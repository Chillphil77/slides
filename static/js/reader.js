/* ============================================================
   reader.js  –  Article reader page logic
   ============================================================ */

const body         = document.getElementById('readerBody');
const progressBar  = document.getElementById('progressBar');
const content      = document.getElementById('readerContent');
const fontSmallerBtn = document.getElementById('fontSmaller');
const fontLargerBtn  = document.getElementById('fontLarger');
const themeToggleBtn = document.getElementById('themeToggle');

// ---- Theme ----
const saved = localStorage.getItem('theme');
if (saved === 'dark') body.classList.add('dark');

themeToggleBtn.addEventListener('click', () => {
  body.classList.toggle('dark');
  localStorage.setItem('theme', body.classList.contains('dark') ? 'dark' : 'light');
});

// ---- Font size ----
const FONT_SIZES  = [14, 16, 18, 20, 22, 24];
let   fontIndex   = FONT_SIZES.indexOf(18);
const storedSize  = localStorage.getItem('fontSize');
if (storedSize) {
  const idx = FONT_SIZES.indexOf(Number(storedSize));
  if (idx !== -1) fontIndex = idx;
}
applyFontSize();

fontSmallerBtn.addEventListener('click', () => {
  if (fontIndex > 0) { fontIndex--; applyFontSize(); }
});
fontLargerBtn.addEventListener('click', () => {
  if (fontIndex < FONT_SIZES.length - 1) { fontIndex++; applyFontSize(); }
});

function applyFontSize() {
  const size = FONT_SIZES[fontIndex];
  document.documentElement.style.setProperty('--font-size', size + 'px');
  localStorage.setItem('fontSize', String(size));
}

// ---- Reading progress bar ----
function updateProgress() {
  const scrollTop  = window.scrollY;
  const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
  const pct        = docHeight > 0 ? Math.min(100, (scrollTop / docHeight) * 100) : 100;
  progressBar.style.width = pct + '%';
}

window.addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

// ---- Lazy load images already in content ----
if ('IntersectionObserver' in window) {
  const imgs = content ? content.querySelectorAll('img[data-src]') : [];
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '200px' });
  imgs.forEach(img => observer.observe(img));
}

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === '+' || e.key === '=') fontLargerBtn.click();
  if (e.key === '-')                  fontSmallerBtn.click();
  if (e.key === 'd')                  themeToggleBtn.click();
  if (e.key === 'Escape' || e.key === 'Backspace') history.back();
});
