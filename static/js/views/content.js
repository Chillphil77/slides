// Content library — list all generated content, view details
const ContentView = {
  async render(contentId) {
    if (contentId) return this._renderDetail(contentId);
    return this._renderList();
  },

  async _renderList() {
    const app = document.getElementById('app');
    app.innerHTML = UI.layout({
      active: 'content',
      title: 'Content Library',
      subtitle: 'All generated content across clients',
      actions: '<a class="btn primary" href="#/generator">✨ Create new</a>',
      html: '<div id="ct-body"><div class="skeleton" style="height:200px"></div></div>',
    });
    UI.attachGlobal();

    try {
      const items = await API.listContent();
      const clients = await API.listClients();
      const clientMap = Object.fromEntries(clients.map((c) => [c.id, c.name]));
      const body = document.getElementById('ct-body');
      if (items.length === 0) {
        body.innerHTML = '<div class="empty card"><div class="icon">📝</div><h3>No content yet</h3><p>Head to the Content Studio to generate your first campaign.</p></div>';
        return;
      }
      body.innerHTML = `
        <table class="table">
          <thead><tr><th>Title</th><th>Client</th><th>Platforms</th><th>Variants</th><th>Status</th><th>Created</th><th></th></tr></thead>
          <tbody>
            ${items.map((c) => `
              <tr style="cursor:pointer" onclick="location.hash='#/content/${c.id}'">
                <td><strong>${UI.escapeHtml(c.title)}</strong></td>
                <td>${UI.escapeHtml(clientMap[c.client_id] || '?')}</td>
                <td>${(c.platforms || []).map((p) => UI.platformIcon(p)).join(' ')}</td>
                <td>${c.variants ? c.variants.length : 0}</td>
                <td>${UI.statusBadge(c.status)}</td>
                <td>${UI.fmtDate(c.created_at)}</td>
                <td>
                  <button class="btn sm danger" onclick="event.stopPropagation();ContentView._delete(${c.id})">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (e) {
      document.getElementById('ct-body').innerHTML = `<div class="empty">${UI.escapeHtml(e.message)}</div>`;
    }
  },

  async _renderDetail(id) {
    const app = document.getElementById('app');
    app.innerHTML = UI.layout({
      active: 'content',
      title: 'Loading...',
      actions: '<a class="btn" href="#/content">← Content library</a>',
      html: '<div id="ct-body"><div class="skeleton" style="height:200px"></div></div>',
    });
    UI.attachGlobal();

    try {
      const content = await API.getContent(id);
      const comments = await API.listComments(id);
      document.querySelector('.topbar .title h1').textContent = content.title;
      const body = document.getElementById('ct-body');
      body.innerHTML = `
        <div class="grid" style="grid-template-columns:1fr 300px;gap:20px">
          <div>
            <div class="card" style="margin-bottom:16px">
              <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
                ${UI.statusBadge(content.status)}
                <span style="font-size:12px;color:var(--muted)">${(content.platforms || []).map((p) => UI.platformIcon(p) + ' ' + p).join(', ')}</span>
                <span style="font-size:12px;color:var(--muted)">Formats: ${(content.formats || []).join(', ')}</span>
              </div>
              <h3>Brief</h3>
              <p style="color:var(--muted)">${UI.escapeHtml(content.prompt)}</p>
              ${content.extra_context ? `<p style="font-size:12px;color:var(--muted-2)">${UI.escapeHtml(content.extra_context)}</p>` : ''}
            </div>

            <h3 style="margin-bottom:12px">Variants</h3>
            <div class="variants">
              ${content.variants.map((v) => `
                <div class="variant-card ${v.selected ? 'selected' : ''}">
                  <div class="imgs">
                    ${(v.image_asset_ids || []).map((aid, i) => `<img src="/api/assets/download/${aid}" alt="${v.aspect_ratios?.[i] || ''}">`).join('')}
                  </div>
                  <div class="body">
                    <div class="label">${UI.escapeHtml(v.label)} · ${UI.escapeHtml(v.provider)}</div>
                    <div class="headline">${UI.escapeHtml(v.headline)}</div>
                    <div class="caption">${UI.escapeHtml(v.caption)}</div>
                    <div style="font-size:12px;color:var(--rosa);font-weight:600;margin-top:4px">${UI.escapeHtml(v.cta)}</div>
                    <div class="tags">${(v.hashtags || []).slice(0, 12).map((h) => `<span>${UI.escapeHtml(h)}</span>`).join('')}</div>
                    ${v.keywords && v.keywords.length ? `<div style="font-size:11px;color:var(--muted);margin-top:6px">Keywords: ${v.keywords.join(', ')}</div>` : ''}
                  </div>
                  <div class="actions">
                    <button class="btn sm" onclick="ContentView._select(${content.id},${v.id})">Select</button>
                    <button class="btn sm primary" onclick="GeneratorView._scheduleModal(${content.id},${v.id})">Schedule</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div>
            <div class="card" style="margin-bottom:16px">
              <h3>Status</h3>
              <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
                ${['draft', 'in_review', 'approved', 'scheduled'].map((s) => `
                  <button class="btn sm ${content.status === s ? 'primary' : ''}" onclick="ContentView._changeStatus(${content.id},'${s}')">${s.replace('_', ' ')}</button>
                `).join('')}
              </div>
            </div>

            <div class="card">
              <h3>Comments</h3>
              <div id="ct-comments" style="max-height:300px;overflow-y:auto;margin-bottom:12px">
                ${comments.length === 0 ? '<div style="font-size:13px;color:var(--muted);padding:8px">No comments yet</div>' : ''}
                ${comments.map((c) => `
                  <div style="padding:8px;border-bottom:1px solid var(--border)">
                    <div style="font-size:11px;color:var(--muted)">${UI.fmtDateTime(c.created_at)}</div>
                    <div style="font-size:13px;margin-top:4px">${UI.escapeHtml(c.body)}</div>
                  </div>
                `).join('')}
              </div>
              <textarea id="ct-comment-input" rows="2" placeholder="Add a comment..."></textarea>
              <button class="btn sm primary" style="margin-top:6px" onclick="ContentView._addComment(${content.id})">Post comment</button>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      document.getElementById('ct-body').innerHTML = `<div class="empty">${UI.escapeHtml(e.message)}</div>`;
    }
  },

  async _select(cid, vid) {
    try { await API.selectVariant(cid, vid); UI.toast('Selected', 'success'); this._renderDetail(cid); } catch (e) { UI.toast(e.message, 'error'); }
  },

  async _changeStatus(cid, status) {
    try { await API.changeStatus(cid, status); UI.toast('Status updated', 'success'); this._renderDetail(cid); } catch (e) { UI.toast(e.message, 'error'); }
  },

  async _addComment(cid) {
    const input = document.getElementById('ct-comment-input');
    const body = input.value.trim();
    if (!body) return;
    try { await API.addComment(cid, body); input.value = ''; UI.toast('Comment added', 'success'); this._renderDetail(cid); } catch (e) { UI.toast(e.message, 'error'); }
  },

  async _delete(cid) {
    if (!UI.confirm('Delete this content and all variants?')) return;
    try { await API.deleteContent(cid); UI.toast('Deleted', 'success'); this._renderList(); } catch (e) { UI.toast(e.message, 'error'); }
  },
};
