/* ReadFlow — sessão de leitura: cronómetro, início, fim, resumo e imagem para partilhar. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic, S = RF.store, UI = RF.ui;
  const { h, icon } = UI;
  const t = RF.i18n.t;

  /* ---------- Estado do cronómetro (calculado com datas, por isso não se perde) ---------- */
  const session = {
    state: 'idle', bookId: null, startPage: 0, sessionStart: null, accumulated: 0, resumedAt: null,
    overlay: null, timer: null,

    get active() { return this.state !== 'idle'; },
    elapsed(now = Date.now()) {
      let t = this.accumulated;
      if (this.state === 'running' && this.resumedAt) t += Math.max(0, (now - this.resumedAt) / 1000);
      return t;
    },
    persist() {
      return S.saveActive({ state: this.state, bookId: this.bookId, startPage: this.startPage,
        sessionStart: this.sessionStart, accumulated: this.accumulated, resumedAt: this.resumedAt });
    },
    restore(saved) {
      if (!saved || saved.state === 'idle' || !S.getBook(saved.bookId)) { if (saved) S.clearActive(); return; }
      Object.assign(this, { bookId: saved.bookId, startPage: saved.startPage, sessionStart: saved.sessionStart,
        accumulated: saved.accumulated || 0, resumedAt: saved.resumedAt || null });
      const gap = saved.resumedAt ? Date.now() - saved.resumedAt : 0;
      // Se a app esteve fechada muito tempo, pausa em vez de contar horas a mais.
      this.state = (saved.state === 'running' && gap > 2 * 3600 * 1000) ? 'paused' : saved.state;
      if (this.state === 'paused') this.resumedAt = null;
    },
    async begin(bookId, startPage) {
      Object.assign(this, { state: 'running', bookId, startPage, sessionStart: Date.now(), accumulated: 0, resumedAt: Date.now() });
      await this.persist();
      RF.app.refresh();
      openOverlay();
    },
    async pause() {
      if (this.state !== 'running') return;
      this.accumulated = this.elapsed();
      this.resumedAt = null;
      this.state = 'paused';
      await this.persist();
    },
    async resume() {
      if (this.state !== 'paused') return;
      this.resumedAt = Date.now();
      this.state = 'running';
      await this.persist();
    },
    async reset() {
      Object.assign(this, { state: 'idle', bookId: null, startPage: 0, sessionStart: null, accumulated: 0, resumedAt: null });
      document.title = 'ReadFlow';
      await S.clearActive();
      RF.app.refresh();
    }
  };

  /* ---------- Ecrã da sessão em curso ---------- */
  function openOverlay() {
    if (session.overlay && !session.overlay.closed) return;
    const book = S.getBook(session.bookId);
    if (!book) { session.reset(); return; }

    const clockEl = h('div', { class: 'big-clock' }, L.clock(session.elapsed()));
    const stateEl = h('span', { class: 'pill' });
    const playBtn = h('button', { class: 'round-btn', title: t('Pausar / retomar (Espaço)'), onClick: toggle });
    function paintState() {
      const running = session.state === 'running';
      stateEl.textContent = running ? t('A ler') : t('Em pausa');
      stateEl.classList.toggle('paused', !running);
      playBtn.replaceChildren(icon(running ? 'pause' : 'play', 30, { fill: true }));
    }
    async function toggle() {
      if (session.state === 'running') await session.pause(); else await session.resume();
      paintState();
    }
    function tick() {
      const t = L.clock(session.elapsed());
      clockEl.textContent = t;
      document.title = session.state === 'running' ? `${t} · ReadFlow` : 'ReadFlow';
    }
    const onKey = (e) => {
      if (e.code === 'Space' && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement.tagName) && session.overlay && !session.overlay.closed
        && !RF.ui.hasModalAbove(session.overlay)) { e.preventDefault(); toggle(); }
    };

    session.overlay = UI.openModal((api) => h('div', { class: 'session-screen' },
      h('div', { class: 'row between center' },
        h('button', { class: 'btn ghost', onClick: () => api.close() }, icon('down', 18), t('Minimizar')),
        stateEl,
        h('button', { class: 'btn ghost danger-text', onClick: async () => {
          if (await UI.confirmDialog({ title: t('Descartar esta sessão?'), message: t('O tempo registado não será guardado.'), confirmLabel: t('Descartar'), danger: true })) {
            api.close(); await session.reset();
          }
        } }, icon('trash', 18), t('Descartar'))),
      h('div', { class: 'session-main' },
        UI.coverEl(book, 170),
        h('h1', { class: 'serif' }, book.title),
        book.author ? h('p', { class: 'muted' }, book.author) : null,
        clockEl,
        h('p', { class: 'muted' }, t('Começaste na página {n}', { n: session.startPage }))),
      h('div', { class: 'row gap center-x' },
        playBtn,
        h('button', { class: 'btn big', onClick: async () => { await session.pause(); paintState(); openFinish(book); } }, icon('stop', 18, { fill: true }), t('Terminar')))
    ), { full: true, sticky: true, onClose: () => { clearInterval(session.timer); document.removeEventListener('keydown', onKey); document.title = 'ReadFlow'; RF.app.refresh(); } });

    paintState(); tick();
    session.timer = setInterval(tick, 500);
    document.addEventListener('keydown', onKey);
  }

  /* ---------- Começar sessão ---------- */
  function openStart(preselectedId) {
    const books = S.state.books.filter((b) => b.status !== 'finished' || b.id === preselectedId)
      .sort((a, b) => b.addedAt - a.addedAt);
    UI.openModal((api) => {
      if (!books.length) {
        return h('div', { class: 'dialog' }, h('h2', null, t('Ainda não tens livros')),
          h('p', { class: 'muted' }, t('Adiciona um livro para começares a registar a leitura.')),
          h('div', { class: 'row end gap' },
            h('button', { class: 'btn', onClick: () => api.close() }, t('Fechar')),
            h('button', { class: 'btn primary', onClick: () => { api.close(); RF.dialogs.openBookForm(); } }, t('Adicionar livro'))));
      }
      let selected = (books.find((b) => b.id === preselectedId) || books.find((b) => b.status === 'reading') || {}).id || null;
      const pageInput = h('input', { type: 'number', min: 0, value: '' });
      const startBtn = h('button', { class: 'btn primary', disabled: !selected, onClick: async () => {
        const book = S.getBook(selected);
        if (!book) return;
        const page = Math.max(0, parseInt(pageInput.value, 10) || book.currentPage);
        if (book.status === 'wantToRead') { book.status = 'reading'; book.startedAt = book.startedAt || Date.now(); await S.saveBook(book); }
        api.close();
        session.begin(book.id, page);
      } }, icon('play', 16, { fill: true }), t('Começar'));
      const list = h('div', { class: 'pick-list' });
      function paint() {
        list.replaceChildren(...books.map((b) => h('button', { class: 'pick' + (b.id === selected ? ' on' : ''), onClick: () => {
          selected = b.id; pageInput.value = b.currentPage; startBtn.disabled = false; paint();
        } }, UI.coverEl(b, 40), h('div', { class: 'grow left' }, h('div', { class: 'strong' }, b.title), h('div', { class: 'muted small' }, b.author)),
        b.id === selected ? icon('checkCircle', 22) : null)));
      }
      const initial = S.getBook(selected);
      if (initial) pageInput.value = initial.currentPage;
      paint();
      return h('div', { class: 'dialog wide' }, UI.modalHeader(t('Nova sessão'), api),
        h('label', { class: 'field' }, h('span', null, t('Que livro vais ler?')), list),
        h('label', { class: 'field' }, h('span', null, t('Página em que começas')), pageInput),
        h('div', { class: 'row between center' }, h('button', { class: 'btn ghost', onClick: () => { api.close(); openManual(selected); } }, icon('edit', 16), t('Registar leitura passada')),
          h('div', { class: 'row gap' }, h('button', { class: 'btn', onClick: () => api.close() }, t('Cancelar')), startBtn)));
    });
  }

  /* ---------- Terminar sessão ---------- */
  function openFinish(book) {
    const seconds = Math.round(session.elapsed());
    let photoId = null, photoBlob = null;
    UI.openModal((api) => {
      const endInput = h('input', { type: 'number', min: session.startPage, value: Math.max(session.startPage, book.currentPage) });
      const finishedChk = h('input', { type: 'checkbox' });
      const notes = h('textarea', { rows: 3, placeholder: t('O que achaste desta sessão?') });
      const pagesEl = h('strong', null, '0');
      const photoPrev = h('div', { class: 'photo-prev' });
      const endPage = () => {
        let v = parseInt(endInput.value, 10);
        if (isNaN(v)) v = session.startPage;
        if (book.totalPages > 0) v = Math.min(v, book.totalPages);
        return Math.max(v, session.startPage);
      };
      const update = () => {
        pagesEl.textContent = String(endPage() - session.startPage);
        if (book.totalPages > 0 && endPage() >= book.totalPages) finishedChk.checked = true;
      };
      endInput.addEventListener('input', update);
      update();

      return h('div', { class: 'dialog wide' }, UI.modalHeader(t('Terminar sessão'), api),
        h('div', { class: 'row gap' },
          h('div', { class: 'tile' }, h('div', { class: 'tile-val' }, L.duration(seconds)), h('div', { class: 'tile-title' }, t('Tempo'))),
          h('div', { class: 'tile' }, h('div', { class: 'tile-val' }, pagesEl), h('div', { class: 'tile-title' }, t('Páginas lidas')))),
        h('label', { class: 'field' }, h('span', null, t('Página em que paraste')), endInput),
        book.totalPages > 0 ? h('label', { class: 'check' }, finishedChk, t('Terminei o livro')) : null,
        h('label', { class: 'field' }, h('span', null, t('Notas (opcional)')), notes),
        h('div', { class: 'field' }, h('span', null, t('Foto (opcional)')), photoPrev,
          UI.photoPicker((blob) => { photoBlob = blob; photoPrev.replaceChildren(h('img', { src: URL.createObjectURL(blob) })); }, { crop: false, maxSide: 1400 })),
        h('div', { class: 'row end gap' },
          h('button', { class: 'btn', onClick: () => api.close() }, t('Voltar')),
          h('button', { class: 'btn primary', onClick: async (e) => {
            e.target.disabled = true;
            if (!session.active) { api.close(); return; }
            if (photoBlob) photoId = await S.addImage(photoBlob);
            const end = endPage();
            const s = { id: L.uid(), bookId: book.id, start: session.sessionStart || Date.now() - seconds * 1000, end: Date.now(),
              durationSeconds: seconds, startPage: session.startPage, endPage: end, notes: notes.value.trim(), photoId };
            s.unlocked = [];
            await S.saveSession(s);
            book.currentPage = end;
            if (book.status === 'wantToRead') book.status = 'reading';
            if (!book.startedAt) book.startedAt = s.start;
            if (finishedChk.checked || (book.totalPages > 0 && end >= book.totalPages)) {
              book.status = 'finished'; book.finishedAt = Date.now();
              if (book.totalPages > 0) book.currentPage = book.totalPages;
            }
            await S.saveBook(book);
            const fresh = await RF.app.checkAchievements(true);
            if (fresh.length) { s.unlocked = fresh.map((a) => a.id); await S.saveSession(s); }
            if (session.overlay) session.overlay.close();
            await session.reset();
            api.close();
            openSummary(s, fresh);
          } }, t('Guardar sessão'))));
    });
  }


  /* ---------- Registar (ou editar) uma leitura passada ---------- */
  /** Página onde terminou a leitura anterior a `startMs` (a que deve servir de ponto de partida). */
  function suggestedStart(bookId, startMs, ignoreId) {
    const mine = S.state.sessions.filter((x) => x.bookId === bookId && x.id !== ignoreId);
    const before = mine.filter((x) => x.start < startMs).sort((a, b) => b.start - a.start);
    if (before.length) return before[0].endPage;
    const b = S.getBook(bookId);
    return mine.some((x) => x.start >= startMs) ? 0 : (b ? b.currentPage : 0);
  }
  /** Depois de editar/apagar sessões, o progresso do livro acompanha a página mais avançada registada. */
  async function recalcProgress(book) {
    if (!book || book.status === 'finished') return;
    const ends = S.state.sessions.filter((x) => x.bookId === book.id).map((x) => x.endPage);
    if (ends.length) { const m = Math.max(...ends); book.currentPage = book.totalPages > 0 ? Math.min(m, book.totalPages) : m; await S.saveBook(book); }
  }

  function openManual(preselectedId, editing) {
    const books = S.state.books.slice().sort((a, b) => b.addedAt - a.addedAt);
    UI.openModal((api) => {
      if (!books.length) {
        return h('div', { class: 'dialog' }, h('h2', null, t('Ainda não tens livros')),
          h('p', { class: 'muted' }, t('Adiciona um livro para começares a registar a leitura.')),
          h('div', { class: 'row end gap' }, h('button', { class: 'btn', onClick: () => api.close() }, t('Fechar')),
            h('button', { class: 'btn primary', onClick: () => { api.close(); RF.dialogs.openBookForm(); } }, t('Adicionar livro'))));
      }
      let selected = editing ? editing.bookId : (books.find((b) => b.id === preselectedId) || books.find((b) => b.status === 'reading') || books[0]).id;
      let photoBlob = null, removePhoto = false, startTouched = !!editing, endTouched = !!editing, zeroOk = false;
      const p2 = (n) => String(n).padStart(2, '0');
      const dateStr = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
      const timeStr = (d) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
      const now = new Date(), def = editing ? new Date(editing.start) : new Date(now.getTime() - 30 * 60000);
      const defMin = editing ? Math.round(editing.durationSeconds / 60) : 30;

      const bookSel = h('select', { onChange: (e) => { selected = e.target.value; startTouched = false; endTouched = false; autoPages(); } },
        ...books.map((b) => h('option', { value: b.id, selected: b.id === selected }, b.title + (b.author ? ' — ' + b.author : ''))));
      const dateIn = h('input', { type: 'date', max: dateStr(now), value: dateStr(def), onChange: () => { autoPages(); } });
      const timeIn = h('input', { type: 'time', value: timeStr(def), onChange: () => { autoPages(); } });
      const hoursIn = h('input', { type: 'number', min: 0, max: 23, value: Math.floor(defMin / 60), onInput: () => update() });
      const minsIn = h('input', { type: 'number', min: 0, max: 59, value: defMin % 60, onInput: () => update() });
      const startPage = h('input', { type: 'number', min: 0, value: editing ? editing.startPage : 0, onInput: () => { startTouched = true; update(); } });
      const endPage = h('input', { type: 'number', min: 0, value: editing ? editing.endPage : 0, onInput: () => { endTouched = true; update(); } });
      const notes = h('textarea', { rows: 2, placeholder: t('O que achaste desta sessão?') }, editing ? editing.notes : '');
      const finishedChk = h('input', { type: 'checkbox' });
      const pagesEl = h('strong', null, '0'), endsEl = h('span', { class: 'muted small' }), hint = h('div', { class: 'muted small' });
      const err = h('div', { class: 'err-note' }), photoPrev = h('div', { class: 'photo-prev' });
      const book = () => S.getBook(selected);

      function startMsNow() {
        const d = String(dateIn.value || '').split('-').map(Number), tm = String(timeIn.value || '').split(':').map(Number);
        if (d.length !== 3 || tm.length < 2 || d.some(isNaN) || tm.some(isNaN)) return null;
        return new Date(d[0], d[1] - 1, d[2], tm[0], tm[1], 0, 0).getTime();
      }
      /** Sugere a página inicial (onde terminou a leitura anterior) enquanto o utilizador não a alterar. */
      function autoPages() {
        const sm = startMsNow();
        if (!startTouched && sm !== null) {
          const sp = suggestedStart(selected, sm, editing && editing.id);
          startPage.value = sp;
          if (!endTouched) endPage.value = sp;
          hint.textContent = t('Página inicial sugerida: onde terminou a leitura anterior ({n}).', { n: sp });
        } else if (startTouched) hint.textContent = '';
        update();
      }
      function parsed() {
        const start = startMsNow();
        if (start === null) return null;
        const sec = ((parseInt(hoursIn.value, 10) || 0) * 60 + (parseInt(minsIn.value, 10) || 0)) * 60;
        const b = book();
        let sp = Math.max(0, parseInt(startPage.value, 10) || 0), ep = Math.max(0, parseInt(endPage.value, 10) || 0);
        if (b && b.totalPages > 0) { sp = Math.min(sp, b.totalPages); ep = Math.min(ep, b.totalPages); }
        return { start, sec, end: start + sec * 1000, sp, ep };
      }
      function update() {
        const v = parsed();
        pagesEl.textContent = v ? String(Math.max(0, v.ep - v.sp)) : '0';
        endsEl.textContent = v && v.sec > 0 ? t('Termina às {time}', { time: L.timeText(v.end) }) : '';
        const b = book();
        if (v && b && b.totalPages > 0 && v.ep >= b.totalPages && !editing) finishedChk.checked = true;
        err.textContent = ''; zeroOk = false;
      }
      if (!editing) autoPages(); else update();

      if (editing && editing.photoId && S.imgUrl(editing.photoId)) photoPrev.append(h('img', { src: S.imgUrl(editing.photoId) }));
      const saveBtn = h('button', { class: 'btn primary', onClick: async () => {
        const v = parsed(), b = book();
        if (!v || !b) { err.textContent = t('Escolhe a data e a hora de início.'); return; }
        if (v.sec < 60) { err.textContent = t('A duração tem de ser de pelo menos 1 minuto.'); return; }
        if (v.end > Date.now() + 60000) { err.textContent = t('A leitura não pode terminar no futuro.'); return; }
        if (v.ep < v.sp) { err.textContent = t('A página final não pode ser anterior à inicial.'); return; }
        if (v.ep === v.sp && !zeroOk) { err.textContent = t('As páginas lidas estão a 0. Confirma as páginas e carrega outra vez em «Registar» se for isso mesmo.'); zeroOk = true; return; }
        saveBtn.disabled = true;

        if (editing) {
          const oldBook = S.getBook(editing.bookId);
          if (photoBlob) { await S.removeImage(editing.photoId); editing.photoId = await S.addImage(photoBlob); }
          else if (removePhoto) { await S.removeImage(editing.photoId); editing.photoId = null; }
          Object.assign(editing, { bookId: b.id, start: v.start, end: v.end, durationSeconds: v.sec, startPage: v.sp, endPage: v.ep, notes: notes.value.trim(), edited: Date.now() });
          await S.saveSession(editing);
          await recalcProgress(oldBook); if (oldBook !== b) await recalcProgress(b);
          if (!b.startedAt || b.startedAt > v.start) { b.startedAt = v.start; await S.saveBook(b); }
          const fresh = await RF.app.checkAchievements(true);
          if (fresh.length) { editing.unlocked = [...(editing.unlocked || []), ...fresh.map((a) => a.id)]; await S.saveSession(editing); UI.toastAchievements(fresh); }
          api.close(); RF.app.refresh();
          return;
        }

        const photoId = photoBlob ? await S.addImage(photoBlob) : null;
        const sess = { id: L.uid(), bookId: b.id, start: v.start, end: v.end, durationSeconds: v.sec, startPage: v.sp, endPage: v.ep,
          notes: notes.value.trim(), photoId, unlocked: [], manual: true };
        await S.saveSession(sess);
        b.currentPage = Math.max(b.currentPage, v.ep);              // um registo antigo não faz o progresso recuar
        if (b.status === 'wantToRead') b.status = 'reading';
        if (!b.startedAt || b.startedAt > v.start) b.startedAt = v.start;
        if (finishedChk.checked || (b.totalPages > 0 && v.ep >= b.totalPages)) {
          if (b.status !== 'finished') b.finishedAt = v.end;
          b.status = 'finished'; b.finishedAt = b.finishedAt || v.end;
          if (b.totalPages > 0) b.currentPage = b.totalPages;
        }
        await S.saveBook(b);
        const fresh = await RF.app.checkAchievements(true);
        if (fresh.length) { sess.unlocked = fresh.map((a) => a.id); await S.saveSession(sess); }
        api.close(); RF.app.refresh(); openSummary(sess, fresh);
      } }, icon('check', 16), editing ? t('Guardar alterações') : t('Registar'));

      return h('div', { class: 'dialog wide' }, UI.modalHeader(editing ? t('Editar leitura') : t('Registar leitura passada'), api),
        editing ? null : h('p', { class: 'muted small' }, t('Esqueceste-te de registar uma leitura? Adiciona-a aqui.')),
        h('label', { class: 'field' }, h('span', null, t('Livro')), bookSel),
        h('div', { class: 'row gap' },
          h('label', { class: 'field grow' }, h('span', null, t('Data')), dateIn),
          h('label', { class: 'field grow' }, h('span', null, t('Hora de início')), timeIn)),
        h('div', { class: 'field' }, h('span', null, t('Duração')),
          h('div', { class: 'row gap center' }, hoursIn, h('span', { class: 'muted' }, t('horas')), minsIn, h('span', { class: 'muted' }, t('minutos')), endsEl)),
        h('div', { class: 'row gap' },
          h('label', { class: 'field grow' }, h('span', null, t('Página em que começaste')), startPage),
          h('label', { class: 'field grow' }, h('span', null, t('Página em que paraste')), endPage),
          h('div', { class: 'field' }, h('span', null, t('Páginas lidas')), h('div', { class: 'pages-box' }, pagesEl))),
        hint,
        editing ? null : h('label', { class: 'check' }, finishedChk, t('Terminei o livro')),
        h('label', { class: 'field' }, h('span', null, t('Notas (opcional)')), notes),
        h('div', { class: 'field' }, h('span', null, t('Foto (opcional)')), photoPrev,
          h('div', { class: 'row gap wrap' },
            UI.photoPicker((blob) => { photoBlob = blob; removePhoto = false; photoPrev.replaceChildren(h('img', { src: URL.createObjectURL(blob) })); }, { crop: false, maxSide: 1400 }),
            editing && editing.photoId ? h('button', { class: 'btn ghost danger-text', type: 'button', onClick: () => { removePhoto = true; photoBlob = null; photoPrev.replaceChildren(); } }, icon('trash', 14), t('Remover foto')) : null)),
        err,
        h('div', { class: 'row end gap' }, h('button', { class: 'btn', onClick: () => api.close() }, t('Cancelar')), saveBtn));
    }, { wide: true });
  }

  /* ---------- Resumo ---------- */
  function openSummary(s, achievements) {
    const book = S.getBook(s.bookId);
    UI.openModal((api) => h('div', { class: 'dialog wide' },
      h('div', { class: 'center-text' },
        h('div', { class: 'big-check' }, icon('checkCircle', 54)),
        h('h2', { class: 'serif' }, t('Sessão guardada')),
        book ? h('p', { class: 'muted' }, book.title) : null),
      h('div', { class: 'row gap' },
        h('div', { class: 'tile' }, h('div', { class: 'tile-val' }, L.duration(s.durationSeconds)), h('div', { class: 'tile-title' }, t('Tempo'))),
        h('div', { class: 'tile' }, h('div', { class: 'tile-val' }, String(L.pagesRead(s))), h('div', { class: 'tile-title' }, t('Páginas'))),
        h('div', { class: 'tile' }, h('div', { class: 'tile-val' }, L.pace(L.pagesPerHour(s))), h('div', { class: 'tile-title' }, t('Ritmo')))),
      book && book.status === 'finished' ? h('div', { class: 'note' }, icon('check', 18), t('Terminaste «{title}». Parabéns!', { title: book.title })) : null,
      achievements.length ? h('div', { class: 'card flat' }, h('h3', null, t('Conquistas desbloqueadas')),
        ...achievements.map((a) => h('div', { class: 'row gap center ach-row' }, UI.medal(a, true, 44),
          h('div', null, h('div', { class: 'strong serif' }, L.achTitle(a)), h('div', { class: 'muted small' }, L.achDetail(a)))))) : null,
      h('div', { class: 'row end gap' },
        h('button', { class: 'btn', onClick: () => saveShareImage(s, book) }, icon('download', 16), t('Guardar imagem')),
        h('button', { class: 'btn primary', onClick: () => api.close() }, t('Concluir')))));
  }

  function loadImg(url) {
    return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
  }
  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = text.split(/\s+/); let line = ''; let lines = 0;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines++;
        if (lines === maxLines) { ctx.fillText(line + '…', x, y); return; }
        ctx.fillText(line, x, y); y += lineH; line = words[i];
      } else line = test;
    }
    ctx.fillText(line, x, y);
  }
  async function saveShareImage(s, book) {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 1080, 1350); g.addColorStop(0, '#3347FF'); g.addColorStop(1, '#1A1F6B');
    x.fillStyle = g; x.fillRect(0, 0, 1080, 1350);
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    x.font = '700 48px Georgia, serif'; x.fillText('ReadFlow', 72, 120);
    x.font = '400 32px "Segoe UI", sans-serif'; x.textAlign = 'right'; x.globalAlpha = 0.8; x.fillText(L.longDate(s.start), 1008, 118);
    x.textAlign = 'left'; x.globalAlpha = 1;
    const cw = 340, ch = 510, cx = (1080 - cw) / 2, cy = 190;
    const url = book ? S.imgUrl(book.coverId) : null;
    const img = url ? await loadImg(url) : null;
    x.save(); x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 40; x.shadowOffsetY = 16;
    if (img) { x.drawImage(img, cx, cy, cw, ch); }
    else {
      const color = book ? book.color : '#2F4858';
      const gg = x.createLinearGradient(cx, cy, cx + cw, cy + ch); gg.addColorStop(0, color); gg.addColorStop(1, color + 'B8');
      x.fillStyle = gg; x.fillRect(cx, cy, cw, ch);
    }
    x.restore();
    if (!img && book) { x.fillStyle = L.textOn(book.color); x.textAlign = 'center'; x.font = '700 34px Georgia, serif'; wrapText(x, book.title, 540, cy + 230, cw - 50, 44, 5); }
    x.fillStyle = '#fff'; x.textAlign = 'center';
    x.font = '700 58px Georgia, serif'; wrapText(x, book ? book.title : t('Leitura'), 540, 810, 900, 70, 2);
    if (book && book.author) { x.font = '400 34px "Segoe UI", sans-serif'; x.globalAlpha = 0.8; x.fillText(book.author, 540, 930); x.globalAlpha = 1; }
    const stats = [[L.duration(s.durationSeconds), t('Tempo')], [String(L.pagesRead(s)), t('Páginas')], [L.pace(L.pagesPerHour(s)), t('Ritmo')]];
    stats.forEach(([v, label], i) => {
      const px = 180 + i * 360;
      x.font = '700 64px "Segoe UI", sans-serif'; x.fillText(v, px, 1120);
      x.font = '400 30px "Segoe UI", sans-serif'; x.globalAlpha = 0.75; x.fillText(label, px, 1170); x.globalAlpha = 1;
    });
    c.toBlob((blob) => {
      const a = h('a', { href: URL.createObjectURL(blob), download: 'readflow-sessao.png' });
      document.body.append(a); a.click(); a.remove();
    }, 'image/png');
  }

  RF.session = session;
  RF.sessionUI = { openStart, openOverlay, openFinish, openManual, recalcProgress };
})(typeof window !== 'undefined' ? window : globalThis);
