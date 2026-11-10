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

  const routes = ['home', 'library', 'stats', 'achievements', 'rankings', 'recommended', 'friends', 'profile'];
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
  if (M.db.profiles.size !== 1 || M.db.shared.size !== 8) throw new Error('secções partilhadas: ' + M.db.shared.size);
  const uidA = [...M.db.profiles.keys()][0];
  const rawShared = JSON.stringify([...M.db.shared.values()]);
  if (rawShared.includes('nota privada')) throw new Error('as notas privadas foram enviadas ao servidor!');
  if (/"coverId"|"spineId"|"photoId"|"id":/.test(rawShared)) throw new Error('foram enviados campos internos');
  ok('criar conta: ID ' + ua.handle + ', 8 secções enviadas, sem notas nem campos internos');
  S.state.settings.privacy.stats = false; await R.pushNow();
  if (M.db.shared.has(uidA + '|stats') || M.db.shared.size !== 7) throw new Error('desligar uma secção devia apagá-la do servidor');
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
  const clickBtn = (root_, label) => { const b = walk(root_).find((n) => n.tagName === 'BUTTON' && text(n).trim() === label); if (!b) throw new Error('botão não encontrado: ' + label); b.listeners.click[0]({ target: b }); return b; };
  // (1) notas, avaliações e capas que os amigos veem
  M.db.shared.set(`${mariaId}|reading`, { user_id: mariaId, section: 'reading', payload: [{ title: 'Rd 0', author: 'Z', note: '', color: '#8C2F39', rating: 4, review: 'Gostei muito', ck: 'cov-1' }] });
  M.db.shared.set(`${mariaId}|recommendations`, { user_id: mariaId, section: 'recommendations', payload: [{ title: 'Rec M', author: 'Q', note: 'Good', rating: 5, ck: 'cov-2' }, { title: 'Rec N', author: 'W', note: '', review: 'Long review text here', rating: 3 }] });
  M.seedCover(mariaId, 'cov-1', 'data:image/jpeg;base64,/9j/AAAA'); M.seedCover(mariaId, 'cov-2', 'data:image/jpeg;base64,/9j/BBBB');
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
  if (!M.db.covers.has(`${meId}|${cid}`) || favPayload.ck !== cid) throw new Error('capa não enviada');
  if (favPayload.rating !== 5 || favPayload.review !== 'minha nota') throw new Error('nota e avaliação não enviadas');
  S.state.settings.privacy.reviews = false; await R.pushNow(true);
  const fp2 = M.db.shared.get(`${meId}|favorites`).payload.find((x) => x.title === 'Livro Req');
  if ('rating' in fp2 || 'review' in fp2) throw new Error('com «Notas e avaliações» desligado não devia enviar');
  S.state.settings.privacy.reviews = true;
  nb2.coverId = null; await S.saveBook(nb2); await R.pushNow(true);
  if (M.db.covers.has(`${meId}|${cid}`)) throw new Error('capa antiga devia ser apagada do servidor');
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
  if (pods1(roots[0]) !== 5) throw new Error('total devia ter 5 rankings, tem ' + pods1(roots[0]));
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
  if (H.errs()) throw new Error('console.error chamado ' + H.errs() + ' vezes'); console.log('\nTUDO OK'); process.exit(0);
})().catch((e) => { console.error('FALHOU:', e); process.exit(1); });
