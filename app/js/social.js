/* ReadFlow: parte social (IDs, privacidade, o que se partilha). A ligação ao servidor está em remote.js. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic;

  const PRIVACY_KEYS = [
    ['reading', 'O que estou a ler'], ['finished', 'Livros que já li'], ['favorites', 'Livros favoritos'],
    ['recommendations', 'As minhas recomendações'], ['bio', 'Descrição do perfil'], ['achievements', 'Conquistas'],
    ['activity', 'Atividade de leitura'], ['stats', 'Estatísticas (tempo e páginas)'], ['reviews', 'Notas e avaliações dos livros']
  ];

  const clean = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '').slice(0, 16);
  /** Aceita "nome#123456" ou "nome123456". */
  function parseId(text) {
    const m = String(text || '').trim().toLowerCase().match(/^([a-z0-9_]{3,16})#?(\d{6})$/);
    return m ? { name: m[1], number: parseInt(m[2], 10), id: `${m[1]}#${m[2]}` } : null;
  }
  const hue = (str) => L.SPINE_PALETTE[L.hashStr(str) % L.SPINE_PALETTE.length];
  /** Item de lista de livros (pseudo-livro, para desenhar a capa). */
  const item = (title, author, note, extra) => ({ id: title + '|' + author, title, author, note: note || '', color: hue(title), coverId: null, ...(extra || {}) });

  /** Totais para o perfil e rankings. Livros lidos sem sessões contam as páginas (o tempo não conta). */
  const statsOf = (st) => {
    const bonus = L.bonusPages(st.books, st.sessions), tot = L.totals(st.sessions), strk = L.computeStreaks(L.activeDays(st.sessions));
    const wk = L.startOfWeek(Date.now()), mo = L.startOfMonth(Date.now());
    const per = (from) => ({ minutes: Math.round(L.totals(st.sessions.filter((s) => s.start >= from)).seconds / 60), pages: L.totals(st.sessions.filter((s) => s.start >= from)).pages + L.sumBonus(bonus, from),
      books: st.books.filter((b) => b.status === 'finished' && (b.finishedAt || 0) >= from).length });
    return { hours: Math.round(tot.seconds / 3600), minutes: Math.round(tot.seconds / 60), pages: tot.pages + L.sumBonus(bonus), books: st.books.filter((b) => b.status === 'finished').length,
      sessions: tot.sessions, streak: strk.current, pace: tot.seconds > 0 ? Math.round(tot.pages / (tot.seconds / 3600)) : 0, week: per(wk), month: per(mo) };
  };
  const activityOf = (st, limit) => [...st.sessions].sort((a, b) => b.start - a.start).slice(0, limit || 1e9).map((s) => {
    const b = st.books.find((x) => x.id === s.bookId);
    return { book: b ? b.title : '', minutes: Math.round(s.durationSeconds / 60), pages: L.pagesRead(s), when: s.start, unlocked: s.unlocked || [], manual: !!s.manual };
  });

  /** O que um seguidor aprovado vê do meu perfil (pré-visualização local, com capas reais). */
  function myPublicProfile(S) {
    const st = S.state, p = st.settings.privacy, books = st.books;
    const mk = (b) => item(b.title, b.author, b.recNote, { id: b.id, color: b.color, coverId: b.coverId, rating: p.reviews ? (b.rating || 0) : 0, review: p.reviews ? (b.notes || '').trim() : '' });
    const out = { name: st.settings.name || 'Leitor', id: st.settings.handleName ? `${st.settings.handleName}#${String(st.settings.handleNumber).padStart(6, '0')}` : '', photoId: st.settings.photoId, sections: {} };
    if (p.bio) out.sections.bio = st.settings.bio || '';
    if (p.reading) out.sections.reading = books.filter((b) => b.status === 'reading').map(mk);
    if (p.finished) out.sections.finished = books.filter((b) => b.status === 'finished').map(mk);
    if (p.favorites) out.sections.favorites = books.filter((b) => b.favorite).map(mk);
    if (p.recommendations) out.sections.recs = books.filter((b) => b.recommend).map(mk);
    if (p.stats) out.sections.stats = statsOf(st);
    if (p.achievements) out.sections.achievements = [...st.unlocked.keys()];
    if (p.activity) out.sections.activity = activityOf(st);
    return out;
  }

  /** O que é enviado ao servidor: SÓ as secções que a pessoa deixou ativas (minimização de dados).
      `coverKeys`: ids das capas que têm miniatura disponível (as miniaturas vão numa tabela à parte). */
  function publicSections(S, coverKeys) {
    const st = S.state, p = st.settings.privacy, books = st.books, out = {};
    const mk = (b) => {
      const it = { title: b.title, author: b.author, note: b.recNote || '', color: b.color };
      if (p.reviews) { if (b.rating > 0) it.rating = b.rating; if (b.notes && b.notes.trim()) it.review = b.notes.trim().slice(0, 400); }
      if (b.coverId && coverKeys && coverKeys.has(b.coverId)) it.ck = b.coverId;
      return it;
    };
    const list = (pred) => books.filter(pred).slice(0, 300).map(mk);
    if (p.bio) out.bio = { text: (st.settings.bio || '').slice(0, 280) };
    if (p.reading) out.reading = list((b) => b.status === 'reading');
    if (p.finished) out.finished = list((b) => b.status === 'finished');
    if (p.favorites) out.favorites = list((b) => b.favorite);
    if (p.recommendations) out.recommendations = list((b) => b.recommend);
    if (p.achievements) out.achievements = [...st.unlocked.keys()];
    if (p.activity) out.activity = activityOf(st, 60);
    if (p.stats) out.stats = statsOf(st);
    return out;
  }
  const ALL_SECTIONS = ['bio', 'reading', 'finished', 'favorites', 'recommendations', 'achievements', 'activity', 'stats'];

  /** Converte as secções recebidas do servidor no formato do ecrã de perfil. `covers`: { ck: dataUrl } já descarregadas. */
  function fromServer(shared, covers) {
    const sec = {};
    const mk = (arr) => (arr || []).map((b) => item(b.title, b.author, b.note, { color: b.color || hue(b.title), rating: b.rating || 0, review: b.review || '', ck: b.ck || '', coverData: (covers && b.ck && covers[b.ck]) || null }));
    if (shared.bio) sec.bio = shared.bio.text || '';
    if (shared.reading) sec.reading = mk(shared.reading);
    if (shared.finished) sec.finished = mk(shared.finished);
    if (shared.favorites) sec.favorites = mk(shared.favorites);
    if (shared.recommendations) sec.recs = mk(shared.recommendations);
    if (shared.stats) sec.stats = shared.stats;
    if (shared.achievements) sec.achievements = shared.achievements;
    if (shared.activity) sec.activity = shared.activity;
    return sec;
  }

  /** Classificação de pessoas por uma métrica e um período ('week' | 'month' | 'total'). Ordem decrescente. */
  function ranking(people, metric, period) {
    const pick = (s) => {
      if (!s) return null;
      const per = period === 'total' ? s : s[period];
      if (metric === 'time') return period === 'total' ? (s.minutes !== undefined ? s.minutes : (s.hours || 0) * 60) : (per ? per.minutes : null);
      if (metric === 'pages') return per ? per.pages : null;
      if (metric === 'books') return per ? per.books : null;
      if (period !== 'total') return null;
      return metric === 'pace' ? s.pace : metric === 'streak' ? s.streak : null;
    };
    return people.map((p) => ({ p, v: pick(p.stats) })).filter((x) => x.v !== null && x.v !== undefined && !Number.isNaN(x.v))
      .sort((a, b) => b.v - a.v || String(a.p.name).localeCompare(String(b.p.name)));
  }

  RF.social = { PRIVACY_KEYS, ALL_SECTIONS, item, clean, parseId, hue, myPublicProfile, publicSections, fromServer, statsOf, ranking };
  if (typeof module !== 'undefined' && module.exports) module.exports = RF.social;
})(typeof window !== 'undefined' ? window : globalThis);
