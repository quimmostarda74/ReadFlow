# Sistema de amigos: como funciona

## Visão geral
- **Conta:** nome de utilizador + palavra-passe. Cada conta recebe um ID único `nome#123456`
  (os 6 números são gerados e verificados no servidor). Não se pede e-mail.
- **Seguir com aprovação:** quem pede para seguir fica «pendente» até a outra pessoa **aceitar** ou recusar.
- **Privacidade por secção** (aplicada no servidor, não só na app): o que estou a ler, livros lidos, favoritos,
  recomendações, descrição, conquistas, atividade e estatísticas. Só um seguidor **aprovado** vê uma secção,
  e só se o dono a deixou ligada.
- **Ver como um seguidor:** pré-visualização exata do que os outros veem.
- **Atividade dos amigos** no Início (cada sessão mostra as conquistas que desbloqueou) e **recomendações dos amigos**.
- **Perfil dos outros:** clicar no nome ou na foto. Sem aprovação só se vê o cartão e a opção de seguir.
- **Capas, notas e avaliações:** um seguidor aprovado vê a imagem da capa de cada livro (miniatura), a avaliação em estrelas e a nota do livro, se estiverem ligadas.
- **Ficha do livro:** ao clicar num livro no perfil de alguém abre-se a ficha com a capa, o autor, as páginas, a avaliação e a **Introdução Geral** que a pessoa escreveu (e, se existir, a nota de recomendação). Daí pode-se adicionar a «Quero ler».
- **Nível e experiência:** cada livro terminado dá 1 XP por página (uma só vez por livro). O nível é infinito e vê-se no perfil de qualquer pessoa, mesmo antes de ela te aceitar. O XP viaja no campo `privacy` do perfil (`privacy.xp`), por isso não é preciso alterar a base de dados.
- **Rankings:** tempo de leitura, páginas, livros, ritmo e sequência, com top 3 e classificação, por semana, mês e total, entre ti e quem segues (e partilha estatísticas).
- **«Quero ler» a partir de um amigo:** leva a capa dele para a tua prateleira e pede os campos obrigatórios que faltem.

## O que vai para o servidor
Só o que a pessoa liga em Privacidade:
nome a mostrar, uma miniatura da foto de perfil (128 px), a descrição, listas de livros (título, autor, nota de recomendação, cor,
e, se «Notas e avaliações dos livros» estiver ligado, a avaliação em estrelas e a Introdução Geral do livro), miniaturas das capas (tabela `covers`),
ids das conquistas, as últimas 60 atividades (livro, minutos, páginas, quando, conquistas) e totais de estatísticas (também por semana e mês).
**Nunca saem do computador:** fotos das lombadas, notas das sessões, fotos das sessões, metas, e secções desligadas.
Ao desligar uma secção, ela é **apagada** do servidor; as miniaturas das capas que deixam de ser partilhadas também.
**Estatísticas:** livros lidos na totalidade contam as páginas (o tempo só conta quando há sessões).

## Como a app sincroniza
- Envia o teu perfil 2 a 3 segundos depois de uma alteração (e verifica de 20 em 20 segundos).
- Recebe pedidos, amigos e partilhas de 45 em 45 segundos, ou ao carregar em **Sincronizar agora**.
- Sem internet, a app continua a funcionar e sincroniza quando a ligação voltar.

## Segurança
- Contas geridas pelo Supabase Auth; palavras-passe nunca ficam no código nem em texto simples.
- As regras (Row Level Security) estão em `docs/supabase-schema.sql`: nenhuma pessoa lê dados de outra sem relação aprovada;
  o ID nunca pode ser alterado; os pedidos só se criam por funções do servidor, com limite de 30 por hora.
- A chave no `config.js` é pública por desenho. A *secret key* nunca entra no programa.
- Código de convite opcional para impedir contas de desconhecidos.

## Limitações atuais (ideias para o futuro)
- Sem recuperação de palavra-passe (não há e-mail). Possível: e-mail opcional ou código de recuperação.
- Sem bloquear/denunciar utilizadores (só «Remover» e «Deixar de seguir»).
- As capas dos livros dos amigos são geradas (cor + título); sincronizar capas reais exige armazenamento de ficheiros.
- Notificações só dentro da app (avisos quando alguém pede para seguir ou aceita).
- Plano gratuito do Supabase: 500 MB de base de dados e pausa após uma semana sem uso. Para uso contínuo, o plano Pro resolve.

## Cópia dos dados na nuvem
Os dados de cada pessoa (livros, leituras, estantes, imagens) não passam pelo servidor dos amigos: ficam no Google Drive dela. Ver `docs/NUVEM-GOOGLE-DRIVE.md`. O servidor guarda apenas, para a ligação ao Google noutro computador, um texto cifrado no computador da pessoa (tabela `vault`).

## Introdução Geral, notas e fotografias das leituras (1.8)
- O que a pessoa escreve na **Introdução Geral** de um livro viaja completo (até 20 000 caracteres): um excerto de 500 caracteres no perfil e o texto inteiro na tabela `covers` (chave `i-<livro>`), que o leitor descarrega ao abrir a ficha do livro.
- A **atividade** pode incluir a nota escrita numa leitura (até 1 500 caracteres) e uma fotografia reduzida (chave `p-<leitura>`, até 420 px). Opção **Notas e fotos das leituras na atividade** em Amigos > Privacidade (ligada por defeito; só funciona com «Atividade de leitura» ligada). Ao desligar, as notas deixam de ir e as miniaturas são apagadas do servidor.
