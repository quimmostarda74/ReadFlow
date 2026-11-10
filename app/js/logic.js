/* ReadFlow — lógica pura (datas, formatação, conquistas, estatísticas, regras de desbloqueio). Sem DOM. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});

  const tr = (k, p) => (RF.i18n ? RF.i18n.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, n) => (p && p[n] !== undefined ? p[n] : m)));
  const loc = () => (RF.i18n ? RF.i18n.locale() : 'pt-PT');

  const SPINE_PALETTE = ['#2F4858', '#8C2F39', '#1B4332', '#B5651D', '#3D348B', '#0B6E4F',
    '#7A3E65', '#2B2D42', '#A23E48', '#4A6FA5', '#C08552', '#5C6B73'];
  const TIER_NAMES = ['Bronze', 'Prata', 'Ouro', 'Platina', 'Diamante', 'Lenda'];
  const TIER_HEX = ['#B87333', '#A8B0BD', '#F2B632', '#4FC3D9', '#8B7BFF', '#FF4F2E'];
  const STATUS = {
    wantToRead: { title: 'Quero ler', icon: 'bookmark' },
    reading: { title: 'A ler', icon: 'book' },
    finished: { title: 'Lido', icon: 'check' }
  };
  const GENRES = {
    classics: ['Clássicos', '#7A3E65'], fiction: ['Ficção', '#2F4858'], romance: ['Romance', '#A23E48'],
    crime: ['Policial e thriller', '#2B2D42'], fantasy: ['Fantasia', '#3D348B'], scifi: ['Ficção científica', '#4A6FA5'],
    history: ['História', '#B5651D'], science: ['Ciência', '#0B6E4F'], selfhelp: ['Desenvolvimento pessoal', '#C08552'],
    biography: ['Biografia', '#5C6B73'], poetry: ['Poesia', '#8C2F39'], kids: ['Infantil e juvenil', '#1B4332'], other: ['Outro', '#5C6B73']
  };

  const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  /* ---------- Datas ---------- */
  function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addDays(ms, n) { const d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }
  function startOfMonth(ms) { const d = new Date(ms); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addMonths(ms, n) { const d = new Date(startOfMonth(ms)); d.setMonth(d.getMonth() + n); return d.getTime(); }
  function startOfWeek(ms) { const d = new Date(startOfDay(ms)); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
  function isSameDay(a, b) { return startOfDay(a) === startOfDay(b); }

  /* ---------- Formatação ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  function duration(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    if (h > 0) return m > 0 ? tr('{h} h {m} min', { h, m }) : tr('{h} h', { h });
    if (m > 0) return tr('{m} min', { m });
    return tr('{s} s', { s: sec });
  }
  function clock(sec) {
    sec = Math.max(0, Math.floor(sec));
    return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
  }
  const pace = (pph) => (pph > 0 ? tr('{n} pág/h', { n: Math.round(pph) }) : '—');
  const timeText = (ms) => new Date(ms).toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit' });
  const shortDate = (ms) => new Date(ms).toLocaleDateString(loc(), { day: 'numeric', month: 'short' });
  const longDate = (ms) => new Date(ms).toLocaleDateString(loc(), { day: 'numeric', month: 'long', year: 'numeric' });
  function relativeDay(ms) {
    const now = Date.now();
    if (isSameDay(ms, now)) return tr('Hoje, {time}', { time: timeText(ms) });
    if (isSameDay(ms, addDays(now, -1))) return tr('Ontem, {time}', { time: timeText(ms) });
    return `${shortDate(ms)}, ${timeText(ms)}`;
  }
  const weekdayLetter = (ms) => new Date(ms).toLocaleDateString(loc(), { weekday: 'narrow' }).toUpperCase();
  const weekdayShort = (ms) => new Date(ms).toLocaleDateString(loc(), { weekday: 'short' }).replace('.', '');
  const monthShort = (ms) => new Date(ms).toLocaleDateString(loc(), { month: 'short' }).replace('.', '');

  /* ---------- Cores e lombadas ---------- */
  function rgb(hex) { const v = parseInt(hex.replace('#', ''), 16); return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }; }
  function isDark(hex) { const c = rgb(hex); return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 < 0.6; }
  const textOn = (hex) => (isDark(hex) ? '#FFFFFF' : '#1C1C1E');
  function hashStr(s) { let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  const spineHeight = (book) => 190 + (hashStr(book.id) % 46);
  const spineWidth = (book) => Math.round(Math.min(62, Math.max(30, 24 + (book.totalPages || 0) / 11)));

  /* ---------- Sessões e livros ---------- */
  const pagesRead = (s) => Math.max(0, s.endPage - s.startPage);
  const pagesPerHour = (s) => (s.durationSeconds > 0 ? pagesRead(s) / (s.durationSeconds / 3600) : 0);
  const bookProgress = (b) => (b.totalPages > 0 ? Math.min(1, b.currentPage / b.totalPages) : 0);
  const bookSessions = (sessions, bookId) => sessions.filter((s) => s.bookId === bookId);

  /* ---------- Sequências ---------- */
  function activeDays(sessions) {
    const set = new Set();
    for (const s of sessions) if (s.durationSeconds >= 60) set.add(startOfDay(s.start));
    return set;
  }
  function computeStreaks(days, now = Date.now()) {
    const sorted = [...days].sort((a, b) => a - b);
    let best = 0, run = 0, prev = null;
    for (const d of sorted) { run = (prev !== null && addDays(prev, 1) === d) ? run + 1 : 1; best = Math.max(best, run); prev = d; }
    let current = 0, cursor = startOfDay(now);
    if (!days.has(cursor)) cursor = addDays(cursor, -1);
    while (days.has(cursor)) { current++; cursor = addDays(cursor, -1); }
    return { current, best };
  }

  /* ---------- Conquistas ---------- */
  // [id, título, ícone, unidade, valor(snapshot), texto do detalhe, níveis, nomes]
  const CAT_ROWS = [
    ['time', 'Tempo de leitura', 'clock', ' h', (s) => s.totalSeconds / 3600, 'Horas de leitura no total: {n}', [1, 10, 50, 100, 500, 1000],
      ['Primeira hora', 'Leitor dedicado', 'Devorador de horas', 'Centurião', 'Mestre do tempo', 'Uma vida a ler']],
    ['pages', 'Páginas lidas', 'file', '', (s) => s.totalPages, 'Páginas lidas no total: {n}', [100, 1000, 5000, 10000, 50000, 100000],
      ['Primeiras cem', 'Mil páginas', 'Cinco mil e a andar', 'Dez mil páginas', 'Biblioteca ambulante', 'Enciclopédia viva']],
    ['finished', 'Livros terminados', 'check', '', (s) => s.booksFinished, 'Livros terminados: {n}', [1, 5, 10, 25, 50, 100],
      ['Primeiro livro', 'Cinco livros', 'Dez livros', 'Vinte e cinco', 'Meio centenário', 'Centenário']],
    ['streak', 'Dias seguidos', 'flame', '', (s) => s.bestStreak, 'Dias seguidos a ler: {n}', [3, 7, 30, 100, 365],
      ['Aquecimento', 'Semana perfeita', 'Um mês de leitura', 'Cem dias', 'Um ano inteiro']],
    ['added', 'Biblioteca', 'book', '', (s) => s.booksAdded, 'Livros na biblioteca: {n}', [1, 10, 25, 50, 100, 250],
      ['Primeiro exemplar', 'Estante a crescer', 'Colecionador', 'Bibliófilo', 'Biblioteca de Alexandria', 'Biblioteca municipal']],
    ['consistency', 'Constância', 'calendar', '', (s) => s.sessionsCount, 'Sessões de leitura: {n}', [1, 10, 50, 100, 365, 1000],
      ['Primeiro passo', 'Dez sessões', 'Cinquenta sessões', 'Cem sessões', 'Hábito de ferro', 'Lenda do hábito']],
    ['longSession', 'Sessão maratona', 'hourglass', ' min', (s) => s.longestSessionSeconds / 60, 'Minutos seguidos numa sessão: {n}', [60, 120, 180, 300],
      ['Concentração', 'Imersão total', 'Maratonista', 'Ultra maratona']],
    ['early', 'Madrugador', 'sunrise', '', (s) => s.earlySessions, 'Sessões antes das 7h: {n}', [1, 10, 30, 100],
      ['Madrugador', 'Acorda cedo', 'Rei da alvorada', 'Amigo do sol']],
    ['night', 'Noctívago', 'moon', '', (s) => s.lateSessions, 'Sessões depois das 23h: {n}', [1, 10, 30, 100],
      ['Noctívago', 'Coruja', 'Rei da noite', 'Guardião da noite']],
    ['spines', 'Estante fotográfica', 'camera', '', (s) => s.spinePhotos, 'Lombadas fotografadas: {n}', [1, 10, 25, 50],
      ['Foto de lombada', 'Estante com cor', 'Estante fotográfica', 'Estante de museu']],
    ['rated', 'Crítico literário', 'star', '', (s) => s.ratedBooks, 'Livros avaliados: {n}', [1, 10, 25, 50],
      ['Primeira opinião', 'Crítico em ascensão', 'Crítico literário', 'Voz da crítica']],
    ['notes', 'Diário de leitura', 'edit', '', (s) => s.notedSessions, 'Sessões com notas: {n}', [1, 10, 50],
      ['Primeira nota', 'Caderno de bordo', 'Diário de leitura']],
    ['photos', 'Álbum de leituras', 'image', '', (s) => s.sessionPhotos, 'Sessões com fotos: {n}', [1, 10, 25],
      ['Primeira foto', 'Álbum de leituras', 'Fotógrafo de livros']],
    ['covers', 'Galeria de capas', 'grid', '', (s) => s.coverPhotos, 'Capas fotografadas: {n}', [1, 10, 25, 50],
      ['Capa à mostra', 'Capas a brilhar', 'Galeria de capas', 'Museu de capas']],
    ['shelves', 'Organizador', 'layers', '', (s) => s.shelvesCount, 'Prateleiras criadas: {n}', [1, 3, 5, 10],
      ['Primeira prateleira', 'Organizador', 'Bibliotecário', 'Mestre da arrumação']],
    ['weekend', 'Fim de semana', 'sun', '', (s) => s.weekendSessions, 'Sessões ao fim de semana: {n}', [1, 10, 30],
      ['Fim de semana com livro', 'Leitor de domingo', 'Rei do fim de semana']],
    ['days', 'Dias de leitura', 'list', '', (s) => s.activeDaysCount, 'Dias diferentes com leitura: {n}', [7, 30, 100, 365],
      ['Sete dias', 'Trinta dias', 'Cem dias a ler', 'Ano de leituras']],
    ['fast', 'Leitor veloz', 'activity', ' pág/h', (s) => s.bestPace, 'Páginas por hora numa sessão de 10+ min: {n}', [40, 60, 90],
      ['Passo rápido', 'Leitor veloz', 'Raio']],
    ['thick', 'Calhamaços', 'book', '', (s) => s.bigBooksFinished, 'Livros de 500+ páginas terminados: {n}', [1, 3, 10],
      ['Calhamaço domado', 'Escalador de tijolos', 'Rei dos calhamaços']],
    ['quick', 'Leitura relâmpago', 'activity', '', (s) => s.quickFinishes, 'Livros terminados em 3 dias ou menos: {n}', [1, 5],
      ['Devorador', 'Leitura relâmpago']],
    ['maxDay', 'Dia de maratona', 'hourglass', ' h', (s) => s.maxDaySeconds / 3600, 'Horas lidas num único dia: {n}', [2, 3, 5],
      ['Dia de leitura', 'Dia inteiro', 'Maratona diária']],
    ['lunch', 'Hora de almoço', 'clock', '', (s) => s.lunchSessions, 'Sessões entre as 12h e as 14h: {n}', [1, 10, 30],
      ['Pausa para ler', 'Almoço literário', 'Rei do almoço']],
    ['profile', 'Perfil', 'user', '', (s) => s.profileItems, 'Itens do perfil preenchidos (foto e descrição): {n}', [1, 2],
      ['Cara conhecida', 'Perfil completo']],
    ['favorites', 'Favoritos', 'heart', '', (s) => s.favoriteBooks, 'Livros favoritos: {n}', [1, 5, 10],
      ['Primeiro favorito', 'Coração cheio', 'Cantinho dos favoritos']],
    ['recs', 'Recomendações', 'gift', '', (s) => s.recommendedBooks, 'Livros recomendados: {n}', [1, 5, 10],
      ['Primeira recomendação', 'Boca a boca', 'Divulgador de livros']]
  ];
  const CATEGORIES = CAT_ROWS.map(([id, title, icon, unit, value, detailKey, tiers, names]) => ({ id, title, icon, unit, value, detailKey, tiers, names }));
  const catById = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
  const ACHIEVEMENTS = [];
  for (const c of CATEGORIES) {
    c.tiers.forEach((target, i) => ACHIEVEMENTS.push({ id: `${c.id}_${i}`, category: c.id, tier: i, title: c.names[i], detailKey: c.detailKey, target }));
  }
  const achById = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
  const tierName = (i) => tr(TIER_NAMES[Math.min(Math.max(i, 0), TIER_NAMES.length - 1)]);
  const tierColor = (i) => TIER_HEX[Math.min(Math.max(i, 0), TIER_HEX.length - 1)];
  const achTitle = (a) => tr(a.title);
  const achDetail = (a) => tr(a.detailKey, { n: a.target });
  const progressText = (cat, value, target) => { const u = cat.unit ? ' ' + tr(cat.unit.trim()) : ''; return `${Math.floor(value)}${u} / ${target}${u}`; };

  function snapshot(books, sessions, shelves = [], settings = {}) {
    const DAY = 86400000;
    const s = {
      totalSeconds: 0, totalPages: 0, booksAdded: books.length,
      booksFinished: books.filter((b) => b.status === 'finished').length,
      spinePhotos: books.filter((b) => !!b.spineId).length,
      coverPhotos: books.filter((b) => !!b.coverId).length,
      ratedBooks: books.filter((b) => b.rating > 0).length,
      favoriteBooks: books.filter((b) => b.favorite).length,
      recommendedBooks: books.filter((b) => b.recommend).length,
      bigBooksFinished: books.filter((b) => b.status === 'finished' && b.totalPages >= 500).length,
      quickFinishes: books.filter((b) => b.status === 'finished' && b.totalPages >= 100 && b.startedAt && b.finishedAt && (b.finishedAt - b.startedAt) <= 3 * DAY).length,
      shelvesCount: shelves.length,
      profileItems: (settings.photoId ? 1 : 0) + (settings.bio && settings.bio.trim() ? 1 : 0),
      sessionsCount: sessions.length, bestStreak: 0, currentStreak: 0, longestSessionSeconds: 0,
      earlySessions: 0, lateSessions: 0, notedSessions: 0, sessionPhotos: 0, weekendSessions: 0, lunchSessions: 0,
      bestPace: 0, maxDaySeconds: 0, activeDaysCount: 0
    };
    const perDay = new Map();
    for (const x of sessions) {
      s.totalSeconds += x.durationSeconds;
      s.totalPages += pagesRead(x);
      s.longestSessionSeconds = Math.max(s.longestSessionSeconds, x.durationSeconds);
      const d = new Date(x.start), hour = d.getHours(), wd = d.getDay();
      if (hour >= 4 && hour < 7) s.earlySessions++;
      if (hour >= 23 || hour < 4) s.lateSessions++;
      if (hour >= 12 && hour < 14) s.lunchSessions++;
      if (wd === 0 || wd === 6) s.weekendSessions++;
      if (x.notes && x.notes.trim()) s.notedSessions++;
      if (x.photoId) s.sessionPhotos++;
      if (x.durationSeconds >= 600) s.bestPace = Math.max(s.bestPace, pagesPerHour(x));
      const k = startOfDay(x.start);
      perDay.set(k, (perDay.get(k) || 0) + x.durationSeconds);
    }
    for (const v of perDay.values()) s.maxDaySeconds = Math.max(s.maxDaySeconds, v);
    s.totalPages += sumBonus(bonusPages(books, sessions));
    const days = activeDays(sessions);
    s.activeDaysCount = days.size;
    const st = computeStreaks(days);
    s.bestStreak = st.best; s.currentStreak = st.current;
    return s;
  }

  function evaluate(books, sessions, unlocked, shelves, settings) {
    const snap = snapshot(books, sessions, shelves, settings);
    const fresh = ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && catById[a.category].value(snap) >= a.target);
    return { snap, fresh };
  }

  /** Regras de desbloqueio de visuais (prateleiras e fundos). */
  function ruleState(rule, snap, unlocked) {
    const num = (value, target, text) => ({ ok: value >= target, value, target, text: tr(text, { n: target }) });
    switch (rule.kind) {
      case 'hours': return num(snap.totalSeconds / 3600, rule.n, 'Lê {n} horas');
      case 'sessions': return num(snap.sessionsCount, rule.n, 'Completa {n} sessões');
      case 'finished': return num(snap.booksFinished, rule.n, 'Termina {n} livros');
      case 'added': return num(snap.booksAdded, rule.n, 'Adiciona {n} livros');
      case 'streak': return num(snap.bestStreak, rule.n, 'Lê {n} dias seguidos');
      case 'pages': return num(snap.totalPages, rule.n, 'Lê {n} páginas');
      case 'achCount': return num(unlocked.size, rule.n, 'Desbloqueia {n} conquistas');
      case 'ach': {
        const a = achById[rule.id], ok = unlocked.has(rule.id);
        return { ok, value: ok ? 1 : 0, target: 1, text: tr('Conquista «{name}»', { name: a ? tr(a.title) : rule.id }) };
      }
      default: return { ok: true, value: 1, target: 1, text: tr('Incluído') };
    }
  }

  /** Livros lidos na totalidade sem sessões (ou com poucas): as páginas em falta contam como lidas; o tempo não. */
  function bonusPages(books, sessions) {
    const per = new Map();
    for (const s of sessions) per.set(s.bookId, (per.get(s.bookId) || 0) + pagesRead(s));
    return books.filter((b) => b.status === 'finished' && b.totalPages > 0)
      .map((b) => ({ bookId: b.id, date: b.finishedAt || b.addedAt || Date.now(), pages: Math.max(0, b.totalPages - (per.get(b.id) || 0)) }))
      .filter((x) => x.pages > 0);
  }
  const sumBonus = (bonus, from = 0) => bonus.filter((x) => x.date >= from).reduce((a, x) => a + x.pages, 0);

  /* ---------- Estatísticas ---------- */
  function totals(sessions) {
    return sessions.reduce((t, s) => ({ seconds: t.seconds + s.durationSeconds, pages: t.pages + pagesRead(s), sessions: t.sessions + 1 }), { seconds: 0, pages: 0, sessions: 0 });
  }
  function rangeStart(range, sessions, now = Date.now()) {
    const today = startOfDay(now), thisMonth = startOfMonth(now);
    if (range === 'week') return addDays(today, -6);
    if (range === 'month') return addDays(today, -29);
    if (range === 'year') return addMonths(thisMonth, -11);
    let first = now;
    for (const s of sessions) if (s.start < first) first = s.start;
    return Math.max(startOfMonth(first), addMonths(thisMonth, -35));
  }
  function buckets(sessions, range, now = Date.now(), bonus = []) {
    const byDay = range === 'week' || range === 'month';
    const out = [];
    let cursor = rangeStart(range, sessions, now);
    while (cursor <= now) {
      const next = byDay ? addDays(cursor, 1) : addMonths(cursor, 1);
      let sec = 0, pages = 0;
      for (const s of sessions) if (s.start >= cursor && s.start < next) { sec += s.durationSeconds; pages += pagesRead(s); }
      for (const b of bonus) if (b.date >= cursor && b.date < next) pages += b.pages;
      out.push({ date: cursor, minutes: sec / 60, pages });
      cursor = next;
    }
    return out;
  }
  function bucketLabel(range, ms) {
    if (range === 'week') return weekdayShort(ms);
    if (range === 'month') return String(new Date(ms).getDate());
    return monthShort(ms);
  }
  function minutesByDay(sessions) {
    const map = new Map();
    for (const s of sessions) { const d = startOfDay(s.start); map.set(d, (map.get(d) || 0) + Math.floor(s.durationSeconds / 60)); }
    return map;
  }

  RF.logic = {
    SPINE_PALETTE, TIER_NAMES, TIER_HEX, STATUS, GENRES, CATEGORIES, catById, ACHIEVEMENTS, achById, uid,
    startOfDay, addDays, startOfMonth, addMonths, startOfWeek, isSameDay,
    duration, clock, pace, timeText, shortDate, longDate, relativeDay, weekdayLetter, weekdayShort, monthShort,
    isDark, textOn, hashStr, spineHeight, spineWidth, pagesRead, pagesPerHour, bookProgress, bookSessions,
    activeDays, computeStreaks, tierName, tierColor, achTitle, achDetail, progressText,
    snapshot, evaluate, ruleState, bonusPages, sumBonus, totals, rangeStart, buckets, bucketLabel, minutesByDay
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = RF.logic;
})(typeof window !== 'undefined' ? window : globalThis);
