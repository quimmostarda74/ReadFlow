/* ReadFlow: histórico de versões (mostrado no separador «Atualizações»). Acrescenta uma entrada nova no topo a cada versão. */
(function (root) {
  'use strict';
  root.RF = root.RF || {};
  // k: new (novo) | imp (melhorado) | fix (corrigido). Cada item tem o texto nos 4 idiomas.
  const E = [
    { v: '1.5.0', date: '2026-11', items: [
      { k: 'new', pt: 'Livros em 3D nos perfis dos amigos: clica num livro e roda-o com o rato. A frente usa a capa, a lombada usa a foto da lombada e o verso mostra a anotação da pessoa.',
        en: 'Books in 3D on friends’ profiles: click a book and rotate it with the mouse. The front uses the cover, the spine uses the spine photo and the back shows the person’s annotation.',
        ru: 'Книги в 3D в профилях друзей: нажми на книгу и вращай её мышью. Спереди — обложка, на корешке — фото корешка, сзади — заметка владельца.',
        de: 'Bücher in 3D auf den Profilen von Freunden: Klicke ein Buch an und drehe es mit der Maus. Vorne ist das Cover, am Rücken das Rückenfoto, hinten die Anmerkung der Person.' },
      { k: 'new', pt: '52 níveis novos de conquistas: todas as categorias têm agora 6 níveis, de Bronze a Lenda (150 conquistas no total).',
        en: '52 new achievement levels: every category now has 6 levels, from Bronze to Legend (150 achievements in total).',
        ru: '52 новых уровня достижений: в каждой категории теперь 6 уровней — от бронзы до легенды (всего 150 достижений).',
        de: '52 neue Erfolgsstufen: Jede Kategorie hat jetzt 6 Stufen, von Bronze bis Legende (insgesamt 150 Erfolge).' },
      { k: 'new', pt: 'Nova aba «Atualizações» com a descrição das novidades de cada versão e o botão «Reiniciar e atualizar».',
        en: 'New «Updates» tab describing what is new in each version, with a «Restart and update» button.',
        ru: 'Новая вкладка «Обновления» с описанием новинок каждой версии и кнопкой «Перезапустить и обновить».',
        de: 'Neuer Tab «Updates» mit der Beschreibung der Neuerungen jeder Version und der Schaltfläche «Neu starten und aktualisieren».' },
      { k: 'imp', pt: 'Conquistas: todos os cartões têm o mesmo tamanho e as medalhas ficam alinhadas.',
        en: 'Achievements: all cards are the same size and the medals are aligned.',
        ru: 'Достижения: все карточки одного размера, медали выровнены.',
        de: 'Erfolge: Alle Karten sind gleich groß und die Medaillen sind ausgerichtet.' },
      { k: 'imp', pt: 'Capas mais nítidas nos perfis dos amigos. As fotos das lombadas também são partilhadas (só com quem aceitaste e só se a lista de livros estiver ligada).',
        en: 'Sharper covers on friends’ profiles. Spine photos are shared too (only with people you accepted and only if the book list is turned on).',
        ru: 'Более чёткие обложки в профилях друзей. Фото корешков тоже передаются (только тем, кого ты принял, и только если список книг включён).',
        de: 'Schärfere Cover auf den Profilen von Freunden. Auch Rückenfotos werden geteilt (nur mit angenommenen Personen und nur, wenn die Bücherliste eingeschaltet ist).' }
    ] },
    { v: '1.4.0', date: '2026-11', items: [
      { k: 'new', pt: 'Os amigos veem a imagem da capa, a nota e a avaliação dos livros. «Quero ler» a partir de um amigo leva a capa para a tua prateleira.',
        en: 'Friends see the cover image, the note and the rating of books. «Want to read» from a friend brings the cover to your shelf.',
        ru: 'Друзья видят обложку, заметку и оценку книг. «Хочу прочитать» от друга переносит обложку на твою полку.',
        de: 'Freunde sehen das Coverbild, die Notiz und die Bewertung der Bücher. «Möchte ich lesen» von einem Freund bringt das Cover in dein Regal.' },
      { k: 'new', pt: 'Rankings entre amigos: tempo de leitura, páginas, livros, ritmo e sequência, com top 3 em cada um.',
        en: 'Rankings among friends: reading time, pages, books, pace and streak, with a top 3 in each.',
        ru: 'Рейтинги среди друзей: время чтения, страницы, книги, темп и серия, с топ-3 в каждом.',
        de: 'Ranglisten unter Freunden: Lesezeit, Seiten, Bücher, Tempo und Serie, jeweils mit Top 3.' },
      { k: 'new', pt: 'Campo «Onde compraste» nos livros. Título, autor e páginas passam a ser obrigatórios.',
        en: 'New «Where you bought it» field on books. Title, author and pages are now required.',
        ru: 'Новое поле «Где куплена» у книг. Название, автор и страницы теперь обязательны.',
        de: 'Neues Feld «Wo gekauft» bei Büchern. Titel, Autor und Seiten sind jetzt Pflicht.' },
      { k: 'imp', pt: 'A vista «Lombadas» mostra sempre a lombada e a vista «Capas» mostra sempre a capa. Livros lidos na totalidade contam as páginas nas estatísticas.',
        en: 'The «Spines» view always shows the spine and the «Covers» view always shows the cover. Fully read books count their pages in the statistics.',
        ru: 'Вид «Корешки» всегда показывает корешок, а «Обложки» — обложку. Полностью прочитанные книги учитываются в статистике по страницам.',
        de: 'Die Ansicht «Buchrücken» zeigt immer den Rücken und die Ansicht «Cover» immer das Cover. Vollständig gelesene Bücher zählen ihre Seiten in den Statistiken.' },
      { k: 'fix', pt: 'Botão de copiar o ID corrigido, o «null» no formulário desapareceu e as medalhas dos perfis mostram como se desbloqueiam.',
        en: 'Fixed the copy-ID button, the «null» in the form is gone and profile medals show how they are unlocked.',
        ru: 'Исправлена кнопка копирования ID, «null» в форме исчез, а медали в профилях показывают, как их получить.',
        de: 'Der Kopieren-Button für die ID funktioniert wieder, das «null» im Formular ist weg und die Medaillen in Profilen zeigen, wie man sie freischaltet.' }
    ] },
    { v: '1.3.0', date: '2026-10', items: [
      { k: 'new', pt: 'Amigos a sério: contas, ID nome#123456, pedidos de seguir com aprovação e privacidade por secção aplicada no servidor.',
        en: 'Real friends: accounts, name#123456 IDs, follow requests with approval and per-section privacy enforced on the server.',
        ru: 'Настоящие друзья: аккаунты, ID имя#123456, запросы на подписку с подтверждением и приватность по разделам на сервере.',
        de: 'Echte Freunde: Konten, IDs wie name#123456, Folgeanfragen mit Bestätigung und Datenschutz pro Bereich auf dem Server.' },
      { k: 'new', pt: 'Atividade e recomendações dos amigos, «Testar ligação» e código de convite opcional.',
        en: 'Friends’ activity and recommendations, «Test connection» and an optional invite code.',
        ru: 'Активность и рекомендации друзей, «Проверить подключение» и необязательный код приглашения.',
        de: 'Aktivität und Empfehlungen der Freunde, «Verbindung testen» und optionaler Einladungscode.' },
      { k: 'new', pt: 'Atualizações automáticas através do GitHub.',
        en: 'Automatic updates through GitHub.',
        ru: 'Автоматические обновления через GitHub.',
        de: 'Automatische Updates über GitHub.' }
    ] },
    { v: '1.2.0', date: '2026-10', items: [
      { k: 'fix', pt: 'Registo manual corrigido (página inicial sugerida) e atividades editáveis.',
        en: 'Manual logging fixed (suggested starting page) and activities can be edited.',
        ru: 'Исправлена ручная запись (предлагается начальная страница), записи можно редактировать.',
        de: 'Manuelles Eintragen korrigiert (Startseite wird vorgeschlagen) und Aktivitäten lassen sich bearbeiten.' },
      { k: 'new', pt: 'Estante só com a linha horizontal, 19 materiais e fundo com imagem própria.',
        en: 'Bookshelf with just the horizontal line, 19 materials and a background with your own image.',
        ru: 'Полка в виде одной горизонтальной линии, 19 материалов и фон со своим изображением.',
        de: 'Regal nur mit der waagerechten Linie, 19 Materialien und Hintergrund mit eigenem Bild.' },
      { k: 'imp', pt: 'Perfil visto por um seguidor com estatísticas e atividade; 5 miniaturas com «Ver mais».',
        en: 'Profile as seen by a follower with statistics and activity; 5 thumbnails with «See more».',
        ru: 'Профиль глазами подписчика со статистикой и активностью; 5 миниатюр и «Показать все».',
        de: 'Profil aus Sicht eines Followers mit Statistiken und Aktivität; 5 Vorschaubilder mit «Mehr ansehen».' }
    ] }
  ];
  root.RF.changelog = { current: '1.5.0', entries: E };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RF.changelog;
})(typeof window !== 'undefined' ? window : globalThis);
