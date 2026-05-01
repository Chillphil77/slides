// Auth view (login + register)
const AuthView = {
  render(mode = 'login') {
    const isRegister = mode === 'register';
    document.getElementById('app').innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <div class="brand">
            <div class="brand-mark" style="width:40px;height:40px">R</div>
            <div>
              <div style="font-family:var(--font-display);font-weight:700;font-size:18px">Rosa Road Studio</div>
              <div style="color:var(--muted);font-size:12px">Advertising Content Automation</div>
            </div>
          </div>
          <h1>${isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <div class="sub">${isRegister ? 'Sign up to start automating client content' : 'Sign in to manage your agency workspace'}</div>
          <form id="auth-form">
            ${isRegister ? '<div class="field"><label>Full name</label><input name="full_name" required></div>' : ''}
            <div class="field"><label>Email</label><input name="email" type="email" required></div>
            <div class="field"><label>Password</label><input name="password" type="password" required minlength="6"></div>
            <button type="submit" class="btn primary">${isRegister ? 'Create account' : 'Sign in'}</button>
          </form>
          <div style="margin-top:16px;text-align:center;font-size:13px;color:var(--muted)">
            ${isRegister
              ? 'Already have an account? <a href="#/login">Sign in</a>'
              : 'Need an account? <a href="#/register">Create one</a>'}
          </div>
          ${!isRegister ? `<div style="margin-top:20px;padding:12px;background:var(--bg-2);border-radius:8px;font-size:12px;color:var(--muted);text-align:center">Demo account pre-loaded: <b>admin@rosaroad.agency</b> / <b>rosaroad123</b></div>` : ''}
        </div>
      </div>
    `;
    document.getElementById('auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      try {
        const res = isRegister ? await API.register(payload) : await API.login(payload);
        API.setToken(res.access_token);
        API.setUser(res.user);
        UI.toast('Welcome to Rosa Road Studio', 'success');
        location.hash = '#/';
      } catch (err) {
        UI.toast(err.message || 'Failed', 'error');
      }
    });
  },
};
