# Pôr o ReadFlow a funcionar hoje, com amigos reais e atualizações automáticas

Tempo estimado: **45 a 60 minutos** (grande parte é esperar que o GitHub crie o instalador).
Custo: **0 €** (GitHub e Supabase têm planos gratuitos suficientes para um grupo de amigos).

O que vais criar:
- **GitHub** guarda o código e entrega o instalador e as atualizações.
- **Supabase** é o servidor dos amigos (contas, pedidos de seguir, o que cada um partilha).

---

## PARTE 1: Supabase, o servidor dos amigos (15 min)

1. Vai a **supabase.com** e carrega em **Start your project**. Entra com a tua conta do GitHub (cria uma se não tiveres).
2. **New project**. Nome: `readflow`. Escolhe uma palavra-passe forte para a base de dados e **guarda-a**.
   Em **Region** escolhe uma da **Europa** (por exemplo Frankfurt ou Paris). Plano: **Free**. Espera 1 a 2 minutos.
3. No menu da esquerda abre **SQL Editor** > **New query**. Abre o ficheiro `docs\supabase-schema.sql`, copia **tudo**,
   cola no editor e carrega em **Run**. Deve aparecer *Success*. (Se já correste uma versão antiga, voltar a correr é seguro.)
4. **Para só os teus amigos criarem conta (recomendado):** numa nova query, corre isto (troca o código):
   `insert into public.app_config (key, value) values ('invite_code', 'O-TEU-CODIGO') on conflict (key) do update set value = excluded.value;`
   Depois dá esse código aos teus amigos em privado.
5. Menu **Authentication** > **Sign In / Providers** > **Email**: **desliga "Confirm email"** e guarda.
   (O ReadFlow não pede e-mail. Se esta opção ficar ligada, ninguém consegue criar conta.)
6. Abre **Project Settings** > **API Keys** (ou o botão **Connect**). Copia:
   - o **Project URL** (algo como `https://abcdxyz.supabase.co`);
   - a **Publishable key** (começa por `sb_publishable_`). Se só vires "anon public", pode ser essa.
   **Nunca** copies a *secret key* nem a *service_role*.
7. Abre o ficheiro `app\js\config.js` (Bloco de Notas) e cola os dois valores entre as aspas de
   `supabaseUrl` e `supabaseKey`. Guarda.

> A chave pública pode ir no programa: quem protege os dados são as regras do servidor (o ficheiro SQL que correste).

## PARTE 2: GitHub, o código e as atualizações (20 min)

1. Cria conta em **github.com** (se ainda não tens).
2. Instala o **GitHub Desktop** (desktop.github.com) e entra com a tua conta.
3. Em `package.json`, na secção `"publish"`, troca `SEU-UTILIZADOR-GITHUB` pelo **teu nome de utilizador do GitHub**
   (o nome do repositório fica `readflow`). Guarda.
4. No GitHub Desktop: **File > Add local repository** e escolhe a pasta do ReadFlow (a que tem o `package.json`).
   Se disser que não é um repositório, carrega em **create a repository**. Nome: `readflow`.
5. Escreve uma mensagem (por exemplo "Primeira versão"), carrega em **Commit to main** e depois em **Publish repository**.
   **Desmarca** "Keep this code private": o repositório tem de ser **público** (é o que permite as atualizações automáticas).
6. No site do GitHub, abre o repositório: **Settings > Actions > General > Workflow permissions**
   e escolhe **Read and write permissions**. Guarda.

## PARTE 3: publicar a primeira versão (10 min + espera)

1. No site do repositório, abre **Releases** > **Create a new release**.
2. Em **Choose a tag** escreve `v1.3.0` e escolhe **Create new tag**. Título: `ReadFlow 1.3.0`. Carrega em **Publish release**.
3. Abre o separador **Actions**: aparece "Publicar versão" a correr. Demora cerca de **8 a 15 minutos**.
   Quando ficar verde, abre **Releases**: o ficheiro **ReadFlow Setup 1.3.0.exe** está lá.
   (Se ficar vermelho, abre-o, copia a mensagem de erro e envia-ma.)
4. Envia aos amigos o link da página **Releases** do teu repositório. Eles descarregam e instalam.

**Aviso do Windows:** como o instalador não está assinado digitalmente, o Windows mostra
"O Windows protegeu o seu PC". Basta carregar em **Mais informações** e depois em **Executar mesmo assim**.
Diz isto aos teus amigos antes. Para o aviso desaparecer é preciso um certificado de assinatura
(pago) ou publicar na Microsoft Store; ver `ATUALIZACOES.md`.

## PARTE 4: teste com os amigos (10 min)

1. Cada pessoa instala, abre o ReadFlow e vai a **Amigos**. Carrega em **Testar ligação**: deve dizer *Ligação ao servidor OK*.
2. **Criar conta**: nome de utilizador, palavra-passe (mínimo 8) e o código de convite. Cada um recebe um ID tipo `nome#123456`.
3. Trocam os IDs e usam **Seguir alguém**. A outra pessoa vê o pedido em **Amigos** e carrega em **Aceitar**.
4. Verifiquem: o perfil abre ao clicar no nome; o progresso e as atividades aparecem no **Início**;
   em **Privacidade** desliguem uma secção e confirmem que o outro deixa de a ver (pode demorar até 1 minuto; há o botão **Sincronizar agora**).

## Como saem as atualizações (sempre que quiseres)
1. Muda `"version"` em `package.json` (por exemplo `1.3.1`) e faz *Commit* + *Push* no GitHub Desktop.
2. Em **Releases > Create a new release**, cria a etiqueta `v1.3.1` e publica.
3. Em poucos minutos o GitHub cria o instalador. Os programas instalados descarregam a novidade sozinhos
   (ao abrir e de 6 em 6 horas) e perguntam "Reiniciar agora / Mais tarde". Os dados ficam guardados.
   Só a versão **instalada** se atualiza, não a versão portátil.

---

## Problemas comuns
| Sintoma | O que fazer |
|---|---|
| "A ligação online ainda não está configurada" | `app\js\config.js` ainda está vazio (Parte 1, passo 7) e é preciso fazer uma nova versão. |
| Testar ligação: "chave ou URL inválidos" | Confere o URL e a chave; sem espaços nem aspas a mais. |
| Testar ligação: "confirmação por e-mail ligada" | Parte 1, passo 5. |
| "Código de convite inválido" | O código tem de ser igual ao do passo 4 (maiúsculas contam). |
| Ao criar conta: erro genérico | Confirma que o SQL (passo 3) correu sem erros. |
| Os amigos deixaram de aparecer após dias sem uso | No plano gratuito o Supabase **pausa** projetos inativos 1 semana: abre o painel do Supabase e carrega em **Restore**. |
| Actions fica vermelho | Abre o erro, copia o texto e envia-me. |

## O que não esquecer
- **Guarda a palavra-passe da base de dados** e **nunca partilhes** a *secret key*.
- **Privacidade (RGPD):** és tu quem gere esta base de dados. Avisa os amigos do que é partilhado
  (só o que cada um liga em Privacidade; as fotos dos livros e as notas nunca saem do computador) e
  que podem apagar a conta online a qualquer momento (Amigos > Apagar conta online).
- **Palavra-passe perdida = conta perdida:** não há recuperação por e-mail nesta versão.
