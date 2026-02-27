/* ============================================================
   dashboard.js – Dashboard with gamification + Chart.js
   ============================================================ */

// ── Chart.js global defaults ──────────────────────────────
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
  Chart.defaults.color = getComputedStyle(document.documentElement)
    .getPropertyValue('--text-muted').trim() || '#6b6b6b';
}

const isDark = () => document.getElementById('appBody')?.classList.contains('dark');

// ── Date display ──────────────────────────────────────────
(function renderDate() {
  const el = document.getElementById('weatherDate');
  if (!el) return;
  const now = new Date();
  const days   = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  el.textContent = `${days[now.getDay()]}, ${now.getDate()}. ${months[now.getMonth()]} ${now.getFullYear()}`;
})();

// ── Weather (Open-Meteo, free) ────────────────────────────
const WMO_ICON = { 0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',71:'❄️',73:'❄️',75:'❄️',77:'🌨️',80:'🌦️',81:'🌧️',82:'⛈️',85:'❄️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️' };
const WMO_TEXT = { 0:'Klar',1:'Fast klar',2:'Teilweise bewölkt',3:'Bedeckt',45:'Nebel',48:'Reifnebel',51:'Leichter Niesel',53:'Niesel',55:'Starker Niesel',61:'Leichter Regen',63:'Regen',65:'Starker Regen',71:'Leichter Schnee',73:'Schneefall',75:'Starker Schnee',77:'Schneegriesel',80:'Leichte Schauer',81:'Schauer',82:'Starke Schauer',85:'Schneeschauer',86:'Schneeschauer',95:'Gewitter',96:'Gewitter+Hagel',99:'Starkes Gewitter' };

async function loadWeather() {
  const iconEl = document.getElementById('weatherIcon');
  const tempEl = document.getElementById('weatherTemp');
  const descEl = document.getElementById('weatherDesc');
  if (!iconEl) return;

  if (!navigator.geolocation) { descEl.textContent = 'Keine Ortung'; return; }

  navigator.geolocation.getCurrentPosition(
    async ({ coords: { latitude, longitude } }) => {
      try {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`);
        const d = await r.json();
        const w = d.current_weather;
        iconEl.textContent = WMO_ICON[w.weathercode] || '🌡️';
        tempEl.textContent = `${Math.round(w.temperature)}°C`;
        descEl.textContent = WMO_TEXT[w.weathercode] || '';
      } catch { descEl.textContent = 'Nicht verfügbar'; }
    },
    () => { iconEl.textContent = '📍'; tempEl.textContent = ''; descEl.textContent = 'Standort nicht freigegeben'; },
    { timeout: 8000, maximumAge: 600000 }
  );
}

loadWeather();

// ── Weekly goal (localStorage) ───────────────────────────
const GOAL_KEY = 'noozly_weekly_goal';
function getGoal() { return parseInt(localStorage.getItem(GOAL_KEY) || '5'); }
function saveGoal(v) { localStorage.setItem(GOAL_KEY, String(v)); }

// Goal modal
const goalModal    = document.getElementById('goalModal');
const goalEditBtn  = document.getElementById('goalEditBtn');
const goalSaveBtn  = document.getElementById('goalSaveBtn');
const goalCancelBtn= document.getElementById('goalCancelBtn');
const goalInput    = document.getElementById('goalInput');

goalEditBtn && goalEditBtn.addEventListener('click', () => {
  if (goalInput) goalInput.value = getGoal();
  document.querySelectorAll('.goal-preset-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.val) === getGoal());
  });
  goalModal && goalModal.classList.remove('hidden');
});

document.querySelectorAll('.goal-preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.goal-preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (goalInput) goalInput.value = btn.dataset.val;
  });
});

goalSaveBtn && goalSaveBtn.addEventListener('click', () => {
  const v = parseInt(goalInput?.value || '5');
  if (v >= 1) { saveGoal(v); goalModal?.classList.add('hidden'); updateGoalRing(window._statsCache); }
});

goalCancelBtn && goalCancelBtn.addEventListener('click', () => goalModal?.classList.add('hidden'));
goalModal && goalModal.addEventListener('click', e => { if (e.target === goalModal) goalModal.classList.add('hidden'); });

// ── Stats → UI ────────────────────────────────────────────
window._statsCache = null;

async function loadStats() {
  try {
    const r    = await fetch('/api/stats');
    const data = await r.json();
    window._statsCache = data;
    renderAll(data);
  } catch (e) {
    console.warn('Stats error:', e);
  }
}

function renderAll(d) {
  renderStreak(d);
  renderLevel(d);
  updateGoalRing(d);
  renderReadingTime(d);
  renderStatCards(d);
  renderBarChart(d);
  renderDonutChart(d);
  renderAchievements(d);
}

// Streak
function renderStreak(d) {
  const numEl = document.getElementById('streakNumber');
  const subEl = document.getElementById('streakSub');
  const fireEl= document.getElementById('streakFire');
  if (!numEl) return;

  const s = d.streak || 0;
  numEl.textContent = s;

  if (s === 0) {
    subEl && (subEl.textContent = 'Starte heute deinen Streak!');
    fireEl && (fireEl.style.opacity = '.4');
  } else if (s === 1) {
    subEl && (subEl.textContent = '1 Tag – weiter so!');
  } else if (s < 7) {
    subEl && (subEl.textContent = `${s} Tage – bleib dran! 💪`);
  } else if (s < 30) {
    subEl && (subEl.textContent = `Wow, ${s} Tage! Fantastisch! 🔥`);
  } else {
    subEl && (subEl.textContent = `${s} Tage – du bist unaufhaltsam! 👑`);
  }
}

// Level
function renderLevel(d) {
  const lv   = d.level || {};
  const iconEl= document.getElementById('levelIcon');
  const numEl = document.getElementById('levelNum');
  const nameEl= document.getElementById('levelName');
  const barEl = document.getElementById('xpBar');
  const lblEl = document.getElementById('xpLabel');

  if (iconEl) iconEl.textContent = lv.icon || '📗';
  if (numEl)  numEl.textContent  = `Lv. ${lv.level || 1}`;
  if (nameEl) nameEl.textContent = lv.name || 'Neuling';
  if (numEl && lv.color) numEl.style.background = lv.color;

  // Animate XP bar after short delay
  if (barEl) {
    barEl.style.width = '0%';
    setTimeout(() => { barEl.style.width = `${lv.progress || 0}%`; }, 200);
  }

  if (lblEl) {
    const xpPart = `${(lv.xp || 0).toLocaleString('de')} XP`;
    const nextPart = lv.next_name ? ` · nächstes Level: ${lv.next_name} in ${(lv.xp_to_next || 0)} XP` : ' · Max. Level!';
    lblEl.textContent = xpPart + nextPart;
  }
}

// Weekly goal ring
function updateGoalRing(d) {
  if (!d) return;
  const goal    = getGoal();
  const current = d.total_read || 0; // reads this week from API
  const weekRead= d.chart_data ? d.chart_data.reduce((a,b) => a+b, 0) : 0;

  const curEl = document.getElementById('goalCurrent');
  const tgtEl = document.getElementById('goalTarget');
  const ring  = document.getElementById('goalRingFill');

  if (curEl) curEl.textContent = weekRead;
  if (tgtEl) tgtEl.textContent = goal;

  if (ring) {
    const circ  = 113.1; // 2π × 18
    const pct   = Math.min(1, weekRead / Math.max(1, goal));
    const offset= circ - pct * circ;
    ring.style.stroke = weekRead >= goal ? '#059669' : '#2563eb';
    setTimeout(() => { ring.style.strokeDashoffset = offset; }, 300);
  }
}

// Reading time
function renderReadingTime(d) {
  const mins = d.reading_mins || 0;
  const numEl= document.getElementById('timeNumber');
  const subEl= document.getElementById('timeSub');
  if (!numEl) return;
  numEl.textContent = mins.toLocaleString('de');
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  subEl && (subEl.textContent = h > 0 ? `≈ ${h} Std. ${m > 0 ? m + ' Min.' : ''}` : `${m} Min. heute`);
}

// Stat cards
function renderStatCards(d) {
  setText('statSaved',   d.total_saved   ?? '–');
  setText('statUnread',  (d.total_saved - d.total_read) || 0);
  setText('statRead',    d.total_read    ?? '–');
  setText('statStarred', d.total_starred ?? '–');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Bar Chart ─────────────────────────────────────────────
let barChartInst = null;

function renderBarChart(d) {
  const ctx = document.getElementById('barChart');
  if (!ctx || typeof Chart === 'undefined') return;

  const labels   = d.chart_labels || [];
  const data     = d.chart_data   || [];
  const weekTotal= data.reduce((a, b) => a + b, 0);

  const badge = document.getElementById('weekTotalBadge');
  if (badge) badge.textContent = `${weekTotal} diese Woche`;

  const dark = isDark();
  const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 160);
  gradient.addColorStop(0,   'rgba(37,99,235,.85)');
  gradient.addColorStop(1,   'rgba(124,58,237,.3)');

  if (barChartInst) barChartInst.destroy();

  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Artikel gelesen',
        data,
        backgroundColor: gradient,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} Artikel`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: dark ? '#999' : '#6b7280', font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)' },
          border: { display: false },
          ticks: {
            stepSize: 1,
            color: dark ? '#999' : '#6b7280',
            font: { size: 11 }
          }
        }
      }
    }
  });
}

// ── Donut Chart ───────────────────────────────────────────
let donutChartInst = null;

const DONUT_COLORS = ['#2563eb','#7c3aed','#059669','#d97706','#dc2626','#0891b2'];

function renderDonutChart(d) {
  const ctx    = document.getElementById('donutChart');
  const legend = document.getElementById('donutLegend');
  if (!ctx || typeof Chart === 'undefined') return;

  const sources = d.top_sources || [];

  if (sources.length === 0) {
    if (legend) legend.innerHTML = '<div style="font-size:.82rem;color:var(--text-muted);padding:.5rem 0">Noch keine Lesedaten</div>';
    return;
  }

  const labels = sources.map(s => s.name);
  const counts = sources.map(s => s.count);

  if (donutChartInst) donutChartInst.destroy();

  donutChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: counts,
        backgroundColor: DONUT_COLORS.slice(0, sources.length),
        borderWidth: 2,
        borderColor: isDark() ? '#1e1e1e' : '#ffffff',
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} Artikel` }
        }
      }
    }
  });

  // Custom legend
  if (legend) {
    legend.innerHTML = sources.map((s, i) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${DONUT_COLORS[i]}"></span>
        <span class="legend-name" title="${s.name}">${s.name}</span>
        <span class="legend-count">${s.count}</span>
      </div>
    `).join('');
  }
}

// ── Achievements ──────────────────────────────────────────
function renderAchievements(d) {
  const grid = document.getElementById('achievementsGrid');
  const prog = document.getElementById('achieveProgress');
  if (!grid) return;

  const items    = d.achievements || [];
  const unlocked = items.filter(a => a.unlocked).length;
  if (prog) prog.textContent = `${unlocked} von ${items.length} freigeschaltet`;

  grid.innerHTML = items.map(a => `
    <div class="achieve-card ${a.unlocked ? 'achieve-card--unlocked' : 'achieve-card--locked'}"
         title="${a.desc}">
      ${a.unlocked ? '<div class="achieve-check">✓</div>' : ''}
      <div class="achieve-icon">${a.icon}</div>
      <div class="achieve-name">${a.name}</div>
      <div class="achieve-desc">${a.desc}</div>
    </div>
  `).join('');

  // Pop-in animation for unlocked ones
  grid.querySelectorAll('.achieve-card--unlocked').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'scale(.8)';
    el.style.transition = 'opacity .35s, transform .35s';
    setTimeout(() => {
      el.style.opacity = '1';
      el.style.transform = 'scale(1)';
    }, 80 + i * 60);
  });
}

// ── Quick Add ─────────────────────────────────────────────
const dashUrlInput   = document.getElementById('dashUrlInput');
const dashAddBtn     = document.getElementById('dashAddBtn');
const dashStatus     = document.getElementById('dashStatus');
const loadingOverlay = document.getElementById('loadingOverlay');

async function dashAddArticle() {
  const url = dashUrlInput?.value.trim();
  if (!url) return;
  setDashStatus('', '');
  if (dashAddBtn) dashAddBtn.disabled = true;
  loadingOverlay?.classList.remove('hidden');

  try {
    const res  = await fetch('/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();

    if (res.ok) {
      setDashStatus(`✓ "${data.title}" gespeichert`, 'success');
      if (dashUrlInput) dashUrlInput.value = '';
      setTimeout(() => location.reload(), 1100);
    } else if (res.status === 409) {
      setDashStatus(`Bereits gespeichert`, 'error');
    } else {
      setDashStatus(data.error || 'Fehler beim Laden', 'error');
    }
  } catch { setDashStatus('Netzwerkfehler', 'error'); }
  finally {
    if (dashAddBtn) dashAddBtn.disabled = false;
    loadingOverlay?.classList.add('hidden');
  }
}

function setDashStatus(msg, type) {
  if (!dashStatus) return;
  dashStatus.textContent = msg;
  dashStatus.className   = 'add-status ' + type;
}

dashAddBtn  && dashAddBtn.addEventListener('click', dashAddArticle);
dashUrlInput && dashUrlInput.addEventListener('keydown', e => { if (e.key === 'Enter') dashAddArticle(); });
dashUrlInput && dashUrlInput.addEventListener('paste', () => {
  setTimeout(() => { if (dashUrlInput.value.startsWith('http')) dashAddArticle(); }, 80);
});

// ── Username ──────────────────────────────────────────────
(function applyGreetName() {
  const el   = document.getElementById('greetName');
  const name = localStorage.getItem('noozly_username');
  if (el && name) el.textContent = name;
})();

// ── Init ──────────────────────────────────────────────────
loadStats();
