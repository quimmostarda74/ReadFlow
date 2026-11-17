
# Cópia na nuvem com o Google Drive: como funciona

ReadFlow 1.7 · guia para quem administra a app e para quem a usa

## Em resumo

Cada pessoa liga o ReadFlow ao seu próprio Google Drive. Tudo o que regista (livros, leituras, estantes, conquistas, definições e imagens) é guardado numa pasta privada e escondida desse Drive. Ao entrar na conta do ReadFlow noutro computador, tudo reaparece sozinho. O Supabase continua a servir só os amigos (contas, pedidos, perfis, rankings), por isso o espaço da cópia sai do Google Drive de cada pessoa.

## O que muda para quem usa

1. Em **Perfil > Cópia na nuvem (Google Drive)** carrega em **Ligar ao Google Drive**.
2. Abre-se o browser: escolhe a conta Google e autoriza. O ReadFlow só pede acesso à sua própria pasta privada no Drive e não consegue ver os outros ficheiros.
3. De volta ao ReadFlow, confirma a palavra-passe do ReadFlow (serve para proteger a ligação ao Google quando é transferida para outro computador, ver abaixo) e pronto: tudo é enviado.
4. A partir daí, cada alteração é guardada automaticamente poucos segundos depois, e o programa verifica novidades de minuto a minuto e quando volta a ficar em foco.
5. **Noutro computador:** instala o ReadFlow, entra na conta (Amigos > Entrar) e os dados podem ser recuperados através do cofre, sem repetir a autorização Google, desde que o cofre esteja configurado e a palavra-passe seja a mesma.

Botões do cartão: **Sincronizar agora**, **Desligar** (deixa de sincronizar, os dados ficam) e **Apagar cópia na nuvem** (apaga a pasta no Drive, não apaga os dados do computador).

## Como funciona por dentro

**Três ligações independentes**
- Conta do ReadFlow (Supabase): identifica a pessoa e trata dos amigos.
- Conta Google: só guarda e devolve os ficheiros da cópia.
- Cofre: um texto cifrado, guardado no Supabase, que permite recuperar a ligação ao Google noutro computador depois de entrar no ReadFlow.

**O que fica no Google Drive** (na pasta privada da app, acessível através do âmbito `drive.appdata`):
- `readflow-data.json`: livros, leituras, estantes, conquistas desbloqueadas, definições partilháveis e o registo do que foi apagado.
- `img-<id>`: uma por imagem (capas, lombadas, fotos das leituras, foto de perfil, fundo da parede). Cada imagem é enviada uma só vez.

**Quando sincroniza:** ao ligar, ao entrar na conta, alguns segundos depois de cada alteração, de minuto a minuto (para verificar se o ficheiro mudou), quando a janela volta a ficar em foco e quando carregas em Sincronizar agora.

**Como junta alterações de vários computadores:**
- Cada livro, leitura e estante tem um carimbo com a hora da última alteração. Se o mesmo registo mudou nos dois lados, **ganha o mais recente**.
- Quem só existe de um lado é mantido (nada se perde por estar apenas num computador).
- Quando apagas algo, fica um registo do apagamento. Assim, um computador antigo não traz de volta o que apagaste, a não ser que alguém altere esse registo depois de o teres apagado.
- Conquistas: juntam-se (fica a data mais antiga). XP e visuais já vistos: juntam-se (fica o maior valor).
- Definições: ganha o conjunto alterado mais recentemente.
- Se dois computadores gravam ao mesmo tempo, o ReadFlow volta a juntar as alterações antes de gravar.
- As imagens vão antes do ficheiro principal, para nunca haver referências a imagens que ainda não chegaram.

**Primeira vez num computador:** se o computador já tinha dados e a conta tem cópia (ou os dados eram de outra conta), o ReadFlow pergunta: **Juntar os dois** (recomendado), **Usar só os da nuvem** ou **Agora não**.

**Não vai para a nuvem:** o nome de utilizador e número do ReadFlow, a versão vista por último e o estado de cada computador.

## Privacidade e segurança

- **Âmbito mínimo.** O acesso pedido à Google é `drive.appdata`, destinado à pasta privada da aplicação. O ReadFlow não pede acesso geral aos ficheiros do Drive.
- **Nada passa pelo Supabase como cópia de dados.** Os dados da cópia vão diretamente do computador para o Google Drive. O Supabase recebe os dados da conta e do perfil que já são usados pela funcionalidade de amigos, além do cofre cifrado quando este está ativo.
- **Notas privadas continuam privadas.** As notas das leituras e as fotos da cópia só são enviadas para o Drive da própria pessoa; não são publicadas no perfil dos amigos por este mecanismo.
- **Ligação ao Google no computador.** Os tokens ficam guardados localmente através do `safeStorage` do Electron, que usa os mecanismos de proteção de credenciais do sistema operativo. A disponibilidade depende da configuração do sistema.
- **Cofre.** Para entrar noutro computador sem repetir a autorização Google, a ligação é cifrada no computador (AES-256-GCM, com chave derivada da palavra-passe do ReadFlow através de PBKDF2-SHA256, 200 000 iterações) antes de ser enviada para o Supabase. Quem administra o Supabase não consegue ler o conteúdo sem a palavra-passe. Sem recuperação de palavra-passe, perder a palavra-passe significa voltar a ligar o Google.
- **Autorização segura.** A aplicação usa OAuth 2.0 com PKCE e um endereço local temporário (`127.0.0.1`) para receber a resposta da Google. O cliente OAuth deve ser do tipo **Aplicação para computador**. Aplicações Desktop são clientes públicos: não conseguem manter um segredo confidencial. O ReadFlow usa apenas o ID do cliente e não guarda nem necessita do `client_secret`.
- Se a pessoa retirar o acesso em `myaccount.google.com/permissions`, o ReadFlow poderá deixar de conseguir sincronizar e pedir que ligue novamente.

## Configuração (uma vez, por quem publica a app)

**Parte A: Google Cloud**

1. Entra em `console.cloud.google.com` e cria ou seleciona o projeto ReadFlow.
2. **APIs e serviços > Biblioteca**: procura **Google Drive API** e carrega em **Ativar**.
3. Configura o ecrã de consentimento OAuth / Google Auth Platform, incluindo o nome da app ReadFlow e o contacto.
4. Configura o público da aplicação e os âmbitos necessários, incluindo `.../auth/drive.appdata`. Segue os requisitos de publicação e verificação apresentados pela Google para o projeto e os âmbitos utilizados.
5. **Clientes > Criar cliente**: escolhe o tipo **Aplicação para computador**.
6. Copia o **ID do cliente**. Não precisas de copiar, guardar ou publicar o segredo do cliente.

**Parte B: `config-google.js`**

Abre `app/js/config-google.js` e configura apenas o ID do cliente. O ficheiro deve ter esta forma:

```javascript
/* ReadFlow — configuração pública Google Drive.
   Aplicação Desktop: OAuth 2.0 com PKCE.
   Não colocar client_secret neste ficheiro. */

(function (root) {
  'use strict';

  root.RF = root.RF || {};
  root.RF.config = root.RF.config || {};

  Object.assign(root.RF.config, {
    googleClientId: 'O_TEU_ID_DE_CLIENTE.apps.googleusercontent.com'
  });

})(typeof window !== 'undefined' ? window : globalThis);
```

O ID do cliente é identificador público da aplicação. Não coloques neste ficheiro palavras-passe, tokens ou segredos.

**Parte C: Supabase (opcional)**

No SQL Editor corre `docs/supabase-update-1.7.0.sql`. Esta alteração cria o suporte para o cofre. Se não o fizeres, a cópia no Google Drive continua a funcionar, mas poderá ser necessário ligar o Google separadamente em cada computador.

**Parte D: publicar**

Copia os ficheiros atualizados para o projeto, atualiza a versão em `package.json`, faz Commit e Push e cria a release correspondente. Antes de publicar, executa os testes do projeto e confirma que nenhum segredo OAuth antigo permanece no código ou no histórico Git.

## Limites e cuidados

- **Mesmo livro nos dois computadores ao mesmo tempo:** fica a versão mais recente desse livro; a outra edição pode ser substituída. Para evitar conflitos, deixa sincronizar antes de mudar de computador.
- **Relógios:** a fusão usa a hora de cada computador; convém tê-los certos.
- **Sem internet:** a app continua a funcionar e sincroniza quando a rede volta.
- **Apagar tudo** (Perfil > Dados) com a nuvem ligada pode apagar também a cópia e afetar os outros computadores.
- **Importar** uma cópia de segurança substitui os dados do computador e junta-os à cópia na nuvem.
- **Imagens sem uso** há mais de 2 dias são retiradas do Drive.
- **Espaço:** conta para os 15 GB gratuitos do Google de cada pessoa. A pasta da app costuma ocupar poucos megabytes.
- **Só na versão instalada.** No browser, o cartão mostra que a funcionalidade não está disponível.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| «O Google ainda não está configurado» | Confirmar se `googleClientId` está preenchido em `config-google.js` e se o cliente OAuth é do tipo Aplicação para computador. |
| «A API do Google Drive não está ativada» | Ativar a Google Drive API no projeto Google Cloud. Esperar um pouco e tentar de novo. |
| Erro ao autorizar a conta | Confirmar que o cliente OAuth é do tipo Aplicação para computador e que a autorização está a ser feita no browser do sistema. |
| A ligação deixa de funcionar | Verificar se o acesso do ReadFlow continua autorizado na conta Google e voltar a ligar se necessário. |
| «O Google não deu a ligação permanente» | Verificar as permissões da aplicação na conta Google e tentar autorizar novamente. |
| Noutro computador pede para ligar o Google | Confirmar se o cofre está ativo (Parte C) e se foi usada a mesma palavra-passe do ReadFlow. |
| Aparece a pergunta «Dados neste computador» | O computador tinha dados que não eram desta conta: escolhe Juntar, Usar só os da nuvem ou Agora não. |

## O que foi testado

Os testes automatizados podem verificar a fusão entre computadores, as imagens, os erros, o cofre cifrado e os ecrãs com serviços simulados. Isso não substitui um teste com uma conta Google real. A primeira ligação real, a renovação dos tokens e a sincronização entre dois computadores devem ser confirmadas antes de considerar a publicação concluída.
