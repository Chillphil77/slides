/* ============================================================
   discover.js – Discover / Topics page logic
   ============================================================ */

const grid           = document.getElementById('topicsGrid');
const addTopicBtn    = document.getElementById('addTopicBtn');
const addTopicModal  = document.getElementById('addTopicModal');
const topicNameInput = document.getElementById('topicName');
const topicIconInput = document.getElementById('topicIcon');
const topicColorInput= document.getElementById('topicColor');
const topicSaveBtn   = document.getElementById('topicSaveBtn');
const topicCancelBtn = document.getElementById('topicCancelBtn');

// ── Sortable drag-and-drop ────────────────────────────────
if (grid && typeof Sortable !== 'undefined') {
  Sortable.create(grid, {
    animation: 200,
    handle: '.topic-drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: async () => {
      const order = [...grid.querySelectorAll('.topic-card')]
        .map(el => parseInt(el.dataset.id));
      await fetch('/api/topics/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      });
    },
  });
}

// ── Modal helpers ─────────────────────────────────────────
function openAddModal() {
  if (!addTopicModal) return;
  topicNameInput && (topicNameInput.value = '');
  topicIconInput && (topicIconInput.value = '📌');
  topicColorInput && (topicColorInput.value = '#2563eb');
  addTopicModal.classList.remove('hidden');
  setTimeout(() => topicNameInput && topicNameInput.focus(), 50);
}

function closeAddModal() {
  addTopicModal && addTopicModal.classList.add('hidden');
}

addTopicBtn && addTopicBtn.addEventListener('click', openAddModal);
topicCancelBtn && topicCancelBtn.addEventListener('click', closeAddModal);

// Close on backdrop
addTopicModal && addTopicModal.addEventListener('click', e => {
  if (e.target === addTopicModal) closeAddModal();
});

// Also wire up empty-state button if present
const addTopicBtnEmpty = document.getElementById('addTopicBtnEmpty');
addTopicBtnEmpty && addTopicBtnEmpty.addEventListener('click', openAddModal);

// ── Emoji presets ─────────────────────────────────────────
document.querySelectorAll('.emoji-opt').forEach(el => {
  el.addEventListener('click', () => {
    if (topicIconInput) topicIconInput.value = el.dataset.emoji;
  });
});

// ── Color presets ─────────────────────────────────────────
document.querySelectorAll('.color-preset').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    if (topicColorInput) topicColorInput.value = el.dataset.color;
  });
});

// Sync color input → preview
topicColorInput && topicColorInput.addEventListener('input', () => {
  document.querySelectorAll('.color-preset').forEach(p => p.classList.remove('selected'));
});

// ── Save new topic ────────────────────────────────────────
topicSaveBtn && topicSaveBtn.addEventListener('click', async () => {
  const name  = (topicNameInput && topicNameInput.value.trim()) || '';
  const icon  = (topicIconInput && topicIconInput.value.trim()) || '📌';
  const color = (topicColorInput && topicColorInput.value) || '#2563eb';

  if (!name) {
    topicNameInput && topicNameInput.focus();
    return;
  }

  topicSaveBtn.disabled = true;

  try {
    const res  = await fetch('/api/topics/add', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, icon, color }),
    });
    const data = await res.json();

    if (res.ok) {
      // Add card to grid without reload
      const card = buildTopicCard(data.id, name, icon, color, true);
      grid && grid.appendChild(card);
      closeAddModal();
    }
  } finally {
    topicSaveBtn.disabled = false;
  }
});

topicNameInput && topicNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') topicSaveBtn && topicSaveBtn.click();
  if (e.key === 'Escape') closeAddModal();
});

// ── Build topic card element ──────────────────────────────
function buildTopicCard(id, name, icon, color, isCustom) {
  const div = document.createElement('div');
  div.className   = 'topic-card';
  div.dataset.id  = id;
  div.dataset.custom = isCustom ? '1' : '0';
  div.style.setProperty('--topic-color', color);
  div.innerHTML = `
    <div class="topic-drag-handle" title="Ziehen zum Sortieren">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
        <line x1="8" y1="18" x2="21" y2="18"/>
        <line x1="3" y1="6" x2="3.01" y2="6"/>
        <line x1="3" y1="12" x2="3.01" y2="12"/>
        <line x1="3" y1="18" x2="3.01" y2="18"/>
      </svg>
    </div>
    <div class="topic-icon">${icon}</div>
    <div class="topic-name">${name}</div>
    ${isCustom ? `
    <button class="topic-delete-btn" data-id="${id}" title="Thema entfernen">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>` : ''}
  `;
  return div;
}

// ── Delete custom topic ───────────────────────────────────
grid && grid.addEventListener('click', async e => {
  const btn = e.target.closest('.topic-delete-btn');
  if (!btn) return;
  e.stopPropagation();

  const id   = btn.dataset.id;
  const card = btn.closest('.topic-card');

  card.style.transition = 'opacity .2s, transform .2s';
  card.style.opacity    = '0';
  card.style.transform  = 'scale(.92)';

  await fetch(`/api/topics/${id}`, { method: 'DELETE' });
  setTimeout(() => card.remove(), 220);
});

// ── Edit mode toggle ──────────────────────────────────────
const editModeBtn = document.getElementById('editModeBtn');
let editMode = false;

editModeBtn && editModeBtn.addEventListener('click', () => {
  editMode = !editMode;
  editModeBtn.classList.toggle('icon-btn--active', editMode);
  editModeBtn.title = editMode ? 'Bearbeitung beenden' : 'Bearbeitungsmodus';
  // When edit mode off, drag handles are always visible anyway
});
