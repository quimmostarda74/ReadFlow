/* ReadFlow: ligação online (sistema de amigos).
   Cola aqui os dois valores do teu projeto Supabase (Project Settings > API Keys):
     - supabaseUrl: o "Project URL", por exemplo https://abcdxyz.supabase.co
     - supabaseKey: a chave PÚBLICA "Publishable key" (começa por sb_publishable_ ou, na chave antiga, "anon").
   NUNCA coloques aqui a "secret key" nem a "service_role": essas dão acesso total aos dados.
   A chave pública pode ir no programa: quem protege os dados são as regras do servidor (docs/supabase-schema.sql). */
(function (root) {
  'use strict';
  root.RF = root.RF || {};
  root.RF.config = {
    supabaseUrl: 'https://nrtwzeipsxvigacggcov.supabase.co',
    supabaseKey: 'sb_publishable_WZ-r4quimhtwf6_So_URQA_sJIE8OcF',
    emailDomain: 'readflow.app'   // só serve para construir um "e-mail" interno; não é enviado nenhum e-mail
  };
})(typeof window !== 'undefined' ? window : globalThis);
