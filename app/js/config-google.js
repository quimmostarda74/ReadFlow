/* ReadFlow: ligação ao Google Drive (cópia na nuvem). Ficheiro à parte, para não mexer no config.js do Supabase.
   Preenche os dois valores depois de criares o projeto no Google Cloud (ver docs/NUVEM-GOOGLE-DRIVE.md):
     - googleClientId:     o «ID do cliente» (termina em .apps.googleusercontent.com)
     - googleClientSecret: o «Segredo do cliente» (começa por GOCSPX-)
   Para uma app de computador, o Google considera estes dois valores públicos: o acesso aos dados de cada pessoa
   exige sempre a autorização dela. Se ficarem vazios, a cópia na nuvem fica desligada e o resto da app funciona igual. */
(function (root) {
  'use strict';
  root.RF = root.RF || {};
  root.RF.config = root.RF.config || {};
  Object.assign(root.RF.config, {
    googleClientId: '',
    googleClientSecret: ''
  });
})(typeof window !== 'undefined' ? window : globalThis);
