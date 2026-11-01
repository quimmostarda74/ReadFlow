# ReadFlow 1.3 para Windows

O Strava da leitura, como programa para o computador: sessões com cronómetro, estante, estatísticas,
conquistas, recomendações e **amigos reais** (com contas, pedidos de seguir e privacidade por secção).

## Para pôr tudo a funcionar (amigos + atualizações automáticas)
Segue **`docs\PASSO-A-PASSO.md`** (45 a 60 minutos, custo 0 €): criar o servidor (Supabase), colar 2 valores em
`app\js\config.js`, publicar no GitHub e criar a primeira versão. Os amigos instalam o `ReadFlow Setup x.y.z.exe`
da página Releases e recebem as atualizações sozinhos.

## Experimentar no teu computador
- **Sem instalar nada:** abre `app\index.html` no Chrome ou no Edge (os amigos precisam do servidor configurado).
- **Como programa:** instala o Node.js (LTS) e faz duplo clique em **Iniciar ReadFlow.bat**.
- **Instalador:** duplo clique em **Criar instalador.bat** (pasta `dist`).

## Novidades da 1.3
- Fim dos amigos de demonstração: contas reais, ID `nome#123456`, pedidos de seguir com aprovação.
- A privacidade é aplicada no servidor: só o que ligas, só para quem aceitas. Desligar uma secção apaga-a do servidor.
- Atividade e recomendações dos amigos (Início e Recomendados); clicar num nome abre o perfil.
- **Testar ligação** (Amigos) diz exatamente o que está mal configurado.
- Código de convite opcional para só os teus amigos criarem conta.
- Atualizações automáticas via GitHub (Perfil > Atualizações).

## Documentação
- `docs\PASSO-A-PASSO.md`: o que fazer hoje, com problemas comuns.
- `docs\SISTEMA-DE-AMIGOS.md`: como funciona, o que é partilhado, segurança e limites.
- `docs\ATUALIZACOES.md`: como saem as versões e o aviso do Windows (SmartScreen).
- `docs\supabase-schema.sql`: o esquema e as regras de privacidade do servidor.

## Para quem desenvolve
`npm test` corre os testes (todos os ecrãs, 4 temas, 4 idiomas, registo manual, e o sistema de amigos contra um
servidor simulado). O fluxo `.github\workflows\testes.yml` corre-os em cada envio ao GitHub.
