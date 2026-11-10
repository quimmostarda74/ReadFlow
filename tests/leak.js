// Verifica que, em inglês, russo e alemão, não sobra texto da interface em português.
const H = require('./harness');
const { roots, doc, text, sleep } = H;
const RF = H.RF;
const { createMock } = require('./mock-supabase');

(async () => {
  doc.listeners.DOMContentLoaded[0](); await sleep(50);
  const S = RF.store, M = createMock(); global.fetch = M.fetch;
  RF.config.supabaseUrl = 'https://mock.supabase.co'; RF.config.supabaseKey = M.key;
  const b = S.newBook({ title: 'Book One', author: 'Anon', totalPages: 300, status: 'reading', genre: 'fiction', favorite: true, recommend: true, recNote: 'Great' }); await S.saveBook(b);
  await S.saveSession({ id: RF.logic.uid(), bookId: b.id, start: Date.now() - 3600000, end: Date.now(), durationSeconds: 3600, startPage: 0, endPage: 30, notes: '', photoId: null, unlocked: ['time_0'], manual: true });
  await RF.app.checkAchievements(true);

  const pt = /[ãõçáéíóúâêôà]|\b(Livro|Estante|Conquista|Sessão|Amigos|Perfil|Tempo|Página|Nova|Novo|Guardar|Apagar|Cancelar)\b/;
  const bad = [];
  const scan = (lang, label, tx) => {
    tx = tx.replace(/Café|Book One|Anon|Maria|Pedro|Tester|tester#\d+|maria#\d+|pedro#\d+|Hi, I am Maria|Português \(Portugal\)/g, '');
    const data = [...RF.catalog.CATALOG.flatMap((c) => [c.title, c.author]), ...RF.catalog.TRENDING.flatMap((c) => [c.title, c.author])];
    for (const d of data.sort((a, c) => c.length - a.length)) tx = tx.split(d).join('');
    const hits = [...new Set(tx.match(new RegExp(pt.source, 'g')) || [])].filter((x) => !(lang === 'de' && /^[äöüß]$/.test(x)));
    const words = hits.filter((x) => (lang === 'de' ? /[ãõçâêôà]|\b(Livro|Estante|Conquista|Sessão|Nova|Novo|Guardar|Apagar|Cancelar)\b/.test(x) : (x.length > 1 || /[ãõçáéíóúâêôà]/.test(x))));
    if (words.length) bad.push([lang, label, words.join(',')]);
  };
  const sweep = (routes) => {
    for (const lang of ['en', 'ru', 'de']) {
      S.state.settings.lang = lang; RF.app.applyTheme();
      for (const r of routes) { RF.app.go(r); scan(lang, r, text(roots[0])); }
      for (const open of [() => RF.shelf.openCustomize(), () => RF.sessionUI.openManual(b.id), () => RF.dialogs.openBookForm(b.id), () => RF.sessionUI.openStart(b.id)]) { open(); scan(lang, 'modal', text(roots[1])); roots[1].children = []; }
    }
  };
  // 1) sem ligação configurada e 2) com ligação mas sem conta
  sweep(['home', 'library', 'stats', 'achievements', 'rankings', 'recommended', 'friends', 'profile', 'book:' + b.id]);
  RF.config.supabaseUrl = 'https://mock.supabase.co'; RF.config.supabaseKey = M.key;
  S.state.settings.lang = 'pt'; RF.app.applyTheme();
  // 3) com conta e amigos
  await RF.remote.signUp('tester', 'segredo123', 'Tester');
  const me = RF.remote.state.user.uid;
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ title: 'Bk ' + i, author: 'Z', note: 'ok', color: '#8C2F39' }));
  const mid = M.seed({ name: 'maria', number: 204819, display: 'Maria', sections: { bio: { text: 'Hi, I am Maria' }, reading: mk(2), finished: mk(7), favorites: mk(3), recommendations: [{ title: 'Rec', author: 'Q', note: 'ok' }], achievements: ['time_0'],
    activity: [{ book: 'Bk 0', minutes: 30, pages: 20, when: Date.now() - 3600000, unlocked: ['time_3'] }], stats: { hours: 4, pages: 300, books: 2, sessions: 5, streak: 2, pace: 30 } } });
  M.follow(me, mid, 'accepted');
  const pid = M.seed({ name: 'pedro', number: 771203, display: 'Pedro', sections: {} }); M.follow(pid, me, 'pending');
  await RF.remote.pull(true);
  sweep(['home', 'friends', 'rankings', 'recommended', 'friend:maria#204819', 'friend:pedro#771203', 'friendlist:maria#204819:finished', 'profile']);
  console.log(bad.length ? 'POSSÍVEL TEXTO EM PORTUGUÊS: ' + JSON.stringify(bad) : 'OK sem texto em português nos outros idiomas');
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
