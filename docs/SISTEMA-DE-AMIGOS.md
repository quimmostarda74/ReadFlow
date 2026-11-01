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

## O que vai para o servidor
Só o que a pessoa liga em Privacidade:
nome a mostrar, uma miniatura da foto de perfil (128 px), a descrição, listas de livros (título, autor, nota de recomendação, cor),
ids das conquistas, as últimas 60 atividades (livro, minutos, páginas, quando, conquistas) e totais de estatísticas.
**Nunca saem do computador:** fotos de capas e lombadas, notas das sessões, fotos das sessões, metas, e secções desligadas.
Ao desligar uma secção, ela é **apagada** do servidor.

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
