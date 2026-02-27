/* ============================================================
   admin.js – Admin dashboard logic
   ============================================================ */

// ── Coupon form ───────────────────────────────────────────
const newCouponBtn   = document.getElementById('newCouponBtn');
const couponForm     = document.getElementById('couponForm');
const couponSaveBtn  = document.getElementById('couponSaveBtn');
const couponCancelBtn= document.getElementById('couponCancelBtn');
const couponStatus   = document.getElementById('couponStatus');

newCouponBtn && newCouponBtn.addEventListener('click', () => {
  couponForm && couponForm.classList.toggle('hidden');
});

couponCancelBtn && couponCancelBtn.addEventListener('click', () => {
  couponForm && couponForm.classList.add('hidden');
});

couponSaveBtn && couponSaveBtn.addEventListener('click', async () => {
  const code       = document.getElementById('couponCode')?.value.trim() || '';
  const discount   = parseInt(document.getElementById('couponDiscount')?.value || 20);
  const plan       = document.getElementById('couponPlan')?.value || 'lifetime';
  const max_uses   = parseInt(document.getElementById('couponMaxUses')?.value || 1);
  const valid_until= document.getElementById('couponValidUntil')?.value || '';

  couponSaveBtn.disabled = true;
  setStatus(couponStatus, '', '');

  try {
    const res  = await fetch('/api/admin/coupon', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, discount, plan, max_uses, valid_until }),
    });
    const data = await res.json();

    if (res.ok) {
      setStatus(couponStatus, `✓ Code „${data.code}" erstellt`, 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      setStatus(couponStatus, data.error || 'Fehler', 'error');
    }
  } finally {
    couponSaveBtn.disabled = false;
  }
});

// Delete coupon
document.getElementById('couponTableBody')?.addEventListener('click', async e => {
  const btn = e.target.closest('.coupon-delete-btn');
  if (!btn) return;
  if (!confirm('Code löschen?')) return;

  const id  = btn.dataset.id;
  const row = btn.closest('tr');

  await fetch(`/api/admin/coupon/${id}`, { method: 'DELETE' });
  row && row.remove();
});

// ── User form ─────────────────────────────────────────────
const newUserBtn    = document.getElementById('newUserBtn');
const userForm      = document.getElementById('userForm');
const userSaveBtn   = document.getElementById('userSaveBtn');
const userCancelBtn = document.getElementById('userCancelBtn');
const userStatus    = document.getElementById('userStatus');

newUserBtn && newUserBtn.addEventListener('click', () => {
  userForm && userForm.classList.toggle('hidden');
});

userCancelBtn && userCancelBtn.addEventListener('click', () => {
  userForm && userForm.classList.add('hidden');
});

userSaveBtn && userSaveBtn.addEventListener('click', async () => {
  const username = document.getElementById('newUsername')?.value.trim() || '';
  const email    = document.getElementById('newEmail')?.value.trim() || '';
  const plan     = document.getElementById('newPlan')?.value || 'free';
  const credits  = parseInt(document.getElementById('newCredits')?.value || 0);

  if (!username) {
    document.getElementById('newUsername')?.focus();
    return;
  }

  userSaveBtn.disabled = true;
  setStatus(userStatus, '', '');

  try {
    const res  = await fetch('/api/admin/user', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, email, plan, credits }),
    });
    const data = await res.json();

    if (res.ok) {
      setStatus(userStatus, '✓ Nutzer hinzugefügt', 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      setStatus(userStatus, data.error || 'Fehler', 'error');
    }
  } finally {
    userSaveBtn.disabled = false;
  }
});

// Delete user
document.getElementById('userTableBody')?.addEventListener('click', async e => {
  const btn = e.target.closest('.user-delete-btn');
  if (!btn) return;
  if (!confirm('Nutzer löschen?')) return;

  const id  = btn.dataset.id;
  const row = btn.closest('tr');

  await fetch(`/api/admin/user/${id}`, { method: 'DELETE' });
  row && row.remove();
});

// ── Helper ───────────────────────────────────────────────
function setStatus(el, msg, type) {
  if (!el) return;
  el.textContent = msg;
  el.className   = 'add-status ' + type;
}
