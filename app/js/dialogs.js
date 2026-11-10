/* ReadFlow — formulário de livro e gestão de prateleiras. */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  const L = RF.logic, S = RF.store, UI = RF.ui;
  const t = RF.i18n.t;
  const { h, icon } = UI;

  function openBookForm(bookId, preset) {
    const existing = bookId ? S.getBook(bookId) : null;
    const pr = preset ? { ...preset } : {}, presetCover = pr.coverBlob || null;
    delete pr.coverBlob;
    const d = existing ? { ...existing, shelfIds: [...existing.shelfIds] } : S.newBook({ status: 'reading', ...pr });
    let coverBlob = presetCover || undefined, spineBlob;   // undefined = sem alterações, null = remover, Blob = nova imagem

    UI.openModal((api) => {
      const title = h('input', { type: 'text', value: d.title, placeholder: t('Título'), onInput: (e) => { d.title = e.target.value; paintSpine(); paintCover(); } });
      const author = h('input', { type: 'text', value: d.author, placeholder: t('Autor'), onInput: (e) => { d.author = e.target.value; } });
      const pages = h('input', { type: 'number', min: 0, value: d.totalPages || '', placeholder: t('Número de páginas'), onInput: (e) => { d.totalPages = Math.max(0, parseInt(e.target.value, 10) || 0); paintSpine(); } });
      const current = h('input', { type: 'number', min: 0, value: d.currentPage || '', placeholder: t('Página em que vais') });
      const notes = h('textarea', { rows: 2, placeholder: t('Notas sobre o livro') }, d.notes);
      const bought = h('input', { type: 'text', value: d.boughtAt || '', placeholder: t('Ex.: Wook, Bertrand, feira do livro…'), onInput: (e) => { d.boughtAt = e.target.value; } });
      const err = h('div', { class: 'err-note' });
      const genre = h('select', { onChange: (e) => { d.genre = e.target.value; } },
        h('option', { value: '' }, '—'), ...Object.entries(L.GENRES).map(([k, v]) => h('option', { value: k, selected: d.genre === k }, t(v[0]))));
      const recNote = h('input', { type: 'text', value: d.recNote || '', placeholder: t('Porque o recomendas? (opcional)'), onInput: (e) => { d.recNote = e.target.value; } });
      const extra = h('div', { class: 'stack' }), recBox = h('div', { class: 'stack tight' });
      const coverBox = h('div', { class: 'cover-box' }), spineBox = h('div', { class: 'spine-box' }), swatches = h('div', { class: 'swatches' });
      const statusRow = h('div', { class: 'seg' });

      function paintStatus() {
        extra.replaceChildren();
        if (d.status === 'reading') extra.append(h('label', { class: 'field' }, h('span', null, t('Página em que vais')), current));
        if (d.status === 'finished') extra.append(h('div', { class: 'field' }, h('span', null, t('Avaliação')), UI.stars(d.rating, (v) => { d.rating = v; paintStatus(); })));
      }
      function paintSeg() {
        statusRow.replaceChildren(...['wantToRead', 'reading', 'finished'].map((k) =>
          h('button', { type: 'button', class: 'seg-btn' + (d.status === k ? ' on' : ''), onClick: () => { d.status = k; paintSeg(); paintStatus(); } }, t(L.STATUS[k].title))));
      }
      function paintFlags() {
        recBox.replaceChildren(...[
          h('div', { class: 'row gap wrap' },
            h('button', { type: 'button', class: 'btn' + (d.favorite ? ' on-fav' : ''), onClick: () => { d.favorite = !d.favorite; paintFlags(); } }, icon('heart', 16, { fill: d.favorite }), t('Favorito')),
            h('button', { type: 'button', class: 'btn' + (d.recommend ? ' on-rec' : ''), onClick: () => { d.recommend = !d.recommend; paintFlags(); } }, icon('gift', 16, { fill: d.recommend }), t('Recomendo'))),
          d.recommend ? recNote : null].filter(Boolean));
      }
      const urlOf = (blob, id) => (blob instanceof Blob ? URL.createObjectURL(blob) : blob === null ? null : S.imgUrl(id));
      function paintCover() {
        const url = urlOf(coverBlob, d.coverId);
        coverBox.replaceChildren(url ? h('div', { class: 'cover', style: { width: '72px', height: '108px', backgroundImage: `url("${url}")` } }) : UI.coverEl({ ...d, coverId: null }, 72));
      }
      function paintSpine() {
        const url = urlOf(spineBlob, d.spineId);
        spineBox.replaceChildren(url ? h('div', { class: 'spine photo', style: { width: '36px', height: '170px', backgroundImage: `url("${url}")` } }) : UI.spineEl({ ...d, spineId: null }, { w: 36, h: 170 }));
        swatches.replaceChildren();
        if (!url) L.SPINE_PALETTE.forEach((hex) => swatches.append(h('button', { type: 'button', class: 'swatch' + (hex === d.color ? ' on' : ''),
          style: { background: hex }, title: hex, onClick: () => { d.color = hex; paintSpine(); paintCover(); } })));
      }
      paintSeg(); paintStatus(); paintFlags(); paintCover(); paintSpine();

      return h('div', { class: 'dialog wide form' }, UI.modalHeader(existing ? t('Editar livro') : t('Novo livro'), api),
        h('div', { class: 'form-grid' },
          h('div', { class: 'stack' },
            h('label', { class: 'field' }, h('span', null, t('Título') + ' *'), title),
            h('label', { class: 'field' }, h('span', null, t('Autor') + ' *'), author),
            h('div', { class: 'row gap' },
              h('label', { class: 'field grow' }, h('span', null, t('Páginas') + ' *'), pages),
              h('label', { class: 'field grow' }, h('span', null, t('Género')), genre)),
            h('label', { class: 'field' }, h('span', null, t('Onde compraste (opcional)')), bought),
            h('div', { class: 'field' }, h('span', null, t('Estado')), statusRow), extra,
            recBox,
            h('label', { class: 'field' }, h('span', null, t('Notas')), notes)),
          h('div', { class: 'stack' },
            h('div', { class: 'field' }, h('span', null, t('Capa')),
              h('div', { class: 'row gap' }, coverBox, h('div', { class: 'stack' },
                UI.photoPicker((b) => { coverBlob = b; paintCover(); }, { crop: true, title: t('Enquadrar capa'), aspect: 2 / 3, outW: 600 }),
                h('button', { class: 'btn ghost', type: 'button', onClick: () => { coverBlob = null; paintCover(); } }, icon('trash', 14), t('Remover capa'))))),
            h('div', { class: 'field' }, h('span', null, t('Lombada')),
              h('div', { class: 'row gap' }, spineBox, h('div', { class: 'stack' },
                UI.photoPicker((b) => { spineBlob = b; paintSpine(); }, { crop: true, title: t('Enquadrar lombada'), aspect: 0.2, outW: 280 }),
                h('button', { class: 'btn ghost', type: 'button', onClick: () => { spineBlob = null; paintSpine(); } }, icon('trash', 14), t('Remover foto')), swatches)),
              h('p', { class: 'muted small' }, t('Fotografa a lombada do livro físico para ele aparecer na tua estante. Sem foto, a app cria uma lombada com a cor escolhida.'))))),
        err,
        h('div', { class: 'row end gap' },
          h('button', { class: 'btn', onClick: () => api.close() }, t('Cancelar')),
          h('button', { class: 'btn primary', onClick: async (e) => {
            const name = d.title.trim(), auth = d.author.trim(), pgs = parseInt(pages.value, 10) || 0;
            [title, author, pages].forEach((i) => i.classList.remove('invalid'));
            const missing = [];
            if (!name) missing.push(title); if (!auth) missing.push(author); if (pgs < 1) missing.push(pages);
            if (missing.length) { missing.forEach((i) => i.classList.add('invalid')); missing[0].focus(); err.textContent = t('Indica o título, o autor e o número de páginas.'); return; }
            err.textContent = ''; d.totalPages = pgs;
            e.target.disabled = true;
            d.title = name; d.author = d.author.trim(); d.notes = notes.value; d.genre = genre.value || d.genre || '';
            if (!d.recommend) d.recNote = '';
            const cur = Math.max(0, parseInt(current.value, 10) || 0);
            if (coverBlob !== undefined) { await S.removeImage(d.coverId); d.coverId = coverBlob ? await S.addImage(coverBlob) : null; }
            if (spineBlob !== undefined) { await S.removeImage(d.spineId); d.spineId = spineBlob ? await S.addImage(spineBlob) : null; }
            if (d.status === 'wantToRead') d.currentPage = 0;
            else if (d.status === 'reading') { d.currentPage = d.totalPages > 0 ? Math.min(cur, d.totalPages) : cur; d.startedAt = d.startedAt || Date.now(); d.finishedAt = null; }
            else { d.currentPage = d.totalPages > 0 ? d.totalPages : Math.max(d.currentPage, cur); d.startedAt = d.startedAt || Date.now(); d.finishedAt = d.finishedAt || Date.now(); }
            await S.saveBook(d);
            api.close();
            await RF.app.checkAchievements();
            RF.app.refresh();
          } }, t('Guardar'))));
    }, { sticky: true });
  }

  function openShelvesDialog(bookId) {
    UI.openModal((api) => {
      const list = h('div', { class: 'stack' });
      function paint() {
        const book = S.getBook(bookId);
        list.replaceChildren();
        if (!S.state.shelves.length) list.append(h('p', { class: 'muted' }, t('Ainda não tens prateleiras personalizadas.')));
        for (const sh of S.state.shelves) {
          list.append(h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: book.shelfIds.includes(sh.id), onChange: async (e) => {
            book.shelfIds = e.target.checked ? [...book.shelfIds, sh.id] : book.shelfIds.filter((x) => x !== sh.id);
            await S.saveBook(book); RF.app.refresh();
          } }), sh.name));
        }
      }
      paint();
      return h('div', { class: 'dialog' }, UI.modalHeader(t('Prateleiras'), api), list,
        h('div', { class: 'row between' },
          h('button', { class: 'btn', onClick: async () => {
            const name = await UI.promptDialog({ title: t('Nova prateleira'), label: t('Nome da prateleira'), confirmLabel: t('Criar') });
            if (name) { await S.saveShelf({ id: L.uid(), name, createdAt: Date.now() }); paint(); await RF.app.checkAchievements(); RF.app.refresh(); }
          } }, icon('plus', 16), t('Nova prateleira')),
          h('button', { class: 'btn primary', onClick: () => api.close() }, t('Fechar'))));
    });
  }

  RF.dialogs = { openBookForm, openShelvesDialog };
})(typeof window !== 'undefined' ? window : globalThis);
