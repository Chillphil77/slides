/* ============================================================
   base.js – Shared logic for all pages
   ============================================================ */

// ── Theme ──────────────────────────────────────────────────
const body        = document.getElementById('appBody');
const themeToggle = document.getElementById('themeToggle');

if (localStorage.getItem('theme') === 'dark') body.classList.add('dark');

themeToggle && themeToggle.addEventListener('click', () => {
  body.classList.toggle('dark');
  localStorage.setItem('theme', body.classList.contains('dark') ? 'dark' : 'light');
});

// ── Username (localStorage) ────────────────────────────────
const USERNAME_KEY = 'noozly_username';

function getUsername() {
  return localStorage.getItem(USERNAME_KEY) || '';
}

function setUsername(name) {
  localStorage.setItem(USERNAME_KEY, name.trim());
}

function applyUsername() {
  const name = getUsername();
  const display = name || 'Gast';
  const navEl   = document.getElementById('usernameText');
  const greetEl = document.getElementById('greetName');
  if (navEl)   navEl.textContent   = display;
  if (greetEl) greetEl.textContent = display;
}

applyUsername();

// ── Shine animation: trigger occasionally (every 8-14s) ──
function scheduleShine() {
  const delay = 8000 + Math.random() * 6000;
  setTimeout(() => {
    const navU = document.querySelector('.nav-username');
    if (navU) {
      navU.classList.add('shine-running');
      setTimeout(() => navU.classList.remove('shine-running'), 2500);
    }
    scheduleShine();
  }, delay);
}
scheduleShine();

// ── Username modal ─────────────────────────────────────────
const usernameModal  = document.getElementById('usernameModal');
const usernameInput  = document.getElementById('usernameInput');
const usernameSave   = document.getElementById('usernameSave');
const usernameCancel = document.getElementById('usernameCancel');
const navUsername    = document.getElementById('navUsername');

function openUsernameModal() {
  if (!usernameModal) return;
  usernameInput.value = getUsername();
  usernameModal.classList.remove('hidden');
  setTimeout(() => usernameInput.focus(), 50);
}

function closeUsernameModal() {
  usernameModal && usernameModal.classList.add('hidden');
}

navUsername && navUsername.addEventListener('click', openUsernameModal);

usernameSave && usernameSave.addEventListener('click', () => {
  const val = usernameInput.value.trim();
  if (val) { setUsername(val); applyUsername(); }
  closeUsernameModal();
});

usernameCancel && usernameCancel.addEventListener('click', closeUsernameModal);

usernameInput && usernameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') usernameSave.click();
  if (e.key === 'Escape') closeUsernameModal();
});

// Close on backdrop click
usernameModal && usernameModal.addEventListener('click', e => {
  if (e.target === usernameModal) closeUsernameModal();
});

// ── First visit: show name prompt ─────────────────────────
if (!getUsername() && !sessionStorage.getItem('username_prompted')) {
  sessionStorage.setItem('username_prompted', '1');
  setTimeout(openUsernameModal, 800);
}
