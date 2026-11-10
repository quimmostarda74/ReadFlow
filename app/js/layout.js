/* ReadFlow — motor de arrumação da estante (puro, sem DOM).
   Posições: lombada em pé, capa para a frente, livro encostado, pilha deitada e livro deitado em cima de um grupo.
   Quanto mais cheia a estante, mais compacta é a arrumação (níveis 0 a 3). */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic;

  const ROW_H = 292, FACE_W = 112;
  const LEVELS = [
    { gap: 12, face: 0, lying: 10, pileMax: 3 },    // 0: espaçosa
    { gap: 8, face: 0, lying: 14, pileMax: 4 },     // 1: equilibrada
    { gap: 5, face: 0, lying: 30, pileMax: 6 },     // 2: compacta
    { gap: 3, face: 0, lying: 55, pileMax: 8 }      // 3: muito cheia
  ];
  const clamp = (lo, v, hi) => Math.max(lo, Math.min(hi, v));
  const hash = (b) => L.hashStr(b.id);
  const thickness = (b) => Math.round(clamp(20, 16 + (b.totalPages || 200) / 16, 44));
  const lyingLength = (b) => 150 + (hash(b) % 49);

  const pileHeight = (bs) => bs.reduce((a, b) => a + thickness(b), 0);
  function takePile(lying, li, cfg) {
    let n = Math.min(lying.length - li, 2 + (hash(lying[li]) % Math.max(cfg.pileMax - 1, 1)));
    while (n > 1 && pileHeight(lying.slice(li, li + n)) > 268) n--;
    return n;
  }
  const unitSpine = (b) => ({ kind: 'spine', books: [b], w: L.spineWidth(b), h: L.spineHeight(b) });
  const unitFace = (b) => ({ kind: 'face', books: [b], w: FACE_W, tilt: 0 });
  const unitPile = (bs) => ({ kind: 'pile', books: bs, w: Math.max(...bs.map(lyingLength)) + 14 });
  function leanUnit(b) {
    const h = L.spineHeight(b), sw = L.spineWidth(b), angle = 10 + (hash(b) % 7);
    const extra = Math.ceil(h * Math.sin((angle * Math.PI) / 180));
    return { kind: 'lean', books: [b], w: sw + extra, sw, h, angle, extra };
  }
  const groupWidth = (g) => g.reduce((a, b) => a + L.spineWidth(b), 0) + 2 * (g.length - 1);
  function unitCapped(group, cap) {
    const gw = groupWidth(group), capL = clamp(130, Math.max(lyingLength(cap), gw + 10), 210);
    return { kind: 'capped', books: group, cap, gw, capL, w: Math.max(gw, capL), maxH: Math.max(...group.map(L.spineHeight)) };
  }

  function composeUnits(books, level, featured) {
    const cfg = LEVELS[level];
    const faces = [], lying = [], vert = [];
    for (const b of books) {
      const k = hash(b) % 100;
      if (k < cfg.face) faces.push(b);
      else if (k >= 100 - cfg.lying) lying.push(b);
      else vert.push(b);
    }
    const units = [];
    let vi = 0, fi = 0, li = 0, sinceFace = 0;
    const faceEvery = Math.max(3, Math.floor((vert.length + 1) / (faces.length + 1)));
    while (vi < vert.length || fi < faces.length || li < lying.length) {
      if (fi < faces.length && (sinceFace >= faceEvery || vi >= vert.length)) { units.push(unitFace(faces[fi++])); sinceFace = 0; continue; }
      if (vi < vert.length) {
        let group = vert.slice(vi, vi + 2 + (hash(vert[vi]) % 3));
        if (level >= 2 && li < lying.length) {
          while (group.length > 2 && groupWidth(group) > 186) group.pop();
          if (group.length >= 2) { vi += group.length; sinceFace += group.length; units.push(unitCapped(group, lying[li++])); }
          else { units.push(unitSpine(vert[vi++])); sinceFace++; }
        } else {
          group = vert.slice(vi, vi + group.length + 1);
          vi += group.length; sinceFace += group.length;
          group.forEach((b) => units.push(unitSpine(b)));
        }
        if (level >= 1 && li < lying.length && units.length % 2 === 0) {
          const n = takePile(lying, li, cfg);
          units.push(unitPile(lying.slice(li, li + n))); li += n;
        }
        continue;
      }
      const n = takePile(lying, li, cfg);
      units.push(unitPile(lying.slice(li, li + n))); li += n;
    }
    return units;
  }

  function packRows(units, W, level) {
    const gap = LEVELS[level].gap;
    const rows = [];
    let cur = [], used = 0;
    const close = () => {
      if (!cur.length) return;
      const last = cur[cur.length - 1];
      if (level <= 1 && last.kind === 'spine') {          // o último livro da linha fica encostado
        const lean = leanUnit(last.books[0]);
        if (W - used >= lean.w - last.w) { cur[cur.length - 1] = lean; used += lean.w - last.w; }
      }
      rows.push({ units: cur, used }); cur = []; used = 0;
    };
    for (const u of units) {
      if (cur.length && used + gap + u.w > W) close();
      used += cur.length ? gap + u.w : u.w;
      cur.push(u);
    }
    close();
    return rows;
  }

  /** Escolhe o nível mais espaçoso que cabe em `rows` linhas. */
  function layoutShelf(books, W, opts = {}) {
    const cap = opts.rows || 2, featured = opts.featured || new Set();
    let best = { rows: [], level: 0 };
    for (let level = 0; level < LEVELS.length; level++) {
      best = { rows: packRows(composeUnits(books, level, featured), W, level), level };
      if (best.rows.length <= cap) break;
    }
    best.gap = LEVELS[best.level].gap;
    return best;
  }

  RF.layout = { ROW_H, FACE_W, LEVELS, layoutShelf, thickness, lyingLength };
  if (typeof module !== 'undefined' && module.exports) module.exports = RF.layout;
})(typeof window !== 'undefined' ? window : globalThis);
