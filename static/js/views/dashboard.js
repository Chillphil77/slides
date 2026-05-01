const DashboardView = {
  async render() {
    const app = document.getElementById('app');
    app.innerHTML = UI.layout({
      active: 'dashboard',
      title: 'Dashboard',
      subtitle: 'Your agency at a glance',
      actions: `<a class="btn primary" href="#/generator">✨ New content</a>`,
      html: '<div id="dash-body"><div class="skeleton" style="height:200px"></div></div>',
    });
    UI.attachGlobal();

    try {
      const data = await API.dashboard();
      document.getElementById('dash-body').innerHTML = this._html(data);
    } catch (e) {
      document.getElementById('dash-body').innerHTML = `<div class="empty">${UI.escapeHtml(e.message)}</div>`;
    }
  },

  _html(d) {
    const last = d.last_30_days;
    const pipe = d.pipeline;
    return `
      <div class="grid cols-4" style="margin-bottom:20px">
        <div class="stat rosa">
          <div class="label">Active clients</div>
          <div class="value">${d.clients}</div>
          <div class="delta">Agency portfolio</div>
        </div>
        <div class="stat">
          <div class="label">30-day impressions</div>
          <div class="value">${UI.fmtNumber(last.impressions)}</div>
          <div class="delta">Across all clients</div>
        </div>
        <div class="stat">
          <div class="label">Engagement</div>
          <div class="value">${UI.fmtNumber(last.engagement)}</div>
          <div class="delta">${last.impressions > 0 ? ((last.engagement / last.impressions) * 100).toFixed(2) : '0.00'}% rate</div>
        </div>
        <div class="stat">
          <div class="label">Ad spend (30d)</div>
          <div class="value">€${last.spend.toFixed(0)}</div>
          <div class="delta">${UI.fmtNumber(last.clicks)} clicks</div>
        </div>
      </div>

      <div class="grid cols-2">
        <div class="card">
          <div class="card-header"><h3>Content pipeline</h3></div>
          <div class="grid cols-5" style="gap:10px">
            ${['draft', 'in_review', 'approved', 'scheduled', 'published'].map((k) => `
              <div style="padding:12px;background:var(--bg-2);border-radius:10px;text-align:center">
                <div style="font-size:11px;text-transform:uppercase;color:var(--muted);font-weight:600">${k.replace('_', ' ')}</div>
                <div style="font-family:var(--font-display);font-size:24px;font-weight:700;margin-top:4px">${pipe[k]}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Upcoming posts</h3><a class="btn sm" href="#/calendar">View calendar →</a></div>
          ${d.upcoming_posts.length === 0 ? '<div class="empty" style="padding:20px">No scheduled posts yet</div>' : `
            <table class="table">
              <thead><tr><th>Platform</th><th>When</th><th>Status</th></tr></thead>
              <tbody>
                ${d.upcoming_posts.map((p) => `
                  <tr>
                    <td>${UI.platformIcon(p.platform)} ${p.platform}</td>
                    <td>${UI.fmtDateTime(p.scheduled_for)}</td>
                    <td>${UI.statusBadge(p.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  },
};
