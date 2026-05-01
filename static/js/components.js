// Shared UI helpers
const UI = (() => {
  function toast(msg, type = 'info', ms = 3000) {
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function openModal({ title, body, foot, onClose }) {
    const c = document.getElementById('modal-container');
    c.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h2>${escapeHtml(title)}</h2>
          <button class="btn ghost" id="modal-close">✕</button>
        </div>
        <div class="modal-body">${body || ''}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>
    `;
    c.classList.add('open');
    const close = () => { c.classList.remove('open'); c.innerHTML = ''; if (onClose) onClose(); };
    c.querySelector('#modal-close').onclick = close;
    c.addEventListener('click', (e) => { if (e.target === c) close(); });
    return { close, root: c };
  }

  function closeModal() {
    const c = document.getElementById('modal-container');
    c.classList.remove('open');
    c.innerHTML = '';
  }

  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function fmtNumber(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(n));
  }

  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function statusBadge(status) {
    return `<span class="badge ${status}">${status.replace('_', ' ')}</span>`;
  }

  function platformIcon(p) {
    const map = {
      instagram: '📷', facebook: '👥', linkedin: '💼', x: '𝕏',
      tiktok: '🎵', pinterest: '📌', threads: '@', youtube: '▶',
    };
    return map[p] || '🌐';
  }

  function confirm(msg) { return window.confirm(msg); }

  function sidebar(active) {
    const user = API.getUser();
    const initials = user ? user.full_name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() : 'RR';
    return `
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">R</div>
          <div>
            <div class="brand-name">Rosa Road</div>
            <div class="brand-sub">Studio</div>
          </div>
        </div>
        <nav class="nav">
          <a href="#/" class="${active === 'dashboard' ? 'active' : ''}">📊 Dashboard</a>
          <a href="#/clients" class="${active === 'clients' ? 'active' : ''}">🏢 Clients</a>
          <a href="#/generator" class="${active === 'generator' ? 'active' : ''}">✨ Content Studio</a>
          <a href="#/content" class="${active === 'content' ? 'active' : ''}">📝 Content Library</a>
          <a href="#/calendar" class="${active === 'calendar' ? 'active' : ''}">🗓 Calendar</a>

          <div class="group-title">Research</div>
          <a href="#/research" class="${active === 'research' ? 'active' : ''}">🔎 Keywords &amp; Hashtags</a>

          <div class="group-title">Insights</div>
          <a href="#/analytics" class="${active === 'analytics' ? 'active' : ''}">📈 Analytics</a>
        </nav>
        <div class="user-box">
          <div class="avatar">${initials}</div>
          <div style="flex:1">
            <div class="user-name">${escapeHtml(user ? user.full_name : '')}</div>
            <div class="user-role">${user ? user.role : ''}</div>
          </div>
          <button class="btn sm ghost" id="logout-btn" title="Logout" style="color:#B8B6C1">↩</button>
        </div>
      </aside>
    `;
  }

  function layout({ active, title, subtitle, actions, html }) {
    return `
      <div class="shell">
        ${sidebar(active)}
        <main class="main">
          <div class="topbar">
            <div class="title">
              <h1>${escapeHtml(title)}</h1>
              ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ''}
            </div>
            <div class="actions">${actions || ''}</div>
          </div>
          ${html}
        </main>
      </div>
    `;
  }

  function attachGlobal() {
    const btn = document.getElementById('logout-btn');
    if (btn) btn.onclick = () => { API.clearToken(); location.hash = '#/login'; };
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return {
    toast, openModal, closeModal, escapeHtml, fmtNumber, fmtDate, fmtDateTime,
    statusBadge, platformIcon, confirm, sidebar, layout, attachGlobal, download,
  };
})();
