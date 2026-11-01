/* ReadFlow — visuais da estante (prateleiras e fundos desbloqueáveis) e desenho das prateleiras. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic, S = RF.store, UI = RF.ui, Y = RF.layout;
  const t = RF.i18n.t;
  const { h, icon } = UI;

  const grain = (c, a, step) => `repeating-linear-gradient(90deg, rgba(${c},${a}) 0 2px, transparent 2px ${step}px)`;

  /* ---------- Prateleiras: só a linha horizontal, em vários materiais ---------- */
  const woodGrain = (a, step) => `repeating-linear-gradient(90deg, rgba(0,0,0,${a}) 0 2px, transparent 2px ${step}px)`;
  const marbleVeins = (v1, v2) => `linear-gradient(115deg, ${v1} 0 1px, transparent 1px) 0 0/90px 100%, linear-gradient(160deg, ${v2} 0 1px, transparent 1px) 30px 0/130px 100%`;
  const sh = (c) => `0 7px 14px rgba(0,0,0,${c})`;
  const THEMES = [
    { id: 'wood', name: 'Madeira clássica', rule: { kind: 'free' }, vars: { '--board-bg': `${woodGrain('.08', 14)}, linear-gradient(#D9AB78, #A87444 55%, #8A5A30)`, '--board-h': '16px', '--board-shadow': sh('.3') } },
    { id: 'oak', name: 'Carvalho claro', rule: { kind: 'added', n: 3 }, vars: { '--board-bg': `repeating-linear-gradient(90deg, rgba(120,80,30,.1) 0 1px, transparent 1px 16px), linear-gradient(#EFDCB8, #D4B07C 60%, #B88F58)`, '--board-h': '16px', '--board-shadow': sh('.25') } },
    { id: 'pine', name: 'Pinho', rule: { kind: 'hours', n: 2 }, vars: { '--board-bg': `repeating-linear-gradient(90deg, rgba(160,90,20,.16) 0 2px, transparent 2px 22px), linear-gradient(#F1D08A, #DDB05E 60%, #B98B3A)`, '--board-h': '16px', '--board-shadow': sh('.25') } },
    { id: 'cherry', name: 'Cerejeira', rule: { kind: 'hours', n: 10 }, vars: { '--board-bg': `${woodGrain('.12', 12)}, linear-gradient(#B4533A, #8E3523 60%, #6A2416)`, '--board-h': '16px', '--board-shadow': sh('.35') } },
    { id: 'walnut', name: 'Nogueira escura', rule: { kind: 'hours', n: 25 }, vars: { '--board-bg': `repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 2px, transparent 2px 13px), linear-gradient(#7A5642, #4B3226 60%, #2F1F17)`, '--board-h': '16px', '--board-shadow': sh('.45') } },
    { id: 'ebony', name: 'Ébano', rule: { kind: 'hours', n: 50 }, vars: { '--board-bg': `repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 11px), linear-gradient(#3A3A3F, #1B1B1F 60%, #0D0D10)`, '--board-h': '15px', '--board-shadow': sh('.5') } },
    { id: 'white', name: 'Branco minimalista', rule: { kind: 'added', n: 10 }, vars: { '--board-bg': 'linear-gradient(#FFFFFF, #E4E7EE)', '--board-h': '12px', '--board-shadow': '0 6px 12px rgba(30,40,80,.2)' } },
    { id: 'brickred', name: 'Tijolo vermelho', rule: { kind: 'finished', n: 3 }, vars: { '--board-bg': 'linear-gradient(rgba(232,222,205,.9) 0 2px, transparent 2px calc(100% - 2px), rgba(232,222,205,.9) calc(100% - 2px)), repeating-linear-gradient(90deg, rgba(232,222,205,.9) 0 2px, transparent 2px 38px), linear-gradient(#B3573E, #9C432E)', '--board-h': '20px', '--board-shadow': sh('.35') } },
    { id: 'brickgrey', name: 'Tijolo cinzento', rule: { kind: 'finished', n: 8 }, vars: { '--board-bg': 'linear-gradient(rgba(225,225,228,.8) 0 2px, transparent 2px calc(100% - 2px), rgba(225,225,228,.8) calc(100% - 2px)), repeating-linear-gradient(90deg, rgba(225,225,228,.8) 0 2px, transparent 2px 36px), linear-gradient(#8A8D94, #6F7279)', '--board-h': '20px', '--board-shadow': sh('.35') } },
    { id: 'marble', name: 'Mármore', rule: { kind: 'hours', n: 100 }, vars: { '--board-bg': `${marbleVeins('rgba(120,125,140,.4)', 'rgba(150,150,165,.35)')}, linear-gradient(120deg, #FAFAFC 0, #E2E3EA 40%, #F6F6FA 60%, #D0D2DC 100%)`, '--board-h': '16px', '--board-shadow': sh('.28') } },
    { id: 'blackmarble', name: 'Mármore preto', rule: { kind: 'finished', n: 25 }, vars: { '--board-bg': `${marbleVeins('rgba(255,255,255,.4)', 'rgba(212,175,55,.5)')}, linear-gradient(#2A2A30, #121216)`, '--board-h': '16px', '--board-shadow': sh('.5') } },
    { id: 'greenmarble', name: 'Mármore verde', rule: { kind: 'streak', n: 14 }, vars: { '--board-bg': `${marbleVeins('rgba(255,255,255,.35)', 'rgba(220,240,225,.3)')}, linear-gradient(#2E6B52, #1B4A38 60%, #123626)`, '--board-h': '16px', '--board-shadow': sh('.4') } },
    { id: 'pinkmarble', name: 'Mármore rosa', rule: { kind: 'sessions', n: 50 }, vars: { '--board-bg': `${marbleVeins('rgba(255,255,255,.55)', 'rgba(190,100,120,.3)')}, linear-gradient(#F3C9D2, #E3A6B4 60%, #CE8497)`, '--board-h': '16px', '--board-shadow': sh('.28') } },
    { id: 'leaves', name: 'Folhas', rule: { kind: 'streak', n: 3 }, vars: { '--board-bg': 'radial-gradient(ellipse 11px 4.5px at 12px 6px, #6FBF63 0 98%, transparent 100%) 0 0/34px 18px, radial-gradient(ellipse 11px 4.5px at 27px 12px, #2E7D3A 0 98%, transparent 100%) 0 0/34px 18px, linear-gradient(#3C8D48, #1F5E2B)', '--board-h': '18px', '--board-shadow': sh('.3') } },
    { id: 'clouds', name: 'Nuvens', rule: { kind: 'ach', id: 'early_0' }, vars: { '--board-bg': 'radial-gradient(circle at 20px 13px, #fff 0 9px, transparent 10px) 0 0/62px 100%, radial-gradient(circle at 38px 10px, #fff 0 11px, transparent 12px) 0 0/62px 100%, radial-gradient(circle at 52px 14px, #fff 0 8px, transparent 9px) 0 0/62px 100%, linear-gradient(#9CCBF2, #6FAEE0)', '--board-h': '22px', '--board-shadow': '0 8px 16px rgba(40,90,150,.3)' } },
    { id: 'glass', name: 'Vidro', rule: { kind: 'hours', n: 75 }, vars: { '--board-bg': 'linear-gradient(rgba(215,240,255,.92), rgba(140,200,235,.55))', '--board-h': '11px', '--board-shadow': '0 8px 16px rgba(20,60,100,.28), inset 0 1px 0 rgba(255,255,255,.9)' } },
    { id: 'steel', name: 'Metal industrial', rule: { kind: 'finished', n: 5 }, vars: { '--board-bg': 'linear-gradient(#A5AEB8, #6E7882 55%, #4C555E)', '--board-h': '13px', '--board-shadow': sh('.4') } },
    { id: 'neon', name: 'Néon nerd', rule: { kind: 'ach', id: 'pages_1' }, vars: { '--board-bg': 'linear-gradient(#171A3A, #0C0E24)', '--board-h': '11px', '--board-shadow': '0 0 16px #00E5FF, 0 0 3px #00E5FF' } },
    { id: 'gold', name: 'Biblioteca real', rule: { kind: 'achCount', n: 30 }, vars: { '--board-bg': 'linear-gradient(#F8DE86, #CBA43D 55%, #8A6A1E)', '--board-h': '15px', '--board-shadow': sh('.45') } }
  ];

  /* ---------- Fundos da estante ---------- */
  const dots = 'radial-gradient(1.5px 1.5px at 20px 30px, #fff, transparent) 0 0/240px 150px, radial-gradient(1px 1px at 80px 70px, #fff, transparent) 0 0/240px 150px, radial-gradient(1.5px 1.5px at 140px 20px, #fff, transparent) 0 0/240px 150px, radial-gradient(1px 1px at 200px 110px, #fff, transparent) 0 0/240px 150px, radial-gradient(1px 1px at 50px 120px, #cde, transparent) 0 0/240px 150px';
  const BACKGROUNDS = [
    { id: 'neutral', name: 'Neutro', dark: false, rule: { kind: 'free' }, css: 'linear-gradient(#ECEDF2, #D9DCE6)' },
    { id: 'minimal', name: 'Minimalista', dark: false, rule: { kind: 'finished', n: 1 }, css: 'linear-gradient(#F7F5F0, #ECE8DF)' },
    { id: 'library', name: 'Biblioteca clássica', dark: true, rule: { kind: 'hours', n: 5 }, css: 'repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 2px, transparent 2px 140px), linear-gradient(180deg, #22443A 0 64%, #5A3E28 64% 65%, #1A3028 65%)' },
    { id: 'school', name: 'Escolar', dark: false, rule: { kind: 'sessions', n: 10 }, css: 'linear-gradient(90deg, transparent 58px, rgba(220,60,60,.5) 58px 60px, transparent 60px), repeating-linear-gradient(#FBFAF3 0 27px, #BFD4E8 27px 28px)' },
    { id: 'cafe', name: 'Café', dark: false, rule: { kind: 'ach', id: 'early_0' }, css: 'radial-gradient(circle at 80% 10%, rgba(255,255,255,.35), transparent 50%), repeating-linear-gradient(45deg, rgba(120,80,50,.05) 0 2px, transparent 2px 6px), linear-gradient(#E6D3B8, #CDB38F)' },
    { id: 'forest', name: 'Floresta', dark: true, rule: { kind: 'streak', n: 7 }, css: 'radial-gradient(circle at 15% 20%, #2E6B45 0, transparent 40%), radial-gradient(circle at 85% 80%, #1C4A33 0, transparent 45%), linear-gradient(#143A2A, #0D2A1F)' },
    { id: 'oldschool', name: 'Old school', dark: true, rule: { kind: 'hours', n: 25 }, css: 'radial-gradient(ellipse at 50% 0, rgba(255,200,120,.28), transparent 65%), repeating-linear-gradient(90deg, #4A3324 0 70px, #382517 70px 72px)' },
    { id: 'nerd', name: 'Nerd', dark: true, rule: { kind: 'sessions', n: 25 }, css: 'linear-gradient(rgba(0,229,255,.07) 1px, transparent 1px) 0 0/32px 32px, linear-gradient(90deg, rgba(0,229,255,.07) 1px, transparent 1px) 0 0/32px 32px, radial-gradient(circle at 20% 10%, #1B2A6B 0, #0B1030 60%)' },
    { id: 'brick', name: 'Tijolo', dark: true, rule: { kind: 'added', n: 25 }, css: 'repeating-linear-gradient(0deg, rgba(0,0,0,.22) 0 3px, transparent 3px 26px), repeating-linear-gradient(90deg, rgba(0,0,0,.2) 0 3px, transparent 3px 62px), linear-gradient(#B3573E, #8F3F2C)' },
    { id: 'architect', name: 'Arquiteto', dark: true, rule: { kind: 'finished', n: 10 }, css: 'linear-gradient(rgba(255,255,255,.2) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(90deg, rgba(255,255,255,.2) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px) 0 0/120px 120px, linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px) 0 0/120px 120px, #1F4E9A' },
    { id: 'night', name: 'Noite estrelada', dark: true, rule: { kind: 'ach', id: 'night_0' }, css: `${dots}, linear-gradient(#0B1030, #1B1450)` },
    { id: 'sunset', name: 'Pôr do sol', dark: true, rule: { kind: 'streak', n: 30 }, css: 'linear-gradient(180deg, #2B1B54 0, #8E3B7A 38%, #F2745B 70%, #FFC067 100%)' }
  ];
  const ALL = [...THEMES.map((x) => ({ ...x, type: 'theme' })), ...BACKGROUNDS.map((x) => ({ ...x, type: 'bg' }))];

  const context = () => ({ snap: L.snapshot(S.state.books, S.state.sessions, S.state.shelves, S.state.settings), unlocked: S.state.unlocked });
  const stateOf = (item, ctx) => L.ruleState(item.rule, ctx.snap, ctx.unlocked);
  const pick = (list, id, ctx) => { const it = list.find((x) => x.id === id) || list[0]; return stateOf(it, ctx).ok ? it : list[0]; };
  const themeOf = (id, ctx) => pick(THEMES, id, ctx);
  const customBg = () => {
    const st = S.state.settings, url = S.imgUrl(st.shelfBgImageId);
    return url ? { id: 'custom', name: 'A minha imagem', dark: !!st.shelfBgDark, css: `linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.12)), url("${url}") center / cover no-repeat, #888`, custom: true } : null;
  };
  const bgOf = (id, ctx) => (id === 'custom' && customBg()) || pick(BACKGROUNDS, id === 'custom' ? 'neutral' : id, ctx);
  /** Descobre se a imagem é escura (para escolher a cor do texto por cima). */
  function isDarkImage(url) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            const c = document.createElement('canvas'); c.width = 8; c.height = 8;
            const x = c.getContext('2d'); x.drawImage(img, 0, 0, 8, 8);
            const d = x.getImageData(0, 0, 8, 8).data; let sum = 0;
            for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            resolve(sum / (d.length / 4) / 255 < 0.55);
          } catch (e) { resolve(true); }
        };
        img.onerror = () => resolve(true);
        img.src = url;
      } catch (e) { resolve(true); }
    });
  }

  function applyRoom(el, theme, bg) {
    el.style.background = bg.css;
    for (const [k, v] of Object.entries(theme.vars)) el.style.setProperty(k, v);
    el.classList.add(bg.dark ? 'dark' : 'light');
  }

  /** Visuais acabados de desbloquear (para avisar o utilizador). Na primeira vez só regista o que já estava aberto. */
  async function syncCosmetics(silent) {
    const st = S.state.settings, ctx = context();
    const okIds = ALL.filter((c) => stateOf(c, ctx).ok).map((c) => c.id);
    const first = st.seenCosmetics === null || st.seenCosmetics === undefined;
    const seen = new Set(st.seenCosmetics || []);
    const fresh = okIds.filter((id) => !seen.has(id));
    if (first || fresh.length) { st.seenCosmetics = okIds; await S.saveSettings(); }
    if (first || silent) return [];
    return ALL.filter((c) => fresh.includes(c.id));
  }

  /* ---------- Desenho das prateleiras ---------- */
  function lyingEl(b, len, thick) {
    const url = S.imgUrl(b.spineId);
    const el = h('div', { class: 'lying', title: b.title, style: { width: len + 'px', height: thick + 'px' } });
    if (url) {
      el.append(h('div', { class: 'lying-photo', style: { width: thick + 'px', height: len + 'px', left: (len - thick) / 2 + 'px', top: (thick - len) / 2 + 'px', backgroundImage: `url("${url}")` } }));
    } else {
      el.style.background = b.color; el.style.color = L.textOn(b.color);
      el.append(h('i', { class: 'band-v left' }), h('span', { class: 'lying-title' }, b.title), h('i', { class: 'band-v right' }));
    }
    return el;
  }

  function renderUnit(u, open) {
    const click = (b) => (el) => { el.addEventListener('click', () => open(b)); return el; };
    switch (u.kind) {
      case 'face': {
        const b = u.books[0];
        return click(b)(h('div', { class: 'unit face', title: b.title, style: { width: u.w + 'px' } }, UI.coverEl(b, u.w)));
      }
      case 'lean': {
        const b = u.books[0], sp = UI.spineEl(b);
        sp.style.left = u.extra + 'px';
        click(b)(sp);
        return h('div', { class: 'unit lean', style: { width: u.w + 'px', height: u.h + 'px', '--a': u.angle + 'deg' } }, sp);
      }
      case 'pile':
        return h('div', { class: 'unit pile', style: { width: u.w + 'px' } }, ...u.books.map((b) =>
          click(b)(lyingEl(b, Y.lyingLength(b), Y.thickness(b)))).map((el, i) => { el.style.marginLeft = (L.hashStr(u.books[i].id) % 14) + 'px'; return el; }));
      case 'capped': {
        const cap = click(u.cap)(lyingEl(u.cap, u.capL, Y.thickness(u.cap)));
        cap.classList.add('cap');
        cap.style.left = (u.w - u.capL) / 2 + 'px'; cap.style.bottom = u.maxH + 'px';
        return h('div', { class: 'unit capped', style: { width: u.w + 'px', height: u.maxH + Y.thickness(u.cap) + 'px' } },
          h('div', { class: 'cap-base', style: { marginLeft: (u.w - u.gw) / 2 + 'px' } }, ...u.books.map((b) => click(b)(UI.spineEl(b)))), cap);
      }
      default: return click(u.books[0])(UI.spineEl(u.books[0]));
    }
  }

  /** Prateleiras com os livros dados: só a linha horizontal, com um pequeno batente em cada ponta. Devolve { node, level }. */
  function renderCase(books, o) {
    const open = o.onOpen, boardLine = () => h('div', { class: 'board' });
    if (o.style === 'covers') {
      const per = Math.max(1, Math.floor((o.width + 16) / (Y.FACE_W + 16)));
      const rows = [];
      for (let i = 0; i < books.length; i += per) rows.push(books.slice(i, i + per));
      if (!rows.length) rows.push([]);
      return { level: 0, node: h('div', { class: 'shelf-lines' }, ...rows.map((row) => h('div', { class: 'shelf-row' },
        h('div', { class: 'units', style: { gap: '16px', height: Y.ROW_H - 40 + 'px' } },
          ...(row.length ? row.map((b) => h('div', { class: 'unit face', title: b.title, onClick: () => open(b) }, UI.coverEl(b, Y.FACE_W))) : [h('div', { class: 'shelf-empty' }, t('Sem livros nesta prateleira'))])),
        boardLine()))) };
    }
    const lay = Y.layoutShelf(books, o.width, { rows: 2, featured: o.featured });
    const rows = lay.rows.length ? lay.rows : [{ units: [] }];
    return { level: lay.level, node: h('div', { class: 'shelf-lines' }, ...rows.map((row) => h('div', { class: 'shelf-row' },
      h('div', { class: 'units', style: { gap: lay.gap + 'px', height: Y.ROW_H + 'px' } },
        ...(row.units.length ? row.units.map((u) => renderUnit(u, open)) : [h('div', { class: 'shelf-empty' }, t('Sem livros nesta prateleira'))])),
      boardLine()))) };
  }

  /* ---------- Janela "Personalizar estante" ---------- */
  function themePreview(theme) {
    const el = h('div', { class: 'cos-prev' });
    for (const [k, v] of Object.entries(theme.vars)) el.style.setProperty(k, v);
    const cols = ['#2F4858', '#8C2F39', '#B5651D', '#3D348B', '#0B6E4F', '#7A3E65'];
    el.append(h('div', { class: 'pv-shelf' }, h('div', { class: 'pv-units' }, ...cols.map((c, i) => h('i', { style: { background: c, height: 30 + ((i * 7) % 16) + 'px' } }))), h('b', { class: 'pv-board' })));
    return el;
  }
  function bgPreview(bg) {
    const el = h('div', { class: 'cos-prev bg' }, h('b', { class: 'pv-board', style: { '--board-bg': 'linear-gradient(#D9AB78, #8A5A30)', '--board-h': '8px' } }));
    el.style.background = bg.css;
    return el;
  }

  function openCustomize() {
    UI.openModal((api) => {
      const wrap = h('div', { class: 'stack' });
      function paint() {
        const ctx = context(), st = S.state.settings, custom = customBg();
        const card = (item, selected, apply, prev) => {
          const r = stateOf(item, ctx);
          return h('button', { class: 'cos-card' + (selected ? ' on' : '') + (r.ok ? '' : ' locked'), title: r.ok ? '' : r.text, onClick: async () => { if (r.ok) { apply(); await S.saveSettings(); RF.app.refresh(); paint(); } } },
            prev, r.ok ? null : h('div', { class: 'cos-lock' }, icon('lock', 22)),
            h('div', { class: 'cos-body' }, h('div', { class: 'strong small' }, t(item.name)),
              r.ok ? h('div', { class: 'muted tiny' }, selected ? t('Em uso') : t('Desbloqueado'))
                : h('div', { class: 'stack tight' }, h('div', { class: 'muted tiny' }, r.text), r.target > 1 ? UI.progressBar(r.value / r.target) : null)));
        };
        const customPrev = custom ? bgPreview(custom) : h('div', { class: 'cos-prev bg empty-prev' }, icon('image', 28));
        const customCard = h('div', { class: 'cos-card' + (st.shelfBg === 'custom' && custom ? ' on' : '') },
          h('div', { onClick: async () => { if (custom) { st.shelfBg = 'custom'; await S.saveSettings(); RF.app.refresh(); paint(); } }, class: 'link' }, customPrev),
          h('div', { class: 'cos-body stack tight' }, h('div', { class: 'strong small' }, t('A minha imagem')),
            h('div', { class: 'muted tiny' }, custom ? (st.shelfBg === 'custom' ? t('Em uso') : t('Toca na imagem para usar')) : t('Carrega uma fotografia ou imagem para a parede.')),
            UI.photoPicker(async (blob) => {
              await S.removeImage(st.shelfBgImageId); st.shelfBgImageId = await S.addImage(blob);
              st.shelfBgDark = await isDarkImage(S.imgUrl(st.shelfBgImageId)); st.shelfBg = 'custom';
              await S.saveSettings(); RF.app.refresh(); paint();
            }, { crop: false, maxSide: 2400 }),
            custom ? h('button', { class: 'btn ghost danger-text small-btn', onClick: async () => { await S.removeImage(st.shelfBgImageId); st.shelfBgImageId = null; if (st.shelfBg === 'custom') st.shelfBg = 'neutral'; await S.saveSettings(); RF.app.refresh(); paint(); } }, icon('trash', 14), t('Remover imagem')) : null));
        wrap.replaceChildren(
          h('h3', null, t('Prateleiras')),
          h('div', { class: 'cos-grid' }, ...THEMES.map((x) => card(x, themeOf(st.shelfTheme, ctx).id === x.id, () => { st.shelfTheme = x.id; }, themePreview(x)))),
          h('h3', null, t('Fundos')),
          h('div', { class: 'cos-grid' }, customCard, ...BACKGROUNDS.map((x) => card(x, st.shelfBg !== 'custom' && bgOf(st.shelfBg, ctx).id === x.id, () => { st.shelfBg = x.id; }, bgPreview(x)))));
      }
      paint();
      return h('div', { class: 'dialog wide' }, UI.modalHeader(t('Personalizar estante'), api),
        h('p', { class: 'muted small' }, t('Desbloqueia novos visuais a ler, a terminar livros e a ganhar conquistas.')), wrap,
        h('div', { class: 'row end' }, h('button', { class: 'btn primary', onClick: () => api.close() }, t('Fechar'))));
    }, { wide: true });
  }

  RF.shelf = { THEMES, BACKGROUNDS, ALL, context, stateOf, themeOf, bgOf, applyRoom, syncCosmetics, renderCase, openCustomize };
})(typeof window !== 'undefined' ? window : globalThis);
