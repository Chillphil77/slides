/* ============================================================
   faq.js – FAQ page logic (search)
   ============================================================ */

const searchInput   = document.getElementById('faqSearch');
const clearBtn      = document.getElementById('faqClear');
const searchResults = document.getElementById('faqSearchResults');
const staticSections= document.getElementById('faqStatic');

let debounceTimer = null;

searchInput && searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(performSearch, 200);
});

searchInput && searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') clearSearch();
});

clearBtn && clearBtn.addEventListener('click', clearSearch);

function clearSearch() {
  if (searchInput) searchInput.value = '';
  showStatic();
}

async function performSearch() {
  const q = (searchInput && searchInput.value.trim()) || '';

  if (!q) { showStatic(); return; }

  clearBtn && clearBtn.classList.remove('hidden');
  staticSections && (staticSections.style.display = 'none');
  searchResults && searchResults.classList.remove('hidden');

  try {
    const res  = await fetch(`/api/faq/search?q=${encodeURIComponent(q)}`);
    const items = await res.json();

    if (!searchResults) return;

    if (items.length === 0) {
      searchResults.innerHTML = `<div class="faq-no-results">Keine Ergebnisse für „${escapeHtml(q)}"</div>`;
    } else {
      searchResults.innerHTML = items.map(item => `
        <div class="faq-search-result-item">
          <div class="faq-search-result-cat">${escapeHtml(item.category)}</div>
          <div class="faq-search-result-q">${highlight(item.question, q)}</div>
          <div class="faq-search-result-a">${highlight(item.answer, q)}</div>
        </div>
      `).join('');
    }
  } catch {
    searchResults && (searchResults.innerHTML = '<div class="faq-no-results">Suchfehler – bitte nochmal versuchen.</div>');
  }
}

function showStatic() {
  clearBtn && clearBtn.classList.add('hidden');
  searchResults && searchResults.classList.add('hidden');
  searchResults && (searchResults.innerHTML = '');
  staticSections && (staticSections.style.display = '');
}

function highlight(text, query) {
  const safe  = escapeHtml(text);
  const safeQ = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re    = new RegExp(`(${safeQ})`, 'gi');
  return safe.replace(re, '<mark style="background:rgba(37,99,235,.18);border-radius:3px;padding:0 2px">$1</mark>');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
