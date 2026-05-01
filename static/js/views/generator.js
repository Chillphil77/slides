// Content Studio — AI generation with brand CI, docs, reference images
const GeneratorView = {
  _clients: [],
  _docs: [],
  _refs: [],

  async render() {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const preClient = params.get('client') || '';
    const app = document.getElementById('app');
    app.innerHTML = UI.layout({
      active: 'generator',
      title: 'Content Studio',
      subtitle: 'AI-powered content generation with Nano Banana 2',
      html: '<div id="gen-body"><div class="skeleton" style="height:300px"></div></div>',
    });
    UI.attachGlobal();

    try {
      this._clients = await API.listClients();
    } catch { this._clients = []; }

    this._renderForm(preClient);
  },

  _renderForm(preClient) {
    const body = document.getElementById('gen-body');
    body.innerHTML = `
      <div class="grid" style="grid-template-columns:1fr 340px;gap:20px">
        <div>
          <div class="card" style="margin-bottom:16px">
            <h3>Campaign brief</h3>
            <div class="field">
              <label>Client *</label>
              <select id="gen-client">
                <option value="">Select client...</option>
                ${this._clients.map((c) => `<option value="${c.id}" ${String(c.id) === preClient ? 'selected' : ''}>${UI.escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Campaign title</label>
              <input id="gen-title" placeholder="e.g. Summer launch 2026" value="">
            </div>
            <div class="field">
              <label>Creative prompt / brief *</label>
              <textarea id="gen-prompt" rows="4" placeholder="Describe what you want: product launch post, seasonal campaign, event promo..."></textarea>
              <div class="hint">The AI uses this + your brand CI + uploaded docs to generate content</div>
            </div>
            <div class="field">
              <label>Additional context (optional)</label>
              <textarea id="gen-context" rows="2" placeholder="Key dates, promo codes, specific instructions..."></textarea>
            </div>

            <div id="gen-suggest-area" style="display:none;margin-bottom:14px">
              <label style="font-size:12px;font-weight:600;color:var(--ink-2);margin-bottom:6px;display:block">AI text suggestions</label>
              <div id="gen-suggestions" class="chips"></div>
            </div>
            <button class="btn sm" id="gen-suggest-btn" style="margin-bottom:14px">💡 Get text suggestions</button>
          </div>

          <div class="card" style="margin-bottom:16px">
            <h3>Documents for context</h3>
            <p style="font-size:12px;color:var(--muted);margin-bottom:10px">Select documents from the information hub to give the AI more context</p>
            <div id="gen-docs" class="doc-list"><div style="color:var(--muted);font-size:13px">Select a client first</div></div>
          </div>

          <div class="card">
            <h3>Reference images</h3>
            <p style="font-size:12px;color:var(--muted);margin-bottom:10px">The AI uses these as visual references for image generation</p>
            <div id="gen-refs" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px"><div style="color:var(--muted);font-size:13px">Select a client first</div></div>
          </div>
        </div>

        <div>
          <div class="card" style="margin-bottom:16px">
            <h3>Output settings</h3>
            <div class="field">
              <label>Platforms</label>
              <div class="chips" id="gen-platforms">
                ${['instagram', 'facebook', 'linkedin', 'x', 'tiktok', 'pinterest', 'youtube', 'threads'].map((p) =>
                  `<div class="chip ${['instagram', 'facebook'].includes(p) ? 'selected' : ''}" data-val="${p}">${UI.platformIcon(p)} ${p}</div>`
                ).join('')}
              </div>
            </div>
            <div class="field">
              <label>Image formats</label>
              <div class="chips" id="gen-formats">
                ${['1:1', '4:5', '9:16', '16:9', '3:2', '4:1'].map((r) =>
                  `<div class="chip ${['1:1', '4:5', '9:16'].includes(r) ? 'selected' : ''}" data-val="${r}">${r}</div>`
                ).join('')}
              </div>
            </div>
            <div class="field">
              <label>Number of variants</label>
              <select id="gen-variants">
                <option value="2">2 variants</option>
                <option value="3" selected>3 variants</option>
                <option value="5">5 variants</option>
              </select>
            </div>
          </div>
          <button class="btn primary" style="width:100%;padding:14px;font-size:15px" id="gen-go">
            ✨ Generate content
          </button>
          <div id="gen-progress" style="display:none;text-align:center;padding:20px">
            <div class="spinner dark" style="margin:0 auto 10px"></div>
            <div style="color:var(--muted);font-size:13px">Generating variants...</div>
          </div>
        </div>
      </div>

      <div id="gen-results" style="margin-top:24px;display:none"></div>
    `;

    // Chip toggles
    document.querySelectorAll('#gen-platforms .chip, #gen-formats .chip').forEach((c) => {
      c.onclick = () => c.classList.toggle('selected');
    });

    // Client change → load docs + refs
    const clientSel = document.getElementById('gen-client');
    clientSel.onchange = () => this._loadClientAssets(clientSel.value);
    if (preClient) this._loadClientAssets(preClient);

    // Suggest button
    document.getElementById('gen-suggest-btn').onclick = () => this._doSuggest();

    // Generate
    document.getElementById('gen-go').onclick = () => this._doGenerate();
  },

  async _loadClientAssets(cid) {
    if (!cid) return;
    try {
      this._docs = await API.listAssets(cid, 'document');
      this._refs = await API.listAssets(cid, 'reference_image');
    } catch { this._docs = []; this._refs = []; }

    const docsEl = document.getElementById('gen-docs');
    docsEl.innerHTML = this._docs.length === 0
      ? '<div style="color:var(--muted);font-size:13px">No documents uploaded yet. <a href="#/clients/' + cid + '">Upload in client profile</a></div>'
      : this._docs.map((d) => `
        <div class="doc-item" style="cursor:pointer" data-id="${d.id}">
          <input type="checkbox" checked style="margin-right:8px">
          <div class="icon">${d.mime_type.includes('pdf') ? 'PDF' : 'TXT'}</div>
          <div class="info">
            <div class="name">${UI.escapeHtml(d.original_name)}</div>
            <div class="meta">${(d.size_bytes / 1024).toFixed(1)} KB</div>
          </div>
        </div>
      `).join('');

    const refsEl = document.getElementById('gen-refs');
    refsEl.innerHTML = this._refs.length === 0
      ? '<div style="color:var(--muted);font-size:13px">No reference images yet. <a href="#/clients/' + cid + '">Upload in client profile</a></div>'
      : this._refs.map((r) => `
        <div style="position:relative;cursor:pointer;border:2px solid var(--rosa);border-radius:8px;overflow:hidden" data-id="${r.id}">
          <img src="/files/${r.path}" style="width:100%;height:80px;object-fit:cover;display:block">
          <input type="checkbox" checked style="position:absolute;top:4px;left:4px">
        </div>
      `).join('');

    // Toggle selection
    docsEl.querySelectorAll('.doc-item').forEach((el) => {
      el.onclick = (e) => {
        if (e.target.tagName === 'INPUT') return;
        const cb = el.querySelector('input');
        cb.checked = !cb.checked;
      };
    });
    refsEl.querySelectorAll('[data-id]').forEach((el) => {
      el.onclick = (e) => {
        if (e.target.tagName === 'INPUT') return;
        const cb = el.querySelector('input');
        cb.checked = !cb.checked;
        el.style.borderColor = cb.checked ? 'var(--rosa)' : 'var(--border)';
      };
    });
  },

  async _doSuggest() {
    const cid = document.getElementById('gen-client').value;
    const seed = document.getElementById('gen-prompt').value || document.getElementById('gen-title').value;
    if (!cid || !seed) return UI.toast('Select client and type something first', 'info');
    const platforms = [...document.querySelectorAll('#gen-platforms .chip.selected')].map((c) => c.dataset.val);
    try {
      const res = await API.textSuggest({
        client_id: parseInt(cid),
        seed,
        kind: 'caption',
        platform: platforms[0] || 'instagram',
        count: 5,
      });
      const area = document.getElementById('gen-suggest-area');
      area.style.display = 'block';
      const container = document.getElementById('gen-suggestions');
      container.innerHTML = res.suggestions.map((s) =>
        `<div class="chip" style="max-width:100%;white-space:normal;text-align:left;line-height:1.4">${UI.escapeHtml(s)}</div>`
      ).join('');
      container.querySelectorAll('.chip').forEach((c) => {
        c.onclick = () => { document.getElementById('gen-prompt').value = c.textContent; };
      });
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async _doGenerate() {
    const cid = document.getElementById('gen-client').value;
    const prompt = document.getElementById('gen-prompt').value;
    if (!cid) return UI.toast('Select a client', 'error');
    if (!prompt) return UI.toast('Write a creative brief', 'error');

    const platforms = [...document.querySelectorAll('#gen-platforms .chip.selected')].map((c) => c.dataset.val);
    const formats = [...document.querySelectorAll('#gen-formats .chip.selected')].map((c) => c.dataset.val);
    const docIds = [...document.querySelectorAll('#gen-docs input:checked')].map((cb) => parseInt(cb.closest('[data-id]').dataset.id));
    const refIds = [...document.querySelectorAll('#gen-refs input:checked')].map((cb) => parseInt(cb.closest('[data-id]').dataset.id));

    const btn = document.getElementById('gen-go');
    const prog = document.getElementById('gen-progress');
    btn.style.display = 'none';
    prog.style.display = 'block';

    try {
      const content = await API.generate({
        client_id: parseInt(cid),
        title: document.getElementById('gen-title').value || 'Untitled campaign',
        prompt,
        extra_context: document.getElementById('gen-context').value,
        reference_asset_ids: refIds,
        document_asset_ids: docIds,
        platforms,
        formats,
        num_variants: parseInt(document.getElementById('gen-variants').value),
      });
      btn.style.display = '';
      prog.style.display = 'none';
      UI.toast('Content generated!', 'success');
      this._showResults(content);
    } catch (e) {
      btn.style.display = '';
      prog.style.display = 'none';
      UI.toast(e.message, 'error');
    }
  },

  _showResults(content) {
    const el = document.getElementById('gen-results');
    el.style.display = 'block';
    el.innerHTML = `
      <h2 style="margin-bottom:16px">Generated variants — ${UI.escapeHtml(content.title)}</h2>
      <div class="variants">
        ${content.variants.map((v) => `
          <div class="variant-card ${v.selected ? 'selected' : ''}" data-vid="${v.id}">
            <div class="imgs">
              ${(v.image_asset_ids || []).map((aid, i) => `<img src="/api/assets/download/${aid}" alt="${v.aspect_ratios?.[i] || ''}">`).join('')}
            </div>
            <div class="body">
              <div class="label">${UI.escapeHtml(v.label)} · ${UI.escapeHtml(v.provider)}</div>
              <div class="headline">${UI.escapeHtml(v.headline)}</div>
              <div class="caption">${UI.escapeHtml(v.caption)}</div>
              <div style="font-size:12px;color:var(--rosa);font-weight:600;margin-top:4px">${UI.escapeHtml(v.cta)}</div>
              <div class="tags">${(v.hashtags || []).slice(0, 8).map((h) => `<span>${UI.escapeHtml(h)}</span>`).join('')}</div>
            </div>
            <div class="actions">
              <button class="btn sm" onclick="GeneratorView._selectVariant(${content.id}, ${v.id})">Select</button>
              <button class="btn sm primary" onclick="GeneratorView._scheduleModal(${content.id}, ${v.id})">Schedule</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:16px;display:flex;gap:10px">
        <a class="btn" href="#/content/${content.id}">View in library →</a>
        <button class="btn" onclick="GeneratorView._approveContent(${content.id})">✓ Approve</button>
      </div>
    `;
    el.scrollIntoView({ behavior: 'smooth' });
  },

  async _selectVariant(cid, vid) {
    try {
      await API.selectVariant(cid, vid);
      UI.toast('Variant selected', 'success');
      document.querySelectorAll('.variant-card').forEach((c) => c.classList.remove('selected'));
      document.querySelector(`[data-vid="${vid}"]`)?.classList.add('selected');
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async _approveContent(cid) {
    try {
      await API.changeStatus(cid, 'approved');
      UI.toast('Content approved', 'success');
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  _scheduleModal(cid, vid) {
    UI.openModal({
      title: 'Schedule post',
      body: `
        <div class="field"><label>Platform</label>
          <select id="sched-platform">
            ${['instagram', 'facebook', 'linkedin', 'x', 'tiktok'].map((p) => `<option value="${p}">${UI.platformIcon(p)} ${p}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Date &amp; time</label>
          <input type="datetime-local" id="sched-time">
        </div>
      `,
      foot: `
        <button class="btn" onclick="UI.closeModal()">Cancel</button>
        <button class="btn primary" id="sched-save">Schedule</button>
      `,
    });
    // Default to tomorrow at 10:00
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setHours(10, 0, 0, 0);
    document.getElementById('sched-time').value = tomorrow.toISOString().slice(0, 16);

    document.getElementById('sched-save').onclick = async () => {
      const platform = document.getElementById('sched-platform').value;
      const time = document.getElementById('sched-time').value;
      if (!time) return UI.toast('Pick a time', 'error');
      try {
        await API.schedule({
          content_id: cid,
          variant_id: vid,
          platform,
          scheduled_for: new Date(time).toISOString(),
        });
        UI.closeModal();
        UI.toast('Scheduled!', 'success');
      } catch (e) { UI.toast(e.message, 'error'); }
    };
  },
};
