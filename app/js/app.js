/* ReadFlow — arranque, navegação, temas e idioma. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic, S = RF.store, UI = RF.ui;
  const t = RF.i18n.t;
  const { h, icon } = UI;

  const NAV = [['home', 'Início', 'home'], ['library', 'Estante', 'book'], ['stats', 'Estatísticas', 'chart'], ['achievements', 'Conquistas', 'trophy'],
    ['rankings', 'Rankings', 'crown'], ['recommended', 'Recomendados', 'gift'], ['friends', 'Amigos', 'users'], ['profile', 'Perfil', 'user'], ['updates', 'Atualizações', 'download']];
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
    /** Dá XP pelos livros terminados que ainda não deram (1 XP por página). Devolve o resumo ou null. */
    async awardXp(silent) {
      const s = S.state.settings; s.xpLedger = s.xpLedger || {};
      const pend = L.pendingXp(S.state.books, s.xpLedger);
      if (!pend.length) return null;
      const before = L.levelFromXp(L.ledgerTotal(s.xpLedger));
      for (const p of pend) s.xpLedger[p.id] = p.xp;
      await S.saveSettings();
      const total = L.ledgerTotal(s.xpLedger), after = L.levelFromXp(total), gained = pend.reduce((a, p) => a + p.xp, 0);
      if (!silent) {
        const toasts = [{ type: 'xp', name: pend.length === 1 ? t('+{n} XP por terminares «{title}»', { n: gained, title: pend[0].title }) : t('+{n} XP por {count} livros terminados', { n: gained, count: pend.length }) }];
        if (after > before) toasts.push({ type: 'xp', level: true, name: t('Subiste para o nível {n}!', { n: after }) });
        UI.toastAchievements(toasts);
      }
      return { gained, before, after, total };
    },
    /** Verifica conquistas e novos visuais. Devolve as conquistas novas. */
    async checkAchievements(silent) {
      const st = S.state;
      const { fresh } = L.evaluate(st.books, st.sessions, st.unlocked, st.shelves, st.settings);
      if (fresh.length) { await S.unlock(fresh); if (silent !== true) UI.toastAchievements(fresh); }
      await RF.app.awardXp(silent === true);
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
      h('nav', null, ...NAV.map(([key, label, ic]) => h('button', { class: 'nav-btn' + (base === key ? ' on' : ''), onClick: () => app.go(key) }, icon(ic, 18), key === 'library' ? app.libName() : t(label), key === 'updates' && st.settings.lastSeenVersion !== RF.changelog.current ? h('span', { class: 'nav-dot' }) : null))),
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
    if (root.readflowApp && root.readflowApp.onUpdateStatus) root.readflowApp.onUpdateStatus((p) => { RF.updateInfo = p; const el = document.getElementById('update-status'); if (el) el.textContent = RF.updateText(p); if (route === 'updates') render(); });
    RF.session.restore(active);
    await RF.shelf.syncCosmetics(true);
    RF.sync.setHooks({ change: () => { if (route === 'profile' || route === 'friends') render(); }, applied: () => { RF.i18n.setLang(S.state.settings.lang); app.applyTheme(); render(); } });
    await RF.app.awardXp(true);                     // dá, sem avisos, o XP dos livros que já estavam terminados
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
    // Depois de uma atualização: avisa uma vez (clicar leva ao separador «Atualizações»).
    const sv = S.state.settings;
    if (sv.toastedVersion !== RF.changelog.current) {
      const upgraded = sv.lastSeenVersion || S.state.books.length || S.state.sessions.length;
      if (upgraded && sv.lastSeenVersion !== RF.changelog.current) UI.toastAchievements([{ type: 'info', name: t('Atualizado para a versão {v}. Vê as novidades.', { v: RF.changelog.current }), go: 'updates' }]);
      if (!upgraded) sv.lastSeenVersion = RF.changelog.current;
      sv.toastedVersion = RF.changelog.current; await S.saveSettings();
    }
    if (RF.session.active) RF.sessionUI.openOverlay();

    let timer = null;
    window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => { if (route === 'library' && !UI.hasModal()) render(); }, 250); });
    setInterval(() => { if (sideClock && RF.session.active) sideClock.textContent = L.clock(RF.session.elapsed()); }, 1000);
  }

  RF.app = app;
  document.addEventListener('DOMContentLoaded', boot);
})(typeof window !== 'undefined' ? window : globalThis);
