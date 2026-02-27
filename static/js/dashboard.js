/* ============================================================
   dashboard.js – Dashboard page logic
   ============================================================ */

// ── Date display ──────────────────────────────────────────
function renderDate() {
  const el = document.getElementById('weatherDate');
  if (!el) return;
  const now = new Date();
  const days = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  el.textContent = `${days[now.getDay()]}, ${now.getDate()}. ${months[now.getMonth()]} ${now.getFullYear()}`;
}

renderDate();

// ── Weather via Open-Meteo (free, no key) ─────────────────
const WMO_ICONS = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌧️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'❄️', 73:'❄️', 75:'❄️',
  77:'🌨️',
  80:'🌦️', 81:'🌧️', 82:'⛈️',
  85:'❄️', 86:'❄️',
  95:'⛈️', 96:'⛈️', 99:'⛈️',
};

const WMO_DESC = {
  0:'Klar', 1:'Größtenteils klar', 2:'Teilweise bewölkt', 3:'Bedeckt',
  45:'Nebel', 48:'Reifnebel',
  51:'Leichter Niesel', 53:'Nieselregen', 55:'Starker Niesel',
  61:'Leichter Regen', 63:'Regen', 65:'Starker Regen',
  71:'Leichter Schneefall', 73:'Schneefall', 75:'Starker Schneefall',
  77:'Schneegriesel',
  80:'Leichte Schauer', 81:'Schauer', 82:'Starke Schauer',
  85:'Leichte Schneeschauer', 86:'Schneeschauer',
  95:'Gewitter', 96:'Gewitter mit Hagel', 99:'Starkes Gewitter',
};

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=celsius&timezone=auto`;
  const res  = await fetch(url);
  const data = await res.json();
  return data.current_weather;
}

async function loadWeather() {
  const iconEl = document.getElementById('weatherIcon');
  const tempEl = document.getElementById('weatherTemp');
  const descEl = document.getElementById('weatherDesc');

  if (!iconEl) return;

  if (!navigator.geolocation) {
    descEl.textContent = 'Ortung nicht verfügbar';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      try {
        const w = await fetchWeather(pos.coords.latitude, pos.coords.longitude);
        iconEl.textContent = WMO_ICONS[w.weathercode] || '🌡️';
        tempEl.textContent = `${Math.round(w.temperature)}°C`;
        descEl.textContent = WMO_DESC[w.weathercode] || '';
      } catch {
        iconEl.textContent = '🌡️';
        descEl.textContent = 'Wetter nicht verfügbar';
      }
    },
    () => {
      iconEl.textContent = '📍';
      tempEl.textContent = '';
      descEl.textContent = 'Standort nicht freigegeben';
    },
    { timeout: 8000, maximumAge: 600000 }
  );
}

loadWeather();

// ── Quick Add article from dashboard ─────────────────────
const dashUrlInput   = document.getElementById('dashUrlInput');
const dashAddBtn     = document.getElementById('dashAddBtn');
const dashStatus     = document.getElementById('dashStatus');
const loadingOverlay = document.getElementById('loadingOverlay');

async function dashAddArticle() {
  const url = dashUrlInput.value.trim();
  if (!url) return;

  setDashStatus('', '');
  dashAddBtn.disabled = true;
  loadingOverlay && loadingOverlay.classList.remove('hidden');

  try {
    const res  = await fetch('/add', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url }),
    });
    const data = await res.json();

    if (res.ok) {
      setDashStatus(`✓ "${data.title}" gespeichert`, 'success');
      dashUrlInput.value = '';
      setTimeout(() => location.reload(), 1200);
    } else if (res.status === 409) {
      setDashStatus(`Bereits gespeichert – Artikel #${data.id}`, 'error');
    } else {
      setDashStatus(data.error || 'Fehler beim Laden', 'error');
    }
  } catch {
    setDashStatus('Netzwerkfehler', 'error');
  } finally {
    dashAddBtn.disabled = false;
    loadingOverlay && loadingOverlay.classList.add('hidden');
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
  setTimeout(() => {
    if (dashUrlInput.value.startsWith('http')) dashAddArticle();
  }, 80);
});
