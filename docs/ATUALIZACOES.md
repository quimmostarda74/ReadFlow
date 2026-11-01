# Atualizações automáticas com o GitHub

## Como vai funcionar
1. Guardas o código do ReadFlow num repositório do GitHub.
2. Quando há uma versão nova, crias uma **etiqueta** (por exemplo `v1.2.1`).
3. O GitHub Actions (`.github/workflows/publicar.yml`) corre os testes, cria o instalador do Windows
   e publica-o nas **Releases** do repositório.
4. A app instalada, de 6 em 6 horas e sempre que abre, pergunta ao GitHub se há uma versão mais nova.
   Se houver, **descarrega-a sozinha** e mostra «Reiniciar agora / Mais tarde». Os dados do utilizador
   (livros, fotos, sessões) ficam intactos, porque vivem no perfil local da app.
5. Em Perfil > Atualizações, o utilizador vê a versão e pode procurar atualizações à mão.

O código já está preparado (`main.js`, `preload.js`, `electron-updater`, os dois fluxos de trabalho).
Faltam os passos que só tu podes fazer, com a tua conta.

## Passos (uma só vez)
1. **Criar a conta e o repositório:** em github.com cria o repositório `readflow`.
   Para as atualizações automáticas funcionarem sem configuração extra, o repositório (ou um
   repositório só de lançamentos) tem de ser **público**. Num repositório privado, cada
   computador precisaria de uma chave de acesso, o que não é boa ideia.
2. **Pôr o teu nome de utilizador no projeto:** em `package.json`, em `build.publish`, troca
   `SEU-UTILIZADOR-GITHUB` pelo teu utilizador do GitHub (e `readflow` pelo nome do repositório).
3. **Enviar o código:** na pasta do projeto,
   `git init`, `git add .`, `git commit -m "Primeira versão"`, `git branch -M main`,
   `git remote add origin https://github.com/SEU-UTILIZADOR/readflow.git`, `git push -u origin main`.
4. **Permissão do fluxo de trabalho:** no GitHub, Settings > Actions > General > Workflow permissions:
   escolhe **Read and write permissions**.

## Para cada versão nova
1. Muda `"version"` em `package.json` (por exemplo `1.2.1`) e faz commit.
2. Cria e envia a etiqueta: `git tag v1.2.1` e `git push origin v1.2.1`.
3. Espera uns minutos: em Actions vês o progresso; em Releases aparece o instalador.
4. Quem já tem a app instalada recebe a versão sozinho.

## Cuidados
- **Só o instalador atualiza.** A versão «portátil» (`ReadFlow x.y.z.exe`) não se atualiza sozinha.
- **Aviso do Windows (SmartScreen):** sem assinatura digital, o Windows mostra «O Windows protegeu o seu PC» em cada
  instalador novo; basta **Mais informações > Executar mesmo assim**. Opções para o evitar:
  1. **Microsoft Store:** as apps instaladas pela Store não mostram o aviso (exige registo de programador e preparar o pacote).
  2. **Certificado de assinatura comercial** (de uma autoridade como Certum, Sectigo ou DigiCert). Tem custo anual, e mesmo
     assim a reputação do Windows demora a construir-se.
  3. **Azure Artifact Signing** (serviço da Microsoft): para pessoas individuais só está disponível nos EUA e Canadá;
     para empresas, também na UE e no Reino Unido.
  Para um grupo de amigos, o mais simples é avisar que o aviso é esperado.
- **Nunca** guardes palavras-passe ou chaves dentro do código. O `GITHUB_TOKEN` do fluxo é criado
  automaticamente pelo GitHub.
- **Testes antes de publicar:** o fluxo `Testes` corre em cada envio. Se falhar, não publiques.

## Ideias para mais tarde
- **Catálogo de recomendações atualizável:** a lista «Em alta» (`app/js/catalog.js`) pode passar para
  um ficheiro no repositório que a app descarrega, para atualizar as sugestões sem nova versão.
- **Sistema de amigos a sério:** o servidor é outra peça (ver `SISTEMA-DE-AMIGOS.md`); o GitHub só entrega
  as versões da app, não guarda os dados das pessoas.
