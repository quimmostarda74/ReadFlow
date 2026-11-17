// Testes da cópia na nuvem: fusão entre computadores, imagens, primeira vez, erros e cartão do perfil.
const { createFakeDrive } = require('./fake-drive');

async function run(c) {
  const { RF, M, ok, walk, text, roots, sleep } = c, S = RF.store, R = RF.remote, Y = RF.sync, L = RF.logic;
  const uid = R.state.user.uid, DOC = 'readflow-data.json';
  const must = (cond, msg) => { if (!cond) throw new Error(msg); };
  const cls = (n, k) => String(n.className || '').split(' ').includes(k);
  const click = (root_, label) => { const b = walk(root_).find((n) => n.tagName === 'BUTTON' && text(n).trim() === label); must(b, 'botão não encontrado: ' + label); b.listeners.click[0]({ target: b, stopPropagation() {} }); return b; };
  const cloudDoc = () => JSON.parse(new TextDecoder().decode(fake.cloud.get(DOC).bytes));
  const bytes = (a) => new Uint8Array(a);
  const img = async (arr, type) => S.addImage(new Blob([bytes(arr)], { type: type || 'image/jpeg' }));
  const fake = createFakeDrive();
  roots[1].children = [];

  // ---------- 0. estados do cartão no perfil
  RF.app.go('profile'); must(/Disponível na versão instalada/.test(text(roots[0])), 'sem a app instalada');
  globalThis.readflowApp = { drive: fake.api, getVersion: async () => '1.7.0', checkUpdates: async () => ({}), onUpdateStatus() {}, copyText: async () => true }; RF.config.googleClientId = ''; RF.config.googleClientSecret = '';
  await Y.onSignIn(uid, 'segredo123'); RF.app.go('profile'); must(/ainda não está configurado/.test(text(roots[0])), 'sem configuração do Google');
  RF.config.googleClientId = 'cid'; RF.config.googleClientSecret = 'sec';
  await Y.onSignIn(uid, 'segredo123'); RF.app.go('profile'); must(/Ligar ao Google Drive/.test(text(roots[0])) && !Y.state.connected, 'por ligar');
  ok('cartão «Cópia na nuvem»: versão sem instalador, sem configuração do Google e por ligar');

  // ---------- 1. computador A: dados e primeira ligação
  await S.wipe(); roots[1].children = [];
  const b1 = S.newBook({ title: 'Livro A', author: 'X', totalPages: 200, status: 'finished', finishedAt: Date.now() }); b1.coverId = await img([0xFF, 0xD8, 0xFF, 1, 2, 3]);
  const b2 = S.newBook({ title: 'Livro B', author: 'Y', totalPages: 300, status: 'reading', currentPage: 50 });
  const b3 = S.newBook({ title: 'Livro C', author: 'Z', totalPages: 100, status: 'wantToRead' });
  for (const b of [b1, b2, b3]) await S.saveBook(b);
  const sess = { id: L.uid(), bookId: b1.id, start: Date.now() - 3600000, end: Date.now(), durationSeconds: 3600, startPage: 0, endPage: 40, notes: 'nota privada', photoId: null, unlocked: [] }; await S.saveSession(sess);
  await S.saveShelf({ id: L.uid(), name: 'Minha estante', createdAt: Date.now() });
  S.state.settings.name = 'Ana Leitora'; S.state.settings.lastSeenVersion = 'x'; await S.saveSettings(); await RF.app.awardXp(true);
  const okc = await Y.connect('segredo123');
  must(okc && Y.state.connected && Y.state.email === 'leitor@gmail.com', 'ligar: ' + JSON.stringify(Y.state));
  const d1 = cloudDoc();
  must(d1.books.length === 3 && d1.sessions.length === 1 && d1.shelves.length === 1 && d1.settings.name === 'Ana Leitora', 'conteúdo enviado');
  must(!('handleName' in d1.settings) && !('cloudUid' in d1.settings) && !('social' in d1.settings) && !('lastSeenVersion' in d1.settings) && !('toastedVersion' in d1.settings), 'definições locais não podem ir para a nuvem');
  must(Buffer.compare(Buffer.from(fake.cloud.get('img-' + b1.coverId).bytes), Buffer.from([0xFF, 0xD8, 0xFF, 1, 2, 3])) === 0, 'imagem enviada igual');
  must(M.db.vault.get(uid).blob.startsWith('v1.') && S.state.settings.cloudUid === uid && roots[1].children.length === 0, 'cofre, conta e janela de progresso');
  ok('computador A: ligar ao Google envia livros, leituras, estantes, definições e imagens; ligação guardada no cofre; sem dados locais a sair');

  // ---------- 2. computador B (novo): entra na conta e recebe tudo, sem voltar a ligar ao Google
  const docA = Y.buildDoc(), imgsA = new Map(); for (const id of Y.imageIdsOf(docA)) imgsA.set(id, await S.getImageBlob(id));
  const restoreA = async () => { await S.resetLocal(); await S.applyDoc(JSON.parse(JSON.stringify(docA)), { cloudUid: uid }); for (const [id, b] of imgsA) await S.restoreImage(id, b); };
  await S.resetLocal(); fake.connected.clear(); Y._reset();
  await Y.onSignIn(uid, 'errada'); must(!Y.state.connected && S.state.books.length === 0, 'palavra-passe errada não liga');
  await Y.onSignIn(uid, 'segredo123');
  must(Y.state.connected && S.state.books.length === 3 && S.state.sessions.length === 1 && S.state.shelves.length === 1, 'restauro: ' + S.state.books.length);
  must(S.hasImage(b1.coverId) && Buffer.compare(Buffer.from(await (await S.getImageBlob(b1.coverId)).arrayBuffer()), Buffer.from([0xFF, 0xD8, 0xFF, 1, 2, 3])) === 0, 'a capa foi restaurada');
  must(S.state.settings.name === 'Ana Leitora' && S.state.settings.cloudUid === uid && b1.id in S.state.settings.xpLedger, 'definições e XP restaurados');
  must(S.state.sessions[0].notes === 'nota privada', 'notas das leituras vêm com a cópia');
  ok('computador B: entrar na conta restaura livros, leituras, estantes, capas, definições e XP, sem ligar o Google outra vez');

  // ---------- 3. alterações em B chegam a A (e apagados não ressuscitam)
  const bB = S.state.books.find((b) => b.title === 'Livro A'); bB.title = 'Livro A (editado em B)'; await S.saveBook(bB);
  await S.deleteSession(S.state.sessions[0].id);
  const b4 = S.newBook({ title: 'Livro D', author: 'W', totalPages: 150, status: 'reading' }); b4.coverId = await img([0x89, 0x50, 0x4E, 0x47, 9, 9], 'image/png'); await S.saveBook(b4);
  await Y.syncNow();
  const d2 = cloudDoc(); must(d2.books.length === 4 && Object.values(d2.tombstones).some((x) => x.k === 's') && fake.cloud.has('img-' + b4.coverId), 'B enviou as alterações');
  await restoreA();                                                           // «A» antigo, ainda sem as alterações de B...
  const bA2 = S.state.books.find((b) => b.title === 'Livro B'); bA2.rating = 5; await S.saveBook(bA2);     // ...mas com uma alteração própria
  const s2 = { id: L.uid(), bookId: bA2.id, start: Date.now() - 1000, end: Date.now(), durationSeconds: 600, startPage: 50, endPage: 60, notes: '', photoId: null, unlocked: [] }; await S.saveSession(s2);
  await Y.syncNow();
  const titles = S.state.books.map((b) => b.title).sort();
  must(titles.join('|') === ['Livro A (editado em B)', 'Livro B', 'Livro C', 'Livro D'].join('|'), 'livros juntos: ' + titles);
  must(S.state.books.find((b) => b.title === 'Livro B').rating === 5 && S.state.sessions.length === 1 && S.state.sessions[0].id === s2.id, 'a alteração de A fica e a sessão apagada em B não ressuscita');
  must(S.hasImage(b4.coverId), 'a capa nova de B chegou a A'); must(RF.sync.canon(Y.buildDoc()) === RF.sync.canon(cloudDoc()), 'local e nuvem iguais');
  ok('dois computadores: as alterações juntam-se, o que foi apagado não volta e as capas novas seguem');

  // ---------- 4. regras da fusão (puras)
  const base = (o) => ({ books: [], sessions: [], shelves: [], unlocked: [], settings: { updatedAt: 0 }, tombstones: {}, ...o });
  let m = Y.mergeDocs(base({ books: [{ id: 'x', updatedAt: 200, t: 'local' }] }), base({ tombstones: { x: { k: 'b', at: 100 } } }));
  must(m.books.length === 1 && !m.tombstones.x, 'alterado depois de apagado: fica');
  m = Y.mergeDocs(base({ books: [{ id: 'x', updatedAt: 100 }] }), base({ tombstones: { x: { k: 'b', at: 300 } } })); must(m.books.length === 0 && m.tombstones.x, 'apagado depois da alteração: sai');
  m = Y.mergeDocs(base({ books: [{ id: 'x', updatedAt: 100 }] }), base({ tombstones: { x: { k: 'b', at: 100 } } })); must(m.books.length === 0, 'empate: apagar ganha');
  m = Y.mergeDocs(base({ books: [{ id: 'x', updatedAt: 300, t: 'A' }] }), base({ books: [{ id: 'x', updatedAt: 200, t: 'B' }] })); must(m.books[0].t === 'A', 'a versão mais recente ganha');
  m = Y.mergeDocs(base({ books: [{ id: 'x', updatedAt: 300, t: 'A' }] }), base({ books: [{ id: 'x', updatedAt: 300, t: 'B' }] })); must(m.books[0].t === 'B', 'empate: fica a da nuvem');
  m = Y.mergeDocs(base({ unlocked: [{ id: 'a', at: 5 }] }), base({ unlocked: [{ id: 'a', at: 3 }, { id: 'b', at: 9 }] })); must(m.unlocked.length === 2 && m.unlocked.find((u) => u.id === 'a').at === 3, 'conquistas: união, a data mais antiga');
  m = Y.mergeDocs(base({ settings: { updatedAt: 10, appTheme: 'dark', xpLedger: { a: 100 }, seenCosmetics: ['w'] } }), base({ settings: { updatedAt: 20, appTheme: 'cream', xpLedger: { a: 50, b: 70 }, seenCosmetics: ['n'] } }));
  must(m.settings.appTheme === 'cream' && m.settings.xpLedger.a === 100 && m.settings.xpLedger.b === 70 && m.settings.seenCosmetics.length === 2 && m.settings.updatedAt === 20, 'definições: a mais recente ganha; XP e visuais juntam-se');
  ok('regras de fusão: mais recente ganha, apagar vs alterar, empates, conquistas e XP em união');

  // ---------- 5. outro computador escreve a meio, falta de rede e perda da ligação
  const edit = S.state.books.find((b) => b.title === 'Livro C'); edit.notes = 'mudança local'; await S.saveBook(edit);
  fake.hookStat = () => { const d = cloudDoc(); d.books.push({ id: 'externo', title: 'Livro Externo', author: 'E', totalPages: 10, status: 'wantToRead', updatedAt: Date.now() + 5, shelfIds: [] }); fake.setCloudFile(DOC, new TextEncoder().encode(JSON.stringify(d))); };
  await Y.syncNow();
  must(S.state.books.some((b) => b.title === 'Livro Externo') && cloudDoc().books.find((b) => b.title === 'Livro C').notes === 'mudança local' && cloudDoc().books.some((b) => b.id === 'externo'), 'escrita simultânea: nada se perde');
  fake.down = true; const off = S.state.books.find((b) => b.title === 'Livro D'); off.notes = 'sem rede'; await S.saveBook(off); await Y.syncNow();
  must(Y.state.status === 'offline' && /Sem ligação/.test(Y.state.error) && S.state.books.some((b) => b.notes === 'sem rede'), 'sem rede: avisa e mantém os dados'); fake.down = false;
  await Y.syncNow(); must(Y.state.status === 'idle' && cloudDoc().books.find((b) => b.title === 'Livro D').notes === 'sem rede', 'volta a rede: sincroniza');
  fake.failCode = 'api_disabled'; await Y.syncNow(); must(Y.state.status === 'error' && /API do Google Drive/.test(Y.state.error), 'API desligada: explica'); 
  fake.failCode = 'auth'; await Y.syncNow(); must(!Y.state.connected && /ligação ao Google caiu/.test(Y.state.error), 'ligação caída'); RF.app.go('profile'); must(/Ligar ao Google Drive/.test(text(roots[0])), 'cartão volta a pedir para ligar');
  ok('escrita simultânea, falta de rede, API desligada e ligação caída: nada se perde e a mensagem é clara');
  await Y.connect(null);

  // ---------- 6. mais de um utilizador no mesmo computador
  const asked = []; const realAsk = Y.ask;
  S.state.settings.cloudUid = 'outra-conta'; const local1 = S.newBook({ title: 'Só neste computador', author: 'L', totalPages: 10, status: 'wantToRead' }); await S.saveBook(local1);
  Y.ask = async (remote, other) => { asked.push([remote, other]); return 'cancel'; };
  await Y.syncNow({ manual: true }); must(asked.length === 1 && asked[0][1] === 'outra-conta' && S.state.books.some((b) => b.id === local1.id) && !cloudDoc().books.some((b) => b.id === local1.id), 'agora não: nada muda');
  await Y.syncNow(); must(asked.length === 1, 'não volta a perguntar sozinho');
  Y.ask = async () => 'replace'; await Y.syncNow({ manual: true });
  must(!S.state.books.some((b) => b.id === local1.id) && S.state.books.length === cloudDoc().books.length && S.state.settings.cloudUid === uid, 'substituir: fica só o da nuvem');
  S.state.settings.cloudUid = 'outra-conta'; const local2 = S.newBook({ title: 'Para juntar', author: 'L', totalPages: 10, status: 'wantToRead' }); await S.saveBook(local2);
  Y.ask = async () => 'merge'; await Y.syncNow({ manual: true }); must(cloudDoc().books.some((b) => b.id === local2.id) && S.state.books.some((b) => b.id === local2.id), 'juntar: sobe o que estava aqui'); Y.ask = realAsk;
  ok('dados de outra conta no mesmo computador: pergunta, e «agora não», «substituir» e «juntar» fazem o que dizem');

  // ---------- 7. apagar tudo propaga; imagens órfãs; cartão no perfil
  fake.setCloudFile('img-orfa-antiga', [1], '2020-01-01T00:00:00Z'); fake.setCloudFile('img-orfa-nova', [1], new Date().toISOString());
  await S.saveSettings(); S.state.settings.dailyGoal = 33; await S.saveSettings(); await Y.syncNow();
  must(!fake.cloud.has('img-orfa-antiga') && fake.cloud.has('img-orfa-nova'), 'só as imagens órfãs antigas são limpas');
  RF.app.go('profile'); let pt = text(roots[0]);
  must(/Ligado ao Google Drive/.test(pt) && /leitor@gmail\.com/.test(pt) && /Sincronizado/.test(pt), 'cartão ligado: ' + pt.slice(0, 200));
  const before = fake.calls.length; click(roots[0], 'Sincronizar agora'); await sleep(150); must(fake.calls.length > before, '«Sincronizar agora» sincroniza');
  await S.wipe(); await Y.syncNow(); const d3 = cloudDoc();
  must(d3.books.length === 0 && d3.sessions.length === 0 && Object.keys(d3.tombstones).length >= 4 && d3.settings.name === '', 'apagar tudo apaga também na nuvem');
  await restoreA(); await Y.syncNow(); must(S.state.books.length === 0 && S.state.sessions.length === 0 && S.state.settings.name === '', 'um computador antigo não traz de volta o que foi apagado');
  ok('apagar tudo propaga à nuvem e aos outros computadores; imagens órfãs antigas são limpas; botão «Sincronizar agora»');

  // ---------- 8. ligar pelo ecrã, desligar e apagar a cópia
  await Y.disconnect(); must(!M.db.vault.has(uid) && !Y.state.connected, 'desligar apaga o cofre'); RF.app.go('profile');
  click(roots[0], 'Ligar ao Google Drive'); const dlg = roots[1].children[roots[1].children.length - 1];
  const pw = walk(dlg).find((n) => n.tagName === 'INPUT' && n.attrs.placeholder === 'Palavra-passe do ReadFlow'); must(pw, 'pede a palavra-passe');
  pw.value = 'errada'; click(dlg, 'Continuar'); await sleep(100); must(/Palavra-passe incorreta/.test(walk(dlg).find((n) => cls(n, 'err-note')).textContent) && !Y.state.connected, 'palavra-passe errada no diálogo');
  pw.value = 'segredo123'; click(dlg, 'Continuar'); await sleep(400);
  must(Y.state.connected && M.db.vault.has(uid), 'ligar pelo ecrã guarda o cofre'); roots[1].children = [];
  must(await Y.deleteCloud() && fake.cloud.size === 0 && S.state.settings.cloudUid === '', 'apagar a cópia na nuvem');
  ok('ecrã: ligar com confirmação da palavra-passe, desligar (apaga o cofre) e apagar a cópia na nuvem');

  // ---------- 9. servidor sem o cofre: o Google liga-se em cada computador
  await Y.connect('segredo123'); M.flags.noVault = true; await S.resetLocal(); fake.connected.clear(); Y._reset();
  await Y.onSignIn(uid, 'segredo123'); must(!Y.state.connected, 'sem cofre fica por ligar'); M.flags.noVault = false;
  ok('sem a tabela do cofre no servidor, a app continua a funcionar e pede o Google em cada computador');
  Y.onSignOut(); delete globalThis.readflowApp;
}
module.exports = { run };
