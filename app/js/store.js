/* ReadFlow — armazenamento local (IndexedDB), cópia de segurança e dados de exemplo. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic;

  const DB_NAME = 'readflow';
  const STORES = ['books', 'sessions', 'shelves', 'unlocked', 'images', 'kv'];
  let db = null;

  const DEFAULT_SETTINGS = {
    id: 'settings', name: '', bio: '', photoId: null, libraryName: '', shelfBgImageId: null, shelfBgDark: true, privacyV2: true, dailyGoal: 20, weeklyGoal: 150, libraryStyle: 'spines',
    shelfTheme: 'wood', shelfBg: 'neutral', seenCosmetics: null, appTheme: 'classic', lang: 'pt',
    handleName: '', handleNumber: 0,
    privacy: { reading: true, finished: true, favorites: true, recommendations: true, bio: true, achievements: true, activity: true, stats: true },
    social: { demo: false, following: {}, followers: {}, queued: [] }
  };
  const mergeSettings = (saved) => {
    const m = {
      ...DEFAULT_SETTINGS, ...(saved || {}),
      privacy: { ...DEFAULT_SETTINGS.privacy, ...((saved || {}).privacy || {}) },
      social: { ...DEFAULT_SETTINGS.social, ...((saved || {}).social || {}) }
    };
    if (saved && !saved.privacyV2) m.privacy.stats = true;   // migração: as estatísticas passam a ser visíveis por omissão
    m.privacyV2 = true;
    return m;
  };

  const state = {
    books: [], sessions: [], shelves: [],
    unlocked: new Map(),          // id da conquista -> data
    settings: { ...DEFAULT_SETTINGS },
    imageUrls: new Map()          // id da imagem -> URL local
  };

  /* ---------- IndexedDB ---------- */
  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        for (const name of STORES) {
          if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function run(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      let req;
      t.oncomplete = () => resolve(req ? req.result : undefined);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
      req = fn(t.objectStore(store));
    });
  }
  const put = (store, obj) => run(store, 'readwrite', (s) => s.put(obj));
  const del = (store, id) => run(store, 'readwrite', (s) => s.delete(id));
  const all = (store) => run(store, 'readonly', (s) => s.getAll());
  const clear = (store) => run(store, 'readwrite', (s) => s.clear());

  async function init() {
    db = await open();
    state.books = await all('books');
    state.sessions = await all('sessions');
    state.shelves = await all('shelves');
    state.unlocked = new Map((await all('unlocked')).map((u) => [u.id, u.at]));
    const kv = await all('kv');
    const settings = kv.find((k) => k.id === 'settings');
    state.settings = mergeSettings(settings);
    if (settings && !settings.privacyV2) await saveSettings();
    for (const img of await all('images')) state.imageUrls.set(img.id, URL.createObjectURL(img.blob));
    return kv.find((k) => k.id === 'active') || null;
  }

  /* ---------- Imagens ---------- */
  const imgUrl = (id) => (id ? state.imageUrls.get(id) || null : null);

  async function addImage(blob) {
    const id = L.uid();
    await put('images', { id, blob });
    state.imageUrls.set(id, URL.createObjectURL(blob));
    return id;
  }
  async function removeImage(id) {
    if (!id) return;
    const url = state.imageUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    state.imageUrls.delete(id);
    await del('images', id);
  }
  async function getImageBlob(id) {
    const rows = await run('images', 'readonly', (s) => s.get(id));
    return rows ? rows.blob : null;
  }

  /* ---------- Livros, sessões, prateleiras ---------- */
  function upsert(list, item) {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item; else list.push(item);
  }
  const getBook = (id) => state.books.find((b) => b.id === id) || null;

  function newBook(fields = {}) {
    return {
      id: L.uid(), title: '', author: '', totalPages: 0, currentPage: 0, status: 'wantToRead',
      addedAt: Date.now(), startedAt: null, finishedAt: null, rating: 0, notes: '',
      color: L.SPINE_PALETTE[0], coverId: null, spineId: null, shelfIds: [],
      genre: '', favorite: false, recommend: false, recNote: '', ...fields
    };
  }
  async function saveBook(book) { upsert(state.books, book); await put('books', book); }

  async function deleteBook(id) {
    const book = getBook(id);
    if (!book) return;
    for (const s of state.sessions.filter((x) => x.bookId === id)) await deleteSession(s.id);
    await removeImage(book.coverId);
    await removeImage(book.spineId);
    state.books = state.books.filter((b) => b.id !== id);
    await del('books', id);
  }

  async function saveSession(session) { upsert(state.sessions, session); await put('sessions', session); }
  async function deleteSession(id) {
    const s = state.sessions.find((x) => x.id === id);
    if (!s) return;
    await removeImage(s.photoId);
    state.sessions = state.sessions.filter((x) => x.id !== id);
    await del('sessions', id);
  }

  async function saveShelf(shelf) { upsert(state.shelves, shelf); await put('shelves', shelf); }
  async function deleteShelf(id) {
    state.shelves = state.shelves.filter((s) => s.id !== id);
    await del('shelves', id);
    for (const b of state.books) {
      if (b.shelfIds.includes(id)) { b.shelfIds = b.shelfIds.filter((x) => x !== id); await put('books', b); }
    }
  }

  async function unlock(achievements) {
    for (const a of achievements) {
      const at = Date.now();
      state.unlocked.set(a.id, at);
      await put('unlocked', { id: a.id, at });
    }
  }

  async function saveSettings() { await put('kv', { ...state.settings, id: 'settings' }); }
  async function getKV(id) { const all_ = await all('kv'); return all_.find((k) => k.id === id) || null; }
  async function putKV(obj) { await put('kv', obj); }
  async function deleteKV(id) { await del('kv', id); }
  async function saveActive(active) { await put('kv', { ...active, id: 'active' }); }
  async function clearActive() { await del('kv', 'active'); }

  /* ---------- Cópia de segurança ---------- */
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  function dataUrlToBlob(dataUrl) {
    const [head, body] = dataUrl.split(',');
    const mime = (head.match(/data:(.*?);base64/) || [])[1] || 'image/jpeg';
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  async function exportAll() {
    const images = {};
    for (const id of state.imageUrls.keys()) {
      const blob = await getImageBlob(id);
      if (blob) images[id] = await blobToDataUrl(blob);
    }
    return {
      app: 'ReadFlow', version: 1, exportedAt: Date.now(),
      books: state.books, sessions: state.sessions, shelves: state.shelves,
      unlocked: [...state.unlocked].map(([id, at]) => ({ id, at })),
      settings: state.settings, images
    };
  }

  async function wipe() {
    for (const url of state.imageUrls.values()) URL.revokeObjectURL(url);
    for (const name of STORES) await clear(name);
    state.books = []; state.sessions = []; state.shelves = [];
    state.unlocked = new Map(); state.imageUrls = new Map();
    state.settings = mergeSettings(null);
  }

  async function importAll(data) {
    if (!data || data.app !== 'ReadFlow') throw new Error('Ficheiro inválido');
    await wipe();
    for (const [id, dataUrl] of Object.entries(data.images || {})) {
      const blob = dataUrlToBlob(dataUrl);
      await put('images', { id, blob });
      state.imageUrls.set(id, URL.createObjectURL(blob));
    }
    for (const b of data.books || []) await saveBook(b);
    for (const s of data.sessions || []) await saveSession(s);
    for (const s of data.shelves || []) await saveShelf(s);
    for (const u of data.unlocked || []) { state.unlocked.set(u.id, u.at); await put('unlocked', u); }
    state.settings = mergeSettings(data.settings);
    await saveSettings();
  }

  /* ---------- Dados de exemplo ---------- */
  async function loadSample() {
    const specs = [
      ['Os Maias', 'Eça de Queirós', 704, 'finished'],
      ['Ensaio sobre a Cegueira', 'José Saramago', 310, 'finished'],
      ['Hábitos Atómicos', 'James Clear', 320, 'reading'],
      ['Sapiens', 'Yuval Noah Harari', 464, 'reading'],
      ['1984', 'George Orwell', 328, 'finished'],
      ['O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 96, 'finished'],
      ['A Sombra do Vento', 'Carlos Ruiz Zafón', 487, 'wantToRead'],
      ['Dom Casmurro', 'Machado de Assis', 256, 'wantToRead']
    ];
    const day = 86400000;
    const books = [];
    for (let i = 0; i < specs.length; i++) {
      const [title, author, totalPages, status] = specs[i];
      const genre = ['classics', 'fiction', 'selfhelp', 'history', 'scifi', 'kids', 'fiction', 'classics'][i];
      const b = newBook({ title, author, totalPages, status, genre, color: L.SPINE_PALETTE[i % L.SPINE_PALETTE.length],
        favorite: i === 1 || i === 4, recommend: i === 1 || i === 5, recNote: i === 1 ? 'Um livro que fica na cabeça.' : '' });
      if (status === 'finished') {
        b.currentPage = totalPages; b.rating = 3 + (i % 3);
        b.startedAt = Date.now() - (30 + i * 9) * day; b.finishedAt = Date.now() - (5 + i * 6) * day;
      } else if (status === 'reading') {
        b.currentPage = Math.floor(totalPages * (25 + i * 10) / 100); b.startedAt = Date.now() - 12 * day;
      }
      books.push(b);
      await saveBook(b);
    }
    const readable = books.filter((b) => b.status !== 'wantToRead');
    const hours = [6, 7, 12, 21, 22, 23];
    for (let d = 0; d < 45; d++) {
      if (d > 8 && (d % 7 === 3 || d % 11 === 5)) continue;
      const book = readable[d % readable.length];
      const minutes = 12 + Math.floor(Math.random() * 59);
      const pages = Math.max(4, Math.round(minutes * (0.6 + Math.random() * 0.5)));
      const date = new Date(L.addDays(L.startOfDay(Date.now()), -d));
      date.setHours(hours[d % hours.length], Math.floor(Math.random() * 60), 0, 0);
      let start = date.getTime();
      if (start > Date.now()) start = Date.now() - minutes * 60000 - 600000;
      const startPage = (d * 13) % Math.max(book.totalPages - pages, 1);
      await saveSession({
        id: L.uid(), bookId: book.id, start, end: start + minutes * 60000, durationSeconds: minutes * 60,
        startPage, endPage: startPage + pages, notes: '', photoId: null, unlocked: []
      });
    }
    const shelf = { id: L.uid(), name: 'Clássicos', createdAt: Date.now() };
    await saveShelf(shelf);
    for (const b of books.slice(0, 2)) { b.shelfIds.push(shelf.id); await saveBook(b); }
  }

  RF.store = {
    state, init, imgUrl, addImage, removeImage, getBook, newBook, saveBook, deleteBook,
    saveSession, deleteSession, saveShelf, deleteShelf, unlock, saveSettings, saveActive, clearActive, getKV, putKV, deleteKV,
    exportAll, importAll, wipe, loadSample
  };
})(typeof window !== 'undefined' ? window : globalThis);
