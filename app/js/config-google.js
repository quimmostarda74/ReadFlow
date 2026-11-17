
/* ReadFlow — configuração pública Google Drive.
   Aplicação Desktop: OAuth 2.0 com PKCE.
   Não colocar client_secret neste ficheiro. */

(function (root) {
  'use strict';

  root.RF = root.RF || {};
  root.RF.config = root.RF.config || {};

  Object.assign(root.RF.config, {
    googleClientId: '939932875138-h4jsneuqfh9cqp1d8fqf3ob1uaqu5jmu.apps.googleusercontent.com'
  });

})(typeof window !== 'undefined' ? window : globalThis);
