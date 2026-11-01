/* ReadFlow — ecrãs principais. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic, S = RF.store, UI = RF.ui, SOC = RF.social;
  const t = RF.i18n.t;
  const { h, icon } = UI;
  const APP_VERSION = '1.3.0';
  const MAX_SHOWN = 5;

  let libQuery = '', statsRange = 'week', statsMetric = 'time', achFilter = 'all', recTab = 'foryou', recGenre = '', recLang = '', recMore = false, friendsTab = 'feed', homeFeed = 'all';

  const PL = {
    streak: { pt: { one: '{n} dia seguido', other: '{n} dias seguidos' }, en: { one: '{n} day in a row', other: '{n} days in a row' }, de: { one: '{n} Tag in Folge', other: '{n} Tage in Folge' }, ru: { one: '{n} день подряд', few: '{n} дня подряд', many: '{n} дней подряд', other: '{n} дня подряд' } },
    days: { pt: { one: '{n} dia', other: '{n} dias' }, en: { one: '{n} day', other: '{n} days' }, de: { one: '{n} Tag', other: '{n} Tage' }, ru: { one: '{n} день', few: '{n} дня', many: '{n} дней', other: '{n} дня' } },
    books: { pt: { one: '{n} livro', other: '{n} livros' }, en: { one: '{n} book', other: '{n} books' }, de: { one: '{n} Buch', other: '{n} Bücher' }, ru: { one: '{n} книга', few: '{n} книги', many: '{n} книг', other: '{n} книги' } }
  };
  const tn = (k, n) => RF.i18n.tn(PL[k], n);

  const metric = (label, value) => h('div', { class: 'metric' }, h('div', { class: 'metric-val' }, value), h('div', { class: 'muted small' }, label));
  const tile = (ic, title, value) => h('div', { class: 'tile' }, ic ? h('span', { class: 'tile-ico' }, icon(ic, 18)) : null, h('div', { class: 'tile-val' }, value), h('div', { class: 'tile-title' }, title));
  const pageHead = (title, subtitle, actions) => h('header', { class: 'page-head' }, h('div', null, h('h1', { class: 'serif' }, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null), actions || null);
  const seg = (items, current, set) => h('div', { class: 'seg' }, ...items.map(([k, label]) => h('button', { class: 'seg-btn' + (current === k ? ' on' : ''), onClick: () => { set(k); RF.app.refresh(); } }, label)));
  const emptyCard = (ic, title, text, action) => h('div', { class: 'card empty' }, icon(ic, 34), h('h3', null, title), text ? h('p', { class: 'muted' }, text) : null, action || null);
  const lockedCard = (title, ic) => h('div', { class: 'card stack' }, h('h3', { class: 'row gap center' }, icon(ic, 16), title), h('div', { class: 'row gap center muted small' }, icon('lock', 14), t('Esta pessoa não partilha esta secção.')));
  const libName = () => RF.app.libName();

  function unlockChips(ids) {
    const items = (ids || []).map((id) => L.achById[id]).filter(Boolean);
    if (!items.length) return null;
    return h('div', { class: 'unlock-chips' }, ...items.map((a) => h('div', { class: 'unlock-chip', title: L.achDetail(a) }, UI.medal(a, true, 28), h('span', null, t('Desbloqueou «{name}»', { name: L.achTitle(a) })))));
  }
  const timeAgo = (hrs) => (hrs >= 24 ? t('há {n} d', { n: Math.floor(hrs / 24) }) : t('há {n} h', { n: Math.max(1, Math.round(hrs)) }));
  const agoFromMs = (ms) => { const m = (Date.now() - ms) / 60000; if (m < 1) return t('agora mesmo'); if (m < 60) return t('há {n} min', { n: Math.round(m) }); return timeAgo(m / 60); };

  /* ---------- Cartão de sessão (estilo Strava) ---------- */
  function sessionCard(s, showBook = true) {
    const book = S.getBook(s.bookId), photo = S.imgUrl(s.photoId);
    return h('div', { class: 'card session-card' },
      h('div', { class: 'row gap center' }, showBook && book ? UI.coverEl(book, 44) : null,
        h('div', { class: 'grow' },
          showBook ? h('div', { class: 'strong serif clip link', onClick: () => book && RF.app.go('book:' + book.id) }, book ? book.title : t('Livro removido')) : null,
          h('div', { class: 'row gap center wrap' }, h('span', { class: showBook ? 'muted small' : 'strong' }, L.relativeDay(s.start)),
            s.manual ? h('span', { class: 'chip manual-chip', title: t('Registo manual') }, icon('edit', 11), t('Registo manual')) : null)),
        h('button', { class: 'icon-btn', title: t('Editar leitura'), onClick: () => RF.sessionUI.openManual(null, s) }, icon('edit', 16)),
        h('button', { class: 'icon-btn', title: t('Apagar sessão'), onClick: async () => {
          if (await UI.confirmDialog({ title: t('Apagar esta sessão?'), message: t('Esta ação não pode ser desfeita.'), confirmLabel: t('Apagar'), danger: true })) {
            await S.deleteSession(s.id); await RF.sessionUI.recalcProgress(book); RF.app.refresh();
          }
        } }, icon('trash', 16))),
      unlockChips(s.unlocked),
      h('div', { class: 'metrics' }, metric(t('Tempo'), L.duration(s.durationSeconds)), metric(t('Páginas'), String(L.pagesRead(s))), metric(t('Ritmo'), L.pace(L.pagesPerHour(s)))),
      photo ? h('img', { class: 'session-photo', src: photo, alt: '' }) : null,
      s.notes ? h('p', { class: 'muted' }, s.notes) : null);
  }

  /** Atividade de um amigo (o nome e a foto abrem o perfil). */
  function friendPostCard(u, p) {
    return h('div', { class: 'card session-card' },
      h('div', { class: 'row gap center' }, h('div', { class: 'row gap center grow link', onClick: () => RF.app.go('friend:' + u.id) }, UI.avatar(40, { name: u.name, color: u.color, photo: u.avatar }),
        h('div', null, h('div', { class: 'strong' }, t('{name} leu «{book}»', { name: u.name, book: p.book })), h('div', { class: 'muted small' }, agoFromMs(p.when))))),
      unlockChips(p.unlocked),
      h('div', { class: 'metrics' }, metric(t('Tempo'), L.duration(p.minutes * 60)), metric(t('Páginas'), String(p.pages)), metric(t('Ritmo'), L.pace(p.minutes > 0 ? p.pages / (p.minutes / 60) : 0))));
  }
  const friendPosts = () => (RF.remote.signedIn() ? RF.remote.feed() : []);

  /* ---------- Início ---------- */
  function home() {
    const st = S.state, now = Date.now();
    const goal = st.settings.dailyGoal, weekGoal = st.settings.weeklyGoal;
    const todaySec = st.sessions.filter((s) => L.isSameDay(s.start, now)).reduce((a, s) => a + s.durationSeconds, 0);
    const weekStart = L.startOfWeek(now);
    const weekPages = st.sessions.filter((s) => s.start >= weekStart).reduce((a, s) => a + L.pagesRead(s), 0);
    const days = L.activeDays(st.sessions), streak = L.computeStreaks(days).current;
    const hour = new Date().getHours();
    const base = hour < 6 ? t('Boa madrugada') : hour < 13 ? t('Bom dia') : hour < 20 ? t('Boa tarde') : t('Boa noite');
    const reading = st.books.filter((b) => b.status === 'reading');
    const startLabel = RF.session.active ? t('Voltar à sessão') : st.books.length ? t('Começar a ler') : t('Adicionar o primeiro livro');
    const startAction = () => (RF.session.active ? RF.sessionUI.openOverlay() : st.books.length ? RF.sessionUI.openStart() : RF.dialogs.openBookForm());

    const mine = [...st.sessions].sort((a, b) => b.start - a.start).slice(0, 8).map((s) => ({ when: s.start, node: sessionCard(s) }));
    const theirs = friendPosts().slice(0, 12).map((x) => ({ when: x.when, node: friendPostCard(x.u, x.p) }));
    let feed = homeFeed === 'mine' ? mine : homeFeed === 'friends' ? theirs : [...mine, ...theirs];
    feed = feed.sort((a, b) => b.when - a.when).slice(0, 10);

    const dots = h('div', { class: 'week-dots' });
    for (let i = 0; i < 7; i++) {
      const day = L.addDays(weekStart, i), read = days.has(L.startOfDay(day));
      dots.append(h('div', { class: 'dot-col' }, h('span', { class: 'muted small' }, L.weekdayLetter(day)),
        h('span', { class: 'dot' + (read ? ' on' : '') + (L.isSameDay(day, now) && !read ? ' today' : '') }, read ? icon('check', 14) : null)));
    }
    return h('div', { class: 'page' },
      h('header', { class: 'page-head' }, h('div', { class: 'row gap center' }, UI.avatar(58),
        h('div', null, h('h1', { class: 'serif' }, st.settings.name ? `${base}, ${st.settings.name}` : base), h('p', { class: 'muted' }, t('O que vais ler hoje?'))))),
      h('div', { class: 'home-grid' },
        h('div', { class: 'stack' },
          h('div', { class: 'card' },
            h('div', { class: 'row gap center' },
              UI.ring(todaySec / (Math.max(goal, 1) * 60), 124, h('div', { class: 'center-text' }, h('div', { class: 'ring-num' }, String(Math.floor(todaySec / 60))), h('div', { class: 'muted small' }, t('min')))),
              h('div', { class: 'stack tight' }, h('h3', null, t('Hoje')), h('div', { class: 'muted' }, t('Meta de {n} min', { n: goal })),
                h('div', { class: 'streak' + (streak > 0 ? ' on' : '') }, icon('flame', 18, { fill: streak > 0 }), tn('streak', streak)))),
            h('button', { class: 'btn primary block lg', onClick: startAction }, icon(RF.session.active || st.books.length ? 'play' : 'plus', 18, { fill: true }), startLabel),
            st.books.length ? h('button', { class: 'btn ghost block', onClick: () => RF.sessionUI.openManual() }, icon('edit', 16), t('Registar leitura manualmente')) : null),
          h('div', { class: 'card' },
            h('div', { class: 'row between' }, h('h3', null, t('Esta semana')), h('span', { class: 'muted' }, t('{a} / {b} págs', { a: weekPages, b: weekGoal }))),
            UI.progressBar(weekPages / Math.max(weekGoal, 1)), dots)),
        h('div', { class: 'stack' },
          reading.length ? h('section', null, h('h2', { class: 'serif section-title' }, t('A ler agora')),
            h('div', { class: 'reading-row' }, ...reading.map((b) => h('button', { class: 'reading-card', onClick: () => RF.app.go('book:' + b.id) },
              UI.coverEl(b, 104), UI.progressBar(L.bookProgress(b)), h('div', { class: 'strong small clip2' }, b.title))))) : null,
          h('section', { class: 'stack' }, h('div', { class: 'row between center' }, h('h2', { class: 'serif' }, t('Atividade recente')),
            RF.remote.signedIn() ? seg([['all', t('Tudo')], ['mine', t('Eu')], ['friends', t('Amigos')]], homeFeed, (k) => { homeFeed = k; }) : null),
            feed.length ? h('div', { class: 'stack' }, ...feed.map((x) => x.node)) : emptyCard('clock', t('Ainda não tens sessões'), t('Começa a ler e a tua primeira sessão aparece aqui.'))))));
  }

  /* ---------- Estante ---------- */
  function library() {
    const st = S.state, style = st.settings.libraryStyle, ctx = RF.shelf.context();
    const theme = RF.shelf.themeOf(st.settings.shelfTheme, ctx), bg = RF.shelf.bgOf(st.settings.shelfBg, ctx);
    const room = h('div', { class: 'room' });
    RF.shelf.applyRoom(room, theme, bg);
    let W = Math.max(380, ((document.getElementById('main') || {}).clientWidth || 1000) - 76 - 56 - 36);
    const matches = (b) => { const q = libQuery.trim().toLowerCase(); return !q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q); };
    const open = (b) => RF.app.go('book:' + b.id);
    const levelNames = ['', t('Equilibrada'), t('Compacta'), t('Muito cheia')];

    function section(title, ic, books, shelf, featured) {
      const res = RF.shelf.renderCase(books, { style, width: W, featured: featured || new Set(), onOpen: open });
      return h('section', { class: 'shelf' }, h('div', { class: 'shelf-head' }, icon(ic, 18), h('h2', { class: 'serif' }, title), h('span', { class: 'count' }, String(books.length)),
        style !== 'covers' && res.level > 0 ? h('span', { class: 'level-chip', title: t('Os livros reorganizam-se para caberem mais') }, levelNames[res.level]) : null, h('span', { class: 'grow' }),
        shelf ? h('button', { class: 'icon-btn', title: t('Renomear'), onClick: async () => {
          const name = await UI.promptDialog({ title: t('Renomear prateleira'), label: t('Nome'), value: shelf.name });
          if (name) { shelf.name = name; await S.saveShelf(shelf); RF.app.refresh(); }
        } }, icon('edit', 16)) : null,
        shelf ? h('button', { class: 'icon-btn', title: t('Apagar prateleira'), onClick: async () => {
          if (await UI.confirmDialog({ title: t('Apagar «{name}»?', { name: shelf.name }), message: t('Os livros não são apagados.'), confirmLabel: t('Apagar'), danger: true })) { await S.deleteShelf(shelf.id); RF.app.refresh(); }
        } }, icon('trash', 16)) : null), res.node);
    }
    function paint() {
      room.replaceChildren();
      if (!st.books.length) {
        room.append(emptyCard('book', t('A tua estante está vazia'), t('Adiciona o primeiro livro e fotografa a lombada para ele aparecer aqui.'), h('button', { class: 'btn primary', onClick: () => RF.dialogs.openBookForm() }, icon('plus', 16), t('Adicionar livro'))));
        return;
      }
      const reading = st.books.filter((b) => b.status === 'reading' && matches(b));
      room.append(section(t('A ler'), 'book', reading, null, new Set(reading.map((b) => b.id))),
        section(t('Lidos'), 'check', st.books.filter((b) => b.status === 'finished' && matches(b))),
        section(t('Quero ler'), 'bookmark', st.books.filter((b) => b.status === 'wantToRead' && matches(b))),
        ...st.shelves.map((sh) => section(sh.name, 'layers', st.books.filter((b) => b.shelfIds.includes(sh.id) && matches(b)), sh)));
    }
    paint();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => {
      if (!room.isConnected) return;
      const w = room.clientWidth - 56 - 36;
      if (w > 300 && Math.abs(w - W) > 14) { W = w; paint(); }
    });

    const rename = async () => {
      const v = await UI.promptDialog({ title: t('Mudar o nome da estante'), label: t('Nome'), value: libName() });
      if (v !== null) { st.settings.libraryName = v === t('Estante') ? '' : v; await S.saveSettings(); RF.app.refresh(); }
    };
    const segBtn = (val, ic, title) => h('button', { class: 'seg-btn' + (style === val ? ' on' : ''), title, onClick: async () => { st.settings.libraryStyle = val; await S.saveSettings(); RF.app.refresh(); } }, icon(ic, 16));
    return h('div', { class: 'page' },
      pageHead(h('span', { class: 'row gap center' }, libName(), h('button', { class: 'icon-btn', title: t('Mudar o nome da estante'), onClick: rename }, icon('edit', 18))), tn('books', st.books.length), h('div', { class: 'row gap center wrap' },
        h('label', { class: 'search-box' }, icon('search', 16), h('input', { class: 'search', type: 'search', placeholder: t('Procurar livro ou autor'), value: libQuery, onInput: (e) => { libQuery = e.target.value; paint(); } })),
        h('div', { class: 'seg' }, segBtn('spines', 'columns', t('Lombadas')), segBtn('covers', 'grid', t('Capas'))),
        h('button', { class: 'btn', onClick: () => RF.shelf.openCustomize() }, icon('palette', 16), t('Personalizar')),
        h('button', { class: 'btn', onClick: async () => {
          const name = await UI.promptDialog({ title: t('Nova prateleira'), label: t('Nome da prateleira'), confirmLabel: t('Criar') });
          if (name) { await S.saveShelf({ id: L.uid(), name, createdAt: Date.now() }); await RF.app.checkAchievements(); RF.app.refresh(); }
        } }, icon('layers', 16), t('Nova prateleira')),
        h('button', { class: 'btn primary', onClick: () => RF.dialogs.openBookForm() }, icon('plus', 16), t('Novo livro')))),
      room);
  }

  /* ---------- Livro ---------- */
  async function markFinished(book) {
    book.status = 'finished'; book.finishedAt = Date.now(); book.startedAt = book.startedAt || Date.now();
    if (book.totalPages > 0) book.currentPage = book.totalPages;
    await S.saveBook(book); await RF.app.checkAchievements(); RF.app.refresh();
  }
  async function setStatus(book, status) {
    if (status === 'finished') return markFinished(book);
    book.status = status;
    if (status === 'reading') { book.finishedAt = null; book.startedAt = book.startedAt || Date.now(); }
    if (status === 'wantToRead') book.currentPage = 0;
    await S.saveBook(book); RF.app.refresh();
  }
  async function toggleFlag(book, key) { book[key] = !book[key]; await S.saveBook(book); await RF.app.checkAchievements(); RF.app.refresh(); }

  function bookView(id) {
    const book = S.getBook(id);
    if (!book) { setTimeout(() => RF.app.go('library'), 0); return h('div'); }
    const sessions = L.bookSessions(S.state.sessions, id).sort((a, b) => b.start - a.start);
    const totalSec = sessions.reduce((a, s) => a + s.durationSeconds, 0), totalPages = sessions.reduce((a, s) => a + L.pagesRead(s), 0);
    const pph = totalSec > 0 ? totalPages / (totalSec / 3600) : 0;
    const shelves = S.state.shelves.filter((s) => book.shelfIds.includes(s.id));
    const status = h('div', { class: 'seg' }, ...['wantToRead', 'reading', 'finished'].map((k) => h('button', { class: 'seg-btn' + (book.status === k ? ' on' : ''), onClick: () => setStatus(book, k) }, t(L.STATUS[k].title))));
    const genre = L.GENRES[book.genre];
    return h('div', { class: 'page' },
      h('button', { class: 'btn ghost back', onClick: () => RF.app.go('library') }, icon('back', 18), libName()),
      h('div', { class: 'book-layout' },
        h('div', { class: 'stack' },
          h('div', { class: 'card book-head' }, UI.coverEl(book, 150),
            h('div', { class: 'stack tight grow' },
              h('h1', { class: 'serif' }, book.title), book.author ? h('p', { class: 'muted' }, book.author) : null, status,
              book.status === 'finished' ? UI.stars(book.rating, async (v) => { book.rating = v; await S.saveBook(book); await RF.app.checkAchievements(); RF.app.refresh(); }) : null,
              h('div', { class: 'row gap wrap center' }, book.totalPages > 0 ? h('span', { class: 'muted small' }, t('{n} páginas', { n: book.totalPages })) : null, genre ? h('span', { class: 'chip' }, t(genre[0])) : null),
              h('div', { class: 'row gap wrap' },
                h('button', { class: 'btn' + (book.favorite ? ' on-fav' : ''), onClick: () => toggleFlag(book, 'favorite') }, icon('heart', 16, { fill: book.favorite }), t('Favorito')),
                h('button', { class: 'btn' + (book.recommend ? ' on-rec' : ''), onClick: () => toggleFlag(book, 'recommend') }, icon('gift', 16, { fill: book.recommend }), t('Recomendo'))),
              book.recommend && book.recNote ? h('p', { class: 'muted small' }, '“' + book.recNote + '”') : null,
              h('div', { class: 'row gap wrap' },
                h('button', { class: 'btn primary', onClick: () => RF.sessionUI.openStart(book.id) }, icon('play', 16, { fill: true }), book.status === 'finished' ? t('Ler outra vez') : t('Começar a ler')),
                h('button', { class: 'btn', onClick: () => RF.sessionUI.openManual(book.id) }, icon('edit', 16), t('Registar leitura')),
                book.status !== 'finished' ? h('button', { class: 'btn', onClick: () => markFinished(book) }, icon('check', 16), t('Marcar como lido')) : null,
                h('button', { class: 'btn', onClick: () => RF.dialogs.openBookForm(book.id) }, icon('edit', 16), t('Editar')),
                h('button', { class: 'btn danger-text', onClick: async () => {
                  if (await UI.confirmDialog({ title: t('Apagar «{name}»?', { name: book.title }), message: t('O livro e as suas sessões serão apagados. Esta ação não pode ser desfeita.'), confirmLabel: t('Apagar'), danger: true })) { await S.deleteBook(book.id); RF.app.go('library'); }
                } }, icon('trash', 16), t('Apagar'))))),
          book.totalPages > 0 && book.status !== 'wantToRead' ? h('div', { class: 'card' },
            h('div', { class: 'row between' }, h('h3', null, t('Progresso')), h('strong', { class: 'accent' }, Math.round(L.bookProgress(book) * 100) + '%')), UI.progressBar(L.bookProgress(book)),
            h('p', { class: 'muted small' }, t('Página {a} de {b}', { a: book.currentPage, b: book.totalPages }) + (book.startedAt ? ' · ' + t('começaste a {d}', { d: L.shortDate(book.startedAt) }) : '') + (book.finishedAt ? ', ' + t('terminaste a {d}', { d: L.shortDate(book.finishedAt) }) : ''))) : null,
          h('div', { class: 'tiles' }, tile('clock', t('Tempo de leitura'), L.duration(totalSec)), tile('list', t('Sessões'), String(sessions.length)), tile('file', t('Páginas lidas'), String(totalPages)), tile('activity', t('Ritmo médio'), L.pace(pph))),
          h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h3', null, t('Prateleiras')), h('button', { class: 'btn small-btn', onClick: () => RF.dialogs.openShelvesDialog(book.id) }, icon('layers', 14), t('Gerir'))),
            shelves.length ? h('div', { class: 'row gap wrap' }, ...shelves.map((s) => h('span', { class: 'chip' }, s.name))) : h('p', { class: 'muted small' }, t('Este livro ainda não está em nenhuma prateleira personalizada.'))),
          h('div', { class: 'card row gap center' }, UI.spineEl(book, { w: 40, h: 150 }),
            h('div', { class: 'stack tight' }, h('h3', null, t('Lombada na estante')),
              UI.photoPicker(async (blob) => { await S.removeImage(book.spineId); book.spineId = await S.addImage(blob); await S.saveBook(book); await RF.app.checkAchievements(); RF.app.refresh(); }, { crop: true, title: t('Enquadrar lombada'), aspect: 0.2, outW: 280 }),
              book.spineId ? h('button', { class: 'btn ghost danger-text', onClick: async () => { await S.removeImage(book.spineId); book.spineId = null; await S.saveBook(book); RF.app.refresh(); } }, icon('trash', 14), t('Remover foto')) : null))),
        h('div', { class: 'stack' }, h('h2', { class: 'serif section-title' }, t('Sessões')),
          sessions.length ? sessions.map((s) => sessionCard(s, false)) : emptyCard('clock', t('Ainda não há sessões para este livro.')))));
  }

  /* ---------- Estatísticas ---------- */
  function stats() {
    const st = S.state, start = L.rangeStart(statsRange, st.sessions);
    const tt = L.totals(st.sessions.filter((s) => s.start >= start));
    const finished = st.books.filter((b) => b.status === 'finished' && b.finishedAt && b.finishedAt >= start).length;
    const allT = L.totals(st.sessions), streaks = L.computeStreaks(L.activeDays(st.sessions));
    const longest = st.sessions.reduce((m, s) => Math.max(m, s.durationSeconds), 0);
    const pace = allT.seconds > 0 ? allT.pages / (allT.seconds / 3600) : 0;
    const buckets = L.buckets(st.sessions, statsRange);
    const row = (a, b) => h('div', { class: 'row between' }, h('span', { class: 'muted' }, a), h('strong', null, b));
    return h('div', { class: 'page' },
      pageHead(t('Estatísticas'), null, seg([['week', t('Semana')], ['month', t('Mês')], ['year', t('Ano')], ['all', t('Total')]], statsRange, (k) => { statsRange = k; })),
      h('div', { class: 'tiles four' }, tile('clock', t('Tempo de leitura'), L.duration(tt.seconds)), tile('file', t('Páginas'), String(tt.pages)), tile('list', t('Sessões'), String(tt.sessions)), tile('check', t('Livros terminados'), String(finished))),
      h('div', { class: 'card' }, h('div', { class: 'row between center' }, h('h3', null, statsMetric === 'time' ? t('Minutos lidos') : t('Páginas lidas')), seg([['time', t('Tempo')], ['pages', t('Páginas')]], statsMetric, (k) => { statsMetric = k; })),
        UI.barChart(buckets, statsMetric, statsRange), buckets.some((b) => b.minutes > 0) ? null : h('p', { class: 'muted center-text' }, t('Sem leituras neste período'))),
      h('div', { class: 'two-col' },
        h('div', { class: 'card row gap' },
          h('div', { class: 'grow' }, h('div', { class: 'streak on small' }, icon('flame', 16, { fill: true }), t('Sequência atual')), h('div', { class: 'tile-val' }, tn('days', streaks.current))),
          h('div', { class: 'grow' }, h('div', { class: 'accent small row gap center' }, icon('trophy', 16), t('Melhor sequência')), h('div', { class: 'tile-val' }, tn('days', streaks.best)))),
        h('div', { class: 'card stack tight' }, row(t('Sessão mais longa'), L.duration(longest)), row(t('Ritmo médio'), L.pace(pace)), row(t('Tempo total'), L.duration(allT.seconds)), row(t('Livros lidos'), String(st.books.filter((b) => b.status === 'finished').length)))),
      h('div', { class: 'card' }, h('h3', null, t('Dias de leitura')), UI.heatmap(L.minutesByDay(st.sessions)), h('p', { class: 'muted small' }, t('Últimas 22 semanas. Quanto mais forte a cor, mais tempo leste.'))));
  }

  /* ---------- Conquistas ---------- */
  function achievements() {
    const st = S.state, snap = L.snapshot(st.books, st.sessions, st.shelves, st.settings);
    const total = L.ACHIEVEMENTS.length, count = st.unlocked.size;
    function detail(a) {
      const cat = L.catById[a.category], at = st.unlocked.get(a.id), value = cat.value(snap);
      UI.openModal((api) => h('div', { class: 'dialog center-text' }, UI.modalHeader(t(cat.title), api),
        h('div', { class: 'row center-x' }, UI.medal(a, !!at, 96)), h('h2', { class: 'serif' }, L.achTitle(a)),
        h('p', { class: 'muted' }, `${L.tierName(a.tier)} · ${t(cat.title)}`), h('p', null, L.achDetail(a)),
        at ? h('p', { class: 'accent strong' }, t('Desbloqueada a {d}', { d: L.longDate(at) })) : h('div', null, UI.progressBar(value / a.target, L.tierColor(a.tier)), h('p', { class: 'muted small' }, L.progressText(cat, value, a.target)))));
    }
    const cats = L.CATEGORIES.filter((c) => {
      const defs = L.ACHIEVEMENTS.filter((a) => a.category === c.id), n = defs.filter((a) => st.unlocked.has(a.id)).length;
      return achFilter === 'all' || (achFilter === 'unlocked' ? n > 0 : n < defs.length);
    });
    return h('div', { class: 'page' },
      pageHead(t('Conquistas'), null, seg([['all', t('Todas')], ['unlocked', t('Com medalhas')], ['locked', t('Por desbloquear')]], achFilter, (k) => { achFilter = k; })),
      h('div', { class: 'card row gap center' }, UI.ring(count / total, 96, icon('trophy', 26)), h('div', null, h('div', { class: 'tile-val' }, t('{a} de {b}', { a: count, b: total })), h('div', { class: 'muted' }, t('conquistas desbloqueadas')))),
      h('div', { class: 'ach-grid' }, ...cats.map((cat) => {
        const defs = L.ACHIEVEMENTS.filter((a) => a.category === cat.id), next = defs.find((a) => !st.unlocked.has(a.id)), value = cat.value(snap);
        return h('div', { class: 'card' },
          h('div', { class: 'row gap center' }, icon(cat.icon, 18, { cls: 'accent' }), h('h3', { class: 'serif grow' }, t(cat.title)), h('span', { class: 'muted small' }, `${defs.filter((a) => st.unlocked.has(a.id)).length}/${defs.length}`)),
          h('div', { class: 'medals' }, ...defs.map((a) => h('button', { class: 'medal-btn', title: L.achTitle(a), onClick: () => detail(a) }, UI.medal(a, st.unlocked.has(a.id), 58), h('span', { class: 'medal-name' }, L.tierName(a.tier))))),
          next ? h('div', { class: 'stack tight' }, h('div', { class: 'row between small' }, h('strong', null, t('Próxima: {name}', { name: L.achTitle(next) })), h('span', { class: 'muted' }, L.progressText(cat, value, next.target))), UI.progressBar(value / next.target, L.tierColor(next.tier)))
            : h('p', { class: 'accent strong small' }, t('Categoria completa')));
      })));
  }

  /* ---------- Recomendados ---------- */
  async function addToWishlist(it) {
    const b = S.newBook({ title: it.title, author: it.author, totalPages: it.pages || 0, status: 'wantToRead', genre: it.genre || '', color: (L.GENRES[it.genre] || [])[1] || L.SPINE_PALETTE[0] });
    await S.saveBook(b); await RF.app.checkAchievements(); RF.app.refresh();
  }
  const haveBook = (title, author) => S.state.books.some((b) => (b.title + '|' + b.author).toLowerCase() === (title + '|' + author).toLowerCase());
  const TAGS = { top: 'Mais vendido', hot: 'Em alta', new: 'Novidade' };

  function recCard(it, extra) {
    const fake = { id: it.title + it.author, title: it.title, color: (L.GENRES[it.genre] || [])[1] || '#2F4858', coverId: null };
    const have = haveBook(it.title, it.author);
    return h('div', { class: 'card rec-card' }, h('div', { class: 'row gap' }, UI.coverEl(fake, 62),
      h('div', { class: 'grow stack tight' }, h('div', { class: 'strong serif' }, it.title), h('div', { class: 'muted small' }, it.author),
        h('div', { class: 'row gap wrap center' }, it.tag ? h('span', { class: 'chip hot-chip' }, t(TAGS[it.tag])) : null, it.lang ? h('span', { class: 'chip' }, it.lang === 'pt' ? t('Português') : t('Inglês')) : null,
          it.genre ? h('span', { class: 'chip' }, t((L.GENRES[it.genre] || [''])[0])) : null, it.pages ? h('span', { class: 'muted tiny' }, t('~{n} págs', { n: it.pages })) : null), extra || null)),
      h('div', { class: 'row between center' }, have ? h('span', { class: 'muted small row gap center' }, icon('check', 14), t('Já está na tua biblioteca')) : h('button', { class: 'btn small-btn', onClick: () => addToWishlist(it) }, icon('plus', 14), t('Adicionar a «Quero ler»')),
        it.tag ? h('a', { class: 'link-btn', href: RF.catalog.wookSearchUrl(it), target: '_blank', rel: 'noopener' }, icon('send', 12), t('Ver na Wook')) : null));
  }

  function recommended() {
    const st = S.state;
    let body;
    if (recTab === 'foryou') {
      const trend = RF.catalog.trending(st.books, recLang), shown = recMore ? trend : trend.slice(0, 8);
      const when = new Date(2026, 9, 1).toLocaleDateString(RF.i18n.locale(), { month: 'long', year: 'numeric' });
      const list = RF.catalog.suggestions(st.books, recGenre).slice(0, 18);
      const liked = Object.keys(L.GENRES).filter((g) => st.books.some((b) => b.genre === g && (b.status === 'finished' || b.favorite)));
      body = h('div', { class: 'stack' },
        h('div', { class: 'card stack' }, h('div', { class: 'row between center wrap' }, h('h3', { class: 'row gap center' }, icon('activity', 16), t('Em alta (referência Wook)')),
          h('div', { class: 'row gap wrap' }, ...[['', t('Todos')], ['pt', t('Português')], ['en', t('Inglês')]].map(([k, label]) => h('button', { class: 'chip-btn' + (recLang === k ? ' on' : ''), onClick: () => { recLang = k; RF.app.refresh(); } }, label)))),
          h('p', { class: 'muted small' }, t('Seleção baseada nos mais vendidos e destaques da Wook, segundo a imprensa. Atualizada em {d}.', { d: when })),
          shown.length ? h('div', { class: 'rec-grid' }, ...shown.map((c) => recCard(c))) : emptyCard('gift', t('Já tens todas as sugestões deste género')),
          trend.length > 8 ? h('div', { class: 'row center-x' }, h('button', { class: 'btn small-btn', onClick: () => { recMore = !recMore; RF.app.refresh(); } }, recMore ? t('Mostrar menos') : t('Mostrar mais'))) : null),
        h('h3', { class: 'serif section-title' }, t('Pela tua leitura')),
        h('p', { class: 'muted' }, liked.length ? t('Sugestões com base nos géneros que mais lês.') : t('Marca o género dos teus livros para receberes sugestões à tua medida.')),
        h('div', { class: 'row gap wrap' }, h('button', { class: 'chip-btn' + (recGenre ? '' : ' on'), onClick: () => { recGenre = ''; RF.app.refresh(); } }, t('Todos')),
          ...Object.entries(L.GENRES).filter(([k]) => k !== 'other').map(([k, v]) => h('button', { class: 'chip-btn' + (recGenre === k ? ' on' : ''), onClick: () => { recGenre = k; RF.app.refresh(); } }, t(v[0])))),
        list.length ? h('div', { class: 'rec-grid' }, ...list.map((c) => recCard(c, c.reason ? h('div', { class: 'accent tiny' }, t('Porque lês {genre}', { genre: t(L.GENRES[c.reason][0]).toLowerCase() })) : null)))
          : emptyCard('gift', t('Já tens todas as sugestões deste género'), t('Experimenta outro género.')));
    } else if (recTab === 'friends') {
      const items = RF.remote.signedIn() ? RF.remote.recommendations() : [];
      body = items.length ? h('div', { class: 'rec-grid' }, ...items.map((r) => recCard({ title: r.title, author: r.author },
        h('div', { class: 'row gap center small link', onClick: () => RF.app.go('friend:' + r.u.id) }, UI.avatar(22, { name: r.u.name, color: r.u.color, photo: r.u.avatar }), h('span', null, t('{name} recomenda', { name: r.u.name })), r.note ? h('span', { class: 'muted' }, '· ' + r.note) : null))))
        : emptyCard('users', t('Ainda não há recomendações de amigos'), t('Segue amigos na página Amigos e as recomendações deles aparecem aqui.'), h('button', { class: 'btn primary', onClick: () => RF.app.go('friends') }, icon('users', 16), t('Ir para Amigos')));
    } else {
      const mine = st.books.filter((b) => b.recommend);
      body = mine.length ? h('div', { class: 'rec-grid' }, ...mine.map((b) => h('div', { class: 'card rec-card' }, h('div', { class: 'row gap link', onClick: () => RF.app.go('book:' + b.id) }, UI.coverEl(b, 62),
        h('div', { class: 'grow stack tight' }, h('div', { class: 'strong serif' }, b.title), h('div', { class: 'muted small' }, b.author), b.recNote ? h('div', { class: 'small' }, '“' + b.recNote + '”') : h('div', { class: 'muted small' }, t('Sem nota'))),
        h('button', { class: 'icon-btn', title: t('Deixar de recomendar'), onClick: (e) => { e.stopPropagation(); toggleFlag(b, 'recommend'); } }, icon('x', 16))))))
        : emptyCard('gift', t('Ainda não recomendaste nenhum livro'), t('Abre um livro e carrega em «Recomendo» para ele aparecer aqui e no teu perfil.'));
    }
    return h('div', { class: 'page' }, pageHead(t('Recomendados'), t('Descobre o que ler a seguir.'), seg([['foryou', t('Para ti')], ['friends', t('Dos amigos')], ['mine', t('As minhas recomendações')]], recTab, (k) => { recTab = k; })), body);
  }

  /* ---------- Amigos ---------- */
  const openFriend = (id) => RF.app.go('friend:' + id);
  const personRow = (u, actions) => h('div', { class: 'person' }, h('div', { class: 'row gap center grow link', onClick: () => openFriend(u.id) }, UI.avatar(42, { name: u.name, color: u.color, photo: u.avatar }),
    h('div', null, h('div', { class: 'strong' }, u.name), h('div', { class: 'muted small' }, u.id))), h('div', { class: 'row gap' }, ...actions));
  /** Executa uma ação do servidor e mostra o erro, se houver. */
  async function act(fn) {
    try { await fn(); } catch (e) { UI.toastAchievements([{ type: 'info', name: RF.remote.explain(e) }]); }
    RF.app.refresh();
  }
  let authMode = 'signin', authMsg = '', authBusy = false;

  function authPage() {
    const R = RF.remote, st = S.state.settings;
    const idIn = h('input', { type: 'text', placeholder: authMode === 'signin' ? t('nome#123456') : t('Nome de utilizador (3 a 16 letras ou números)'), autocomplete: 'username' });
    const nameIn = h('input', { type: 'text', value: st.name || '', placeholder: t('Como te chamas?') });
    const inviteIn = h('input', { type: 'text', placeholder: t('Código de convite (se existir)') });
    const pw = h('input', { type: 'password', placeholder: t('Palavra-passe (mínimo 8 caracteres)'), autocomplete: authMode === 'signin' ? 'current-password' : 'new-password' });
    const pw2 = h('input', { type: 'password', placeholder: t('Repete a palavra-passe'), autocomplete: 'new-password' });
    const msg = h('div', { class: 'err-note' }, authMsg);
    const submit = h('button', { class: 'btn primary', disabled: authBusy, onClick: async () => {
      if (authMode === 'signup' && pw.value !== pw2.value) { authMsg = t('As palavras-passe não coincidem.'); msg.textContent = authMsg; return; }
      authBusy = true; authMsg = ''; submit.disabled = true; msg.textContent = '';
      try {
        const u = authMode === 'signin' ? await R.signIn(idIn.value, pw.value) : await R.signUp(idIn.value, pw.value, nameIn.value.trim(), inviteIn.value);
        if (authMode === 'signup') { if (!st.name && nameIn.value.trim()) { st.name = nameIn.value.trim(); await S.saveSettings(); } UI.toastAchievements([{ type: 'info', name: t('Conta criada! O teu ID é {id}', { id: u.handle }) }]); }
      } catch (e) { authMsg = R.explain(e); }
      authBusy = false; RF.app.refresh();
    } }, icon(authMode === 'signin' ? 'user' : 'userPlus', 16), authMode === 'signin' ? t('Entrar') : t('Criar conta'));
    pw.addEventListener('keydown', (e) => { if (e.key === 'Enter' && authMode === 'signin') submit.click(); });
    return h('div', { class: 'page narrow' }, pageHead(t('Amigos'), t('Segue leitores e partilha só o que quiseres.')),
      h('div', { class: 'card stack' }, seg([['signin', t('Entrar')], ['signup', t('Criar conta')]], authMode, (k) => { authMode = k; authMsg = ''; }),
        h('label', { class: 'field' }, h('span', null, authMode === 'signin' ? t('O teu ID') : t('Nome de utilizador')), idIn),
        authMode === 'signup' ? h('label', { class: 'field' }, h('span', null, t('Nome a mostrar')), nameIn) : null,
        h('label', { class: 'field' }, h('span', null, t('Palavra-passe')), pw),
        authMode === 'signup' ? h('label', { class: 'field' }, h('span', null, t('Repete a palavra-passe')), pw2) : null,
        authMode === 'signup' ? h('label', { class: 'field' }, h('span', null, t('Código de convite')), inviteIn) : null,
        msg, h('div', { class: 'row end' }, submit),
        h('p', { class: 'muted small' }, authMode === 'signup' ? t('Recebes um ID único (nome#123456). Não pedimos e-mail: guarda bem a palavra-passe, porque não é possível recuperá-la.') : t('Usa o ID que recebeste ao criar a conta, por exemplo nome#123456.'))),
      h('div', { class: 'card flat stack tight' }, h('div', { class: 'row between center wrap' }, h('div', { class: 'strong' }, t('Ligação ao servidor')),
        h('button', { class: 'btn small-btn', onClick: async (e) => { const out = h('span', { class: 'small' }, t('A testar…')); e.target.after(out); const d = await R.diagnose();
          const M = { not_configured: 'A ligação online ainda não está configurada.', signup_disabled: 'Os registos de novas contas estão desativados no Supabase.', confirm_email: 'A confirmação por e-mail está ligada no Supabase. Desliga «Confirm email» (ver o guia).', network: 'Não foi possível ligar. Verifica a internet.', bad_key: 'A chave ou o URL em config.js não são válidos.', unknown: 'Algo correu mal. Tenta outra vez.' };
          out.textContent = d.ok ? t('Ligação ao servidor OK.') : t(M[d.problem]); out.className = 'small ' + (d.ok ? 'accent strong' : 'err-note'); } }, icon('activity', 14), t('Testar ligação'))),
        h('p', { class: 'muted small' }, t('Confirma que o URL e a chave de config.js estão certos e que o servidor aceita contas novas.'))),
      h('div', { class: 'card flat stack tight' }, h('div', { class: 'strong' }, t('O que é partilhado?')),
        h('p', { class: 'muted small' }, t('Só o que tu ligares em Privacidade, e só com quem aceitares. As fotos dos teus livros e as tuas notas ficam sempre neste computador.'))));
  }

  function friends() {
    const R = RF.remote;
    if (!R.configured()) return h('div', { class: 'page narrow' }, pageHead(t('Amigos'), null), emptyCard('lock', t('A ligação online ainda não está configurada.'), t('Segue o guia docs\\PASSO-A-PASSO.md para ligar o ReadFlow ao teu servidor.')));
    if (!R.signedIn()) return authPage();
    const st = S.state.settings, me = R.state.user, cache = R.cache;
    const input = h('input', { type: 'text', placeholder: t('nome#123456'), onKeydown: (e) => { if (e.key === 'Enter') add(); } });
    const msg = h('div', { class: 'muted small' });
    async function add() {
      msg.textContent = '';
      try { await R.follow(input.value); input.value = ''; msg.textContent = t('Pedido enviado. A pessoa tem de o aceitar.'); RF.app.refresh(); }
      catch (e) { msg.textContent = R.explain(e); }
    }
    const incoming = cache.followers.filter((f) => f.status === 'pending');
    const followers = cache.followers.filter((f) => f.status === 'accepted');
    const following = cache.following;

    let tabBody;
    if (friendsTab === 'feed') {
      const posts = friendPosts();
      tabBody = posts.length ? h('div', { class: 'stack' }, ...posts.slice(0, 30).map(({ u, p }) => friendPostCard(u, p)))
        : emptyCard('activity', t('Sem atividade para mostrar'), t('Quando seguires amigos, as leituras deles aparecem aqui.'));
    } else if (friendsTab === 'followers') {
      tabBody = followers.length ? h('div', { class: 'card stack' }, ...followers.map((u) => personRow(u, [h('button', { class: 'btn small-btn', onClick: () => act(() => R.removeFollower(u.id)) }, t('Remover'))])))
        : emptyCard('users', t('Ainda ninguém te segue'), t('Partilha o teu ID para as pessoas poderem pedir para te seguir.'));
    } else if (friendsTab === 'following') {
      tabBody = following.length ? h('div', { class: 'card stack' }, ...following.map((u) => personRow(u, [u.status === 'pending' ? h('span', { class: 'chip' }, t('Pedido enviado')) : null,
        h('button', { class: 'btn small-btn', onClick: () => act(() => R.unfollow(u.id)) }, u.status === 'pending' ? t('Cancelar') : t('Deixar de seguir'))])))
        : emptyCard('userPlus', t('Ainda não segues ninguém'), t('Escreve o ID de uma pessoa acima para pedir para a seguir.'));
    } else {
      tabBody = h('div', { class: 'card stack' }, h('h3', null, t('O que os teus seguidores aprovados podem ver')),
        h('p', { class: 'muted small' }, t('Só as pessoas cujo pedido aceitaste veem o teu perfil. Escolhe o que mostras.')),
        ...SOC.PRIVACY_KEYS.map(([k, label]) => h('label', { class: 'switch-row' }, h('span', null, t(label)), h('input', { type: 'checkbox', class: 'switch', checked: !!st.privacy[k], onChange: async (e) => { st.privacy[k] = e.target.checked; await S.saveSettings(); R.schedulePush(400); } }))),
        h('p', { class: 'muted small' }, t('Só enviamos para o servidor o que estiver ligado. Ao desligar uma secção, ela é apagada do servidor.')),
        h('div', { class: 'row end' }, h('button', { class: 'btn', onClick: () => openMyPreview() }, icon('eye', 16), t('Ver como um seguidor'))));
    }
    const status = R.state.offline ? t('Sem ligação. Os dados são enviados quando voltar a internet.') : R.state.lastSync ? t('Sincronizado {ago}', { ago: agoFromMs(R.state.lastSync) }) : t('A sincronizar…');
    return h('div', { class: 'page' }, pageHead(t('Amigos'), t('Segue leitores e partilha só o que quiseres.')),
      h('div', { class: 'two-col' },
        h('div', { class: 'card stack' }, h('h3', null, t('O teu ID')),
          h('div', { class: 'id-box' }, h('span', { class: 'serif big' }, me.handle), h('button', { class: 'icon-btn', title: t('Copiar'), onClick: () => navigator.clipboard && navigator.clipboard.writeText(me.handle) }, icon('copy', 16))),
          h('p', { class: 'muted small' }, t('Outras pessoas encontram-te por este ID. Os 6 números são únicos.')),
          h('div', { class: 'row between center wrap' }, h('span', { class: 'muted small' }, status), h('button', { class: 'btn small-btn', onClick: () => act(() => R.pull(true)) }, icon('rotate', 14), t('Sincronizar agora')))),
        h('div', { class: 'card stack' }, h('h3', null, t('Seguir alguém')), h('div', { class: 'row gap' }, input, h('button', { class: 'btn primary', onClick: add }, icon('send', 16), t('Pedir'))), msg, h('p', { class: 'muted small' }, t('A pessoa tem de aceitar o pedido antes de veres o perfil dela.')))),
      incoming.length ? h('div', { class: 'card stack' }, h('h3', null, t('Pedidos para te seguirem')), ...incoming.map((u) => personRow(u, [h('button', { class: 'btn primary small-btn', onClick: () => act(() => R.respond(u.id, true)) }, t('Aceitar')), h('button', { class: 'btn small-btn', onClick: () => act(() => R.respond(u.id, false)) }, t('Recusar'))]))) : null,
      seg([['feed', t('Atividade')], ['followers', t('Seguidores')], ['following', t('A seguir')], ['privacy', t('Privacidade')]], friendsTab, (k) => { friendsTab = k; }), tabBody,
      h('div', { class: 'card flat stack tight' }, h('div', { class: 'strong' }, t('Conta online')),
        h('div', { class: 'row gap wrap' }, h('button', { class: 'btn', onClick: () => act(() => R.signOut()) }, t('Terminar sessão')),
          h('button', { class: 'btn danger-text', onClick: async () => { if (await UI.confirmDialog({ title: t('Apagar a conta online?'), message: t('O teu perfil, pedidos e dados partilhados são apagados do servidor. Os teus livros neste computador não são afetados.'), confirmLabel: t('Apagar conta'), danger: true })) act(() => R.deleteAccount()); } }, icon('trash', 16), t('Apagar conta online')))));
  }

  /* ---------- Perfil público (de um amigo ou o meu em pré-visualização) ---------- */
  const KIND_TITLES = { reading: 'A ler agora', favorites: 'Favoritos', finished: 'Livros lidos', recs: 'Recomendações', activity: 'Atividade' };
  const thumb = (it, withNote) => h('div', { class: 'thumb', title: it.title + (it.author ? ' — ' + it.author : '') }, UI.coverEl(it, 76), h('span', { class: 'small strong clip2' }, it.title), withNote && it.note ? h('span', { class: 'muted tiny clip2' }, '“' + it.note + '”') : null);
  const activityLine = (a) => h('div', { class: 'card flat stack tight session-card' }, h('div', { class: 'row between center' }, h('span', { class: 'strong serif clip' }, a.book || t('Livro removido')), h('span', { class: 'muted small' }, agoFromMs(a.when))),
    unlockChips(a.unlocked), h('div', { class: 'metrics' }, metric(t('Tempo'), L.duration(a.minutes * 60)), metric(t('Páginas'), String(a.pages)), metric(t('Ritmo'), L.pace(a.minutes > 0 ? a.pages / (a.minutes / 60) : 0))));

  function publicView(p, ctx) {
    const sec = p.sections;
    const bookSection = (key, ic) => {
      const items = sec[key], title = t(KIND_TITLES[key]);
      if (items === undefined) return lockedCard(title, ic);
      return h('div', { class: 'card stack' }, h('div', { class: 'row between center' }, h('h3', { class: 'row gap center' }, icon(ic, 16), title, h('span', { class: 'count' }, String(items.length))),
        items.length > MAX_SHOWN ? h('button', { class: 'btn small-btn', onClick: () => ctx.onMore(key) }, t('Ver mais')) : null),
        items.length ? h('div', { class: 'thumb-row' }, ...items.slice(0, MAX_SHOWN).map((it) => thumb(it, key === 'recs'))) : h('span', { class: 'muted small' }, '—'));
    };
    const st = sec.stats;
    return h('div', { class: 'stack' },
      h('div', { class: 'card row gap center' }, UI.avatar(84, { name: p.name, color: p.color, photo: p.photo }), h('div', { class: 'stack tight grow' }, h('h1', { class: 'serif' }, p.name), h('div', { class: 'muted' }, p.id),
        sec.bio !== undefined ? h('p', null, sec.bio ? sec.bio : h('span', { class: 'muted' }, t('Sem descrição'))) : h('p', { class: 'muted small row gap center' }, icon('lock', 14), t('Descrição privada')))),
      st !== undefined ? h('div', { class: 'tiles three' }, tile('clock', t('Horas lidas'), String(st.hours)), tile('file', t('Páginas'), String(st.pages)), tile('check', t('Livros terminados'), String(st.books)),
        tile('list', t('Sessões'), String(st.sessions || 0)), tile('flame', t('Sequência atual'), tn('days', st.streak || 0)), tile('activity', t('Ritmo médio'), L.pace(st.pace || 0))) : lockedCard(t('Estatísticas'), 'chart'),
      bookSection('reading', 'book'), bookSection('favorites', 'heart'), bookSection('finished', 'check'), bookSection('recs', 'gift'),
      sec.activity === undefined ? lockedCard(t('Atividade'), 'activity') : h('div', { class: 'card stack' }, h('div', { class: 'row between center' }, h('h3', { class: 'row gap center' }, icon('activity', 16), t('Atividade'), h('span', { class: 'count' }, String(sec.activity.length))),
        sec.activity.length > 3 ? h('button', { class: 'btn small-btn', onClick: () => ctx.onMore('activity') }, t('Ver mais')) : null),
        sec.activity.length ? h('div', { class: 'stack' }, ...sec.activity.slice(0, 3).map(activityLine)) : h('span', { class: 'muted small' }, '—')),
      sec.achievements === undefined ? lockedCard(t('Conquistas'), 'trophy') : h('div', { class: 'card stack' }, h('h3', { class: 'row gap center' }, icon('trophy', 16), t('Conquistas'), h('span', { class: 'count' }, String(sec.achievements.length))),
        sec.achievements.length ? h('div', { class: 'medals' }, ...sec.achievements.map((id) => L.achById[id]).filter(Boolean).map((a) => h('div', { class: 'medal-btn', title: L.achTitle(a) }, UI.medal(a, true, 52), h('span', { class: 'medal-name' }, L.achTitle(a))))) : h('span', { class: 'muted small' }, '—')));
  }

  /** Lista completa (miniaturas de todos os livros ou todas as atividades). */
  function listView(p, kind, onBack) {
    const items = p.sections[kind] || [];
    return h('div', { class: 'stack' }, h('button', { class: 'btn ghost back', onClick: onBack }, icon('back', 18), t('Voltar')),
      h('div', { class: 'row gap center' }, UI.avatar(40, { name: p.name, color: p.color, photo: p.photo }), h('div', null, h('h2', { class: 'serif' }, t(KIND_TITLES[kind])), h('div', { class: 'muted small' }, `${p.name} · ${items.length}`))),
      kind === 'activity' ? h('div', { class: 'stack' }, ...items.map(activityLine))
        : h('div', { class: 'full-list' }, ...items.map((it) => h('div', { class: 'full-item', title: it.title }, UI.coverEl(it, 96), h('div', { class: 'strong small clip2' }, it.title), h('div', { class: 'muted tiny clip' }, it.author), kind === 'recs' && it.note ? h('div', { class: 'muted tiny clip2' }, '“' + it.note + '”') : null))));
  }

  const remotePublic = (f) => ({ name: f.name, id: f.id, color: f.color, photo: f.avatar, sections: RF.remote.sectionsOf(f.id) || {} });
  function openMyPreview() {
    const mine = SOC.myPublicProfile(S);
    mine.photo = S.imgUrl(mine.photoId);
    UI.openModal((api) => {
      const body = h('div', { class: 'stack' });
      const show = (kind) => body.replaceChildren(kind ? listView(mine, kind, () => show(null)) : publicView(mine, { onMore: show }));
      show(null);
      return h('div', { class: 'dialog wide' }, UI.modalHeader(t('Assim te veem os teus seguidores'), api), body, h('div', { class: 'row end' }, h('button', { class: 'btn primary', onClick: () => api.close() }, t('Fechar'))));
    }, { wide: true });
  }

  /** Perfil de uma pessoa. Sem aprovação só se vê o cartão e a opção de seguir. */
  function friendView(id) {
    const R = RF.remote, person = R.person(id);
    if (!R.signedIn() || !person) { setTimeout(() => RF.app.go('friends'), 0); return h('div'); }
    const rel = R.relation(id), back = h('button', { class: 'btn ghost back', onClick: () => RF.app.go('friends') }, icon('back', 18), t('Amigos'));
    if (rel.iFollow !== 'accepted') {
      const pending = rel.iFollow === 'pending';
      return h('div', { class: 'page narrow' }, back, h('div', { class: 'card stack' }, h('div', { class: 'row gap center' }, UI.avatar(84, { name: person.name, color: person.color, photo: person.avatar }),
        h('div', { class: 'stack tight grow' }, h('h1', { class: 'serif' }, person.name), h('div', { class: 'muted' }, person.id), rel.followsMe === 'accepted' ? h('span', { class: 'chip' }, t('Segue-te')) : null)),
        h('div', { class: 'row gap center muted' }, icon('lock', 16), t('Segue esta pessoa e espera que ela aceite o pedido para veres o perfil.')),
        pending ? h('div', { class: 'row gap' }, h('span', { class: 'chip' }, t('Pedido enviado')), h('button', { class: 'btn small-btn', onClick: () => act(() => R.unfollow(id)) }, t('Cancelar')))
          : h('button', { class: 'btn primary', onClick: () => act(() => R.follow(id)) }, icon('userPlus', 16), t('Seguir'))));
    }
    return h('div', { class: 'page narrow' }, back, publicView(remotePublic(person), { onMore: (kind) => RF.app.go('friendlist:' + id + ':' + kind) }),
      h('div', { class: 'row end' }, h('button', { class: 'btn danger-text', onClick: async () => { await act(() => R.unfollow(id)); RF.app.go('friends'); } }, t('Deixar de seguir'))));
  }
  function friendListView(id, kind) {
    const R = RF.remote, person = R.person(id);
    if (!R.signedIn() || !person || R.relation(id).iFollow !== 'accepted') { setTimeout(() => RF.app.go('friend:' + id), 0); return h('div'); }
    return h('div', { class: 'page narrow' }, listView(remotePublic(person), kind, () => RF.app.go('friend:' + id)));
  }

  /* ---------- Perfil ---------- */
  function updateText(p) {
    if (!p) return '';
    switch (p.status) {
      case 'checking': return t('A procurar atualizações…');
      case 'available': return t('Nova versão {v} encontrada. A descarregar…', { v: p.version || '' });
      case 'downloading': return t('A descarregar… {n}%', { n: p.percent || 0 });
      case 'downloaded': return t('Versão {v} pronta. Reinicia a app para atualizar.', { v: p.version || '' });
      case 'none': return t('Estás na versão mais recente.');
      case 'error': return t('Não foi possível procurar atualizações.');
      default: return '';
    }
  }

  function profile() {
    const st = S.state, s = st.settings, tt = L.totals(st.sessions);
    const finished = st.books.filter((b) => b.status === 'finished').length, favs = st.books.filter((b) => b.favorite);
    const save = () => S.saveSettings();
    const num = (key, min, max, step) => h('input', { type: 'number', min, max, step, value: s[key], onChange: (e) => { const v = Math.min(max, Math.max(min, parseInt(e.target.value, 10) || min)); e.target.value = v; s[key] = v; save(); } });
    const importInput = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onChange: async (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!(await UI.confirmDialog({ title: t('Importar cópia de segurança?'), message: t('Isto substitui todos os dados atuais.'), confirmLabel: t('Importar'), danger: true }))) return;
        await S.importAll(data); RF.i18n.setLang(S.state.settings.lang); RF.app.applyTheme(); await RF.app.checkAchievements(true); RF.app.refresh();
      } catch (err) { UI.openModal((m) => h('div', { class: 'dialog' }, h('h2', null, t('Ficheiro inválido')), h('p', { class: 'muted' }, t('Escolhe um ficheiro de cópia de segurança criado pelo ReadFlow.')), h('div', { class: 'row end' }, h('button', { class: 'btn primary', onClick: () => m.close() }, t('OK'))))); }
    } });
    const bio = h('textarea', { rows: 3, maxLength: 280, placeholder: t('Escreve algo sobre ti: o que gostas de ler, o teu livro de sempre…'), onChange: async (e) => { s.bio = e.target.value.trim(); await save(); await RF.app.checkAchievements(); RF.app.refresh(); } }, s.bio || '');
    const THEME_NAMES = [['classic', 'Clássico'], ['light', 'Claro'], ['dark', 'Escuro'], ['cream', 'Creme']];
    const verEl = h('strong', null, APP_VERSION), updEl = h('span', { id: 'update-status', class: 'muted small' }, root.readflowApp ? updateText(RF.updateInfo) : t('Disponível na versão instalada.'));
    if (root.readflowApp) root.readflowApp.getVersion().then((v) => { verEl.textContent = v; }).catch(() => {});

    return h('div', { class: 'page narrow' }, pageHead(t('Perfil'), null),
      h('div', { class: 'card stack' },
        h('div', { class: 'row gap center' }, UI.avatar(96),
          h('div', { class: 'grow stack tight' }, h('input', { type: 'text', class: 'name-input serif', value: s.name, placeholder: t('Como te chamas?'), onChange: (e) => { s.name = e.target.value.trim(); save(); RF.app.refresh(); } }),
            h('span', { class: 'muted small' }, `${L.duration(tt.seconds)} · ${t('{n} págs', { n: tt.pages })} · ${tn('books', finished)}`),
            h('div', { class: 'row gap wrap' }, UI.photoPicker(async (blob) => { await S.removeImage(s.photoId); s.photoId = await S.addImage(blob); await save(); await RF.app.checkAchievements(); RF.app.refresh(); }, { crop: true, title: t('Enquadrar foto de perfil'), aspect: 1, outW: 512 }),
              s.photoId ? h('button', { class: 'btn ghost danger-text', onClick: async () => { await S.removeImage(s.photoId); s.photoId = null; await save(); RF.app.refresh(); } }, icon('trash', 14), t('Remover foto')) : null))),
        h('label', { class: 'field' }, h('span', null, t('Descrição')), bio)),
      h('div', { class: 'card stack' }, h('div', { class: 'row between' }, h('h3', { class: 'row gap center' }, icon('heart', 16, { fill: true }), t('Livros favoritos')), favs.length ? h('span', { class: 'muted small' }, tn('books', favs.length)) : null),
        favs.length ? h('div', { class: 'fav-row' }, ...favs.map((b) => h('button', { class: 'cover-item', onClick: () => RF.app.go('book:' + b.id) }, UI.coverEl(b, 92), h('span', { class: 'small strong clip2' }, b.title)))) : h('p', { class: 'muted small' }, t('Abre um livro e carrega em «Favorito» para ele aparecer aqui.'))),
      h('div', { class: 'card stack' }, h('h3', { class: 'row gap center' }, icon('palette', 16), t('Aparência')),
        h('div', { class: 'theme-row' }, ...THEME_NAMES.map(([id, name]) => h('button', { class: 'theme-card' + ((s.appTheme || 'classic') === id ? ' on' : ''), onClick: async () => { s.appTheme = id; await save(); RF.app.applyTheme(); RF.app.refresh(); } },
          h('div', { class: 'theme-prev', 'data-theme': id }, h('i', { class: 'tp-side' }), h('i', { class: 'tp-bar' }), h('i', { class: 'tp-card' }), h('i', { class: 'tp-card' })), h('span', { class: 'small strong' }, t(name))))),
        h('div', { class: 'field' }, h('span', null, t('Idioma')), h('div', { class: 'seg lang-seg' }, ...RF.i18n.LANGS.map((l) => h('button', { class: 'seg-btn' + (s.lang === l.id ? ' on' : ''), onClick: async () => { s.lang = l.id; RF.i18n.setLang(l.id); await save(); RF.app.applyTheme(); RF.app.refresh(); } }, icon('globe', 14), l.name))))),
      h('div', { class: 'card stack' }, h('h3', null, t('Metas')),
        h('label', { class: 'field' }, h('span', null, t('Meta de leitura diária (minutos)')), num('dailyGoal', 5, 600, 5)),
        h('label', { class: 'field' }, h('span', null, t('Meta de páginas por semana')), num('weeklyGoal', 10, 5000, 10))),
      h('div', { class: 'card stack' }, h('h3', null, t('Atualizações')),
        h('div', { class: 'row between center wrap' }, h('div', { class: 'stack tight' }, h('div', null, t('Versão'), ' ', verEl), updEl),
          h('button', { class: 'btn', onClick: async () => { if (root.readflowApp) { const r = await root.readflowApp.checkUpdates(); if (r && r.status === 'unavailable') updEl.textContent = t('Disponível na versão instalada.'); } } }, icon('download', 16), t('Procurar atualizações')))),
      h('div', { class: 'card stack' }, h('h3', null, t('Dados')), h('p', { class: 'muted small' }, t('Os teus dados ficam guardados neste computador. Faz uma cópia de segurança de vez em quando.')),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'btn', onClick: async () => {
            const blob = new Blob([JSON.stringify(await S.exportAll())], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `readflow-backup-${new Date().toISOString().slice(0, 10)}.json` });
            document.body.append(a); a.click(); a.remove();
          } }, icon('download', 16), t('Exportar cópia de segurança')),
          importInput, h('button', { class: 'btn', onClick: () => importInput.click() }, icon('upload', 16), t('Importar cópia'))),
        h('div', { class: 'row gap wrap' },
          h('button', { class: 'btn', onClick: async () => { await S.loadSample(); await RF.app.checkAchievements(true); await RF.shelf.syncCosmetics(true); RF.app.refresh(); } }, icon('star', 16), t('Carregar dados de exemplo')),
          h('button', { class: 'btn danger-text', onClick: async () => {
            if (await UI.confirmDialog({ title: t('Apagar todos os dados?'), message: t('Livros, sessões, prateleiras e conquistas serão removidos. Esta ação não pode ser desfeita.'), confirmLabel: t('Apagar tudo'), danger: true })) {
              if (RF.session.active) await RF.session.reset();
              await S.wipe(); RF.i18n.setLang('pt'); RF.app.applyTheme(); RF.app.refresh();
            }
          } }, icon('trash', 16), t('Apagar todos os dados')))),
      h('p', { class: 'muted small center-text' }, t('ReadFlow {v} · versão para computador', { v: APP_VERSION })));
  }

  RF.updateText = updateText;
  RF.views = { home, library, bookView, stats, achievements, recommended, friends, friendView, friendListView, profile };
})(typeof window !== 'undefined' ? window : globalThis);
