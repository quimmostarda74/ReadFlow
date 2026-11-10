/* ReadFlow — componentes de interface reutilizáveis. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic;
  const t = RF.i18n.t;

  /* ---------- Criar elementos ---------- */
  function append(el, children) {
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
  }
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    append(el, children);
    return el;
  }

  /* ---------- Ícones (traço simples) ---------- */
  const ICONS = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    trophy: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    sunrise: '<path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
    stop: '<rect x="4" y="4" width="16" height="16" rx="2"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    rotate: '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    back: '<polyline points="15 18 9 12 15 6"/>',
    down: '<polyline points="6 9 12 15 18 9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
    columns: '<path d="M12 3v18"/><rect x="3" y="3" width="18" height="18" rx="2"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
    gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    crown: '<path d="m2 4 3 12h14l3-12-6 5-4-8-4 8-6-5z"/><path d="M5 20h14"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>'
  };
  function icon(name, size = 20, opts = {}) {
    return h('span', {
      class: 'ico' + (opts.cls ? ' ' + opts.cls : ''),
      html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${opts.fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`
    });
  }

  /* ---------- Janelas (modais) ---------- */
  const stack = [];
  function openModal(build, opts = {}) {
    const overlay = h('div', { class: 'overlay' });
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : '') + (opts.full ? ' full' : '') });
    overlay.append(box);
    const api = {
      el: box, sticky: !!opts.sticky, closed: false,
      close() {
        if (api.closed) return;
        api.closed = true;
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        overlay.remove();
        if (opts.onClose) opts.onClose();
      }
    };
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay && !api.sticky) api.close(); });
    box.append(build(api));
    document.getElementById('layer').append(overlay);
    stack.push(api);
    return api;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) {
      const top = stack[stack.length - 1];
      if (!top.sticky) top.close();
    }
  });
  const hasModal = () => stack.length > 0;
  const hasModalAbove = (api) => stack.indexOf(api) !== stack.length - 1;

  function modalHeader(title, api, extra) {
    return h('div', { class: 'modal-head' },
      h('h2', null, title), extra || null,
      api.sticky ? null : h('button', { class: 'icon-btn', title: t('Fechar'), onClick: () => api.close() }, icon('x', 18)));
  }

  function confirmDialog({ title, message, confirmLabel = t('Confirmar'), danger = false }) {
    return new Promise((resolve) => {
      openModal((api) => h('div', { class: 'dialog' },
        h('h2', null, title),
        message ? h('p', { class: 'muted' }, message) : null,
        h('div', { class: 'row end gap' },
          h('button', { class: 'btn', onClick: () => { resolve(false); api.close(); } }, t('Cancelar')),
          h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onClick: () => { resolve(true); api.close(); } }, confirmLabel))
      ), { onClose: () => resolve(false) });
    });
  }

  function promptDialog({ title, label, value = '', confirmLabel = t('Guardar') }) {
    return new Promise((resolve) => {
      openModal((api) => {
        const input = h('input', { type: 'text', value, placeholder: label });
        const ok = () => { const v = input.value.trim(); resolve(v || null); api.close(); };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
        setTimeout(() => { input.focus(); input.select(); }, 30);
        return h('div', { class: 'dialog' },
          h('h2', null, title), input,
          h('div', { class: 'row end gap' },
            h('button', { class: 'btn', onClick: () => { resolve(null); api.close(); } }, t('Cancelar')),
            h('button', { class: 'btn primary', onClick: ok }, confirmLabel)));
      }, { onClose: () => resolve(null) });
    });
  }

  /* ---------- Avisos de conquistas ---------- */
  const toastQueue = [];
  let toastActive = false;
  function toastAchievements(list) {
    toastQueue.push(...list.map((x) => x));
    if (!toastActive) nextToast();
  }
  function nextToast() {
    const a = toastQueue.shift();
    if (!a) { toastActive = false; return; }
    toastActive = true;
    const cos = a.type === 'theme' || a.type === 'bg', info = a.type === 'info';
    const el = h('div', { class: 'toast', onClick: () => { dismiss(); if (cos && RF.shelf) RF.shelf.openCustomize(); } },
      (cos || info) ? h('div', { class: 'medal on', style: { width: '52px', height: '52px', background: 'linear-gradient(135deg,#3347FF,#8B7BFF)' } }, icon(info ? 'users' : 'palette', 22)) : medal(a, true, 52),
      h('div', null,
        h('div', { class: 'toast-kicker' }, info ? t('Amigos') : cos ? t('Novo visual desbloqueado') : t('Conquista desbloqueada')),
        h('div', { class: 'toast-title' }, info ? a.name : cos ? t(a.name) : L.achTitle(a)),
        info ? null : h('div', { class: 'muted small' }, cos ? (a.type === 'theme' ? t('Prateleira') : t('Fundo da estante')) : `${L.tierName(a.tier)}: ${L.achDetail(a)}`)));
    let done = false;
    function dismiss() {
      if (done) return;
      done = true;
      el.classList.add('out');
      setTimeout(() => { el.remove(); setTimeout(nextToast, 250); }, 300);
    }
    document.getElementById('toasts').append(el);
    setTimeout(dismiss, 4200);
  }

  /* ---------- Peças visuais ---------- */
  function avatar(size, who) {
    const st = RF.store.state.settings;
    const photo = who ? who.photo : RF.store.imgUrl(st.photoId);
    const name = who ? who.name : st.name;
    const el = h('div', { class: 'avatar serif', style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.44) + 'px' } });
    if (photo) el.style.backgroundImage = `url("${photo}")`;
    else { el.textContent = (name || 'R').slice(0, 1).toUpperCase(); if (who && who.color) { el.style.background = who.color; el.style.color = '#fff'; } }
    return el;
  }
  function medal(def, unlocked, size = 56) {
    const color = L.tierColor(def.tier);
    const el = h('div', { class: 'medal' + (unlocked ? ' on' : ''), style: { width: size + 'px', height: size + 'px' } },
      icon(unlocked ? L.catById[def.category].icon : 'lock', Math.round(size * 0.42)));
    if (unlocked) {
      el.style.background = `linear-gradient(135deg, ${color}, ${color}99)`;
      el.style.boxShadow = `0 6px 14px ${color}55`;
    }
    return el;
  }

  function spineEl(book, size) {
    const w = size ? size.w : L.spineWidth(book);
    const hh = size ? size.h : L.spineHeight(book);
    const url = RF.store.imgUrl(book.spineId);
    const el = h('div', { class: 'spine' + (url ? ' photo' : ''), style: { width: w + 'px', height: hh + 'px' }, title: book.title });
    if (url) {
      el.style.backgroundImage = `url("${url}")`;
    } else {
      el.style.background = book.color;
      el.style.color = L.textOn(book.color);
      el.append(h('i', { class: 'band top' }), h('span', { class: 'spine-title' }, book.title || t('Título')), h('i', { class: 'band bottom' }));
    }
    return el;
  }

  function coverEl(book, width = 90) {
    const url = RF.store.imgUrl(book.coverId) || book.coverData || null;
    const el = h('div', { class: 'cover', style: { width: width + 'px', height: Math.round(width * 1.5) + 'px' } });
    if (url) {
      el.style.backgroundImage = `url("${url}")`;
    } else {
      el.style.background = `linear-gradient(135deg, ${book.color}, ${book.color}B8)`;
      el.style.color = L.textOn(book.color);
      el.append(icon('book', Math.round(width * 0.24)),
        h('span', { class: 'cover-title', style: { fontSize: Math.max(10, Math.round(width * 0.115)) + 'px' } }, book.title || t('Sem título')));
    }
    return el;
  }

  function ring(progress, size, centerNode) {
    const r = 46, c = 2 * Math.PI * r, p = Math.min(1, Math.max(0, progress));
    return h('div', { class: 'ring', style: { width: size + 'px', height: size + 'px' } },
      h('div', { html: `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><circle cx="50" cy="50" r="${r}" class="ring-bg"/><circle cx="50" cy="50" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 50 50)"/></svg>` }),
      h('div', { class: 'ring-center' }, centerNode));
  }

  /** Estrelas só de leitura (para mostrar a avaliação de outra pessoa). */
  function starsStatic(n, size = 13) {
    const el = h('span', { class: 'stars-static', title: n + ' ★' });
    for (let i = 1; i <= 5; i++) el.append(icon('star', size, { fill: i <= n, cls: i <= n ? 'on' : 'off' }));
    return el;
  }

  function progressBar(p, color) {
    const fill = h('i', { style: { width: Math.round(Math.min(1, Math.max(0, p)) * 100) + '%' } });
    if (color) fill.style.background = color;
    return h('div', { class: 'bar' }, fill);
  }

  function stars(value, onChange) {
    const el = h('div', { class: 'stars' });
    for (let i = 1; i <= 5; i++) {
      const s = h('button', { class: 'star' + (i <= value ? ' on' : ''), type: 'button', title: i + ' ★',
        onClick: () => onChange && onChange(value === i ? 0 : i) }, icon('star', 20, { fill: i <= value }));
      if (!onChange) s.disabled = true;
      el.append(s);
    }
    return el;
  }

  /* ---------- Gráficos ---------- */
  function niceMax(v) {
    if (v <= 0) return 4;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return m * exp;
    return 10 * exp;
  }
  function barChart(buckets, metric, range) {
    const W = 720, H = 240, m = { l: 44, r: 10, t: 10, b: 28 };
    const vals = buckets.map((b) => (metric === 'time' ? b.minutes : b.pages));
    const max = niceMax(Math.max(0, ...vals));
    const iw = W - m.l - m.r, ih = H - m.t - m.b, n = Math.max(buckets.length, 1);
    const slot = iw / n, bw = Math.max(3, Math.min(38, slot * 0.62));
    const every = range === 'month' ? 5 : range === 'all' ? Math.ceil(n / 9) : 1;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">`;
    for (let i = 0; i <= 4; i++) {
      const y = m.t + ih - (ih * i) / 4;
      s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}" class="grid"/><text x="${m.l - 8}" y="${y + 4}" text-anchor="end" class="axis">${Math.round((max * i) / 4)}</text>`;
    }
    buckets.forEach((b, i) => {
      const v = vals[i], bh = max ? (ih * v) / max : 0;
      const x = m.l + slot * i + (slot - bw) / 2, y = m.t + ih - bh;
      const tip = `${L.bucketLabel(range, b.date)}: ${metric === 'time' ? L.duration(b.minutes * 60) : t('{n} págs', { n: Math.round(v) })}`;
      s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" class="bar-rect"><title>${tip}</title></rect>`;
      if (i % every === 0) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" class="axis">${L.bucketLabel(range, b.date)}</text>`;
    });
    return h('div', { class: 'chart-wrap', html: s + '</svg>' });
  }

  function heatmap(minutesByDay, weeks = 22) {
    const today = L.startOfDay(Date.now());
    const start = L.addDays(L.startOfWeek(today), -(weeks - 1) * 7);
    const el = h('div', { class: 'heatmap', style: { gridTemplateColumns: `repeat(${weeks}, 1fr)` } });
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const date = L.addDays(start, w * 7 + d);
        const mins = minutesByDay.get(date) || 0;
        let level = 0;
        if (mins >= 60) level = 4; else if (mins >= 30) level = 3; else if (mins >= 15) level = 2; else if (mins > 0) level = 1;
        const cell = h('i', { class: 'hm l' + level + (date > today ? ' future' : ''),
          title: date > today ? '' : `${L.longDate(date)}: ${t('{m} min', { m: mins })}`, style: { gridColumn: String(w + 1), gridRow: String(d + 1) } });
        el.append(cell);
      }
    }
    return el;
  }

  /* ---------- Fotografias: carregar, recortar, webcam ---------- */
  async function loadDrawable(file) {
    let bmp;
    try {
      bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      bmp = await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = URL.createObjectURL(file);
      });
    }
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    const k = Math.min(1, 2200 / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w0 * k));
    c.height = Math.max(1, Math.round(h0 * k));
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    return c;
  }
  function rotate90(c) {
    const nc = document.createElement('canvas');
    nc.width = c.height; nc.height = c.width;
    const x = nc.getContext('2d');
    x.translate(nc.width / 2, nc.height / 2);
    x.rotate(Math.PI / 2);
    x.drawImage(c, -c.width / 2, -c.height / 2);
    return nc;
  }
  async function downscale(blob, maxSide) {
    const c = await loadDrawable(blob);
    const k = Math.min(1, maxSide / Math.max(c.width, c.height));
    const out = document.createElement('canvas');
    out.width = Math.round(c.width * k); out.height = Math.round(c.height * k);
    out.getContext('2d').drawImage(c, 0, 0, out.width, out.height);
    return new Promise((res) => out.toBlob(res, 'image/jpeg', 0.85));
  }

  function openCropper(source, { title, aspect, outW }) {
    return new Promise((resolve) => {
      let src = source;
      const st = { zoom: 1, ox: 0, oy: 0 };
      const STAGE_W = 680, STAGE_H = 470;
      let boxH = STAGE_H - 50, boxW = boxH * aspect;
      if (boxW > STAGE_W - 50) { boxW = STAGE_W - 50; boxH = boxW / aspect; }
      const bx = (STAGE_W - boxW) / 2, by = (STAGE_H - boxH) / 2;

      const canvas = h('canvas', { class: 'crop-canvas', width: STAGE_W, height: STAGE_H });
      const ctx = canvas.getContext('2d');
      const slider = h('input', { type: 'range', min: 1, max: 8, step: 0.01, value: 1, class: 'zoom' });

      const geometry = (bw, bh) => {
        const s = Math.max(bw / src.width, bh / src.height) * st.zoom;
        return { dw: src.width * s, dh: src.height * s };
      };
      const clampOffset = (bw, bh) => {
        const g = geometry(bw, bh);
        const mx = Math.max(0, (g.dw - bw) / 2) / bw, my = Math.max(0, (g.dh - bh) / 2) / bh;
        st.ox = Math.min(mx, Math.max(-mx, st.ox));
        st.oy = Math.min(my, Math.max(-my, st.oy));
      };
      const paint = (c2d, x, y, bw, bh) => {
        const g = geometry(bw, bh);
        c2d.drawImage(src, x + bw / 2 - g.dw / 2 + st.ox * bw, y + bh / 2 - g.dh / 2 + st.oy * bh, g.dw, g.dh);
      };
      function draw() {
        clampOffset(boxW, boxH);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, STAGE_W, STAGE_H);
        ctx.save(); ctx.globalAlpha = 0.4; paint(ctx, bx, by, boxW, boxH); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(bx, by, boxW, boxH); ctx.clip(); paint(ctx, bx, by, boxW, boxH); ctx.restore();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(bx, by, boxW, boxH);
      }

      let drag = null;
      canvas.addEventListener('pointerdown', (e) => {
        drag = { x: e.clientX, y: e.clientY, ox: st.ox, oy: st.oy };
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const k = STAGE_W / canvas.getBoundingClientRect().width;
        st.ox = drag.ox + ((e.clientX - drag.x) * k) / boxW;
        st.oy = drag.oy + ((e.clientY - drag.y) * k) / boxH;
        draw();
      });
      const endDrag = () => { drag = null; };
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        st.zoom = Math.min(8, Math.max(1, st.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
        slider.value = st.zoom;
        draw();
      }, { passive: false });
      slider.addEventListener('input', () => { st.zoom = parseFloat(slider.value); draw(); });

      let result = null;
      const api = openModal((m) => h('div', { class: 'cropper' },
        modalHeader(title, m),
        canvas,
        h('div', { class: 'row gap center' }, icon('search', 16), slider,
          h('button', { class: 'btn', onClick: () => { src = rotate90(src); st.zoom = 1; st.ox = 0; st.oy = 0; slider.value = 1; draw(); } },
            icon('rotate', 16), t('Rodar 90°'))),
        h('p', { class: 'muted small center-text' }, t('Arrasta para mover e usa a roda do rato (ou o cursor) para aproximar.')),
        h('div', { class: 'row end gap' },
          h('button', { class: 'btn', onClick: () => m.close() }, t('Cancelar')),
          h('button', { class: 'btn primary', onClick: () => {
            const outH = Math.round(outW / aspect);
            const out = document.createElement('canvas');
            out.width = outW; out.height = outH;
            clampOffset(outW, outH);
            paint(out.getContext('2d'), 0, 0, outW, outH);
            out.toBlob((b) => { result = b; m.close(); }, 'image/jpeg', 0.86);
          } }, t('Usar foto')))
      ), { sticky: true, wide: true, onClose: () => resolve(result) });
      draw();
      return api;
    });
  }

  function openCamera() {
    return new Promise((resolve) => {
      let stream = null, result = null;
      const video = h('video', { autoplay: true, muted: true, playsInline: true, class: 'cam' });
      const msg = h('p', { class: 'muted small center-text' }, t('A iniciar a câmara…'));
      const shoot = h('button', { class: 'btn primary', disabled: true, onClick: () => {
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        c.toBlob((b) => { result = b; api.close(); }, 'image/jpeg', 0.92);
      } }, icon('camera', 16), t('Capturar'));
      const api = openModal((m) => h('div', { class: 'cropper' },
        modalHeader(t('Webcam'), m), video, msg,
        h('div', { class: 'row end gap' }, h('button', { class: 'btn', onClick: () => m.close() }, t('Cancelar')), shoot)
      ), { sticky: true, wide: true, onClose: () => { if (stream) stream.getTracks().forEach((t) => t.stop()); resolve(result); } });
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        msg.textContent = t('Este ambiente não permite usar a webcam.');
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
        .then((s) => {
          if (api.closed) { s.getTracks().forEach((t) => t.stop()); return; }
          stream = s; video.srcObject = s; shoot.disabled = false; msg.textContent = t('Aponta a câmara e carrega em Capturar.');
        })
        .catch(() => { msg.textContent = t('Não foi possível aceder à webcam. Verifica se há uma câmara ligada e se a permissão está ativa.'); });
    });
  }

  /**
   * Botões "Escolher ficheiro" e "Webcam". Chama onBlob com a imagem final (já recortada, se crop).
   * opts: { crop: true, title, aspect, outW } ou { crop: false, maxSide }
   */
  function photoPicker(onBlob, opts) {
    async function handle(blob) {
      if (!blob) return;
      try {
        if (opts.crop) {
          const out = await openCropper(await loadDrawable(blob), opts);
          if (out) onBlob(out);
        } else {
          onBlob(await downscale(blob, opts.maxSide || 1400));
        }
      } catch (e) {
        openModal((m) => h('div', { class: 'dialog' }, h('h2', null, t('Não foi possível abrir a imagem')),
          h('p', { class: 'muted' }, t('Tenta com outro ficheiro (JPG, PNG ou WebP).')),
          h('div', { class: 'row end' }, h('button', { class: 'btn primary', onClick: () => m.close() }, t('OK')))));
      }
    }
    const input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) handle(f);
    } });
    return h('div', { class: 'row gap wrap' }, input,
      h('button', { class: 'btn', type: 'button', onClick: () => input.click() }, icon('image', 16), t('Escolher ficheiro')),
      h('button', { class: 'btn', type: 'button', onClick: async () => handle(await openCamera()) }, icon('camera', 16), t('Webcam')));
  }

  RF.ui = {
    h, icon, openModal, modalHeader, hasModal, hasModalAbove, confirmDialog, promptDialog, toastAchievements,
    medal, avatar, spineEl, coverEl, ring, progressBar, stars, starsStatic, barChart, heatmap, photoPicker, openCropper, openCamera
  };
})(typeof window !== 'undefined' ? window : globalThis);
