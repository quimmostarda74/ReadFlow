/* ReadFlow — catálogo de sugestões (títulos conhecidos; páginas aproximadas). */
(function (root) {
  'use strict';
  const RF = (root.RF = root.RF || {});
  // [título, autor, género, páginas aprox.]
  const ROWS = [
    ['Os Maias', 'Eça de Queirós', 'classics', 704], ['Dom Casmurro', 'Machado de Assis', 'classics', 256],
    ['Orgulho e Preconceito', 'Jane Austen', 'classics', 432], ['Crime e Castigo', 'Fiódor Dostoiévski', 'classics', 592],
    ['O Velho e o Mar', 'Ernest Hemingway', 'classics', 128], ['Memorial do Convento', 'José Saramago', 'classics', 400],
    ['Livro do Desassossego', 'Fernando Pessoa', 'classics', 520],
    ['Ensaio sobre a Cegueira', 'José Saramago', 'fiction', 310], ['O Alquimista', 'Paulo Coelho', 'fiction', 208],
    ['A Sombra do Vento', 'Carlos Ruiz Zafón', 'fiction', 487], ['A Menina que Roubava Livros', 'Markus Zusak', 'fiction', 480],
    ['O Nome da Rosa', 'Umberto Eco', 'fiction', 560],
    ['Cem Anos de Solidão', 'Gabriel García Márquez', 'romance', 417], ['O Amor nos Tempos de Cólera', 'Gabriel García Márquez', 'romance', 368],
    ['O Assassinato de Roger Ackroyd', 'Agatha Christie', 'crime', 288], ['Os Homens que Não Amavam as Mulheres', 'Stieg Larsson', 'crime', 560],
    ['O Hobbit', 'J. R. R. Tolkien', 'fantasy', 310], ['A Sociedade do Anel', 'J. R. R. Tolkien', 'fantasy', 576],
    ['A Guerra dos Tronos', 'George R. R. Martin', 'fantasy', 592], ['Harry Potter e a Pedra Filosofal', 'J. K. Rowling', 'fantasy', 223],
    ['1984', 'George Orwell', 'scifi', 328], ['Fundação', 'Isaac Asimov', 'scifi', 255], ['Duna', 'Frank Herbert', 'scifi', 688],
    ['Admirável Mundo Novo', 'Aldous Huxley', 'scifi', 288], ['Fahrenheit 451', 'Ray Bradbury', 'scifi', 208],
    ['Sapiens', 'Yuval Noah Harari', 'history', 464], ['Armas, Germes e Aço', 'Jared Diamond', 'history', 480],
    ['Uma Breve História do Tempo', 'Stephen Hawking', 'science', 256], ['O Gene Egoísta', 'Richard Dawkins', 'science', 360],
    ['Cosmos', 'Carl Sagan', 'science', 396],
    ['Hábitos Atómicos', 'James Clear', 'selfhelp', 320], ['Pense Depressa e Devagar', 'Daniel Kahneman', 'selfhelp', 512],
    ['O Poder do Hábito', 'Charles Duhigg', 'selfhelp', 408],
    ['Steve Jobs', 'Walter Isaacson', 'biography', 656], ['O Diário de Anne Frank', 'Anne Frank', 'biography', 352],
    ['Longo Caminho para a Liberdade', 'Nelson Mandela', 'biography', 656],
    ['Mensagem', 'Fernando Pessoa', 'poetry', 96], ['Os Lusíadas', 'Luís de Camões', 'poetry', 400],
    ['O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'kids', 96], ['Alice no País das Maravilhas', 'Lewis Carroll', 'kids', 192]
  ];
  const CATALOG = ROWS.map(([title, author, genre, pages]) => ({ title, author, genre, pages, key: (title + '|' + author).toLowerCase() }));

  /** Sugestões que ainda não estão na biblioteca, ordenadas pelos géneros que mais lês. */
  function suggestions(books, genreFilter) {
    const have = new Set(books.map((b) => (b.title + '|' + b.author).toLowerCase()));
    const weight = {};
    for (const b of books) if (b.genre && (b.status === 'finished' || b.status === 'reading' || b.favorite)) weight[b.genre] = (weight[b.genre] || 0) + (b.favorite ? 2 : 1);
    return CATALOG.filter((c) => !have.has(c.key) && (!genreFilter || c.genre === genreFilter))
      .map((c) => ({ ...c, score: weight[c.genre] || 0, reason: weight[c.genre] ? c.genre : null }))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }

  // Em alta e mais vendidos: seleção feita a partir de listas e destaques da Wook citados pela imprensa (ver docs).
  // [título, autor, género, língua, etiqueta]  (etiqueta: top = mais vendido, hot = em alta, new = novidade)
  const TREND_ROWS = [
    ['Não Incomodar', 'Freida McFadden', 'crime', 'pt', 'top'], ['A Mulher no Andar de Cima', 'Freida McFadden', 'crime', 'pt', 'top'],
    ['O Segredo da Criada', 'Freida McFadden', 'crime', 'pt', 'top'], ['O Casamento da Criada', 'Freida McFadden', 'crime', 'pt', 'hot'],
    ['O Protocolo do Caos', 'José Rodrigues dos Santos', 'crime', 'pt', 'top'], ['Fomos Mais do que um Erro', 'Raul Minh\'alma', 'romance', 'pt', 'top'],
    ['Nem Todas as Árvores Morrem de Pé', 'Luísa Sobral', 'fiction', 'pt', 'hot'], ['Tempestade de Ónix', 'Rebecca Yarros', 'fantasy', 'pt', 'top'],
    ['Fourth Wing', 'Rebecca Yarros', 'fantasy', 'en', 'top'], ['Uma Corte de Espinhos e Rosas', 'Sarah J. Maas', 'fantasy', 'pt', 'hot'],
    ['É Assim que Acaba', 'Colleen Hoover', 'romance', 'pt', 'top'], ['It Ends with Us', 'Colleen Hoover', 'romance', 'en', 'top'],
    ['Se Fosse Perfeito', 'Colleen Hoover', 'romance', 'pt', 'hot'], ['As Jogadas do Amor', 'Sarah Adams', 'romance', 'pt', 'hot'],
    ['Aconteceu em Roma', 'Sarah Adams', 'romance', 'pt', 'hot'], ['O Clube do Crime das Quintas-Feiras', 'Richard Osman', 'crime', 'pt', 'hot'],
    ['Jogo de Sobrevivência (The Running Man)', 'Stephen King', 'scifi', 'pt', 'new'], ['Astérix na Lusitânia', 'Fabcaro e Didier Conrad', 'kids', 'pt', 'top'],
    ['The Let Them Theory', 'Mel Robbins', 'selfhelp', 'en', 'top'], ['The Correspondent', 'Virginia Evans', 'fiction', 'en', 'hot'],
    ['Outlander', 'Diana Gabaldon', 'fantasy', 'en', 'hot'], ['The Hunger Games', 'Suzanne Collins', 'scifi', 'en', 'hot'],
    ['O Duque e Eu (Bridgerton)', 'Julia Quinn', 'romance', 'pt', 'hot'], ['As Causas do Atraso Português', 'Nuno Palma', 'history', 'pt', 'hot'],
    ['Inteligência Artificial', 'Arlindo Oliveira', 'science', 'pt', 'hot'], ['Vozes de Chernobyl', 'Svetlana Alexievich', 'history', 'pt', 'hot'],
    ['O Hobbit', 'J. R. R. Tolkien', 'fantasy', 'pt', 'top'], ['Atomic Habits', 'James Clear', 'selfhelp', 'en', 'top']
  ];
  const TRENDING = TREND_ROWS.map(([title, author, genre, lang, tag]) => ({ title, author, genre, lang, tag, pages: 0, key: (title + '|' + author).toLowerCase() }));
  const TRENDING_UPDATED = '2026-10';

  /** Em alta, ordenados pelo que tu lês (géneros, autores e favoritos). */
  function trending(books, lang) {
    const have = new Set(books.map((b) => (b.title + '|' + b.author).toLowerCase()));
    const gw = {}, aw = {};
    for (const b of books) {
      const w = (b.favorite ? 3 : 1) + (b.status === 'finished' ? 1 : 0);
      if (b.genre) gw[b.genre] = (gw[b.genre] || 0) + w;
      if (b.author) aw[b.author.toLowerCase()] = (aw[b.author.toLowerCase()] || 0) + w;
    }
    const tagW = { top: 2, hot: 1, new: 1 };
    return TRENDING.filter((c) => !have.has(c.key) && (!lang || c.lang === lang))
      .map((c) => ({ ...c, score: (gw[c.genre] || 0) * 2 + (aw[c.author.toLowerCase()] || 0) * 4 + tagW[c.tag] }))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  }
  const wookSearchUrl = (c) => 'https://www.wook.pt/pesquisa/' + encodeURIComponent(c.title.replace(/\s*\(.*\)\s*$/, '') + ' ' + c.author);
  RF.catalog = { CATALOG, suggestions, TRENDING, TRENDING_UPDATED, trending, wookSearchUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = RF.catalog;
})(typeof window !== 'undefined' ? window : globalThis);
