/* Ponte temporária (issue #8): core.js e db.js já são ES modules, mas o app.js ainda é um script
   clássico que usa os nomes deles como globais. Esta ponte publica no window o mesmo que
   estava global antes. Sai na issue #9, quando o app.js vira módulo e importa direto.

   Ordem no index.html: este módulo vem antes do app.js, que é `defer`. Módulos e scripts `defer`
   rodam na ordem do documento, depois da leitura do HTML, então o app.js só começa com tudo publicado.
   O ?v=N dos imports sobe junto com a versão do app (sem ele o service worker serviria o módulo
   antigo do cache). */

import * as core from './core.js?v=75';
import * as db from './db.js?v=75';

Object.assign(window, core, db);
