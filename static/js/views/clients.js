const ClientsView = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = UI.layout({
      active: 'clients',
      title: 'Clients',
      subtitle: 'Manage your agency portfolio',
      actions: `<button class="btn primary" id="new-client">+ New client</button>`,
      html: '<div id="clients-body"><div class="skeleton" style="height:100px"></div></div>',
    });
    UI.attachGlobal();
    document.getElementById('new-client').onclick = () => this._openNewClient();

    try {
      const clients = await API.listClients();
      const body = document.getElementById('clients-body');
      if (clients.length === 0) {
        body.innerHTML = `<div class="empty card"><div class="icon">🏢</div><h3>No clients yet</h3><p>Create your first client workspace to start building content.</p><button class="btn primary" id="new-client-2">+ New client</button></div>`;
        document.getElementById('new-client-2').onclick = () => this._openNewClient();
        return;
      }
      body.innerHTML = `
        <div class="grid cols-3">
          ${clients.map((c) => `
            <a href="#/clients/${c.id}" class="card" style="text-decoration:none;color:inherit;display:block;transition:all .15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='var(--shadow)'" onmouseout="this.style.transform='';this.style.boxShadow='var(--shadow-sm)'">
              <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
                <div style="width:44px;height:44px;border-radius:12px;background:var(--rosa);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:var(--font-display);font-size:18px">${UI.escapeHtml(c.name[0] || '?').toUpperCase()}</div>
                <div>
                  <h3 style="margin:0">${UI.escapeHtml(c.name)}</h3>
                  <div style="font-size:12px;color:var(--muted)">${UI.escapeHtml(c.industry || 'No industry')}</div>
                </div>
              </div>
              <p style="color:var(--muted);font-size:12px;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${UI.escapeHtml(c.description || 'No description')}</p>
              <div style="margin-top:12px;font-size:11px;color:var(--muted)">Added ${UI.fmtDate(c.created_at)}</div>
            </a>
          `).join('')}
        </div>
      `;
    } catch (e) {
      document.getElementById('clients-body').innerHTML = `<div class="empty">${UI.escapeHtml(e.message)}</div>`;
    }
  },

  _openNewClient() {
    UI.openModal({
      title: 'New client',
      body: `
        <form id="new-client-form">
          <div class="field"><label>Client name *</label><input name="name" required></div>
          <div class="row">
            <div class="field"><label>Industry</label><input name="industry" placeholder="e.g. Fashion, SaaS"></div>
            <div class="field"><label>Website</label><input name="website" placeholder="https://..."></div>
          </div>
          <div class="field"><label>Description</label><textarea name="description" placeholder="What does this brand do?"></textarea></div>
          <div class="row">
            <div class="field"><label>Contact email</label><input name="contact_email" type="email"></div>
            <div class="field"><label>Contact phone</label><input name="contact_phone"></div>
          </div>
        </form>
      `,
      foot: `
        <button class="btn" onclick="UI.closeModal()">Cancel</button>
        <button class="btn primary" id="save-client">Create client</button>
      `,
    });
    document.getElementById('save-client').onclick = async () => {
      const fd = new FormData(document.getElementById('new-client-form'));
      const p = Object.fromEntries(fd.entries());
      if (!p.name) return UI.toast('Name required', 'error');
      try {
        const c = await API.createClient(p);
        UI.closeModal();
        UI.toast('Client created', 'success');
        location.hash = `#/clients/${c.id}`;
      } catch (e) {
        UI.toast(e.message, 'error');
      }
    };
  },
};
