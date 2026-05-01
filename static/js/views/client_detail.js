// Client detail — tabs: Info, Brand CI, Documents, Assets
const ClientDetailView = {
  _id: null,
  _tab: 'info',

  async render(id) {
    this._id = id;
    const app = document.getElementById('app');
    app.innerHTML = UI.layout({
      active: 'clients',
      title: 'Loading...',
      subtitle: '',
      actions: '<a class="btn" href="#/clients">← Back to clients</a>',
      html: '<div id="cd-body"><div class="skeleton" style="height:200px"></div></div>',
    });
    UI.attachGlobal();

    try {
      const client = await API.getClient(id);
      document.querySelector('.topbar .title h1').textContent = client.name;
      document.querySelector('.topbar .title .sub').textContent = client.industry || 'No industry';
      document.querySelector('.topbar .actions').innerHTML = `
        <a class="btn" href="#/clients">← Clients</a>
        <a class="btn primary" href="#/generator?client=${id}">✨ Generate content</a>
        <a class="btn" href="#/analytics?client=${id}">📈 Analytics</a>
      `;
      this._renderTabs(client);
    } catch (e) {
      document.getElementById('cd-body').innerHTML = `<div class="empty">${UI.escapeHtml(e.message)}</div>`;
    }
  },

  _renderTabs(client) {
    const body = document.getElementById('cd-body');
    body.innerHTML = `
      <div class="tabs" id="cd-tabs">
        <button data-tab="info" class="${this._tab === 'info' ? 'active' : ''}">Info</button>
        <button data-tab="brand" class="${this._tab === 'brand' ? 'active' : ''}">Brand CI</button>
        <button data-tab="docs" class="${this._tab === 'docs' ? 'active' : ''}">Documents</button>
        <button data-tab="assets" class="${this._tab === 'assets' ? 'active' : ''}">Assets</button>
      </div>
      <div id="cd-tab-content"></div>
    `;
    body.querySelectorAll('#cd-tabs button').forEach((btn) => {
      btn.onclick = () => {
        this._tab = btn.dataset.tab;
        body.querySelectorAll('#cd-tabs button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this._showTab(client);
      };
    });
    this._showTab(client);
  },

  async _showTab(client) {
    const el = document.getElementById('cd-tab-content');
    if (this._tab === 'info') return this._showInfo(el, client);
    if (this._tab === 'brand') return this._showBrand(el, client);
    if (this._tab === 'docs') return this._showDocs(el, client);
    if (this._tab === 'assets') return this._showAssets(el, client);
  },

  _showInfo(el, c) {
    el.innerHTML = `
      <div class="card" style="max-width:700px">
        <form id="info-form">
          <div class="row">
            <div class="field"><label>Client name</label><input name="name" value="${UI.escapeHtml(c.name)}"></div>
            <div class="field"><label>Industry</label><input name="industry" value="${UI.escapeHtml(c.industry)}"></div>
          </div>
          <div class="field"><label>Website</label><input name="website" value="${UI.escapeHtml(c.website)}"></div>
          <div class="field"><label>Description</label><textarea name="description">${UI.escapeHtml(c.description)}</textarea></div>
          <div class="row">
            <div class="field"><label>Contact email</label><input name="contact_email" value="${UI.escapeHtml(c.contact_email)}"></div>
            <div class="field"><label>Phone</label><input name="contact_phone" value="${UI.escapeHtml(c.contact_phone)}"></div>
          </div>
          <button type="submit" class="btn primary">Save changes</button>
        </form>
      </div>
    `;
    el.querySelector('#info-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await API.updateClient(c.id, Object.fromEntries(fd.entries()));
        UI.toast('Client updated', 'success');
      } catch (err) { UI.toast(err.message, 'error'); }
    };
  },

  async _showBrand(el, client) {
    el.innerHTML = '<div class="skeleton" style="height:180px"></div>';
    try {
      const ci = await API.getBrandCI(client.id);
      el.innerHTML = `
        <div class="card" style="max-width:820px">
          <h3>Brand Corporate Identity</h3>
          <p style="color:var(--muted);font-size:13px;margin-bottom:18px">These settings are used by the AI to generate on-brand content for this client.</p>
          <form id="brand-form">
            <h3 style="font-size:14px;margin-top:16px">Visual Identity</h3>
            <div class="row">
              <div class="field">
                <label>Primary color</label>
                <div class="color-row">
                  <input type="color" name="primary_color" value="${ci.primary_color || '#E0115F'}">
                  <input type="text" name="primary_color_hex" value="${UI.escapeHtml(ci.primary_color)}" style="max-width:120px">
                </div>
              </div>
              <div class="field">
                <label>Secondary color</label>
                <div class="color-row">
                  <input type="color" name="secondary_color" value="${ci.secondary_color || '#111111'}">
                  <input type="text" name="secondary_color_hex" value="${UI.escapeHtml(ci.secondary_color)}" style="max-width:120px">
                </div>
              </div>
              <div class="field">
                <label>Accent color</label>
                <div class="color-row">
                  <input type="color" name="accent_color" value="${ci.accent_color || '#F5F5F5'}">
                  <input type="text" name="accent_color_hex" value="${UI.escapeHtml(ci.accent_color)}" style="max-width:120px">
                </div>
              </div>
            </div>
            <div class="row">
              <div class="field"><label>Heading font</label><input name="font_heading" value="${UI.escapeHtml(ci.font_heading)}"></div>
              <div class="field"><label>Body font</label><input name="font_body" value="${UI.escapeHtml(ci.font_body)}"></div>
            </div>

            <h3 style="font-size:14px;margin-top:24px">Verbal Identity</h3>
            <div class="row">
              <div class="field"><label>Brand voice</label><input name="voice" value="${UI.escapeHtml(ci.voice)}" placeholder="e.g. confident, warm, direct"></div>
              <div class="field"><label>Tone</label><input name="tone" value="${UI.escapeHtml(ci.tone)}" placeholder="e.g. friendly, professional"></div>
            </div>
            <div class="field"><label>Tagline</label><input name="tagline" value="${UI.escapeHtml(ci.tagline)}"></div>
            <div class="field"><label>Target audience</label><textarea name="target_audience" rows="2">${UI.escapeHtml(ci.target_audience)}</textarea></div>
            <div class="field"><label>Key messages</label><textarea name="key_messages" rows="2">${UI.escapeHtml(ci.key_messages)}</textarea></div>
            <div class="row">
              <div class="field"><label>DO use these words</label><textarea name="do_words" rows="2" placeholder="Comma separated">${UI.escapeHtml(ci.do_words)}</textarea></div>
              <div class="field"><label>DON'T use these words</label><textarea name="dont_words" rows="2" placeholder="Comma separated">${UI.escapeHtml(ci.dont_words)}</textarea></div>
            </div>
            <div class="field"><label>Additional guidelines</label><textarea name="guidelines" rows="3">${UI.escapeHtml(ci.guidelines)}</textarea></div>
            <button type="submit" class="btn primary">Save Brand CI</button>
          </form>
        </div>
      `;
      // Sync color pickers with text inputs
      el.querySelectorAll('input[type=color]').forEach((cp) => {
        const txt = cp.parentElement.querySelector('input[type=text]');
        cp.oninput = () => { txt.value = cp.value; };
        txt.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(txt.value)) cp.value = txt.value; };
      });
      el.querySelector('#brand-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {};
        ['primary_color', 'secondary_color', 'accent_color'].forEach((k) => {
          data[k] = fd.get(k);
        });
        ['font_heading', 'font_body', 'voice', 'tone', 'tagline', 'target_audience',
         'key_messages', 'do_words', 'dont_words', 'guidelines'].forEach((k) => {
          data[k] = fd.get(k);
        });
        try {
          await API.updateBrandCI(client.id, data);
          UI.toast('Brand CI saved', 'success');
        } catch (err) { UI.toast(err.message, 'error'); }
      };
    } catch (e) {
      el.innerHTML = `<div class="empty">${UI.escapeHtml(e.message)}</div>`;
    }
  },

  async _showDocs(el, client) {
    el.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    try {
      const docs = await API.listAssets(client.id, 'document');
      el.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3>Information Hub</h3>
            <label class="btn primary" style="cursor:pointer">
              + Upload document
              <input type="file" id="doc-upload" accept=".pdf,.txt,.md,.csv,.json,.html" style="display:none" multiple>
            </label>
          </div>
          <p style="color:var(--muted);font-size:13px;margin-bottom:14px">Upload briefs, brand guidelines, market research, competitor analysis — the AI uses these as context when generating content.</p>
          <div class="doc-list" id="doc-list">
            ${docs.length === 0 ? '<div class="empty" style="padding:20px"><h3>No documents yet</h3><p>Upload PDFs, text files, or markdown to build the knowledge base.</p></div>' : ''}
            ${docs.map((d) => `
              <div class="doc-item">
                <div class="icon">${d.mime_type.includes('pdf') ? 'PDF' : 'TXT'}</div>
                <div class="info">
                  <div class="name">${UI.escapeHtml(d.original_name)}</div>
                  <div class="meta">${(d.size_bytes / 1024).toFixed(1)} KB · ${UI.fmtDate(d.created_at)}</div>
                </div>
                <button class="btn sm danger" data-del="${d.id}">Delete</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      el.querySelector('#doc-upload').onchange = async (e) => {
        for (const f of e.target.files) {
          try {
            await API.uploadAsset(client.id, 'document', f);
            UI.toast(`Uploaded ${f.name}`, 'success');
          } catch (err) { UI.toast(err.message, 'error'); }
        }
        this._showDocs(el, client);
      };
      el.querySelectorAll('[data-del]').forEach((btn) => {
        btn.onclick = async () => {
          if (!UI.confirm('Delete this document?')) return;
          try { await API.deleteAsset(btn.dataset.del); UI.toast('Deleted', 'success'); } catch (err) { UI.toast(err.message, 'error'); }
          this._showDocs(el, client);
        };
      });
    } catch (e) {
      el.innerHTML = `<div class="empty">${UI.escapeHtml(e.message)}</div>`;
    }
  },

  async _showAssets(el, client) {
    el.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    try {
      const [refs, logos] = await Promise.all([
        API.listAssets(client.id, 'reference_image'),
        API.listAssets(client.id, 'logo'),
      ]);
      const all = [...logos, ...refs];
      el.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3>Reference images &amp; logos</h3>
            <div style="display:flex;gap:8px">
              <label class="btn" style="cursor:pointer">
                + Logo <input type="file" id="logo-upload" accept="image/*" style="display:none">
              </label>
              <label class="btn primary" style="cursor:pointer">
                + Reference image <input type="file" id="ref-upload" accept="image/*" style="display:none" multiple>
              </label>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px" id="asset-grid">
            ${all.length === 0 ? '<div class="empty" style="padding:20px;grid-column:1/-1"><h3>No assets yet</h3><p>Upload logos and reference images for AI-guided content generation.</p></div>' : ''}
            ${all.map((a) => `
              <div style="position:relative;border:1px solid var(--border);border-radius:10px;overflow:hidden">
                <img src="/files/${a.path}" style="width:100%;height:120px;object-fit:cover;display:block">
                <div style="padding:6px 8px;font-size:11px">
                  <span class="badge ${a.kind === 'logo' ? 'approved' : 'in_review'}">${a.kind}</span>
                </div>
                <button class="btn sm danger" style="position:absolute;top:4px;right:4px;padding:2px 6px" data-del="${a.id}">×</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      el.querySelector('#logo-upload').onchange = async (e) => {
        for (const f of e.target.files) {
          try { await API.uploadAsset(client.id, 'logo', f); UI.toast('Logo uploaded', 'success'); } catch (err) { UI.toast(err.message, 'error'); }
        }
        this._showAssets(el, client);
      };
      el.querySelector('#ref-upload').onchange = async (e) => {
        for (const f of e.target.files) {
          try { await API.uploadAsset(client.id, 'reference_image', f); UI.toast('Image uploaded', 'success'); } catch (err) { UI.toast(err.message, 'error'); }
        }
        this._showAssets(el, client);
      };
      el.querySelectorAll('[data-del]').forEach((btn) => {
        btn.onclick = async () => {
          if (!UI.confirm('Delete?')) return;
          try { await API.deleteAsset(btn.dataset.del); UI.toast('Deleted', 'success'); } catch (err) { UI.toast(err.message, 'error'); }
          this._showAssets(el, client);
        };
      });
    } catch (e) {
      el.innerHTML = `<div class="empty">${UI.escapeHtml(e.message)}</div>`;
    }
  },
};
