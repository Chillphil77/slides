// Analytics dashboard
const AnalyticsView = {
  async render() {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const preClient = params.get('client') || '';
    const app = document.getElementById('app');
    app.innerHTML = UI.layout({
      active: 'analytics',
      title: 'Analytics',
      subtitle: 'Cross-platform performance insights',
      html: '<div id="an-body"><div class="skeleton" style="height:300px"></div></div>',
    });
    UI.attachGlobal();

    let clients;
    try { clients = await API.listClients(); } catch { clients = []; }
    if (clients.length === 0) {
      document.getElementById('an-body').innerHTML = '<div class="empty card"><h3>No clients</h3><p>Create a client first.</p></div>';
      return;
    }

    const body = document.getElementById('an-body');
    body.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:20px;flex-wrap:wrap">
        <select id="an-client" style="max-width:250px">
          ${clients.map((c) => `<option value="${c.id}" ${String(c.id) === preClient ? 'selected' : ''}>${UI.escapeHtml(c.name)}</option>`).join('')}
        </select>
        <select id="an-days" style="max-width:140px">
          <option value="7">7 days</option>
          <option value="30" selected>30 days</option>
          <option value="60">60 days</option>
          <option value="90">90 days</option>
        </select>
        <button class="btn primary" id="an-refresh">Refresh data</button>
        <button class="btn" id="an-csv">Export CSV</button>
        <button class="btn" id="an-pdf">Export PDF</button>
      </div>
      <div id="an-content"><div class="skeleton" style="height:200px"></div></div>
    `;

    document.getElementById('an-client').onchange = () => this._loadSummary();
    document.getElementById('an-days').onchange = () => this._loadSummary();
    document.getElementById('an-refresh').onclick = () => this._refresh();
    document.getElementById('an-csv').onclick = () => this._exportCSV();
    document.getElementById('an-pdf').onclick = () => this._exportPDF();

    await this._refresh();
  },

  async _refresh() {
    const cid = document.getElementById('an-client').value;
    const days = document.getElementById('an-days').value;
    try {
      await API.refreshAnalytics(cid, days);
    } catch {}
    await this._loadSummary();
  },

  async _loadSummary() {
    const cid = document.getElementById('an-client').value;
    const days = document.getElementById('an-days').value;
    const el = document.getElementById('an-content');
    el.innerHTML = '<div class="skeleton" style="height:200px"></div>';
    try {
      const s = await API.analyticsSummary(cid, days);
      this._draw(s);
    } catch (e) {
      el.innerHTML = `<div class="empty">${UI.escapeHtml(e.message)}</div>`;
    }
  },

  _draw(s) {
    const el = document.getElementById('an-content');
    const engRate = (s.engagement_rate * 100).toFixed(2);
    const daily = s.daily || [];

    // Bar chart data
    const maxImp = Math.max(1, ...daily.map((d) => d.impressions));

    el.innerHTML = `
      <div class="grid cols-4" style="margin-bottom:20px">
        <div class="stat rosa">
          <div class="label">Total impressions</div>
          <div class="value">${UI.fmtNumber(s.total_impressions)}</div>
        </div>
        <div class="stat">
          <div class="label">Reach</div>
          <div class="value">${UI.fmtNumber(s.total_reach)}</div>
        </div>
        <div class="stat">
          <div class="label">Engagement</div>
          <div class="value">${UI.fmtNumber(s.total_engagement)}</div>
          <div class="delta">${engRate}% rate</div>
        </div>
        <div class="stat">
          <div class="label">Clicks</div>
          <div class="value">${UI.fmtNumber(s.total_clicks)}</div>
          <div class="delta">${UI.fmtNumber(s.total_conversions)} conversions</div>
        </div>
      </div>

      <div class="grid cols-3" style="margin-bottom:20px">
        <div class="stat">
          <div class="label">Followers</div>
          <div class="value">${UI.fmtNumber(s.total_followers)}</div>
        </div>
        <div class="stat">
          <div class="label">Ad spend</div>
          <div class="value">&euro;${s.total_spend.toFixed(0)}</div>
        </div>
        <div class="stat">
          <div class="label">Cost per click</div>
          <div class="value">&euro;${s.total_clicks > 0 ? (s.total_spend / s.total_clicks).toFixed(2) : '0.00'}</div>
        </div>
      </div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-header"><h3>Daily impressions</h3></div>
        <div class="bar-chart">
          ${daily.map((d) => `<div class="bar" style="height:${Math.max(2, (d.impressions / maxImp) * 100)}%" data-value="${UI.fmtNumber(d.impressions)} · ${d.date.slice(5)}"></div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Per-platform breakdown</h3></div>
        <table class="table">
          <thead><tr><th>Platform</th><th>Followers</th><th>Impressions</th><th>Reach</th><th>Engagement</th><th>Clicks</th><th>Spend</th></tr></thead>
          <tbody>
            ${Object.entries(s.per_platform).map(([p, m]) => `
              <tr>
                <td>${UI.platformIcon(p)} ${p}</td>
                <td>${UI.fmtNumber(m.followers || 0)}</td>
                <td>${UI.fmtNumber(m.impressions || 0)}</td>
                <td>${UI.fmtNumber(m.reach || 0)}</td>
                <td>${UI.fmtNumber(m.engagement || 0)}</td>
                <td>${UI.fmtNumber(m.clicks || 0)}</td>
                <td>&euro;${(m.spend || 0).toFixed(0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async _exportCSV() {
    const cid = document.getElementById('an-client').value;
    const days = document.getElementById('an-days').value;
    try {
      const blob = await API.exportCSV(cid, days);
      UI.download(blob, `analytics-client-${cid}.csv`);
      UI.toast('CSV downloaded', 'success');
    } catch (e) { UI.toast(e.message, 'error'); }
  },

  async _exportPDF() {
    const cid = document.getElementById('an-client').value;
    const days = document.getElementById('an-days').value;
    try {
      const blob = await API.exportPDF(cid, days);
      UI.download(blob, `report-client-${cid}.pdf`);
      UI.toast('PDF report downloaded', 'success');
    } catch (e) { UI.toast(e.message, 'error'); }
  },
};
