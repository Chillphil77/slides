// Calendar view — monthly grid of scheduled posts
const CalendarView = {
  _year: new Date().getFullYear(),
  _month: new Date().getMonth(),
  _posts: [],

  async render() {
    const app = document.getElementById('app');
    app.innerHTML = UI.layout({
      active: 'calendar',
      title: 'Content Calendar',
      subtitle: 'Plan and schedule your publishing pipeline',
      html: '<div id="cal-body"><div class="skeleton" style="height:400px"></div></div>',
    });
    UI.attachGlobal();
    await this._load();
  },

  async _load() {
    try {
      const start = new Date(this._year, this._month, 1);
      const end = new Date(this._year, this._month + 1, 0, 23, 59, 59);
      this._posts = await API.listScheduled({ start: start.toISOString(), end: end.toISOString() });
    } catch { this._posts = []; }
    this._draw();
  },

  _draw() {
    const body = document.getElementById('cal-body');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const first = new Date(this._year, this._month, 1);
    const last = new Date(this._year, this._month + 1, 0);
    const startDay = first.getDay() || 7; // Mon=1
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Group posts by date
    const byDate = {};
    this._posts.forEach((p) => {
      const d = p.scheduled_for.slice(0, 10);
      (byDate[d] = byDate[d] || []).push(p);
    });

    let cells = '';
    // Empty cells before first day
    for (let i = 1; i < startDay; i++) cells += '<div class="cal-day dim"></div>';
    for (let d = 1; d <= last.getDate(); d++) {
      const dateStr = `${this._year}-${String(this._month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const dayPosts = byDate[dateStr] || [];
      cells += `
        <div class="cal-day ${isToday ? 'today' : ''}">
          <div class="num">${d}</div>
          ${dayPosts.map((p) => `
            <div class="post" title="${p.platform} · ${p.status}">${UI.platformIcon(p.platform)} ${p.platform}</div>
          `).join('')}
        </div>
      `;
    }

    body.innerHTML = `
      <div class="card">
        <div class="cal-head">
          <button class="btn sm" id="cal-prev">← Prev</button>
          <h2>${months[this._month]} ${this._year}</h2>
          <button class="btn sm" id="cal-next">Next →</button>
        </div>
        <div class="cal-weekheader">
          ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div>${d}</div>`).join('')}
        </div>
        <div class="cal-grid">${cells}</div>
      </div>

      <div class="card" style="margin-top:20px">
        <div class="card-header"><h3>Scheduled posts this month</h3></div>
        ${this._posts.length === 0 ? '<div class="empty" style="padding:20px">No scheduled posts for this month</div>' : `
          <table class="table">
            <thead><tr><th>Platform</th><th>Scheduled for</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${this._posts.map((p) => `
                <tr>
                  <td>${UI.platformIcon(p.platform)} ${p.platform}</td>
                  <td>${UI.fmtDateTime(p.scheduled_for)}</td>
                  <td>${UI.statusBadge(p.status)}</td>
                  <td>
                    ${p.status === 'scheduled' ? `<button class="btn sm danger" onclick="CalendarView._cancel(${p.id})">Cancel</button>` : ''}
                    <a class="btn sm" href="#/content/${p.content_id}">View</a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;

    document.getElementById('cal-prev').onclick = () => {
      this._month--;
      if (this._month < 0) { this._month = 11; this._year--; }
      this._load();
    };
    document.getElementById('cal-next').onclick = () => {
      this._month++;
      if (this._month > 11) { this._month = 0; this._year++; }
      this._load();
    };
  },

  async _cancel(id) {
    if (!UI.confirm('Cancel this scheduled post?')) return;
    try { await API.cancelScheduled(id); UI.toast('Cancelled', 'success'); await this._load(); } catch (e) { UI.toast(e.message, 'error'); }
  },
};
