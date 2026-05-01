// Rosa Road Studio — SPA router
(function () {
  function route() {
    const hash = location.hash || '#/';
    const path = hash.slice(1); // remove #

    // Auth guard
    if (!API.getToken() && !path.startsWith('/login') && !path.startsWith('/register')) {
      location.hash = '#/login';
      return;
    }

    if (path === '/login') return AuthView.render('login');
    if (path === '/register') return AuthView.render('register');

    // App routes
    if (path === '/' || path === '') return DashboardView.render();
    if (path === '/clients') return ClientsView.render();
    if (path.startsWith('/clients/')) {
      const id = parseInt(path.split('/')[2]);
      if (id) return ClientDetailView.render(id);
    }
    if (path.startsWith('/generator')) return GeneratorView.render();
    if (path === '/content') return ContentView.render();
    if (path.startsWith('/content/')) {
      const id = parseInt(path.split('/')[2]);
      if (id) return ContentView.render(id);
    }
    if (path === '/calendar') return CalendarView.render();
    if (path === '/research') return ResearchView.render();
    if (path.startsWith('/analytics')) return AnalyticsView.render();

    // Fallback
    DashboardView.render();
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('load', route);
})();
