// Rosa Road Studio — API client
const API = (() => {
  const TOKEN_KEY = 'rosaroad_token';
  const USER_KEY = 'rosaroad_user';

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); }
  function getUser() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; } }
  function setUser(u) { localStorage.setItem(USER_KEY, JSON.stringify(u)); }

  async function req(path, { method = 'GET', body, form, asBlob = false } = {}) {
    const headers = {};
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    let payload;
    if (form) {
      payload = form;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(path, { method, headers, body: payload });
    if (res.status === 401) {
      clearToken();
      location.hash = '#/login';
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); msg = j.detail || JSON.stringify(j); } catch {}
      throw new Error(msg);
    }
    if (asBlob) return res.blob();
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

  return {
    getToken, setToken, clearToken, getUser, setUser,

    // auth
    register: (p) => req('/api/auth/register', { method: 'POST', body: p }),
    login: (p) => req('/api/auth/login', { method: 'POST', body: p }),
    me: () => req('/api/auth/me'),

    // dashboard
    dashboard: () => req('/api/dashboard/overview'),

    // clients
    listClients: () => req('/api/clients'),
    createClient: (p) => req('/api/clients', { method: 'POST', body: p }),
    getClient: (id) => req(`/api/clients/${id}`),
    updateClient: (id, p) => req(`/api/clients/${id}`, { method: 'PATCH', body: p }),
    deleteClient: (id) => req(`/api/clients/${id}`, { method: 'DELETE' }),
    getBrandCI: (id) => req(`/api/clients/${id}/brand-ci`),
    updateBrandCI: (id, p) => req(`/api/clients/${id}/brand-ci`, { method: 'PATCH', body: p }),

    // assets
    listAssets: (clientId, kind) => {
      const q = kind ? `?kind=${kind}` : '';
      return req(`/api/assets/by-client/${clientId}${q}`);
    },
    uploadAsset: (clientId, kind, file) => {
      const fd = new FormData();
      fd.append('client_id', clientId);
      fd.append('kind', kind);
      fd.append('file', file);
      return req('/api/assets/upload', { method: 'POST', form: fd });
    },
    deleteAsset: (id) => req(`/api/assets/${id}`, { method: 'DELETE' }),

    // content
    listContent: (clientId) => req('/api/content' + (clientId ? `?client_id=${clientId}` : '')),
    getContent: (id) => req(`/api/content/${id}`),
    generate: (p) => req('/api/content/generate', { method: 'POST', body: p }),
    selectVariant: (cid, vid) => req(`/api/content/${cid}/variants/${vid}/select`, { method: 'POST' }),
    changeStatus: (cid, status) => req(`/api/content/${cid}/status?status=${status}`, { method: 'POST' }),
    addComment: (cid, body) => req(`/api/content/${cid}/comments`, { method: 'POST', body: { body } }),
    listComments: (cid) => req(`/api/content/${cid}/comments`),
    deleteContent: (cid) => req(`/api/content/${cid}`, { method: 'DELETE' }),

    // research
    keywordResearch: (p) => req('/api/research/keywords', { method: 'POST', body: p }),
    listKeywordResearch: (cid) => req(`/api/research/keywords/${cid}`),
    hashtagResearch: (p) => req('/api/research/hashtags', { method: 'POST', body: p }),
    listHashtagSets: (cid) => req(`/api/research/hashtags/${cid}`),
    textSuggest: (p) => req('/api/research/suggest', { method: 'POST', body: p }),

    // calendar
    schedule: (p) => req('/api/calendar/schedule', { method: 'POST', body: p }),
    listScheduled: (params = {}) => {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => v && q.append(k, v));
      return req('/api/calendar' + (q.toString() ? '?' + q.toString() : ''));
    },
    cancelScheduled: (id) => req(`/api/calendar/${id}`, { method: 'DELETE' }),
    calendarOverview: (days = 30) => req(`/api/calendar/overview?days=${days}`),

    // analytics
    refreshAnalytics: (cid, days = 30) =>
      req(`/api/analytics/refresh/${cid}?days=${days}`, { method: 'POST' }),
    analyticsSummary: (cid, days = 30) => req(`/api/analytics/summary/${cid}?days=${days}`),
    exportCSV: (cid, days = 30) => req(`/api/analytics/export/${cid}.csv?days=${days}`, { asBlob: true }),
    exportPDF: (cid, days = 30) => req(`/api/analytics/export/${cid}.pdf?days=${days}`, { asBlob: true }),
  };
})();
