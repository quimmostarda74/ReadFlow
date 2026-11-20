# Cópia na nuvem com o Google Drive: como funciona

ReadFlow 1.7 · guia para quem administra a app (tu) e para quem a usa

## Em resumo

Cada pessoa liga o ReadFlow ao seu próprio Google Drive. Tudo o que regista (livros, leituras, estantes, conquistas, definições e imagens) é guardado numa pasta privada e escondida desse Drive. Ao entrar na conta do ReadFlow noutro computador, tudo reaparece sozinho. O Supabase continua a servir só os amigos (contas, pedidos, perfis, rankings), por isso o plano gratuito chega, e o espaço de cada pessoa sai do Google Drive dela.

## O que muda para quem usa

1. Em **Perfil > Cópia na nuvem (Google Drive)** carrega em **Ligar ao Google Drive**.
2. Abre-se o browser: escolhe a conta Google e autoriza. O ReadFlow só pede acesso à **sua própria pasta privada** no Drive e nunca vê os outros ficheiros.
3. De volta ao ReadFlow, confirma a palavra-passe do ReadFlow (serve para guardar a ligação ao Google de forma cifrada, ver abaixo) e pronto: tudo é enviado.
4. A partir daí, cada alteração é guardada sozinha poucos segundos depois, e o programa verifica novidades de minuto a minuto e quando volta a ser aberto.
5. **Noutro computador:** instala o ReadFlow, entra na conta (Amigos > Entrar) e os dados aparecem, com as capas. Não é preciso ligar o Google outra vez.

Botões do cartão: **Sincronizar agora**, **Desligar** (deixa de sincronizar, os dados ficam) e **Apagar cópia na nuvem** (apaga a pasta no Drive, não apaga os dados do computador).

## Como funciona por dentro

**Três ligações independentes**
- Conta do ReadFlow (Supabase): identifica a pessoa e trata dos amigos.
- Conta Google: só guarda e devolve os ficheiros da cópia.
- Cofre: um texto cifrado, guardado no Supabase, que permite abrir a ligação ao Google noutro computador depois de entrar no ReadFlow.

**O que fica no Google Drive** (pasta escondida da app, que o utilizador não vê no Drive e que só o ReadFlow consegue abrir):
- `readflow-data.json`: livros, leituras, estantes, conquistas desbloqueadas, definições partilháveis e o registo do que foi apagado.
- `img-<id>`: uma por imagem (capas, lombadas, fotos das leituras, foto de perfil, fundo da parede). Cada imagem é enviada uma só vez.

**Quando sincroniza:** ao ligar, ao entrar na conta, uns 8 segundos depois de cada alteração, de minuto a minuto (só verifica se o ficheiro mudou), quando a janela volta a ficar em foco e quando carregas em Sincronizar agora.

**Como junta alterações de vários computadores:**
- Cada livro, leitura e estante tem um carimbo com a hora da última alteração. Se o mesmo registo mudou nos dois lados, **ganha o mais recente**.
- Quem só existe de um lado é mantido (nada se perde por estar apenas num computador).
- Quando apagas algo, fica um registo do apagamento. Assim, um computador antigo não traz de volta o que apagaste, a não ser que alguém altere esse registo **depois** de o teres apagado.
- Conquistas: juntam-se (fica a data mais antiga). XP e visuais já vistos: juntam-se (fica o maior valor).
- Definições: ganha o conjunto alterado mais recentemente.
- Se dois computadores gravam ao mesmo tempo, o ReadFlow repara, junta outra vez e só depois grava.
- As imagens vão antes do ficheiro principal, para nunca haver referências a imagens que ainda não chegaram.

**Primeira vez num computador:** se o computador já tinha dados e a conta tem cópia (ou os dados eram de outra conta), o ReadFlow pergunta: **Juntar os dois** (recomendado), **Usar só os da nuvem** ou **Agora não**.

**Não vai para a nuvem:** o nome de utilizador e número do ReadFlow, a versão vista por último e o estado de cada computador.

## Privacidade e segurança

- **Âmbito mínimo.** O acesso pedido à Google é `drive.appdata`, a pasta privada da app. A Google classifica-o como não sensível e o ReadFlow não consegue ver mais nada do Drive.
- **Nada passa pelo Supabase.** Os dados da cópia vão direitos do computador para o Google Drive. O Supabase só recebe o que já recebia (perfil público e o que cada um liga em Privacidade) e o cofre.
- **Notas privadas continuam privadas.** As notas das leituras e as fotos só existem no computador e no Drive da própria pessoa.
- **Ligação ao Google no computador.** Fica guardada cifrada pelo Windows (DPAPI), uma por conta do ReadFlow.
- **Cofre.** Para entrar noutro computador sem repetir o passo do Google, a ligação é cifrada no computador (AES-256-GCM, chave derivada da palavra-passe do ReadFlow com PBKDF2, 200 000 iterações) antes de ir para o Supabase. Quem administra o Supabase **não consegue ler**; só abre com a palavra-passe da pessoa. Sem recuperação de palavra-passe, perder a palavra-passe significa voltar a ligar o Google.
- **Autorização segura.** Usa PKCE e um endereço local temporário (127.0.0.1) que só serve para receber a resposta da Google.
- **O segredo do cliente do Google não está no programa (desde a 1.10).** Fica na função `google-token` do teu Supabase (Parte E). O programa só tem o **ID do cliente**, que é público por natureza (aparece no endereço de autorização que o browser abre). A função só atende utilizadores do ReadFlow com sessão válida, só troca códigos e renova acessos, só aceita o endereço local da app como destino, limita 30 pedidos por minuto por pessoa e não regista tokens. Em contrapartida, os códigos e tokens passam pela tua função (tu controlas o código e o Supabase). Quem tinha o segredo antigo nunca conseguiu, só com ele, aceder aos dados de ninguém sem a autorização dessa pessoa; o risco era alguém fazer-se passar pela app, e é esse que a Parte E fecha.
- Se a pessoa retirar o acesso em myaccount.google.com/permissions, o ReadFlow deteta, apaga o token local e pede para ligar de novo.

## Configuração (uma vez, por ti)

**Parte A: Google Cloud (15 minutos, gratuito)**
1. Entra em console.cloud.google.com com a tua conta Google e cria um projeto chamado ReadFlow.
2. **APIs e serviços > Biblioteca**: procura **Google Drive API** e carrega em **Ativar**.
3. **Ecrã de consentimento OAuth** (ou **Google Auth Platform**): tipo de utilizador **Externo**, nome da app **ReadFlow**, o teu e-mail como contacto. Em **Âmbitos** (Data Access) adiciona `.../auth/drive.appdata`.
4. **Publicar a aplicação** (Audience > Publish app, estado **Em produção**). Isto é importante: em modo de teste a Google faz expirar a ligação ao fim de 7 dias. Como o âmbito é não sensível, não é exigida a verificação demorada.
5. **Credenciais > Criar credenciais > ID de cliente OAuth** > tipo **Aplicação para computador**. Copia o **ID do cliente** e o **Segredo do cliente**.

**Parte B: config-google.js.** Abre `app\js\config-google.js` e cola o **ID do cliente** entre as aspas. O segredo **não** vai para este ficheiro: deixa `googleClientSecret: ''` e segue a Parte E (a Parte E também diz como o tirar de quem já o tinha). É um ficheiro à parte, por isso o `config.js` do Supabase não é tocado. Nas próximas atualizações este ficheiro não vem no pacote, para não perderes o ID.

**Parte C: Supabase (opcional, 1 minuto).** No SQL Editor corre `docs\supabase-update-1.7.0.sql`. Cria o cofre. Se não o fizeres, tudo funciona, mas o Google tem de ser ligado uma vez em cada computador.

**Parte D: publicar.** Copia os ficheiros do pacote para o projeto, muda em `package.json` só a linha `"version"` para `1.7.0`, faz Commit e Push e cria a release `v1.7.0`.

**Parte E: o segredo do Google no servidor (a partir da 1.10, 15 minutos).**
1. **Google Cloud > Credenciais > o teu cliente OAuth:** carrega em **Adicionar segredo** e copia o **segredo novo**. Deixa o antigo ativo por agora: o segredo antigo esteve no GitHub, por isso vai ser desativado no passo 6.
2. **Supabase > Edge Functions > Deploy a new function > Via Editor.** Nome exatamente `google-token`. Apaga o código de exemplo, cola o conteúdo de `supabase\functions\google-token\index.ts` e carrega em **Deploy**. Se aparecer a opção **Verify JWT** (ou «Enforce JWT»), deixa-a **desligada**: a função verifica a sessão do ReadFlow por dentro.
3. **Supabase > Edge Functions > Secrets:** cria `GOOGLE_CLIENT_ID` (o ID do cliente) e `GOOGLE_CLIENT_SECRET` (o segredo **novo** do passo 1). Não é preciso voltar a fazer deploy.
4. Publica a **1.10.0** (copia o pacote, muda a linha `"version"`, Commit, Push, release) e, em `app\js\config-google.js`, deixa **`googleClientSecret: ''`**. Faz Commit e Push também deste ficheiro.
5. **Testa:** abre a app, Perfil > Cópia na nuvem > **Desligar** e depois **Ligar ao Google Drive**. Se ligar e sincronizar, está a passar pela função.
6. **Passados alguns dias** (quando os amigos já tiverem atualizado, o que as atualizações automáticas fazem ao abrir a app), volta ao Google Cloud e **desativa/apaga o segredo antigo**. Quem ainda estiver numa versão antiga deixa de conseguir ligar até atualizar.

Durante a transição não se perde nada: a 1.10 tenta primeiro a função e, se ela ainda não existir e o segredo continuar no ficheiro, usa o modo antigo. As ligações já feitas continuam a funcionar com o segredo novo.

## Limites e cuidados

- **Mesmo livro nos dois computadores ao mesmo tempo:** fica a versão mais recente desse livro (a outra edição perde-se). Para evitar, deixa sincronizar antes de mudar de computador.
- **Relógios:** a fusão usa a hora de cada computador; convém tê-los certos.
- **Sem internet:** a app continua a funcionar e sincroniza quando a rede volta.
- **Apagar tudo** (Perfil > Dados) com a nuvem ligada apaga também a cópia e os outros computadores.
- **Importar** uma cópia de segurança substitui os dados do computador e junta-os à cópia na nuvem.
- **Imagens sem uso** há mais de 2 dias são retiradas do Drive.
- **Espaço:** conta para os 15 GB gratuitos do Google de cada pessoa. A pasta da app costuma ocupar poucos megabytes.
- **Só na versão instalada.** No browser, o cartão mostra que não está disponível.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| «O Google ainda não está configurado» | Preencher `config-google.js` (Parte B) e publicar uma versão nova. |
| «A API do Google Drive não está ativada» | Parte A, passo 2. Esperar 1 a 2 minutos e tentar de novo. |
| «O ID ou o segredo… não estão certos» | Copiar outra vez o ID e o segredo, sem espaços. |
| A ligação cai ao fim de uma semana | A app ficou em modo de teste: Parte A, passo 4. |
| «O Google não deu a ligação permanente» | Remover o ReadFlow em myaccount.google.com/permissions e ligar de novo. |
| Noutro computador pede para ligar o Google | O cofre não está ativo (Parte C) ou a palavra-passe foi diferente. |
| «A função google-token ainda não está instalada» | Parte E, passo 2 (o nome tem de ser exatamente `google-token`). |
| «Faltam os segredos do Google na função» | Parte E, passo 3 (`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`). |
| «O ID do Google ou o segredo guardado no Supabase não estão certos» | Confirma que o segredo do Supabase é o do mesmo cliente OAuth que o ID da app, sem espaços. |
| «A sessão do ReadFlow expirou» | Sair e entrar outra vez na conta em Amigos. |
| Aparece a pergunta «Dados neste computador» | O computador tinha dados que não eram desta conta: escolhe Juntar, Usar só os da nuvem ou Agora não. |

## O que foi testado

O código real da função `google-token` foi testado com um Supabase e um Google falsos (sessão inválida, endereços de destino maliciosos, limite de pedidos, o segredo nunca devolvido), tal como o modo em que a app a usa e a transição para quem ainda tem o segredo no ficheiro. A fusão entre computadores, as imagens, os erros, o cofre cifrado, o processo de autorização (PKCE e servidor local) e os ecrãs foram testados com um Google e um Supabase simulados, nos quatro idiomas. Não foi possível testar com o Google real a partir daqui: **a primeira ligação a sério é o teste final**. Se algo falhar, copia a mensagem que aparece no cartão da nuvem.
