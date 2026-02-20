/* ============================================================
   app.js  –  List page logic
   ============================================================ */

const urlInput      = document.getElementById('urlInput');
const addBtn        = document.getElementById('addBtn');
const addStatus     = document.getElementById('addStatus');
const loadingOverlay = document.getElementById('loadingOverlay');

// ---- Dark mode (persisted) ----
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') document.body.classList.add('dark');

// ---- Add article ----
async function addArticle() {
  const url = urlInput.value.trim();
  if (!url) return;

  setStatus('', '');
  addBtn.disabled  = true;
  loadingOverlay.classList.remove('hidden');

  try {
    const res = await fetch('/add', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url }),
    });
    const data = await res.json();

    if (res.ok) {
      setStatus(`✓ "${data.title}" gespeichert`, 'success');
      urlInput.value = '';
      setTimeout(() => location.reload(), 900);
    } else if (res.status === 409) {
      setStatus(`Bereits gespeichert – öffne Artikel #${data.id}`, 'error');
    } else {
      setStatus(data.error || 'Fehler beim Laden', 'error');
    }
  } catch (e) {
    setStatus('Netzwerkfehler – bitte prüfe die Verbindung', 'error');
  } finally {
    addBtn.disabled = false;
    loadingOverlay.classList.add('hidden');
  }
}

function setStatus(msg, type) {
  addStatus.textContent = msg;
  addStatus.className   = 'add-status ' + type;
}

addBtn.addEventListener('click', addArticle);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') addArticle(); });

// Paste & go: if user pastes a URL, auto-trigger after short delay
urlInput.addEventListener('paste', () => {
  setTimeout(() => {
    if (urlInput.value.startsWith('http')) addArticle();
  }, 80);
});

// ---- Card actions (star / read / delete) ----
document.addEventListener('click', async e => {
  const btn = e.target.closest('.action-btn');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  const id = btn.dataset.id;

  if (btn.classList.contains('star-btn')) {
    const res  = await fetch(`/api/article/${id}/star`, { method: 'POST' });
    const data = await res.json();
    btn.classList.toggle('active', data.starred);
    const path = btn.querySelector('polygon') || btn.querySelector('path');
    if (path && path.tagName === 'polygon') {
      path.setAttribute('fill', data.starred ? 'currentColor' : 'none');
    }
  }

  if (btn.classList.contains('read-btn')) {
    const res  = await fetch(`/api/article/${id}/read`, { method: 'POST' });
    const data = await res.json();
    btn.classList.toggle('active', data.read);
    btn.closest('.card').classList.toggle('card--read', data.read);
  }

  if (btn.classList.contains('delete-btn')) {
    const card = btn.closest('.card');
    card.style.transition = 'opacity .25s, transform .25s';
    card.style.opacity    = '0';
    card.style.transform  = 'scale(.95)';
    await fetch(`/api/article/${id}`, { method: 'DELETE' });
    setTimeout(() => card.remove(), 280);
  }
});
