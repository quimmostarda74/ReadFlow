/* ReadFlow — arranque, navegação, temas e idioma. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic, S = RF.store, UI = RF.ui;
  const t = RF.i18n.t;
  const { h, icon } = UI;

  const NAV = [['home', 'Início', 'home'], ['library', 'Estante', 'book'], ['stats', 'Estatísticas', 'chart'], ['achievements', 'Conquistas', 'trophy'],
    ['recommended', 'Recomendados', 'gift'], ['friends', 'Amigos', 'users'], ['profile', 'Perfil', 'user']];
  let route = 'home';
  let sideClock = null;

  const app = {
    libName() { return ((S.state.settings.libraryName || '').trim()) || t('Estante'); },
    go(r) { route = r; render(); const m = document.getElementById('main'); if (m) m.scrollTop = 0; },
    refresh() { render(); if (RF.remote) RF.remote.schedulePush(); },
    applyTheme() {
      const s = S.state.settings;
      document.documentElement.setAttribute('data-theme', s.appTheme || 'classic');
      RF.i18n.setLang(s.lang || 'pt');
    },
    /** Verifica conquistas e novos visuais. Devolve as conquistas novas. */
    async checkAchievements(silent) {
      const st = S.state;
      const { fresh } = L.evaluate(st.books, st.sessions, st.unlocked, st.shelves, st.settings);
      if (fresh.length) { await S.unlock(fresh); if (silent !== true) UI.toastAchievements(fresh); }
      const visuals = await RF.shelf.syncCosmetics(silent === true);
      if (visuals.length && silent !== true) UI.toastAchievements(visuals);
      return fresh;
    }
  };

  function viewFor(r) {
    if (r.startsWith('book:')) return RF.views.bookView(r.slice(5));
    if (r.startsWith('friendlist:')) { const rest = r.slice(11), i = rest.lastIndexOf(':'); return RF.views.friendListView(rest.slice(0, i), rest.slice(i + 1)); }
    if (r.startsWith('friend:')) return RF.views.friendView(r.slice(7));
    return RF.views[r]();
  }

  function render() {
    const rootEl = document.getElementById('app');
    const main = h('main', { id: 'main' });
    const base = route.startsWith('book:') ? 'library' : route.startsWith('friend') ? 'friends' : route;
    const sess = RF.session, st = S.state;

    sideClock = null;
    const banner = sess.active ? (() => {
      sideClock = h('div', { class: 'side-clock' }, L.clock(sess.elapsed()));
      return h('button', { class: 'side-session', onClick: () => RF.sessionUI.openOverlay() },
        h('span', { class: 'live' + (sess.state === 'paused' ? ' paused' : '') }), h('div', null, h('div', { class: 'small' }, sess.state === 'running' ? t('Sessão em curso') : t('Sessão em pausa')), sideClock));
    })() : null;

    const side = h('aside', { class: 'sidebar' },
      h('div', { class: 'brand' }, h('img', { src: 'icon.png', alt: '' }), h('span', { class: 'serif' }, 'ReadFlow')),
      h('nav', null, ...NAV.map(([key, label, ic]) => h('button', { class: 'nav-btn' + (base === key ? ' on' : ''), onClick: () => app.go(key) }, icon(ic, 18), key === 'library' ? app.libName() : t(label)))),
      h('div', { class: 'grow' }),
      banner,
      sess.active ? null : h('button', { class: 'btn primary block', onClick: () => (st.books.length ? RF.sessionUI.openStart() : RF.dialogs.openBookForm()) },
        icon('play', 16, { fill: true }), st.books.length ? t('Nova sessão') : t('Adicionar livro')),
      h('button', { class: 'side-user', onClick: () => app.go('profile') }, UI.avatar(36),
        h('div', { class: 'clip' }, h('div', { class: 'strong clip' }, st.settings.name || t('Leitor')), h('div', { class: 'tiny side-sub' }, t('Ver perfil')))));

    rootEl.replaceChildren(side, main);
    try { main.append(viewFor(route)); }
    catch (e) { console.error(e); main.append(h('div', { class: 'page' }, h('div', { class: 'card' }, h('h3', null, t('Ocorreu um erro ao mostrar este ecrã')), h('p', { class: 'muted' }, String((e && e.message) || e))))); }
  }

  async function boot() {
    let active = null;
    try { active = await S.init(); }
    catch (e) {
      document.getElementById('app').append(h('div', { class: 'fatal' }, h('h2', null, 'ReadFlow'), h('p', null, 'IndexedDB indisponível. / IndexedDB unavailable.')));
      return;
    }
    app.applyTheme();
    if (root.readflowApp && root.readflowApp.onUpdateStatus) root.readflowApp.onUpdateStatus((p) => { RF.updateInfo = p; const el = document.getElementById('update-status'); if (el) el.textContent = RF.updateText(p); });
    RF.session.restore(active);
    await RF.shelf.syncCosmetics(true);
    RF.remote.setHooks({
      change: () => {
        const base = route.startsWith('book:') ? 'library' : route.startsWith('friend') ? 'friends' : route;
        const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
        if (!UI.hasModal() && !typing && ['home', 'friends', 'recommended'].includes(base)) render();
      },
      notify: (kind, person) => UI.toastAchievements([{ type: 'info', name: t(kind === 'request' ? '{name} quer seguir-te' : '{name} aceitou o teu pedido', { name: person.name }) }])
    });
    await RF.remote.restore();
    render();
    if (RF.session.active) RF.sessionUI.openOverlay();

    let timer = null;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { if (route === 'library' && !UI.hasModal()) render(); }, 250); });
    setInterval(() => { if (sideClock && RF.session.active) sideClock.textContent = L.clock(RF.session.elapsed()); }, 1000);
  }

  RF.app = app;
  document.addEventListener('DOMContentLoaded', boot);
})(typeof window !== 'undefined' ? window : globalThis);
