/* ============================================================
   pricing.js – Pricing + Tutorial modal logic
   ============================================================ */

// ── Tutorial modal ────────────────────────────────────────
const tutorialModal  = document.getElementById('tutorialModal');
const tutorialClose  = document.getElementById('tutorialClose');
const tutorialPrev   = document.getElementById('tutorialPrev');
const tutorialNext   = document.getElementById('tutorialNext');
const tutorialDots   = document.querySelectorAll('.tutorial-dot');
const tutorialSteps  = document.querySelectorAll('.tutorial-step');
const startBtn       = document.getElementById('startTutorialBtn');

let currentStep = 1;
const totalSteps = tutorialSteps.length;

function openTutorial() {
  currentStep = 1;
  renderStep();
  tutorialModal && tutorialModal.classList.remove('hidden');
}

function closeTutorial() {
  tutorialModal && tutorialModal.classList.add('hidden');
  localStorage.setItem('noozly_tutorial_done', '1');
}

function renderStep() {
  tutorialSteps.forEach(s => {
    s.classList.toggle('active', parseInt(s.dataset.step) === currentStep);
  });
  tutorialDots.forEach(d => {
    d.classList.toggle('active', parseInt(d.dataset.step) === currentStep);
  });
  if (tutorialPrev) tutorialPrev.disabled = currentStep === 1;
  if (tutorialNext) {
    if (currentStep === totalSteps) {
      tutorialNext.textContent = 'Fertig! 🎉';
    } else {
      tutorialNext.textContent = 'Weiter →';
    }
  }
}

startBtn && startBtn.addEventListener('click', e => {
  e.preventDefault();
  openTutorial();
});

tutorialClose && tutorialClose.addEventListener('click', closeTutorial);

tutorialPrev && tutorialPrev.addEventListener('click', () => {
  if (currentStep > 1) { currentStep--; renderStep(); }
});

tutorialNext && tutorialNext.addEventListener('click', () => {
  if (currentStep < totalSteps) {
    currentStep++;
    renderStep();
  } else {
    closeTutorial();
  }
});

tutorialDots.forEach(d => {
  d.addEventListener('click', () => {
    currentStep = parseInt(d.dataset.step);
    renderStep();
  });
});

tutorialModal && tutorialModal.addEventListener('click', e => {
  if (e.target === tutorialModal) closeTutorial();
});

// Show tutorial automatically on first visit
if (!localStorage.getItem('noozly_tutorial_done')) {
  setTimeout(openTutorial, 600);
}

// ── CTA buttons (placeholder – link to App Store) ─────────
const lifetimeCta = document.getElementById('lifetimeCta');
const deluxeCta   = document.getElementById('deluxeCta');

lifetimeCta && lifetimeCta.addEventListener('click', e => {
  e.preventDefault();
  alert('Lifetime Deal wird über den App Store verfügbar sein. Bleib gespannt!');
});

deluxeCta && deluxeCta.addEventListener('click', e => {
  e.preventDefault();
  alert('Premium Deluxe startet sobald die KI-Integration live ist. Wir informieren dich!');
});
