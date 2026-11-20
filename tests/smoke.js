const H = require('./harness');
const { roots, doc, text, sleep, ok, data, El } = H;
const RF = H.RF;
const { createMock } = require('./mock-supabase');
const walk = (n, out = []) => { if (n && n.nodeType === 1) { out.push(n); n.children.forEach((c) => walk(c, out)); } return out; };
(async () => {
  doc.listeners.DOMContentLoaded[0](); await sleep(50);
  ok('arranque sem erros');
  const S = RF.store;
  await S.loadSample(); await RF.app.checkAchievements(true);
  ok(`dados de exemplo: ${S.state.books.length} livros, ${S.state.sessions.length} sessões, ${S.state.unlocked.size} conquistas`);

  const routes = ['home', 'library', 'stats', 'achievements', 'rankings', 'updates', 'recommended', 'friends', 'profile'];
  for (const lang of ['pt', 'en', 'ru', 'de']) {
    S.state.settings.lang = lang; RF.app.applyTheme();
    for (const theme of ['classic', 'light', 'dark', 'cream']) {
      S.state.settings.appTheme = theme; RF.app.applyTheme();
      for (const r of routes) { RF.app.go(r); const tx = text(roots[0]); if (!tx.includes('ReadFlow') || tx.includes('Ocorreu um erro')) throw new Error('ecrã com erro: ' + r + ' ' + lang + ' ' + tx.slice(-200)); }
    }
  }
  ok('7 ecrãs × 4 temas × 4 idiomas sem erros');
  S.state.settings.lang = 'pt'; RF.app.applyTheme();

  // Estante com muitos livros (níveis de compactação) e todos os visuais
  const base = S.state.books.length;
  for (let i = 0; i < 110; i++) await S.saveBook(S.newBook({ title: 'Livro extra ' + i, author: 'Autor', totalPages: 80 + (i * 53) % 600, status: ['finished', 'reading', 'wantToRead'][i % 3], color: RF.logic.SPINE_PALETTE[i % 12], genre: 'fiction', favorite: i % 9 === 0 }));
  for (const style of ['spines', 'covers']) { S.state.settings.libraryStyle = style; RF.app.go('library'); }
  S.state.settings.libraryStyle = 'spines';
  ok('estante com ' + S.state.books.length + ' livros (lombadas e capas)');
  for (const th of RF.shelf.THEMES) for (const bg of RF.shelf.BACKGROUNDS) { S.state.settings.shelfTheme = th.id; S.state.settings.shelfBg = bg.id; RF.shelf.applyRoom(new El('div'), RF.shelf.themeOf(th.id, RF.shelf.context()), RF.shelf.bgOf(bg.id, RF.shelf.context())); }
  RF.shelf.openCustomize(); ok('personalizar estante abre');

  // Detalhe do livro, favoritos, recomendações
  const book = S.state.books.find((b) => b.status === 'reading');
  RF.app.go('book:' + book.id); if (!text(roots[0]).includes(book.title)) throw new Error('detalhe do livro');
  book.favorite = true; book.recommend = true; book.recNote = 'Ótimo'; await S.saveBook(book);
  RF.app.go('book:' + book.id); RF.app.go('profile'); RF.app.go('recommended');
  for (const tab of ['foryou', 'friends', 'mine']) { /* tabs internas */ }
  ok('livro, favoritos e recomendações');

  // Foto de perfil + descrição + conquista de perfil
  S.state.settings.photoId = await S.addImage(new Blob(['x'])); S.state.settings.bio = 'Olá!'; await S.saveSettings();
  const fresh = await RF.app.checkAchievements(true);
  if (!S.state.unlocked.has('profile_1')) throw new Error('conquista de perfil não desbloqueada');
  RF.app.go('profile'); RF.app.go('home'); ok('foto de perfil, descrição e conquista "Perfil completo"');

  // ---------- Servidor (Supabase simulado): contas, pedidos, privacidade, atualização ----------
  const M = createMock(); global.fetch = M.fetch;
  RF.config.supabaseUrl = 'https://mock.supabase.co'; RF.config.supabaseKey = M.key;
  const R = RF.remote;
  if (!R.configured()) throw new Error('ligação devia estar configurada');
  const fill = async (pfx, n = 8) => {
    const reading = S.newBook({ title: pfx + ' leitura', author: 'Autor', totalPages: 300, status: 'reading', currentPage: 50, favorite: true, recommend: true, recNote: 'Recomendo ' + pfx, color: '#2F4858' });
    await S.saveBook(reading);
    for (let i = 0; i < n; i++) await S.saveBook(S.newBook({ title: `${pfx} fav ${i}`, author: 'X', status: 'finished', favorite: true, totalPages: 120 }));
    await S.saveSession({ id: RF.logic.uid(), bookId: reading.id, start: Date.now() - 3600000, end: Date.now(), durationSeconds: 3600, startPage: 0, endPage: 50, notes: 'nota privada', photoId: null, unlocked: ['time_0'] });
    await RF.app.checkAchievements(true);
  };
  // A cria conta e partilha
  await S.wipe(); await fill('Ana');
  const ua = await R.signUp('Ana', 'segredo123', 'Ana');
  if (!/^ana#\d{6}$/.test(ua.handle) || !R.signedIn()) throw new Error('conta A: ' + JSON.stringify(ua));
  if (M.db.profiles.size !== 1 || M.db.shared.size !== 9) throw new Error('secções partilhadas: ' + M.db.shared.size);
  const uidA = [...M.db.profiles.keys()][0];
  const rawShared = JSON.stringify([...M.db.shared.values()]);
  if (!rawShared.includes('nota privada')) throw new Error('a nota da leitura devia ir na atividade (opção ligada por defeito)');
  if (/"coverId"|"spineId"|"photoId"|"id":/.test(rawShared)) throw new Error('foram enviados campos internos');
  S.state.settings.privacy.activityNotes = false; await R.pushNow(true);
  if (JSON.stringify([...M.db.shared.values()]).includes('nota privada')) throw new Error('com «Notas e fotos» desligado as notas não podem sair!');
  S.state.settings.privacy.activityNotes = true; await R.pushNow(true);
  ok('criar conta: ID ' + ua.handle + ', 9 secções enviadas, sem campos internos; a nota da leitura segue na atividade e deixa de ir se a opção for desligada');
  S.state.settings.privacy.stats = false; await R.pushNow();
  if (M.db.shared.has(uidA + '|stats') || M.db.shared.size !== 8) throw new Error('desligar uma secção devia apagá-la do servidor');
  ok('desligar uma secção apaga-a do servidor');
  const dumpA = await S.exportAll(); await R.signOut();
  if (R.signedIn() || await S.getKV('auth')) throw new Error('terminar sessão devia limpar a sessão');
  // B cria conta e pede para seguir A
  await S.wipe(); await fill('Bruno');
  const ub = await R.signUp('bruno', 'segredo456', 'Bruno');
  await R.follow(ua.handle);
  if (R.cache.following.length !== 1 || R.cache.following[0].status !== 'pending') throw new Error('pedido devia ficar pendente');
  if (Object.keys(R.sectionsOf(ua.handle)).length) throw new Error('sem aprovação não devia ver nada');
  RF.app.go('friend:' + ua.handle); if (!/Segue esta pessoa/.test(text(roots[0]))) throw new Error('perfil sem aprovação devia mostrar o cadeado');
  for (const [fn, code] of [[() => R.follow('ninguem#999999'), 'not_found'], [() => R.follow(ub.handle), 'self'], [() => R.follow('x'), 'bad_id']]) {
    let got = null; try { await fn(); } catch (e) { got = e.code; } if (got !== code) throw new Error('erro esperado ' + code + ', deu ' + got);
  }
  ok('seguir: pedido pendente, nada visível sem aprovação, erros (não existe, eu próprio, ID inválido)');
  const dumpB = await S.exportAll(); await R.signOut();
  // A vê o pedido e aceita
  await S.importAll(dumpA);
  let bad = null; try { await R.signIn(ua.handle, 'errada'); } catch (e) { bad = e; }
  if (!bad || R.explain(bad) !== 'ID ou palavra-passe incorretos.') throw new Error('palavra-passe errada: ' + (bad && bad.code));
  await R.signIn(ua.handle, 'segredo123');
  if (R.cache.followers.length !== 1 || R.cache.followers[0].status !== 'pending') throw new Error('A devia ver o pedido de B');
  RF.app.go('friends'); if (!/Pedidos para te seguirem/.test(text(roots[0])) || !/Bruno/.test(text(roots[0]))) throw new Error('ecrã Amigos sem o pedido: ' + text(roots[0]).slice(0, 900));
  await R.respond(ub.handle, true);
  if (R.cache.followers[0].status !== 'accepted') throw new Error('pedido não aceite');
  ok('iniciar sessão (e erro de palavra-passe), ver o pedido e aceitar');
  await R.signOut();
  // B vê o progresso de A (respeitando a privacidade)
  await S.importAll(dumpB); await R.signIn(ub.handle, 'segredo456');
  if (R.cache.following[0].status !== 'accepted') throw new Error('B devia estar aceite');
  const secA = R.sectionsOf(ua.handle);
  if (secA.reading.length !== 1 || secA.favorites.length !== 9 || secA.finished.length !== 8) throw new Error('listas de A: ' + JSON.stringify(Object.keys(secA)));
  if (secA.stats !== undefined) throw new Error('estatísticas de A estavam desligadas e apareceram');
  if (R.feed().length !== 1 || R.feed()[0].p.unlocked[0] !== 'time_0') throw new Error('atividade de A com conquista');
  if (R.recommendations()[0].note !== 'Recomendo Ana') throw new Error('recomendação de A');
  RF.app.go('friend:' + ua.handle); const pt0 = text(roots[0]);
  if (!/Ana/.test(pt0) || !/A ler agora/.test(pt0) || !/Esta pessoa não partilha esta secção\./.test(pt0)) throw new Error('perfil de A visto por B');
  const rowsB = walk(roots[0]).filter((n) => n.className.split(' ').includes('thumb-row'));
  if (!rowsB.length || rowsB.some((r) => r.children.length > 5)) throw new Error('mais de 5 miniaturas no perfil do amigo');
  const moreB = walk(roots[0]).find((n) => n.tagName === 'BUTTON' && text(n).trim() === 'Ver mais'); if (!moreB) throw new Error('falta "Ver mais"');
  moreB.listeners.click[0](); if (walk(roots[0]).filter((n) => n.className.split(' ').includes('full-item')).length < 8) throw new Error('lista completa do amigo');
  RF.app.go('home'); const hx = text(roots[0]); if (!/Ana leu/.test(hx) || !/Desbloqueou/.test(hx)) throw new Error('Início sem a atividade (e conquista) da amiga');
  RF.app.go('recommended'); // separador "Dos amigos"
  ok('B vê o progresso de A: listas, miniaturas (máx. 5 + Ver mais), atividade com conquista no Início; secção desligada continua escondida');
  await R.unfollow(ua.handle);
  if (R.person(ua.handle) || M.db.follows.length !== 0) throw new Error('deixar de seguir');
  await R.deleteAccount();
  if (M.db.profiles.size !== 1 || R.signedIn()) throw new Error('apagar conta');
  M.flags.confirmEmails = true; let ce = null; try { await R.signUp('carla', 'segredo789', 'Carla'); } catch (e) { ce = e; }
  if (!ce || ce.code !== 'confirm_email' || !/Confirm email/.test(R.explain(ce))) throw new Error('confirmação por e-mail ligada devia dar aviso claro'); M.flags.confirmEmails = false;
  M.flags.down = true; let ne = null; try { await R.signIn(ua.handle, 'segredo123'); } catch (e) { ne = e; } M.flags.down = false;
  if (!ne || ne.code !== 'network' || !/ligar/.test(R.explain(ne))) throw new Error('sem rede devia dar aviso');
  let wp = null; try { await R.signUp('dora', '123', 'D'); } catch (e) { wp = e; } if (!wp || wp.code !== 'weak_password') throw new Error('palavra-passe fraca');
  ok('deixar de seguir, apagar conta, confirmação por e-mail ligada, sem rede e palavra-passe fraca dão avisos claros');
  // diagnóstico e código de convite
  let d1 = await R.diagnose(); if (!d1.ok) throw new Error('diagnóstico devia estar OK: ' + JSON.stringify(d1));
  M.flags.confirmEmails = true; d1 = await R.diagnose(); M.flags.confirmEmails = false; if (d1.problem !== 'confirm_email') throw new Error('diagnóstico devia detetar a confirmação por e-mail');
  RF.config.supabaseKey = 'chave-errada'; d1 = await R.diagnose(); RF.config.supabaseKey = M.key; if (d1.problem !== 'bad_key') throw new Error('diagnóstico devia detetar a chave errada: ' + d1.problem);
  M.flags.invite = 'LIVROS2026'; let ie = null; try { await R.signUp('erica', 'segredo123', 'Erica', ''); } catch (e) { ie = e; }
  if (!ie || ie.code !== 'invite_invalid' || !/convite/.test(R.explain(ie))) throw new Error('sem código de convite devia recusar'); if (R.signedIn()) throw new Error('não devia ficar com sessão');
  await R.signUp('erica', 'segredo123', 'Erica', 'LIVROS2026'); if (!R.signedIn()) throw new Error('com convite devia entrar'); M.flags.invite = '';
  await R.deleteAccount();
  ok('«Testar ligação» deteta chave errada e confirmação por e-mail; código de convite exigido quando definido');
  const pub = RF.social.myPublicProfile(S); S.state.settings.privacy.finished = false;
  if (RF.social.myPublicProfile(S).sections.finished !== undefined) throw new Error('privacidade falhou');
  if (!pub.sections.finished) throw new Error('perfil público sem lidos'); ok('privacidade do meu perfil');
  if (RF.social.parseId('Batata#148740').id !== 'batata#148740' || RF.social.parseId('batata148740').id !== 'batata#148740' || RF.social.parseId('x#1')) throw new Error('parseId');
  ok('IDs: nome#123456 e nome123456');


  // Registo manual de uma leitura passada
  await S.wipe(); S.state.settings.lang = 'pt'; RF.app.applyTheme();
  const mb = S.newBook({ title: 'Livro M', author: 'Z', totalPages: 200, status: 'wantToRead', genre: 'fiction' }); await S.saveBook(mb);
  const lay = roots[1];
    const dstr = (daysAgo) => { const d = new Date(Date.now() - daysAgo * 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fields = () => { const all = walk(lay); const num = all.filter((n) => n.tagName === 'INPUT' && n.attrs.type === 'number');
    return { date: all.find((n) => n.attrs.type === 'date'), time: all.find((n) => n.attrs.type === 'time'), hours: num[0], mins: num[1], sp: num[2], ep: num[3],
      save: all.find((n) => n.tagName === 'BUTTON' && /^(Registar|Guardar alterações)$/.test(text(n).trim())), notes: all.find((n) => n.tagName === 'TEXTAREA'), err: all.find((n) => /err-note/.test(n.className)) }; };
  RF.sessionUI.openManual(mb.id);
  let f = fields(); if (!f.date || !f.save) throw new Error('modal de registo manual não abriu');
  // 1) no futuro: tem de recusar
  f.date.value = dstr(0); f.time.value = '23:59'; f.hours.value = 1; f.mins.value = 0; f.sp.value = 0; f.ep.value = 10;
  const nowH = new Date().getHours();
  if (nowH < 22) { f.save.listeners.click[0]({ target: f.save }); await sleep(30); if (S.state.sessions.length) throw new Error('aceitou leitura no futuro'); if (!f.err.textContent.includes('futuro')) throw new Error('sem aviso de futuro: ' + f.err.textContent); ok('registo manual recusa leituras no futuro'); }
  // 2) válido: há 3 dias, 1 h 5 min, páginas 0 a 40
  f.date.value = dstr(3); f.time.value = '21:10'; f.hours.value = 1; f.mins.value = 5; f.sp.value = 0; f.ep.value = 40;
  f.save.listeners.click[0]({ target: f.save }); await sleep(120);
  let ms = S.state.sessions[0]; if (!ms || !ms.manual) throw new Error('sessão manual não guardada');
  if (ms.durationSeconds !== 3900 || ms.endPage !== 40 || new Date(ms.start).getHours() !== 21) throw new Error('dados da sessão manual errados ' + JSON.stringify(ms));
  if (L2().isSameDay(ms.start, Date.now())) throw new Error('data errada');
  if (mb.currentPage !== 40 || mb.status !== 'reading' || mb.startedAt !== ms.start) throw new Error('livro não atualizado: ' + mb.currentPage + ' ' + mb.status);
  if (!ms.unlocked.includes('time_0')) throw new Error('conquista não ligada à sessão manual: ' + JSON.stringify(ms.unlocked));
  ok('registo manual (há 3 dias, 1 h 5 min): sessão, progresso do livro e conquista ' + ms.unlocked.join(','));
  // 3) outro registo mais antigo não faz o progresso recuar
  RF.sessionUI.openManual(mb.id); f = fields();
  f.date.value = dstr(10); f.time.value = '08:00'; f.hours.value = 0; f.mins.value = 20; f.sp.value = 0; f.ep.value = 15;
  f.save.listeners.click[0]({ target: f.save }); await sleep(120);
  if (S.state.sessions.length !== 2) throw new Error('segundo registo não guardado'); if (mb.currentPage !== 40) throw new Error('progresso recuou: ' + mb.currentPage);
  const st = RF.logic.computeStreaks(RF.logic.activeDays(S.state.sessions)); if (st.best !== 1 || st.current !== 0) throw new Error('sequências: ' + JSON.stringify(st));
  RF.app.go('home'); const ht = text(roots[0]); if (!ht.includes('Registo manual')) throw new Error('feed sem etiqueta "Registo manual"'); if (!ht.includes('Desbloqueou')) throw new Error('feed sem menção da conquista');
  RF.app.go('book:' + mb.id); RF.app.go('stats'); RF.app.go('achievements');
  ok('registo mais antigo mantém o progresso; sequências e feed corretos');
  // 4) terminar o livro à mão
  RF.sessionUI.openManual(mb.id); f = fields();
  f.date.value = dstr(1); f.time.value = '20:00'; f.hours.value = 2; f.mins.value = 0; f.sp.value = 40; f.ep.value = 200;
  f.save.listeners.click[0]({ target: f.save }); await sleep(120);
  if (mb.status !== 'finished' || mb.currentPage !== 200 || !mb.finishedAt) throw new Error('livro não terminado: ' + mb.status);
  ok('registo manual que chega ao fim marca o livro como lido');
  for (const lang of ['en', 'ru', 'de']) { S.state.settings.lang = lang; RF.app.applyTheme(); RF.sessionUI.openManual(mb.id); RF.app.go('home'); }
  S.state.settings.lang = 'pt'; RF.app.applyTheme();
  function L2() { return RF.logic; }


  // Página inicial sugerida, aviso de 0 páginas e edição de uma leitura
  roots[1].children = [];   // fecha as janelas deixadas abertas pelos testes anteriores
  const nb = S.newBook({ title: 'Livro N', author: 'Q', totalPages: 500, status: 'reading', currentPage: 120 }); await S.saveBook(nb);
  RF.sessionUI.openManual(nb.id); f = fields();
  if (String(f.sp.value) !== '120') throw new Error('sem leituras antes, devia sugerir a página atual (120), deu ' + f.sp.value);
  await S.saveSession({ id: RF.logic.uid(), bookId: nb.id, start: Date.now() - 5 * 86400000, end: Date.now() - 5 * 86400000 + 1800000, durationSeconds: 1800, startPage: 40, endPage: 60, notes: '', photoId: null, unlocked: [], manual: true });
  f.date.value = dstr(2); f.time.value = '10:00'; f.date.listeners.change[0]();
  if (String(f.sp.value) !== '60') throw new Error('devia sugerir 60 (fim da leitura anterior), deu ' + f.sp.value);
  f.ep.value = 85; f.ep.listeners.input[0](); f.hours.value = 0; f.mins.value = 40;
  const pagesBox = walk(lay).find((n) => /pages-box/.test(n.className));
  const shownPages = pagesBox.children[0].textContent; if (shownPages !== '25') throw new Error('páginas lidas devia ser 25, deu "' + shownPages + '"');
  f.save.listeners.click[0]({ target: f.save }); await sleep(120);
  const ns = S.state.sessions.find((x) => x.bookId === nb.id && x.endPage === 85);
  if (!ns || ns.startPage !== 60 || RF.logic.pagesRead(ns) !== 25) throw new Error('sessão com páginas erradas: ' + JSON.stringify(ns));
  ok('registo manual: só com a página em que parou, as páginas lidas (25) e a média aparecem');
  RF.sessionUI.openManual(nb.id); f = fields();
  const nBefore = S.state.sessions.length;
  f.save.listeners.click[0]({ target: f.save }); await sleep(30);
  if (S.state.sessions.length !== nBefore || !/0/.test(f.err.textContent)) throw new Error('devia avisar das 0 páginas e não gravar à primeira');
  f.save.listeners.click[0]({ target: f.save }); await sleep(120);
  if (S.state.sessions.length !== nBefore + 1) throw new Error('segundo clique devia gravar');
  ok('aviso de 0 páginas (confirma e grava ao segundo clique)');
  // editar
  RF.sessionUI.openManual(null, ns); f = fields();
  if (!f.save || !/Guardar alterações/.test(text(f.save))) throw new Error('modal de edição sem botão "Guardar alterações"');
  f.ep.value = 95; f.ep.listeners.input[0](); f.notes.value = 'corrigido';
  f.save.listeners.click[0]({ target: f.save }); await sleep(120);
  if (ns.endPage !== 95 || ns.notes !== 'corrigido' || !ns.edited) throw new Error('edição não guardada: ' + JSON.stringify(ns));
  if (nb.currentPage !== 95) throw new Error('progresso do livro não acompanhou a edição: ' + nb.currentPage);
  ok('editar uma leitura registada (páginas, notas) e o progresso do livro acompanha');

  // Conta de teste com amigos já existentes no servidor
  roots[1].children = [];
  await R.signUp('tester', 'segredo123', 'Tester');
  const meId = R.state.user.uid;
  const bk = (n, p) => Array.from({ length: n }, (_, i) => ({ title: `${p} ${i}`, author: 'Z', note: '', color: '#8C2F39' }));
  const mariaId = M.seed({ name: 'maria', number: 204819, display: 'Maria', sections: {
    bio: { text: 'Hi, I am Maria' }, reading: bk(1, 'Rd'), finished: bk(6, 'Fn'), favorites: bk(2, 'Fv'), recommendations: [{ title: 'Rec M', author: 'Q', note: 'Good' }], achievements: ['time_0', 'finished_0'],
    activity: Array.from({ length: 4 }, (_, i) => ({ book: 'Rd 0', minutes: 30 + i, pages: 20, when: Date.now() - (i + 1) * 3600000, unlocked: i === 0 ? ['time_3'] : [], manual: false })),
    stats: { hours: 42, pages: 3000, books: 9, sessions: 40, streak: 4, pace: 35 } } });
  M.follow(meId, mariaId, 'accepted');
  const pedroId = M.seed({ name: 'pedro', number: 771203, display: 'Pedro', sections: { bio: { text: 'Hi' } } });
  M.follow(pedroId, meId, 'pending');                    // o Pedro pede para me seguir
  await R.pull(true);
  for (const lang of ['pt', 'en', 'ru', 'de']) { S.state.settings.lang = lang; RF.app.applyTheme(); for (const r of ['home', 'friends', 'rankings', 'recommended', 'friend:maria#204819', 'friendlist:maria#204819:finished']) { RF.app.go(r); const tx = text(roots[0]); if (tx.includes('Ocorreu um erro')) throw new Error('erro no ecrã ' + r + ' ' + lang + ': ' + tx.slice(-160)); } }
  S.state.settings.lang = 'pt'; RF.app.applyTheme();
  ok('ecrãs de amigos nos 4 idiomas, com sessão iniciada');


  // ===== Versão 1.4 =====
  roots[1].children = [];
  const SOCm = RF.social, Lg = RF.logic;
  const cls1 = (n, k) => String((n && n.className) || '').split(' ').includes(k);
  const clickBtn = (root_, label) => { const b = walk(root_).find((n) => n.tagName === 'BUTTON' && text(n).trim() === label); if (!b) throw new Error('botão não encontrado: ' + label); b.listeners.click[0]({ target: b, stopPropagation() {} }); return b; };
  // (1) notas, avaliações e capas que os amigos veem
  M.db.shared.set(`${mariaId}|reading`, { user_id: mariaId, section: 'reading', payload: [{ title: 'Rd 0', author: 'Z', note: '', color: '#8C2F39', rating: 4, review: 'Gostei muito', ck: 'cov-1', sk: 'sp-1', pages: 280 }] });
  M.db.shared.set(`${mariaId}|recommendations`, { user_id: mariaId, section: 'recommendations', payload: [{ title: 'Rec M', author: 'Q', note: 'Good', rating: 5, ck: 'cov-2' }, { title: 'Rec N', author: 'W', note: '', review: 'Long review text here', rating: 3 }] });
  M.seedCover(mariaId, 'cov-1', 'data:image/jpeg;base64,/9j/AAAA'); M.seedCover(mariaId, 'sp-1', 'data:image/jpeg;base64,/9j/SPINE'); M.seedCover(mariaId, 'cov-2', 'data:image/jpeg;base64,/9j/BBBB');
  await R.pull(true); await sleep(80);
  const smr = R.sectionsOf('maria#204819');
  if (smr.reading[0].rating !== 4 || smr.reading[0].review !== 'Gostei muito') throw new Error('nota e avaliação do amigo não chegaram');
  if (smr.reading[0].coverData !== 'data:image/jpeg;base64,/9j/AAAA') throw new Error('a imagem da capa do amigo não chegou: ' + smr.reading[0].coverData);
  RF.app.go('friend:maria#204819'); await sleep(60);
  if (!walk(roots[0]).some((n) => n.className.includes('stars-static'))) throw new Error('perfil do amigo sem estrelas de avaliação');
  if (await R.loadCovers('pedro#771203') !== 0) throw new Error('não devia receber capas de quem não aprovou');
  RF.app.go('recommended'); clickBtn(roots[0], 'Dos amigos');
  const recC = walk(roots[0]).filter((n) => n.className.split(' ').includes('rec-card'));
  if (recC.length !== 2 || recC.some((c) => !walk(c).some((n) => n.className.split(' ').includes('rec-note')))) throw new Error('cartões de recomendação dos amigos: devem ter todos o bloco de nota (mesmo tamanho)');
  ok('amigos veem a imagem da capa, a nota e a avaliação; cartões de recomendação com o mesmo formato');
  RF.app.go('friendlist:maria#204819:recs'); await sleep(60);
  clickBtn(roots[0], 'Quero ler');
  const frmW = roots[1], phOf = (ph) => walk(frmW).find((n) => n.tagName === 'INPUT' && n.attrs.placeholder === ph);
  if (phOf('Título').value !== 'Rec M' || phOf('Autor').value !== 'Q') throw new Error('formulário devia vir preenchido');
  if (!walk(frmW).some((n) => n.className.split(' ').includes('cover') && /url\(/.test(String(n.style.backgroundImage || '')))) throw new Error('a capa do amigo devia aparecer no formulário');
  const pagesW = phOf('Número de páginas'); pagesW.value = '250'; pagesW.listeners.input[0]({ target: pagesW });
  clickBtn(frmW, 'Guardar'); await sleep(200);
  const wl = S.state.books.find((b) => b.title === 'Rec M');
  if (!wl || wl.status !== 'wantToRead' || wl.totalPages !== 250 || !wl.coverId || !S.imgUrl(wl.coverId)) throw new Error('livro em «Quero ler» sem a capa do amigo');
  ok('«Quero ler» a partir do amigo: formulário preenchido e a capa vai para a minha prateleira');
  roots[1].children = [];

  // (2) formulário: campos obrigatórios, "null" e onde comprou
  RF.dialogs.openBookForm(); const frm = roots[1]; const nB = S.state.books.length;
  clickBtn(frm, 'Guardar'); await sleep(40);
  if (S.state.books.length !== nB) throw new Error('criou livro sem título, autor e páginas');
  if (!/título, o autor e o número de páginas/.test(walk(frm).find((n) => n.className.split(' ').includes('err-note')).textContent)) throw new Error('sem aviso dos campos obrigatórios');
  clickBtn(frm, 'Recomendo'); if (/null/.test(text(frm))) throw new Error('aparece "null" no formulário');
  const fld = (ph) => walk(frm).find((n) => n.tagName === 'INPUT' && n.attrs.placeholder === ph);
  const setv = (el, v) => { el.value = v; if (el.listeners.input) el.listeners.input[0]({ target: el }); };
  setv(fld('Título'), 'Livro Req'); setv(fld('Autor'), 'Autor Req'); setv(fld('Ex.: Wook, Bertrand, feira do livro…'), 'Wook');
  clickBtn(frm, 'Guardar'); await sleep(40); if (S.state.books.length !== nB) throw new Error('criou livro sem páginas');
  setv(fld('Número de páginas'), '321'); clickBtn(frm, 'Guardar'); await sleep(150);
  const nb2 = S.state.books.find((b) => b.title === 'Livro Req');
  if (!nb2 || nb2.author !== 'Autor Req' || nb2.totalPages !== 321 || nb2.boughtAt !== 'Wook' || !nb2.recommend) throw new Error('livro novo: ' + JSON.stringify(nb2));
  RF.app.go('book:' + nb2.id); if (!/Comprado em Wook/.test(text(roots[0]))) throw new Error('detalhe do livro sem «Comprado em»');
  ok('criar livro: título, autor e páginas obrigatórios; sem «null»; «onde compraste» guardado e mostrado');

  // (3) páginas de livros lidos contam (o tempo não)
  const bk300 = { id: 'x', status: 'finished', totalPages: 300, finishedAt: Date.now(), addedAt: Date.now() };
  const s300 = SOCm.statsOf({ books: [bk300], sessions: [] });
  if (s300.pages !== 300 || s300.minutes !== 0 || s300.week.pages !== 300 || s300.month.pages !== 300 || s300.books !== 1) throw new Error('livro lido sem sessões: ' + JSON.stringify(s300));
  if (Lg.snapshot([bk300], [], [], {}).totalPages !== 300) throw new Error('conquistas de páginas devem contar o livro lido');
  const s100 = { id: 's1', bookId: 'x', start: Date.now() - 1000, durationSeconds: 3600, startPage: 0, endPage: 100 };
  const m300 = SOCm.statsOf({ books: [bk300], sessions: [s100] });
  if (m300.pages !== 300 || m300.minutes !== 60) throw new Error('sessão parcial + restante do livro: ' + JSON.stringify(m300));
  ok('livro lido na totalidade: as páginas contam para as estatísticas (tempo não)');

  // (4) estante: Lombadas mostra todos os livros com a lombada (nunca capa para a frente)
  const manyB = Array.from({ length: 80 }, (_, i) => ({ id: 'bk' + i, title: 't' + i, totalPages: 100 + i, status: 'reading' }));
  for (const n of [3, 20, 80]) {
    const r = RF.layout.layoutShelf(manyB.slice(0, n), 900, { featured: new Set(manyB.map((b) => b.id)) });
    const units = r.rows.flatMap((x) => x.units);
    if (units.some((u) => u.kind === 'face')) throw new Error('capa para a frente na vista Lombadas');
    if (units.reduce((a, u) => a + u.books.length + (u.cap ? 1 : 0), 0) !== n) throw new Error('livros perdidos na estante');
  }
  ok('Lombadas: todos os livros com a lombada visível (sem capas para a frente)');

  // (5) capas enviadas ao servidor, limpeza e servidor sem a tabela de capas; notas e avaliações com privacidade
  const cid = await S.addImage(new Blob(['img']));
  nb2.coverId = cid; nb2.favorite = true; nb2.rating = 5; nb2.notes = 'minha nota'; await S.saveBook(nb2);
  R.api.thumbProvider = async () => 'data:image/jpeg;base64,/9j/CCCC';
  await R.pushNow(true);
  const favPayload = M.db.shared.get(`${meId}|favorites`).payload.find((x) => x.title === 'Livro Req');
  if (!M.db.covers.has(`${meId}|c2-${cid}`) || favPayload.ck !== 'c2-' + cid) throw new Error('capa não enviada');
  if (favPayload.pages !== 321 || 'sk' in favPayload) throw new Error('páginas em falta ou lombada partilhada sem querer');
  if (favPayload.rating !== 5 || favPayload.review !== 'minha nota') throw new Error('nota e avaliação não enviadas');
  S.state.settings.privacy.reviews = false; await R.pushNow(true);
  const fp2 = M.db.shared.get(`${meId}|favorites`).payload.find((x) => x.title === 'Livro Req');
  if ('rating' in fp2 || 'review' in fp2) throw new Error('com «Notas e avaliações» desligado não devia enviar');
  S.state.settings.privacy.reviews = true;
  nb2.coverId = null; await S.saveBook(nb2); await R.pushNow(true);
  if (M.db.covers.has(`${meId}|c2-${cid}`)) throw new Error('a capa antiga devia ser apagada do servidor');
  M.flags.noCovers = true; nb2.coverId = cid; await S.saveBook(nb2); S.state.settings.bio = 'bio nova'; await R.pushNow(true); M.flags.noCovers = false;
  if (M.db.shared.get(`${meId}|bio`).payload.text !== 'bio nova') throw new Error('sem a tabela de capas o resto do perfil devia sincronizar');
  ok('capas enviadas e limpas; notas/avaliações respeitam a privacidade; sem a tabela de capas nada se estraga');

  // (6) rankings
  const stObj = (o) => ({ hours: Math.round(o.m / 60), minutes: o.m, pages: o.p, books: o.b, sessions: 10, streak: o.s, pace: o.pc, week: o.w, month: o.mo });
  const luisId = M.seed({ name: 'luis', number: 100001, display: 'Luis', sections: { stats: stObj({ m: 18000, p: 9000, b: 30, s: 40, pc: 50, w: { minutes: 600, pages: 400, books: 2 }, mo: { minutes: 2400, pages: 1500, books: 7 } }) } });
  const anaId2 = M.seed({ name: 'anita', number: 100002, display: 'Anita', sections: { stats: stObj({ m: 600, p: 100, b: 1, s: 1, pc: 20, w: { minutes: 30, pages: 10, books: 0 }, mo: { minutes: 100, pages: 20, books: 0 } }) } });
  const quietId = M.seed({ name: 'quiet', number: 100003, display: 'Quiet', sections: {} });
  M.db.shared.set(`${mariaId}|stats`, { user_id: mariaId, section: 'stats', payload: stObj({ m: 2520, p: 3000, b: 9, s: 4, pc: 35, w: { minutes: 700, pages: 100, books: 1 }, mo: { minutes: 1200, pages: 500, books: 3 } }) });
  for (const id of [luisId, anaId2, quietId]) M.follow(meId, id, 'accepted');
  await R.pull(true);
  const crowd = [{ id: 'me', name: 'Tester', me: true, stats: SOCm.statsOf(S.state) }, ...R.rankingPeople()];
  const rk = (m, p) => SOCm.ranking(crowd, m, p).map((x) => x.p.name);
  if (rk('pages', 'total')[0] !== 'Luis' || rk('time', 'week')[0] !== 'Maria' || rk('books', 'total')[0] !== 'Luis') throw new Error('ordem dos rankings: ' + rk('pages', 'total') + ' | ' + rk('time', 'week'));
  if (rk('pace', 'week').length || rk('streak', 'month').length) throw new Error('ritmo e sequência só existem no total');
  if (rk('time', 'total').includes('Quiet')) throw new Error('quem não partilha estatísticas não entra');
  RF.app.go('rankings'); const rt = text(roots[0]);
  if (!/Rankings/.test(rt) || !/Luis/.test(rt) || !/Sem estatísticas partilhadas: Quiet/.test(rt)) throw new Error('ecrã Rankings: ' + rt.slice(0, 500));
  const pods1 = (r) => walk(r).filter((n) => n.className.split(' ').includes('p1') && n.className.split(' ').includes('pod')).length;
  if (pods1(roots[0]) !== 6) throw new Error('total devia ter 6 rankings, tem ' + pods1(roots[0]));
  clickBtn(roots[0], 'Semana'); if (pods1(roots[0]) !== 3) throw new Error('semana devia ter 3 rankings'); clickBtn(roots[0], 'Total');
  ok('rankings: Tempo, Páginas, Livros (+ Ritmo e Sequência no total), top 3 em cada, por semana/mês/total');

  // (7) copiar o ID e dicas das medalhas
  let copied = null; globalThis.readflowApp = { copyText: async (x) => { copied = x; return true; } };
  RF.app.go('friends'); const cpb = walk(roots[0]).find((n) => n.tagName === 'BUTTON' && n.attrs.title === 'Copiar'); if (!cpb) throw new Error('botão copiar');
  cpb.listeners.click[0](); await sleep(40); delete globalThis.readflowApp;
  if (copied !== R.state.user.handle) throw new Error('copiar ID: ' + copied);
  RF.app.go('achievements'); if (!walk(roots[0]).some((n) => n.className.split(' ').includes('medal-btn') && /Horas de leitura no total/.test(n.attrs.title || ''))) throw new Error('medalhas sem a dica de como desbloquear');
  RF.app.go('friend:maria#204819'); if (!walk(roots[0]).some((n) => n.className.split(' ').includes('medal-btn') && /Horas de leitura|Livros terminados/.test(n.attrs.title || ''))) throw new Error('medalhas do perfil do amigo sem a dica');
  ok('copiar o ID funciona; as medalhas (também no perfil de um amigo) mostram o que foi preciso fazer');


  // ===== Versão 1.5 =====
  roots[1].children = [];
  // (1) conquistas: 25 categorias × 6 níveis, nomes únicos, perfil com 6 passos
  if (Lg.CATEGORIES.some((c) => c.tiers.length !== 6 || c.names.length !== 6) || Lg.ACHIEVEMENTS.length !== 150) throw new Error('conquistas: ' + Lg.ACHIEVEMENTS.length);
  if (new Set(Lg.ACHIEVEMENTS.map((a) => a.title)).size !== 150) throw new Error('nomes de conquistas repetidos');
  const profFull = Lg.snapshot([{ id: 'a', favorite: true, recommend: true, status: 'reading' }], [], [], { photoId: 'p', bio: 'x', name: 'N', handleNumber: 123456 });
  if (profFull.profileItems !== 6) throw new Error('perfil completo devia ter 6 passos: ' + profFull.profileItems);
  RF.app.go('achievements');
  const achGrid = walk(roots[0]).find((n) => n.className.split(' ').includes('ach-grid'));
  if (!achGrid || achGrid.children.length !== 25 || achGrid.children.some((c) => walk(c).filter((n) => n.className.split(' ').includes('medal-btn')).length !== 6 || !walk(c).some((n) => n.className.split(' ').includes('ach-foot')))) throw new Error('cartões de conquistas devem ter todos 6 medalhas e o mesmo rodapé');
  ok('150 conquistas: todas as categorias com 6 níveis; todos os cartões com o mesmo número de medalhas');
  // (2) ficha do livro ao clicar num livro no perfil de um amigo (com a «Introdução Geral»)
  RF.app.go('friend:maria#204819'); await sleep(80);
  const th = walk(roots[0]).find((n) => n.className.split(' ').includes('thumb')); if (!th) throw new Error('sem miniaturas');
  th.listeners.click[0](); await sleep(150);
  const mi = roots[1], infoTxt = text(mi);
  if (!/Introdução Geral/.test(infoTxt) || !/Gostei muito/.test(infoTxt) || !/280 páginas/.test(infoTxt)) throw new Error('ficha do livro: ' + infoTxt);
  if (!walk(mi).some((n) => n.className.split(' ').includes('cover') && /AAAA/.test(String(n.style.backgroundImage || '')))) throw new Error('ficha sem a imagem da capa');
  if (!walk(mi).some((n) => n.className.includes('stars-static'))) throw new Error('ficha sem avaliação');
  if (walk(mi).some((n) => n.className.split(' ').some((c) => c.startsWith('b3d')))) throw new Error('o 3D devia ter sido retirado');
  clickBtn(mi, 'Quero ler'); await sleep(200);
  const wl2 = S.state.books.find((b) => b.title === 'Rd 0' && b.status === 'wantToRead');
  if (!wl2 || wl2.totalPages !== 280 || !wl2.coverId) throw new Error('«Quero ler» a partir da ficha devia levar a capa e as páginas');
  roots[1].children = [];
  RF.app.go('friendlist:maria#204819:recs'); await sleep(60);
  walk(roots[0]).find((n) => n.className.split(' ').includes('full-item')).listeners.click[0](); await sleep(80);
  if (!/Introdução Geral/.test(text(roots[1])) || !/Recomendação/.test(text(roots[1]))) throw new Error('a lista completa também devia abrir a ficha');
  roots[1].children = [];
  ok('clicar num livro no perfil de um amigo abre a ficha com a Introdução Geral, a capa e a avaliação (sem 3D)');
  // (3) separador Atualizações
  S.state.settings.lastSeenVersion = ''; RF.app.go('home');
  if (!walk(roots[0]).some((n) => n.className.split(' ').includes('nav-dot'))) throw new Error('devia haver um ponto de novidade no menu');
  RF.app.go('updates'); const ut = text(roots[0]);
  if (!ut.includes(RF.changelog.current) || !/Níveis de perfil/.test(ut) || !/Versão atual/.test(ut)) throw new Error('separador Atualizações: ' + ut.slice(0, 300));
  RF.app.go('home'); if (walk(roots[0]).some((n) => n.className.split(' ').includes('nav-dot'))) throw new Error('o ponto devia desaparecer depois de abrir');
  for (const [lg, word] of [['en', 'Profile levels'], ['ru', 'Уровни профиля'], ['de', 'Profilstufen']]) { S.state.settings.lang = lg; RF.app.applyTheme(); RF.app.go('updates'); if (!text(roots[0]).includes(word)) throw new Error('novidades em ' + lg); }
  S.state.settings.lang = 'pt'; RF.app.applyTheme();
  ok('«Atualizações»: histórico de versões nos 4 idiomas e ponto de novidade no menu');


  // ===== Versão 1.6 =====
  roots[1].children = [];
  const Lq = RF.logic;
  // (1) «Introdução Geral» no formulário
  RF.dialogs.openBookForm(); const ftxt = text(roots[1]);
  if (!/Introdução Geral/.test(ftxt) || /Notas sobre o livro/.test(ftxt)) throw new Error('o formulário devia ter «Introdução Geral»'); roots[1].children = [];
  RF.app.go('friends'); clickBtn(roots[0], 'Privacidade'); if (!/Introdução Geral e avaliações dos livros/.test(text(roots[0]))) throw new Error('rótulo de privacidade');
  ok('«Notas» passou a «Introdução Geral» (formulário e privacidade)');
  // (2) 5 escolhas por defeito e novos padrões
  const freeT = RF.shelf.THEMES.filter((x) => x.rule.kind === 'free').map((x) => x.name), freeB = RF.shelf.BACKGROUNDS.filter((x) => x.rule.kind === 'free').map((x) => x.name);
  const want5 = (arr, first) => arr.length === 5 && ['Preto', 'Verde tropa', 'Vermelho', 'Branco', first].every((n) => arr.includes(n));
  if (!want5(freeT, 'Madeira clássica') || !want5(freeB, 'Neutro')) throw new Error('5 escolhas por defeito: ' + freeT + ' | ' + freeB);
  if (new Set(RF.shelf.ALL.map((x) => x.id)).size !== RF.shelf.ALL.length) throw new Error('ids de visuais repetidos');
  const snap0 = Lq.snapshot([], [], [], {}), ctx0 = { snap: snap0, unlocked: new Map() };
  for (const x of RF.shelf.ALL) { const ok_ = Lq.ruleState(x.rule, snap0, new Map()).ok; if ((x.rule.kind === 'free') !== ok_) throw new Error('regra de desbloqueio: ' + x.id); if (x.rule.kind === 'ach' && !Lq.achById[x.rule.id]) throw new Error('conquista inexistente: ' + x.rule.id); }
  if (RF.shelf.THEMES.length < 26 || RF.shelf.BACKGROUNDS.length < 22) throw new Error('padrões novos em falta');
  S.state.settings.seenCosmetics = ['wood', 'neutral']; const freshV = await RF.shelf.syncCosmetics(false);
  if (freshV.some((c) => c.rule.kind === 'free') || !S.state.settings.seenCosmetics.includes('matteblack')) throw new Error('os visuais por defeito não devem gerar aviso de «novo visual»');
  ok('prateleiras e fundos: 5 escolhas por defeito (Preto, Verde tropa, Vermelho, Branco + a original) e padrões novos por desbloquear');
  // (3) «A minha imagem»: cartão do mesmo tamanho e botões só numa janela ao centro
  RF.shelf.openCustomize();
  const grids = walk(roots[1]).filter((n) => n.className.split(' ').includes('cos-grid'));
  if (grids.length !== 2 || grids[1].children.length !== RF.shelf.BACKGROUNDS.length + 1) throw new Error('grelha de fundos');
  if (grids[1].children.some((c) => !c.className.split(' ').includes('cos-card') || !walk(c).some((n) => n.className.split(' ').includes('cos-prev')) || !walk(c).some((n) => n.className.split(' ').includes('cos-body')))) throw new Error('todos os cartões devem ter a mesma estrutura');
  if (walk(roots[1]).some((n) => n.tagName === 'BUTTON' && /^(Webcam|Escolher ficheiro)$/.test(text(n).trim()))) throw new Error('os botões de webcam/ficheiro não devem estar na grelha');
  const nMod = roots[1].children.length;
  grids[1].children[0].listeners.click[0]({ target: grids[1].children[0], stopPropagation() {} });
  if (roots[1].children.length !== nMod + 1) throw new Error('clicar em «A minha imagem» devia abrir uma janela');
  const customModal = roots[1].children[roots[1].children.length - 1];
  const bt = walk(customModal).filter((n) => n.tagName === 'BUTTON').map((n) => text(n).trim());
  if (!bt.includes('Webcam') || !bt.includes('Escolher ficheiro')) throw new Error('janela sem os botões: ' + bt);
  roots[1].children = [];
  ok('«A minha imagem» com o mesmo tamanho dos outros fundos; webcam e ficheiro só na janela ao centro');
  // (4) níveis e experiência (infinito)
  if (Lq.levelFromXp(0) !== 1 || Lq.levelFromXp(299) !== 1 || Lq.levelFromXp(300) !== 2 || Lq.levelFromXp(699) !== 2 || Lq.levelFromXp(700) !== 3) throw new Error('limites dos níveis');
  for (let n = 1; n <= 5000; n++) { if (Lq.levelFromXp(Lq.xpToReach(n)) !== n || (n > 1 && Lq.levelFromXp(Lq.xpToReach(n) - 1) !== n - 1)) throw new Error('nível ' + n); }
  const hi = Lq.levelInfo(1e12); if (!(hi.level > 100000) || !(hi.pct >= 0 && hi.pct < 1) || !Number.isFinite(hi.level)) throw new Error('nível infinito: ' + JSON.stringify(hi));
  await RF.app.awardXp(true);
  const xpBook = S.newBook({ title: 'XP Book', author: 'Z', totalPages: 300, status: 'finished' }); await S.saveBook(xpBook);
  const before0 = Lq.ledgerTotal(S.state.settings.xpLedger);
  const r1 = await RF.app.awardXp(false);
  if (!r1 || r1.gained !== 300 || Lq.ledgerTotal(S.state.settings.xpLedger) !== before0 + 300) throw new Error('XP ao terminar um livro: ' + JSON.stringify(r1));
  if (await RF.app.awardXp(false) !== null) throw new Error('não devia dar XP duas vezes');
  xpBook.status = 'reading'; await S.saveBook(xpBook); xpBook.status = 'finished'; await S.saveBook(xpBook);
  if (await RF.app.awardXp(false) !== null) throw new Error('terminar outra vez o mesmo livro não dá XP');
  const xpBook2 = S.newBook({ title: 'XP Book 2', author: 'Z', totalPages: 120, status: 'finished' }); await S.saveBook(xpBook2); await RF.app.checkAchievements(true);
  if (!(xpBook2.id in S.state.settings.xpLedger) || S.state.settings.xpLedger[xpBook2.id] !== 120) throw new Error('checkAchievements devia dar o XP');
  RF.app.go('profile'); if (!/Nível \d+/.test(text(roots[0])) || !/XP/.test(text(roots[0]))) throw new Error('o meu perfil devia mostrar o nível');
  ok('níveis infinitos: 1 XP por página ao terminar um livro (uma só vez por livro) e nível no meu perfil');
  // (5) o nível chega aos outros: perfil aprovado, cartão bloqueado e rankings
  await R.pushNow(true);
  if (M.db.profiles.get(meId).privacy.xp !== Lq.ledgerTotal(S.state.settings.xpLedger)) throw new Error('o XP devia ir no perfil do servidor');
  M.db.profiles.get(mariaId).privacy.xp = 1234; M.db.profiles.get(luisId).privacy.xp = 1e9;
  const zedId = M.seed({ name: 'zed', number: 100009, display: 'Zed', sections: {} }); M.db.profiles.get(zedId).privacy.xp = 5000; M.follow(meId, zedId, 'pending');
  await R.pull(true);
  if (R.person('maria#204819').xp !== 1234) throw new Error('xp da Maria');
  RF.app.go('friend:maria#204819'); if (!/Nível 4/.test(text(roots[0]))) throw new Error('perfil do amigo devia mostrar Nível 4');
  RF.app.go('friend:zed#100009'); let zt = text(roots[0]);
  if (!/Nível \d+/.test(zt) || !/Segue esta pessoa e espera/.test(zt) || !/Nível 8/.test(zt)) throw new Error('o cartão bloqueado também mostra o nível: ' + zt.slice(0, 300));
  RF.app.go('rankings'); const xpRank = [{ id: 'me', name: 'Tester', me: true, xp: Lq.ledgerTotal(S.state.settings.xpLedger) }, ...R.rankingPeople()];
  if (SOCm.ranking(xpRank, 'xp', 'total')[0].p.name !== 'Luis') throw new Error('ranking de XP');
  if (!/Nível e experiência/.test(text(roots[0]))) throw new Error('quadro de nível nos rankings');
  ok('o nível aparece no perfil de quem seguimos, no cartão bloqueado e nos rankings');
  // (6) ficha do livro nas recomendações dos amigos
  RF.app.go('recommended'); clickBtn(roots[0], 'Dos amigos');
  const rcov = walk(roots[0]).find((n) => n.className.split(' ').includes('rec-card')); const rc = walk(rcov).find((n) => n.className.split(' ').includes('cover'));
  rc.listeners.click[0](); await sleep(100); if (!/Introdução Geral/.test(text(roots[1]))) throw new Error('ficha a partir das recomendações'); roots[1].children = [];
  ok('capa nas recomendações dos amigos abre a ficha do livro');


  // ===== Versão 1.8 =====
  roots[1].children = []; R.api.resetCovers(); R.api.thumbProvider = async () => 'data:image/jpeg;base64,/9j/CCCC';
  const Lz = RF.logic;
  // (1) Introdução Geral longa: o excerto vai no perfil e o texto completo à parte
  const LONG = 'Início. ' + 'Linha de texto longa. '.repeat(250) + 'FIM-DO-TEXTO';
  const bLong = S.newBook({ title: 'Livro Longo', author: 'L', totalPages: 400, status: 'reading', notes: LONG }); await S.saveBook(bLong);
  const bShort = S.newBook({ title: 'Livro Curto', author: 'S', totalPages: 100, status: 'reading', notes: 'Introdução curta.' }); await S.saveBook(bShort);
  await R.pushNow(true);
  const rd = M.db.shared.get(`${meId}|reading`).payload, pl = rd.find((x) => x.title === 'Livro Longo'), ps = rd.find((x) => x.title === 'Livro Curto');
  if (pl.review.length !== 500 || pl.rk !== 'i-' + bLong.id || M.db.covers.get(`${meId}|i-${bLong.id}`).data !== LONG.slice(0, 20000)) throw new Error('Introdução longa: excerto + texto completo à parte');
  if (ps.review !== 'Introdução curta.' || 'rk' in ps || M.db.covers.has(`${meId}|i-${bShort.id}`)) throw new Error('introdução curta vai só no perfil');
  S.state.settings.privacy.reviews = false; await R.pushNow(true);
  if (M.db.covers.has(`${meId}|i-${bLong.id}`) || 'review' in M.db.shared.get(`${meId}|reading`).payload[0]) throw new Error('sem «Introdução Geral e avaliações» nada sai');
  S.state.settings.privacy.reviews = true; await R.pushNow(true);
  M.db.shared.set(`${mariaId}|reading`, { user_id: mariaId, section: 'reading', payload: [{ title: 'Livro Longo M', author: 'M', note: '', color: '#2F4858', review: LONG.slice(0, 500), rk: 'i-longm', pages: 400 }, { title: 'Livro Longo N', author: 'N', note: '', color: '#2F4858', review: LONG.slice(0, 500), rk: 'i-longn', pages: 400 }] });
  M.seedCover(mariaId, 'i-longm', LONG);
  await R.pull(true); RF.app.go('friend:maria#204819'); await sleep(80);
  walk(roots[0]).find((n) => cls1(n, 'thumb') && String((n.attrs || {}).title || '').startsWith('Livro Longo M')).listeners.click[0](); await sleep(150);
  const bookModal = roots[1], introEl = walk(bookModal).find((n) => cls1(n, 'intro-text'));
  if (!introEl || !/FIM-DO-TEXTO/.test(text(introEl)) || !cls1(introEl, 'scrollable') || introEl.attrs.tabindex !== '0' || !/Usa a roda do rato/.test(text(bookModal))) throw new Error('a ficha devia mostrar o texto completo, com rolagem e dica');
  roots[1].children = []; M.flags.noCovers = true;
  walk(roots[0]).find((n) => cls1(n, 'thumb') && String((n.attrs || {}).title || '').startsWith('Livro Longo N')).listeners.click[0](); await sleep(150);
  if (!/Início\./.test(text(roots[1])) || /FIM-DO-TEXTO/.test(text(roots[1]))) throw new Error('sem o texto completo, mostra o excerto'); M.flags.noCovers = false; roots[1].children = [];
  ok('Introdução Geral longa: excerto no perfil, texto completo à parte (com privacidade), ficha com rolagem e sem estragar se o texto não chegar');
  // (2) notas e fotos das leituras na atividade
  const phId = await S.addImage(new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 7, 7])], { type: 'image/jpeg' }));
  const sessN = { id: Lz.uid(), bookId: bLong.id, start: Date.now() - 600000, end: Date.now(), durationSeconds: 600, startPage: 10, endPage: 22, notes: 'Capítulo 3: adorei o final.', photoId: phId, unlocked: [], manual: true }; await S.saveSession(sessN);
  await R.pushNow(true);
  let act = M.db.shared.get(`${meId}|activity`).payload.find((a) => a.pages === 12);
  if (!act || act.note !== 'Capítulo 3: adorei o final.' || act.pk !== 'p-' + sessN.id || !M.db.covers.has(`${meId}|p-${sessN.id}`)) throw new Error('atividade com nota e fotografia: ' + JSON.stringify(act));
  if (/photoId|"sid"/.test(JSON.stringify(act))) throw new Error('não vão ids internos');
  S.state.settings.privacy.activityNotes = false; await R.pushNow(true);
  act = M.db.shared.get(`${meId}|activity`).payload.find((a) => a.pages === 12);
  if ('note' in act || 'pk' in act || M.db.covers.has(`${meId}|p-${sessN.id}`)) throw new Error('com a opção desligada não sai nota nem fotografia (e a miniatura é apagada)');
  S.state.settings.privacy.activityNotes = true; S.state.settings.privacy.activity = false; await R.pushNow(true);
  if (M.db.shared.has(`${meId}|activity`) || M.db.covers.has(`${meId}|p-${sessN.id}`)) throw new Error('sem atividade, nada sai'); S.state.settings.privacy.activity = true; await R.pushNow(true);
  const NOTE_LONG = 'Muito bom. ' + 'Esta parte é comprida. '.repeat(30);
  M.db.shared.set(`${mariaId}|activity`, { user_id: mariaId, section: 'activity', payload: [{ book: 'Rd 0', minutes: 30, pages: 20, when: Date.now() - 1000, unlocked: [], note: NOTE_LONG, pk: 'p-ph1' }, { book: 'Rd 0', minutes: 5, pages: 3, when: Date.now() - 5000, unlocked: [], note: 'Nota curta da Maria' }] });
  M.seedCover(mariaId, 'p-ph1', 'data:image/jpeg;base64,/9j/PHOTO');
  await R.pull(true); await sleep(80);
  const fp = R.feed().find((x) => x.p.pages === 20); if (!fp || fp.p.photoData !== 'data:image/jpeg;base64,/9j/PHOTO') throw new Error('fotografia da atividade de uma amiga');
  RF.app.go('home'); await sleep(40);
  const notes = walk(roots[0]).filter((n) => cls1(n, 'act-note')); if (notes.length < 2 || !notes.some((n) => /Nota curta da Maria/.test(text(n)))) throw new Error('o Início devia mostrar as notas das leituras dos amigos');
  const longNote = notes.find((n) => cls1(n, 'clip4')); if (!longNote) throw new Error('nota longa fica recolhida'); longNote.listeners.click[0]({ currentTarget: longNote }); if (cls1(longNote, 'clip4')) throw new Error('clicar na nota longa devia expandi-la');
  const phImg = walk(roots[0]).find((n) => cls1(n, 'session-photo') && String(n.src || (n.attrs || {}).src || '').includes('PHOTO')); if (!phImg) throw new Error('fotografia no cartão');
  phImg.listeners.click[0](); if (!walk(roots[1]).some((n) => cls1(n, 'photo-big'))) throw new Error('clicar na fotografia abre-a em grande'); roots[1].children = [];
  RF.app.go('friend:maria#204819'); await sleep(60); if (!walk(roots[0]).some((n) => cls1(n, 'act-note'))) throw new Error('perfil do amigo: atividade com nota');
  RF.app.go('friends'); clickBtn(roots[0], 'Privacidade'); if (!/Notas e fotos das leituras na atividade/.test(text(roots[0])) || !/só aparecem aos seguidores se/.test(text(roots[0]))) throw new Error('opção na aba Privacidade');
  ok('atividade com o que a pessoa escreveu e a fotografia: enviada só se a opção estiver ligada, mostrada no Início e no perfil, nota longa expansível, foto em grande');
  // (3) trocar a ordem dos livros na estante (arrastar e largar)
  const mk3 = []; for (const n of ['Ord A', 'Ord B', 'Ord C']) { const b = S.newBook({ title: n, author: 'O', totalPages: 100, status: 'reading' }); await S.saveBook(b); mk3.push(b); }
  S.state.settings.libraryStyle = 'spines'; RF.app.go('library');
  const dragEls = () => walk(roots[0]).filter((n) => (n.attrs || {}).draggable === 'true');
  const elOf = (title) => dragEls().find((n) => String((n.attrs || {}).title || '').startsWith(title) || text(n).trim() === title);
  const order3 = () => dragEls().map((n) => text(n).trim() || String((n.attrs || {}).title || '')).filter((x) => /^Ord [ABC]/.test(x)).map((x) => x.slice(0, 5));
  if (dragEls().length < 3) throw new Error('os livros da estante devem ser arrastáveis'); const before3 = order3().join(',');
  const dnd = async (from, to, after) => {
    const a = elOf(from), b = elOf(to); b.getBoundingClientRect = () => ({ left: 0, width: 10 });
    a.listeners.dragstart[0]({ dataTransfer: { setData() {} } }); b.listeners.dragover[0]({ clientX: after ? 9 : 1, preventDefault() {} }); await b.listeners.drop[0]({ clientX: after ? 9 : 1, preventDefault() {} }); await sleep(40);
  };
  await dnd('Ord A', 'Ord C', true);
  const ord = S.state.settings.shelfOrder.reading; if (!ord || ord.at <= 0) throw new Error('a ordem devia ficar guardada');
  const idsRd = ord.ids; if (idsRd.indexOf(mk3[1].id) > idsRd.indexOf(mk3[2].id) || idsRd.indexOf(mk3[2].id) > idsRd.indexOf(mk3[0].id)) throw new Error('ordem guardada: B, C, A — ' + order3());
  await dnd('Ord A', 'Ord B', false);
  { const ids = S.state.settings.shelfOrder.reading.ids, pos = (b) => ids.indexOf(b.id); if (!(pos(mk3[0]) < pos(mk3[1]) && pos(mk3[1]) < pos(mk3[2]))) throw new Error('largar antes de B: A, B, C'); }
  const stale = { ...S.state.settings.shelfOrder.reading }; await dnd('Ord C', 'Ord A', false);
  S.state.settings.libraryStyle = 'covers'; RF.app.go('library'); if (dragEls().length < 3) throw new Error('as capas também são arrastáveis'); S.state.settings.libraryStyle = 'spines'; RF.app.go('library');
  const resetBtn = walk(roots[0]).find((n) => n.tagName === 'BUTTON' && (n.attrs || {}).title === 'Repor a ordem'); if (!resetBtn) throw new Error('botão «Repor a ordem»');
  resetBtn.listeners.click[0](); await sleep(60); if (S.state.settings.shelfOrder.reading.ids.length !== 0) throw new Error('repor a ordem');
  { const plain = S.state.books.filter((b) => b.status === 'reading'); if (RF.shelf.orderBooks('reading', plain).map((b) => b.id).join() !== plain.map((b) => b.id).join()) throw new Error('sem ordem guardada fica a ordem original'); }
  let mo = RF.sync.mergeDocs({ books: [], sessions: [], shelves: [], unlocked: [], settings: { updatedAt: 5, shelfOrder: { reading: { at: 10, ids: ['x'] }, finished: { at: 1, ids: ['f1'] } } }, tombstones: {} }, { books: [], sessions: [], shelves: [], unlocked: [], settings: { updatedAt: 9, shelfOrder: { reading: { at: 4, ids: ['y'] }, wantToRead: { at: 2, ids: ['w'] } } }, tombstones: {} });
  if (mo.settings.shelfOrder.reading.ids[0] !== 'x' || mo.settings.shelfOrder.finished.ids[0] !== 'f1' || mo.settings.shelfOrder.wantToRead.ids[0] !== 'w') throw new Error('a ordem junta-se prateleira a prateleira');
  ok('estante: arrastar para trocar a ordem (lombadas e capas), guardada, com «Repor a ordem» e fusão entre computadores secção a secção');
  // (4) escolher a prateleira ao criar o livro
  const sh1 = { id: Lz.uid(), name: 'Prat1', createdAt: Date.now() }, sh2 = { id: Lz.uid(), name: 'Prat2', createdAt: Date.now() }; await S.saveShelf(sh1); await S.saveShelf(sh2);
  RF.dialogs.openBookForm(); const fm = roots[1];
  if (!/Prateleiras/.test(text(fm)) || !/Prat1/.test(text(fm)) || !/Prat2/.test(text(fm))) throw new Error('o formulário devia listar as prateleiras');
  const chip = walk(fm).find((n) => cls1(n, 'chip-check') && /Prat1/.test(text(n))), chk = walk(chip).find((n) => n.tagName === 'INPUT'); chk.checked = true; chk.listeners.change[0]({ target: chk });
  const realPrompt = RF.ui.promptDialog; RF.ui.promptDialog = async () => 'Prat3'; clickBtn(fm, 'Nova prateleira'); await sleep(120); RF.ui.promptDialog = realPrompt;
  if (!S.state.shelves.some((s) => s.name === 'Prat3')) throw new Error('criar prateleira no formulário');
  const fld4 = (ph) => walk(fm).find((n) => n.tagName === 'INPUT' && n.attrs.placeholder === ph), set4 = (el, v) => { el.value = v; if (el.listeners.input) el.listeners.input[0]({ target: el }); };
  set4(fld4('Título'), 'Livro Prateleiras'); set4(fld4('Autor'), 'P'); set4(fld4('Número de páginas'), '90'); clickBtn(fm, 'Guardar'); await sleep(150);
  const nb4 = S.state.books.find((b) => b.title === 'Livro Prateleiras'), p3 = S.state.shelves.find((s) => s.name === 'Prat3');
  if (!nb4 || !nb4.shelfIds.includes(sh1.id) || !nb4.shelfIds.includes(p3.id) || nb4.shelfIds.includes(sh2.id)) throw new Error('prateleiras escolhidas ao criar: ' + JSON.stringify(nb4 && nb4.shelfIds));
  RF.app.go('library'); if (!walk(roots[0]).some((n) => /Prat1/.test(text(n)) && cls1(n, 'shelf'))) throw new Error('o livro aparece na prateleira escolhida');
  ok('novo livro: escolher a prateleira (e criar uma nova) no próprio formulário');


  // ===== Versão 1.9 =====
  roots[1].children = []; R.api.resetCovers(); R.api.resetWant(); R.api.resetInter();
  const must9 = (c, m) => { if (!c) throw new Error(m); };
  // (1) «Começar a ler»: poder escolher livremente (a lista não pode estar dentro de uma <label>)
  for (const n of ['Pick 1', 'Pick 2', 'Pick 3']) await S.saveBook(S.newBook({ title: n, author: 'P', totalPages: 100, status: 'reading' }));
  RF.sessionUI.openStart(); const pm = roots[1];
  must9(!walk(pm).some((n) => n.tagName === 'LABEL' && walk(n).some((c) => cls1(c, 'pick-list'))), 'a lista de livros não pode estar dentro de uma etiqueta: reencaminha todos os cliques para o 1.º livro');
  const pickOf = (title) => walk(pm).find((n) => n.tagName === 'BUTTON' && cls1(n, 'pick') && text(n).includes(title));
  pickOf('Pick 1').listeners.click[0]({}); must9(cls1(pickOf('Pick 1'), 'on'), 'escolher o 1.º');
  pickOf('Pick 3').listeners.click[0]({}); must9(cls1(pickOf('Pick 3'), 'on') && !cls1(pickOf('Pick 1'), 'on'), 'depois deve ser possível escolher outro');
  pickOf('Pick 2').listeners.click[0]({}); must9(cls1(pickOf('Pick 2'), 'on') && !cls1(pickOf('Pick 3'), 'on'), 'e outro, quantas vezes quiser'); roots[1].children = [];
  const labelBtn = (root_) => walk(root_).filter((n) => n.tagName === 'LABEL' && walk(n).some((c) => c.tagName === 'BUTTON'));
  for (const r of ['home', 'library', 'stats', 'achievements', 'rankings', 'updates', 'recommended', 'friends', 'profile']) { RF.app.go(r); must9(!labelBtn(roots[0]).length, 'botões dentro de uma etiqueta em ' + r); }
  for (const open of [() => RF.dialogs.openBookForm(), () => RF.sessionUI.openManual(), () => RF.sessionUI.openStart(), () => RF.shelf.openCustomize()]) { open(); must9(!labelBtn(roots[1]).length, 'botões dentro de uma etiqueta numa janela'); roots[1].children = []; }
  ok('«Começar a ler»: a lista de livros deixou de reencaminhar cliques (escolhe-se qualquer livro, as vezes que quiser) e não há mais botões dentro de etiquetas');
  // (2) «Quero ler» no perfil, com privacidade igual às outras listas
  M.db.shared.set(`${mariaId}|wantToRead`, { user_id: mariaId, section: 'wantToRead', payload: [{ title: 'Quero 1', author: 'Q1', note: '', color: '#2F4858', pages: 0 }, { title: 'Quero Direto', author: 'QD', note: '', color: '#8C2F39', pages: 150 }] });
  M.db.profiles.get(mariaId).privacy.wantToRead = true;
  await R.pull(true); RF.app.go('friend:maria#204819'); await sleep(60);
  must9(/Quero ler/.test(text(roots[0])) && /Quero 1/.test(text(roots[0])), 'perfil do amigo com a secção «Quero ler»');
  RF.app.go('friendlist:maria#204819:wantToRead'); await sleep(40); must9(/Quero 1/.test(text(roots[0])) && /Quero Direto/.test(text(roots[0])), 'lista completa do «Quero ler»');
  M.db.profiles.get(mariaId).privacy.wantToRead = false; await R.pull(true); M.db.shared.delete(`${mariaId}|wantToRead`); await R.pull(true); RF.app.go('friend:maria#204819'); await sleep(40);
  must9(!/Quero 1/.test(text(roots[0])), 'sem permissão não se vê o «Quero ler»'); M.db.profiles.get(mariaId).privacy.wantToRead = true;
  M.db.shared.set(`${mariaId}|wantToRead`, { user_id: mariaId, section: 'wantToRead', payload: [{ title: 'Quero 1', author: 'Q1', note: '', color: '#2F4858', pages: 0 }, { title: 'Quero Direto', author: 'QD', note: '', color: '#8C2F39', pages: 150 }] }); await R.pull(true);
  S.state.settings.privacy.wantToRead = false; await R.pushNow(true); must9(!M.db.shared.has(`${meId}|wantToRead`), 'desligar «Quero ler» apaga-o do servidor');
  S.state.settings.privacy.wantToRead = true; await R.pushNow(true); const myWant = M.db.shared.get(`${meId}|wantToRead`); must9(myWant && myWant.payload.some((x) => x.title === 'Rd 0'), 'o meu «Quero ler» é partilhado');
  M.flags.noWant = true; R.api.resetWant(); S.state.settings.bio = 'bio 1.9'; await R.pushNow(true);
  must9(M.db.shared.get(`${meId}|bio`).payload.text === 'bio 1.9', 'servidor sem o SQL 1.9: o resto do perfil continua a sincronizar'); M.flags.noWant = false; R.api.resetWant(); await R.pushNow(true);
  ok('«Quero ler» no perfil: ver, lista completa, privacidade igual às outras listas e servidor sem o SQL novo');
  // (3) qualquer livro de um perfil: «+» na capa, ficha e «Ver livro» na atividade
  RF.app.go('friend:maria#204819'); await sleep(60);
  const thumbOf = (title) => walk(roots[0]).find((n) => cls1(n, 'thumb') && String((n.attrs || {}).title || '').startsWith(title));
  const badge = walk(thumbOf('Quero Direto')).find((n) => cls1(n, 'add-badge')); must9(badge && badge.tagName === 'BUTTON', 'botão «+» na capa');
  badge.listeners.click[0]({ stopPropagation() {} }); await sleep(200);
  const qd = S.state.books.find((b) => b.title === 'Quero Direto'); must9(qd && qd.status === 'wantToRead' && qd.totalPages === 150 && qd.author === 'QD', 'adicionar direto a «Quero ler»');
  RF.app.go('friend:maria#204819'); await sleep(40); must9(walk(thumbOf('Quero Direto')).some((n) => cls1(n, 'add-badge') && cls1(n, 'have')), 'depois de adicionado mostra «já tens»');
  thumbOf('Quero Direto').listeners.click[0](); await sleep(100); must9(/Já está na tua estante/.test(text(roots[1])), 'ficha de um livro que já tenho'); roots[1].children = [];
  walk(thumbOf('Quero 1')).find((n) => cls1(n, 'add-badge')).listeners.click[0]({ stopPropagation() {} }); await sleep(60);
  must9(walk(roots[1]).some((n) => n.tagName === 'INPUT' && n.attrs.placeholder === 'Título' && n.value === 'Quero 1'), 'sem páginas: abre o formulário já preenchido'); roots[1].children = [];
  M.db.shared.set(`${mariaId}|activity`, { user_id: mariaId, section: 'activity', payload: [{ aid: 'act-1', book: 'Rd 0', minutes: 30, pages: 20, when: Date.now() - 1000, unlocked: [], note: 'Nota da Maria' }, { aid: 'act-2', book: 'Livro Fora', minutes: 5, pages: 3, when: Date.now() - 5000, unlocked: [] }] });
  await R.pull(true); RF.app.go('home'); await sleep(40);
  const verLivro = walk(roots[0]).filter((n) => n.tagName === 'BUTTON' && text(n).trim() === 'Ver livro'); must9(verLivro.length >= 2, 'botão «Ver livro» nas atividades');
  verLivro[1].listeners.click[0](); await sleep(100); must9(/Livro Fora/.test(text(roots[1])) && walk(roots[1]).some((n) => n.tagName === 'BUTTON' && text(n).trim() === 'Quero ler'), 'livro só com o título abre a ficha com «Quero ler»'); roots[1].children = [];
  ok('qualquer livro de um perfil (listas, «Quero ler» e atividade) abre a ficha e pode ir para «Quero ler», com o «+» direto na capa');
  // (4) Flows e Críticas Elaboradíssimas
  const flowBtn = () => walk(roots[0]).find((n) => n.tagName === 'BUTTON' && cls1(n, 'flow-btn')), critBtn = () => walk(roots[0]).find((n) => n.tagName === 'BUTTON' && /^Críticas Elaboradíssimas/.test(text(n).trim()));
  must9(flowBtn() && critBtn(), 'Flow e Críticas Elaboradíssimas em cada atividade');
  flowBtn().listeners.click[0]({ stopPropagation() {} }); await sleep(150);
  must9(M.db.flows.length === 1 && M.db.flows[0].activity_key === 'act-1' && M.db.flows[0].user_id === meId && M.db.flows[0].author_name, 'dar um Flow'); must9(cls1(flowBtn(), 'on') && /Flow · 1/.test(text(flowBtn())), 'o botão mostra o Flow e a contagem');
  flowBtn().listeners.click[0]({ stopPropagation() {} }); await sleep(150); must9(M.db.flows.length === 0 && !cls1(flowBtn(), 'on'), 'tirar o Flow');
  critBtn().listeners.click[0](); await sleep(40);
  const ta = walk(roots[0]).find((n) => n.tagName === 'TEXTAREA' && n.attrs.placeholder === 'Escreve a tua Crítica Elaboradíssima…'); must9(ta, 'campo da crítica');
  ta.value = 'Excelente leitura!'; clickBtn(roots[0], 'Publicar'); await sleep(150);
  must9(M.db.comments.length === 1 && M.db.comments[0].body === 'Excelente leitura!' && M.db.comments[0].owner_id === mariaId, 'publicar uma crítica'); must9(/Excelente leitura!/.test(text(roots[0])) && /Críticas Elaboradíssimas · 1/.test(text(roots[0])), 'a crítica aparece');
  walk(roots[0]).find((n) => n.tagName === 'BUTTON' && (n.attrs || {}).title === 'Apagar' && cls1(n, 'icon-btn')).listeners.click[0](); await sleep(150); must9(M.db.comments.length === 0, 'apagar a minha crítica');
  critBtn().listeners.click[0](); await sleep(20);
  const realToast = RF.ui.toastAchievements, toasts = []; RF.ui.toastAchievements = (a) => toasts.push(...a.map((x) => x.name));
  M.db.flows.push({ owner_id: meId, activity_key: sessN.id, user_id: mariaId, author_name: 'Maria', created_at: new Date().toISOString() });
  M.db.comments.push({ id: 'cm-in', owner_id: meId, activity_key: sessN.id, user_id: mariaId, author_name: 'Maria', body: 'Crítica da Maria', created_at: new Date().toISOString() });
  await R.pull(true); RF.ui.toastAchievements = realToast;
  must9(toasts.some((x) => /deu um Flow/.test(x)) && toasts.some((x) => /Crítica Elaboradíssima/.test(x)), 'avisos de Flow e crítica recebidos: ' + toasts);
  const myStat = R.activityStats(meId, sessN.id); must9(myStat.flows === 1 && myStat.comments.length === 1 && myStat.comments[0].body === 'Crítica da Maria', 'os meus Flows e críticas');
  await R.deleteComment(meId, sessN.id, 'cm-in'); must9(!M.db.comments.some((c) => c.id === 'cm-in'), 'o dono pode apagar críticas à sua atividade');
  M.db.profiles.get(mariaId).privacy.activity = false; let denied = null; try { await R.toggleFlow(mariaId, 'act-2'); } catch (e) { denied = e; } must9(denied && R.activityStats(mariaId, 'act-2').flows === 0, 'sem permissão (atividade escondida) não se dá Flow e nada fica marcado'); M.db.profiles.get(mariaId).privacy.activity = true;
  M.flags.noInter = true; await R.pull(true); RF.app.go('home'); await sleep(30); must9(!R.interactionsAvailable() && !flowBtn() && walk(roots[0]).some((n) => n.tagName === 'BUTTON' && text(n).trim() === 'Ver livro'), 'sem as tabelas novas: esconde Flow e Críticas, o resto funciona');
  M.flags.noInter = false; R.api.resetInter(); await R.pull(true); must9(R.interactionsAvailable(), 'volta a aparecer com o SQL corrido');
  ok('Flows e Críticas Elaboradíssimas: dar/tirar, comentar/apagar, avisos de quem reage à minha atividade, moderação do dono, permissões e servidor sem o SQL');

  // Perfil visto por um seguidor: 5 miniaturas + "Ver mais", estatísticas e atividade
  for (let i = 0; i < 8; i++) await S.saveBook(S.newBook({ title: 'Fav ' + i, author: 'A', status: 'finished', favorite: true, totalPages: 100 }));
  S.state.settings.privacy.stats = true; S.state.settings.privacy.activity = true;
  RF.app.go('friends');
  const btnByText = (root_, label) => walk(root_).find((n) => n.tagName === 'BUTTON' && text(n).trim() === label);
  btnByText(roots[0], 'Privacidade').listeners.click[0](); RF.app.go('friends');
  btnByText(roots[0], 'Privacidade') && btnByText(roots[0], 'Privacidade').listeners.click[0]();
  const pv = btnByText(roots[0], 'Ver como um seguidor'); if (!pv) throw new Error('botão "Ver como um seguidor" não encontrado');
  pv.listeners.click[0]();
  const modal = roots[1], mt = text(modal);
  const rows = walk(modal).filter((n) => n.className.split(' ').includes('thumb-row'));
  if (!rows.length) throw new Error('sem filas de miniaturas');
  for (const r of rows) { const n = r.children.filter((c) => c.className.split(' ').includes('thumb')).length; if (n > 5) throw new Error('mais de 5 miniaturas: ' + n); }
  if (!rows.some((r) => r.children.length === 5)) throw new Error('devia haver uma fila com 5 miniaturas');
  const more = btnByText(modal, 'Ver mais'); if (!more) throw new Error('falta o botão "Ver mais"');
  if (!mt.includes('Horas lidas') || !mt.includes('Sessões')) throw new Error('estatísticas não aparecem na pré-visualização');
  if (!mt.includes('Atividade') || mt.includes('Esta pessoa não partilha esta secção.')) throw new Error('atividade/estatísticas bloqueadas na pré-visualização do meu perfil');
  more.listeners.click[0]();
  const items = walk(modal).filter((n) => n.className.split(' ').includes('full-item'));
  if (items.length < 8) throw new Error('lista completa devia ter pelo menos 8 livros, tem ' + items.length);
  ok('perfil para seguidores: 5 miniaturas, "Ver mais" → lista completa (' + items.length + '), estatísticas e atividade visíveis');
  roots[1].children = [];

  // Nomes clicáveis, pedidos, perfil sem aprovação, lista completa e atividade dos amigos no Início
  RF.app.go('home'); const feedText = text(roots[0]);
  const lnk = walk(roots[0]).find((n) => n.className.split(' ').includes('link') && /Maria leu/.test(text(n)));
  if (!lnk) throw new Error('Início sem atividade de amigos clicável'); lnk.listeners.click[0]();
  if (!/Maria/.test(text(roots[0])) || !/A ler agora/.test(text(roots[0]))) throw new Error('clicar no nome não abriu o perfil');
  RF.app.go('friends'); if (!/Pedidos para te seguirem/.test(text(roots[0]))) throw new Error('pedido do Pedro não aparece');
  const prow = walk(roots[0]).find((n) => n.className.split(' ').includes('link') && /Pedro/.test(text(n))); if (!prow) throw new Error('nome do Pedro não é clicável'); prow.listeners.click[0]();
  if (!/Segue esta pessoa/.test(text(roots[0]))) throw new Error('perfil sem aprovação devia mostrar o cadeado');
  await R.respond('pedro#771203', true); RF.app.go('friend:pedro#771203'); if (!/Segue-te/.test(text(roots[0]))) throw new Error('depois de aceitar devia aparecer "Segue-te"');
  RF.app.go('friendlist:maria#204819:finished'); if (!/Livros lidos/.test(text(roots[0]))) throw new Error('lista completa do amigo');
  ok('nomes clicáveis (Início, pedidos), perfil sem aprovação, lista completa e atividade dos amigos no Início');

  // Estante: só a linha horizontal, capas direitas, nome editável e imagem de fundo própria
  S.state.settings.libraryName = 'A Minha Biblioteca'; S.state.settings.libraryStyle = 'spines'; RF.app.go('library');
  const els = walk(roots[0]);
  if (!text(roots[0]).includes('A Minha Biblioteca')) throw new Error('nome da estante não mudou');
  if (els.some((n) => n.className.split(' ').includes('case'))) throw new Error('ainda há caixa de madeira (.case)');
  if (!els.some((n) => n.className.split(' ').includes('board'))) throw new Error('sem linha de prateleira (.board)');
  if (els.filter((n) => n.className.split(' ').includes('face')).some((n) => n.style.transform)) throw new Error('capa para a frente inclinada');
  S.state.settings.shelfBgImageId = await S.addImage(new Blob(['x'])); S.state.settings.shelfBg = 'custom'; RF.app.go('library');
  const room = walk(roots[0]).find((n) => n.className.split(' ').includes('room'));
  if (!room || !String(room.style.background).includes('url(')) throw new Error('fundo personalizado não aplicado');
  S.state.settings.shelfBg = 'neutral'; S.state.settings.libraryName = ''; RF.app.go('achievements');
  if (!walk(roots[0]).some((n) => n.className.split(' ').includes('medal-name'))) throw new Error('medalhas sem o contentor de nome uniforme');
  ok('estante: sem caixas, só linha + batentes, capas direitas, nome editável, fundo com imagem própria');

  // Sessão completa com conquista desbloqueada na atividade
  await S.wipe(); S.state.settings.lang = 'pt'; RF.app.applyTheme();
  const b = S.newBook({ title: 'Livro A', author: 'X', totalPages: 100, status: 'reading', genre: 'fiction' }); await S.saveBook(b);
  await RF.session.begin(b.id, 0); await sleep(10); await RF.session.pause(); RF.session.accumulated = 3700;
  RF.sessionUI.openFinish(b);
  // simula guardar: procura o botão "Guardar sessão" no modal
  const layer = roots[1]; const find = (n, pred) => { if (!n || n.nodeType !== 1) return null; if (pred(n)) return n; for (const c of n.children) { const r = find(c, pred); if (r) return r; } return null; };
  const btn = find(layer, (n) => n.tagName === 'BUTTON' && text(n).trim() === 'Guardar sessão');
  if (!btn) throw new Error('botão guardar sessão'); btn.listeners.click[0]({ target: btn }); await sleep(120);
  const sess = S.state.sessions[0]; if (!sess) throw new Error('sessão não guardada');
  if (!sess.unlocked || !sess.unlocked.includes('time_0')) throw new Error('conquista não ligada à sessão: ' + JSON.stringify(sess.unlocked));
  RF.app.go('home'); if (!text(roots[0]).includes('Desbloqueou')) throw new Error('feed sem menção à conquista');
  ok('atividade no feed menciona a conquista desbloqueada: ' + sess.unlocked.join(','));

  // Exportar / importar mantém definições novas
  const dump = await S.exportAll(); await S.importAll(JSON.parse(JSON.stringify(dump))); ok('exportar e importar');
  await S.wipe(); RF.app.go('home'); ok('apagar tudo');
  await require('./drive-test').run(ok);
  await require('./edge-test').run(ok);
  await require('./cloud').run({ RF, M, ok, walk, text, roots, sleep });
  if (H.errs()) throw new Error('console.error chamado ' + H.errs() + ' vezes'); console.log('\nTUDO OK'); process.exit(0);
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
