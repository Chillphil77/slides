// Keyword + Hashtag research view
const ResearchView = {
  _tab: 'keywords',

  async render() {
    const app = document.getElementById('app');
    app.innerHTML = UI.layout({
      active: 'research',
      title: 'Keywords & Hashtags',
      subtitle: 'AI-powered research for your campaigns',
      html: '<div id="res-body"></div>',
    });
    UI.attachGlobal();
    this._renderInner();
  },

  async _renderInner() {
    let clients;
    try { clients = await API.listClients(); } catch { clients = []; }
    const body = document.getElementById('res-body');

    body.innerHTML = `
      <div class="tabs" id="res-tabs">
        <button data-tab="keywords" class="${this._tab === 'keywords' ? 'active' : ''}">🔑 Keyword research</button>
        <button data-tab="hashtags" class="${this._tab === 'hashtags' ? 'active' : ''}"># Hashtag research</button>
      </div>
      <div id="res-content"></div>
    `;
    body.querySelectorAll('#res-tabs button').forEach((b) => {
      b.onclick = () => { this._tab = b.dataset.tab; this._renderInner(); };
    });

    if (this._tab === 'keywords') this._renderKeywords(clients);
    else this._renderHashtags(clients);
  },

  _renderKeywords(clients) {
    const el = document.getElementById('res-content');
    el.innerHTML = `
      <div class="grid" style="grid-template-columns:380px 1fr;gap:20px">
        <div class="card">
          <h3>New keyword research</h3>
          <div class="field"><label>Client</label>
            <select id="kw-client">${clients.map((c) => `<option value="${c.id}">${UI.escapeHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Topic / seed keyword</label>
            <input id="kw-topic" placeholder="e.g. sustainable fashion">
          </div>
          <div class="row">
            <div class="field"><label>Language</label><input id="kw-lang" value="en"></div>
            <div class="field"><label>Region</label><input id="kw-region" placeholder="e.g. DE, US"></div>
          </div>
          <button class="btn primary" id="kw-go" style="width:100%">🔎 Research keywords</button>
          <div id="kw-loading" style="display:none;text-align:center;padding:16px"><div class="spinner dark" style="margin:0 auto"></div></div>
        </div>
        <div id="kw-results"><div class="empty card"><h3>Run a keyword search</h3><p>Results will appear here with volume, difficulty, intent, and trend data.</p></div></div>
      </div>
      <div id="kw-history" style="margin-top:20px"></div>
    `;

    document.getElementById('kw-go').onclick = () => this._doKeywordResearch();

    if (clients.length > 0) this._loadKeywordHistory(clients[0].id);
    document.getElementById('kw-client').onchange = (e) => this._loadKeywordHistory(e.target.value);
  },

  async _doKeywordResearch() {
    const cid = document.getElementById('kw-client').value;
    const topic = document.getElementById('kw-topic').value.trim();
    if (!topic) return UI.toast('Enter a topic', 'error');
    const btn = document.getElementById('kw-go');
    const loading = document.getElementById('kw-loading');
    btn.style.display = 'none'; loading.style.display = 'block';
    try {
      const res = await API.keywordResearch({
        client_id: parseInt(cid),
        topic,
        language: document.getElementById('kw-lang').value || 'en',
        region: document.getElementById('kw-region').value || '',
      });
      this._showKeywordResults(res);
      this._loadKeywordHistory(cid);
    } catch (e) { UI.toast(e.message, 'error'); }
    btn.style.display = ''; loading.style.display = 'none';
  },

  _showKeywordResults(res) {
    const el = document.getElementById('kw-results');
    const kws = res.keywords || [];
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Results for "${UI.escapeHtml(res.topic)}"</h3><span class="badge">${kws.length} keywords</span></div>
        <table class="table">
          <thead><tr><th>Keyword</th><th>Volume</th><th>Difficulty</th><th>Intent</th><th>Trend</th></tr></thead>
          <tbody>
            ${kws.map((k) => `
              <tr>
                <td><strong>${UI.escapeHtml(k.keyword)}</strong></td>
                <td>${UI.fmtNumber(k.volume)}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <div style="width:50px;height:6px;background:var(--bg-2);border-radius:3px;overflow:hidden">
                      <div style="width:${k.difficulty}%;height:100%;background:${k.difficulty > 60 ? 'var(--danger)' : k.difficulty > 30 ? 'var(--warning)' : 'var(--success)'}"></div>
                    </div>
                    ${k.difficulty}
                  </div>
                </td>
                <td><span class="badge">${k.intent}</span></td>
                <td style="color:${k.trend === 'rising' ? 'var(--success)' : k.trend === 'declining' ? 'var(--danger)' : 'var(--muted)'}">
                  ${k.trend === 'rising' ? '↑' : k.trend === 'declining' ? '↓' : '→'} ${k.trend}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async _loadKeywordHistory(cid) {
    try {
      const history = await API.listKeywordResearch(cid);
      const el = document.getElementById('kw-history');
      if (history.length === 0) { el.innerHTML = ''; return; }
      el.innerHTML = `
        <div class="card">
          <h3>Previous research</h3>
          <table class="table">
            <thead><tr><th>Topic</th><th>Keywords</th><th>Provider</th><th>Date</th><th></th></tr></thead>
            <tbody>
              ${history.slice(0, 10).map((r) => `
                <tr>
                  <td>${UI.escapeHtml(r.topic)}</td>
                  <td>${r.keywords.length}</td>
                  <td><span class="badge">${r.provider}</span></td>
                  <td>${UI.fmtDate(r.created_at)}</td>
                  <td><button class="btn sm" onclick='ResearchView._showKeywordResults(${JSON.stringify(r)})'>View</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch {}
  },

  _renderHashtags(clients) {
    const el = document.getElementById('res-content');
    el.innerHTML = `
      <div class="grid" style="grid-template-columns:380px 1fr;gap:20px">
        <div class="card">
          <h3>Hashtag research</h3>
          <div class="field"><label>Client</label>
            <select id="ht-client">${clients.map((c) => `<option value="${c.id}">${UI.escapeHtml(c.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Topic</label>
            <input id="ht-topic" placeholder="e.g. vegan recipes">
          </div>
          <div class="field"><label>Platform</label>
            <select id="ht-platform">
              ${['instagram', 'tiktok', 'linkedin', 'x', 'facebook', 'youtube'].map((p) => `<option value="${p}">${UI.platformIcon(p)} ${p}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Count</label><input type="number" id="ht-count" value="20" min="5" max="50"></div>
          <button class="btn primary" id="ht-go" style="width:100%"># Research hashtags</button>
          <div id="ht-loading" style="display:none;text-align:center;padding:16px"><div class="spinner dark" style="margin:0 auto"></div></div>
        </div>
        <div id="ht-results"><div class="empty card"><h3>Run a hashtag search</h3><p>Get platform-specific hashtag suggestions with reach estimates.</p></div></div>
      </div>
    `;
    document.getElementById('ht-go').onclick = () => this._doHashtagResearch();
  },

  async _doHashtagResearch() {
    const cid = document.getElementById('ht-client').value;
    const topic = document.getElementById('ht-topic').value.trim();
    if (!topic) return UI.toast('Enter a topic', 'error');
    const btn = document.getElementById('ht-go');
    const loading = document.getElementById('ht-loading');
    btn.style.display = 'none'; loading.style.display = 'block';
    try {
      const res = await API.hashtagResearch({
        client_id: parseInt(cid),
        topic,
        platform: document.getElementById('ht-platform').value,
        count: parseInt(document.getElementById('ht-count').value) || 20,
      });
      this._showHashtagResults(res);
    } catch (e) { UI.toast(e.message, 'error'); }
    btn.style.display = ''; loading.style.display = 'none';
  },

  _showHashtagResults(res) {
    const el = document.getElementById('ht-results');
    const tags = res.hashtags || [];
    el.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Hashtags for "${UI.escapeHtml(res.topic)}"</h3>
          <button class="btn sm" onclick="ResearchView._copyHashtags()">Copy all</button>
        </div>
        <div id="ht-tags-text" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
          ${tags.map((t) => `
            <div style="padding:6px 12px;background:var(--rosa-light);color:var(--rosa-dark);border-radius:999px;font-size:13px;font-weight:500;cursor:pointer" onclick="navigator.clipboard.writeText('${t.tag}');UI.toast('Copied','success')">${UI.escapeHtml(t.tag)}</div>
          `).join('')}
        </div>
        <table class="table">
          <thead><tr><th>Hashtag</th><th>Reach estimate</th><th>Competition</th></tr></thead>
          <tbody>
            ${tags.map((t) => `
              <tr>
                <td><strong>${UI.escapeHtml(t.tag)}</strong></td>
                <td>${UI.fmtNumber(t.reach_estimate)}</td>
                <td><span class="badge ${t.competition === 'low' ? 'approved' : t.competition === 'high' ? 'failed' : 'in_review'}">${t.competition}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _copyHashtags() {
    const tags = document.querySelectorAll('#ht-tags-text div');
    const text = Array.from(tags).map((t) => t.textContent).join(' ');
    navigator.clipboard.writeText(text);
    UI.toast('Hashtags copied to clipboard', 'success');
  },
};
