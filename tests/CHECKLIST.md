# Checklist de cobertura — funcionalidade → testes

Mapa de **cada funcionalidade do app** para os testes que a cobrem. Serve para responder
"isso está testado?" sem precisar ler os testes inteiros.

- Testes de unidade: `node --test tests/` (sem dependências).
- Testes de navegador: `npm run test:e2e` (Playwright, pasta `tests/e2e/`; instalação em `documentation/agents/workflow.md`).
  Coluna **Testes de navegador**: toda linha tem pelo menos um (`tests/checklist.test.js` reprova linha com "—"
  e arquivo citado que não existe). Funcionalidade nova entra com linha e teste de navegador. Treinar e
  Início são **telas críticas**: cada comportamento delas ganha linha e teste próprios.
- Cobertura: `node tools/coverage-gate.js` (o CI exige **100% de linhas e ramos em `js/core.js`**).
  Cobertura de `js/app.js` pelos testes de navegador: `node tools/e2e-coverage.js` depois de `npm run test:e2e`;
  o CI publica o número no resumo do job e reprova se cair em relação à `main` (catraca, `tests/e2e/coverage-baseline.json`).
- Lógica pura fica em `js/core.js` de propósito: é o que dá para testar sem navegador.
- Telas/manipulação de DOM (`js/app.js`) são verificadas estaticamente pelo `check.ps1`
  (ids, handlers, assets, versão, anti-zoom) e, cada vez mais, pelos testes de navegador.

| Funcionalidade | Onde vive | Testes | Testes de navegador |
|---|---|---|---|
| Abrir o app sem erro, as 5 abas e telas internas, nada sai do aparelho, cabe em 375px | `index.html`, `js/app.js` (`navigate`) | — | `smoke.spec.js` |
| Datas (ISO ↔ BR, somar dias, fuso local) | `core.js`: `pad2`, `fmtDate`, `parseDate`, `todayISO`, `addDaysISO`, `fmtBR`, `dateParts`, `fmtDateTimeBR` | `core.test.js` (datas), `core-edge-cases.test.js` (formato vazio) | `treinar.spec.js` (data de hoje no formulário), `historico.spec.js` (datas no detalhe, na evolução e no Calendário), `mais.spec.js` ("Iniciar semana") |
| Semana flexível (janela de 7 dias, metas, aviso) | `core.js`: `defaultSettings`, `weekWindow`, `isValidWorkout` | `core.test.js`, `core-edge-cases.test.js` (`weekWindow` sem argumento) | `inicio.spec.js`, `mais.spec.js` (salvar metas e descanso, "Iniciar semana") |
| Números com vírgula (bug do iPhone) | `core.js`: `parseLocalNumber`, `toNum`, `toNumOrNull`, `formatDecimal` | `core.test.js` (inclui regressão da carga `27,5`) | `treinar.spec.js` (carga `27,5` no Treinar) |
| Busca sem acentos | `core.js`: `normalizeText` | `core.test.js` | `biblioteca.spec.js` (busca sem acentos e sem maiúsculas), `fichas.spec.js` (busca do editor de ficha) |
| Escapar HTML (XSS no que vem do banco) | `core.js`: `esc` | `core.test.js`, `setsSummaryLines` | `fichas.spec.js` (nome com HTML aparece como texto), `dados.spec.js` (backup com código no id) |
| Aquecimento (reps/carga/RIR) | `core.js`: `warmupHasData`, `warmupLine`, `previousWarmupFields` | `core.test.js`, `core-edge-cases.test.js` | `treinar.spec.js` (pré-preenchido e editado no Treinar) |
| Séries e agrupamento **por id** | `core.js`: `setLine`, `setsSummaryLines`, `groupSets`, `exerciseKey` | `core.test.js`, `core-edge-cases.test.js` (mesmo nome/ids diferentes, só aquecimento, registro sem nome) | `historico.spec.js` (detalhe: séries agrupadas por exercício, na ordem), `biblioteca.spec.js` (renomear mantém o histórico pelo id) |
| Histórico por exercício (gráfico, PR, tendência) | `core.js`: `workoutRecords`, `lastLoadsForExercise`, `lastWarmupForExercise`, `sessionsForExercise`, `bestSetForExercise`, `exerciseMatches` | `core.test.js`, `core-edge-cases.test.js` (renomear não perde histórico; nomes iguais não se misturam; ordenação), `form-and-progress.test.js` (recordes: primeira vez e carga igual não contam) | `historico.spec.js` (carga máxima, treinos, tendência, melhor série por dia, histórico com ficha e aquecimento), evolução sem registros |
| Nome **atual** de exercício e de ficha (sem nome congelado) | `core.js`: `exerciseLabel`, `sheetLabel`, `exerciseTarget` | `core.test.js`, `core-edge-cases.test.js` | `inicio.spec.js` (ficha renomeada na lista) |
| Renomear exercício propaga (fichas antigas e histórico) | `core.js`: `renameInSheets`, `renameInWorkouts`, `linkSheetItemsToExercises` | `core.test.js`, `sample-data.test.js` (fixture antiga religada) | `biblioteca.spec.js` (renomear: fichas, treinos gravados, detalhe, evolução e Treinar) |
| Dica "Última vez" e repetir o último treino da ficha | `core.js`: `lastSessionForExercise`, `lastSessionLine`, `lastWorkoutForSheet`, `formFromWorkout` | `form-and-progress.test.js` (ignora o treino em edição, `typeId` antigo, RIR/obs em branco) | `treinar.spec.js` |
| Rascunho do treino em andamento | `core.js`: `draftHasContent` (gravação/restauração no `app.js`) | `form-and-progress.test.js` | `treinar.spec.js` (gravar, recarregar, página oculta, cancelar, outro treino) |
| Timer de descanso | `core.js`: `restSecondsOf`, `fmtClock` | `form-and-progress.test.js` | `treinar.spec.js` (relógio da página controlado) |
| Lista curta do Início e filtro por ficha | `core.js`: `recentCutoff`, `visibleWorkoutCount`, `sheetFilterOptions` | `form-and-progress.test.js` (virada do ano, mínimo de treinos) | `historico.spec.js` ("Ver meses anteriores", "Mostrar só os recentes", filtro por ficha) |
| Evolução semanal (volume, treinos, cardio) | `core.js`: `workoutVolume`, `weeklyTotals` | `form-and-progress.test.js` (aquecimento fora do volume, treino inválido) | `historico.spec.js` (Calendário: últimas 8 semanas, volume, treinos da meta e cardio) |
| Texto do treino para enviar à professora | `core.js`: `workoutAsText` | `core.test.js`, `core-edge-cases.test.js` (nome atual, série sem número, treino vazio) | `treinar.spec.js` (exportar do Treinar), `historico.spec.js` (Compartilhar; sem menu do aparelho copia; cópia por seleção quando a área de transferência é bloqueada) |
| Fichas: criar/editar/excluir, itens, migração por nome | `core.js`: `normalizeSheet*`, `linkSheetItemsToExercises` | `core.test.js`, `core-edge-cases.test.js` | `fichas.spec.js` (criar com Biblioteca, catálogo e exercício novo; séries, reps, observação, ordem; editar; renomear; nome repetido; excluir), ficha sem exercícios |
| Importar ficha em JSON (contrato `FICHA-JSON.md`, sugestão de exercício parecido, lista para a IA) | `core.js`: `parseSheetImportText`, `parseSheetImport`, `suggestExercises`, `exerciseNamesText` | `core.test.js` (cerca ```json, JSON quebrado, formatos aceitos, reps, erros, ordem das sugestões, nomes sem repetir) | `fichas.spec.js` (Criar com IA: texto para a IA e copiar, JSON inválido, revisão com sugestão de parecido, importar, nome repetido vira "(importada)") |
| Importar treinos antigos + fichas recriadas (contrato `TREINO-JSON.md`, fichas reaproveitadas pelo nome, treinos repetidos pulados) | `core.js`: `parseHistoryImportText`, `parseHistoryImport`, `sheetByName`, `splitImportedSheets`, `importedWorkout`, `workoutFingerprint`, `splitImportedWorkouts`, `historyExerciseNames`, `sheetNamesText`, `historyImportSummaryHtml`, `historyImportToast` | `history-import.test.js` (resumo da revisão e aviso final, exemplo do contrato, datas BR/ISO/futuro, números com vírgula, erros com o lugar exato, carga da última vez pela ficha recriada, reimportar não duplica), `features.test.js` (card em Mais, janela, precache, revisar/importar ligados, fichas gravadas antes dos treinos, revisão de exercícios compartilhada com Criar com IA) | `mais.spec.js` (texto para a IA com fichas e exercícios, JSON inválido, revisão, importar com ficha recriada e carga da última vez, reimportar não duplica) |
| Biblioteca do usuário × catálogo | `core.js`: `isUserExercise`, `libraryExercises`, `fixLibrarySources` | `core.test.js`, `core-edge-cases.test.js` | `biblioteca.spec.js` (lista só com os exercícios da pessoa e as fichas que usam, filtro por grupo, criar com busca no catálogo, excluir) |
| Backup: nome do arquivo, status e lembrete | `core.js`: `backupFileName`, `backupStatus` | `core.test.js`, `core-edge-cases.test.js` | `inicio.spec.js` (lembrete no Início) |
| Backup: exportar/compartilhar (um arquivo só) | `core.js`: `backupAction`, `backupSharePayload`, `isBackupPayload`, `backupHint` | `core.test.js` (payload sem `text`/`title`; evento de clique não vira backup) | `dados.spec.js` (download no computador; no celular, um único `.json` para o menu de compartilhar) |
| Backup: importar e compatibilidade entre versões | `core.js`: `normalizeBackup`, `normalizeWorkout`, `normalizeSet`, `normalizeWarmup`, `normalizeSettings` | `core.test.js` + `tests/fixtures/backup-v1.json`, `backup-v2-sheets.json` | `dados.spec.js` (cada backup de `tests/fixtures/` importado pela tela: treinos, fichas, Biblioteca, colinha e metas; ida e volta exportar → apagar → reimportar sem perder nada; Desfazer; arquivo que não é backup não apaga nada) |
| Dados de exemplo (3 fichas, 12 treinos) | `core.js`: `materializeSampleData` + `data/sample-data.json` | `sample-data.test.js` (estrutura, integridade referencial, progressão de cargas, normalização) | `smoke.spec.js` (carregar pela tela Mais; Início e Calendário com dados), `dados.spec.js` (substituem os dados atuais; Desfazer devolve os anteriores), `dados.spec.js` (responder "Não" não troca nada; o arquivo de exemplo importa pela tela com datas a partir de hoje) |
| Catálogo embutido (ids únicos, contíguos, estáveis) | `data/exercises.json` | `core.test.js` (travas de ids) + `check.ps1` | `smoke.spec.js` (abre offline com o catálogo), `treinar.spec.js` e `fichas.spec.js` (exercício do catálogo) |
| Registro dos módulos no navegador (globais) | `js/core.js` (UMD) | `module.test.js` (roda o core num escopo de navegador) | `smoke.spec.js` (abre sem erro: as funções do `core.js` existem para o `app.js`) |
| Base antiga (era sem ids) sobrevive ao init | `core.js`: `fixLibrarySources`, `linkSheetItemsToExercises`, `historyTarget`, `normalizeBackup` | `old-db.test.js` (nenhuma série/carga/aquecimento/item se perde; histórico por nome guardado) | `biblioteca.spec.js` (registros sem ids gravados no aparelho: Biblioteca reparada, ficha ligada, histórico pelo nome) |
| PWA: versão consistente, precache, offline | `index.html`, `sw.js`, `manifest.webmanifest` | `check.ps1` (13 verificações) | `smoke.spec.js` (versão no rodapé × arquivos × cache; abre offline com o catálogo), `dados.spec.js` (versão nova do service worker assume e apaga o cache antigo; "Atualizar app"; o rascunho em andamento sobrevive aos dois) |
| Exportar/importar/apagar dentro do app (telas) | `js/app.js` | `check.ps1` (ids e handlers) + lógica do `core.js` | `dados.spec.js` (exportar, importar, Apagar dados só depois de marcar a confirmação, Cancelar não apaga, apagar leva tudo inclusive o rascunho), compartilhamento cancelado ou com erro avisa e não conta como backup; botão Importar abre o seletor de arquivo (`dados.spec.js`) |
| Telas da importação de ficha (colar, revisão, botão Revisar → Importar), desativar/reativar ficha, modal Criar com IA (texto para a IA + colar a resposta), card Debug | `js/app.js` | `check.ps1` (ids e handlers) + lógica do `core.js` (`parseSheetImportText`, `suggestExercises`, `exerciseNamesText`, `normalizeSheet` mantém `active: false`) | `fichas.spec.js` (Criar com IA, desativar/reativar), `mais.spec.js` (card Debug) |
| Importar/desfazer/dados de exemplo sem risco de perder tudo (apaga e grava numa transação só) | `db.js`: `dbReplaceAll` (usado por `restoreAll` no `app.js`) | `db.test.js` (IndexedDB falso: uma transação, `clear` antes do `put`, `abort` em registro inválido) | `dados.spec.js` (Desfazer; arquivo que não é backup não apaga nada; dados de exemplo e Desfazer) |
| Calendário: trocar de mês (inclusive nos dias 29–31) | `core.js`: `shiftMonth` | `core-edge-cases.test.js` (31/out ‹ vai para setembro; 31/jan › vai para fevereiro; virada do ano) | `historico.spec.js` (trocar de mês; dias 31 de outubro e de janeiro, nos dois sentidos e na virada do ano) |
| Selo de PR na evolução do exercício (some quando não há carga) | `core.js`: `maxBestLoad` | `core-edge-cases.test.js` (peso do corpo = 0, sem "PR 1 kg"; maior carga; carga < 1 kg) | `historico.spec.js` (carga máxima; peso do corpo sem selo e sem 1RM) |
| Backup importado não confia no arquivo (ids e datas) | `core.js`: `normalizeBackup` (`hasSafeId`), `normalizeWorkout`, `normalizeSettings` | `core-edge-cases.test.js` (id com aspas/tags é descartado; formatos antigos de id mantidos; data inválida vira "sem data"; início da semana inválido; idempotência) | `dados.spec.js` (id com código descartado, data inválida vira "Sem data", semana inválida) |
| Service worker: `?v=N` sai do cache primeiro (abre rápido com sinal fraco); resto é rede primeiro | `sw.js` | `sw.test.js` (cache e rede falsos: produção × localhost, offline, versão nova = URL nova, o que não é interceptado) | `smoke.spec.js` (abre offline), `dados.spec.js` (versão nova do service worker assume) |
| Iniciar próxima semana (pula as semanas perdidas de uma vez) | `core.js`: `nextWeekAnchor` | `core-edge-cases.test.js` (1 semana, 3 semanas paradas, virada do ano, mesmo dia da semana) | `inicio.spec.js` |
| Formulário do Treinar: linha da série (carga larga, número como texto) | `core.js`: `setRowHtml`, `setHeaderHtml` | `form-and-progress.test.js` (colunas 1-2-3-2-4, "102,5" cabe, handlers `setField`, teclados, escape) | `treinar.spec.js` |
| Remover exercício do treino em andamento (confirma se há algo preenchido) | `core.js`: `groupHasData` (pergunta no `app.js`: `removeFormExercise`) | `form-and-progress.test.js` (série/aquecimento preenchidos, RIR 0, em branco, confirmação antes do `splice`) | `treinar.spec.js` |
| Carga com vírgula também no resumo, histórico e texto exportado | `core.js`: `setLine`, `warmupLine`, `setsSummaryLines`, `workoutAsText` (parâmetro `useComma`) | `core-edge-cases.test.js` (vírgula quando pedido; sem o parâmetro o formato antigo não muda) | `historico.spec.js` (detalhe e evolução com 47,5 e 42,5), `treinar.spec.js` (texto exportado) |
| Treino aberto sobrevive a recarregar a página (`#/detail/<id>`) | `core.js`: `parseRoute` (usado pelo `navigate` no `app.js`) | `core-edge-cases.test.js` (id no endereço, endereços antigos sem id, endereço vazio, app sempre navega com id) | `historico.spec.js` (recarregar no detalhe; treino que não existe mais) |
| Não repetir o mesmo exercício no treino nem na ficha | `core.js`: `hasExercise` (avisos no `app.js`: `addExerciseToForm`, `addSheetExercise`) | `core-edge-cases.test.js` (por id, id do catálogo como texto, item de ficha com `name`, registro antigo sem id; prova do agrupamento que motivou o bloqueio) | `fichas.spec.js` (aviso no editor de ficha), `treinar.spec.js` (aviso no Treinar) |
| Ficha: no máximo 20 séries por exercício (editor, importação e backup) | `core.js`: `normalizeSheetItem` (usado também por `saveSheetEditor` no `app.js`) | `core-edge-cases.test.js` (500 vira 20, lista de reps longa, formato v2, fichas normais intactas) | `fichas.spec.js` (500 séries no editor viram 20) |
| Dois treinos no mesmo dia: o mais recente vem primeiro | `core.js`: `byDateDesc` (usado em toda ordenação por data) | `core-edge-cases.test.js` (qualquer ordem de entrada, sem `createdAt`, "última vez"/cargas/aquecimento do treino mais novo) | `historico.spec.js` (Início e Calendário abrem o mais recente) |
| Busca de exercício (seletor do treino, da ficha e do cadastro) | `core.js`: `pickerHtml` (os três `render*Results` do `app.js`) | `picker.test.js` (Biblioteca × catálogo, busca sem acento, Criar, limites, escape, handlers existem e aceitam id como texto, código morto não voltou) | `treinar.spec.js` (seletor do Treinar: Biblioteca, catálogo, Criar) |
| Resumo no card do Início (exercícios · volume · cardio · recordes) | `core.js`: `workoutSummary`, `fmtThousands` (+ `workoutRecords`) | `features.test.js` (linha completa, partes zeradas, singular, dados de exemplo, card usa o resumo) | `treinar.spec.js` (salvar leva ao Início com o resumo), `historico.spec.js` (resumo e recordes de cada linha) |
| Começar o treino em um toque (botão "Treinar: <ficha>" no Início) | `core.js`: `nextSheet` (botão e carga da ficha no `app.js`) | `features.test.js` (próxima ficha em ordem alfabética, volta ao início, ficha desativada/excluída, sem fichas, dados v1) | `inicio.spec.js`, `treinar.spec.js` |
| Remover a última série de um exercício no Treinar | `core.js`: `setHasData` (botão "− série" no `app.js`: `removeFormSet`) | `features.test.js` (série em branco × preenchida, nunca remove a única, confirma antes) | `treinar.spec.js` |
| Marcar a série como feita inicia o descanso (botão no número da série) | `core.js`: `setRowHtml` (ação no `app.js`: `toggleSetDone`) | `features.test.js` (botão, estado feito, acessibilidade, carga continua larga, `done` não vai para o treino salvo, sem som/vibração) | `treinar.spec.js` |
| Calendário: tocar no dia abre o treino daquele dia | `core.js`: `workoutsByDate` (link no `app.js`: `renderCalendar`) | `features.test.js` (agrupa por dia, mais recente primeiro, sem data fica de fora, link `#/detail/<id>`) | `historico.spec.js` (abre o treino; com dois no dia, o mais recente) |
| 1RM estimado na evolução do exercício (Epley) | `core.js`: `estimate1RM`, `best1RMForExercise` | `features.test.js` (fórmula, 1 rep, sem carga/reps, mais reps com a mesma carga = progresso, melhor série do exercício) | `historico.spec.js` (1RM do exercício e de cada dia; sem carga, sem 1RM) |
| Avisos de sucesso somem sozinhos (toast); erros e perguntas continuam bloqueando | `index.html`: `#appToast`; `app.js`: `showToast` | `features.test.js` (5 mensagens de sucesso viraram toast, erros continuam `alert`, texto puro) | `mais.spec.js` ("Metas salvas." aparece e some sozinho), `dados.spec.js` (backup importado), `fichas.spec.js` ("Texto copiado!") |
| Área de toque de 44px nos botões só com ícone | `css/styles.css`: `.btn-sm[aria-label]` | `features.test.js` (regra presente; todo botão de ícone tem `aria-label`) | `fichas.spec.js` (botões de ícone das fichas com 44px ou mais) |
| Card Debug à vista no fim de Mais, sem recolher (v74), com o armazenamento persistente | `index.html`; `app.js`: `requestPersistentStorage`, `renderStorageInfo` | `features.test.js` (último card, contém atualizar/apagar/exemplo/espaço usado, backup continua antes) | `mais.spec.js` (à vista no fim de Mais; pede armazenamento persistente ao abrir: protegido ou não protegido) |
| Mais → Instalar o app (botão do navegador, instrução para iPhone e menu, "já instalado") | `core.js`: `installHint` (evento no `app.js`: `renderInstall`, `installApp`) | `features.test.js` (4 casos do texto, card entre Dados e o Debug, `beforeinstallprompt` guardado, botão ligado) | `mais.spec.js` (menu do navegador, botão Instalar com o pedido do navegador, iPhone, já instalado) |
| Colinha (criar, editar, excluir) | `app.js`: `renderColinhaList`, `saveColinha`, `deleteColinha` | `check.ps1` (ids e handlers) | `mais.spec.js` (criar, editar, excluir, vazia não salva) |
| Campos do aquecimento com nome para leitor de tela | `app.js`: `renderFormSets` | `features.test.js` (reps, peso e RIR com `aria-label`) | `treinar.spec.js` (campos achados pelo nome) |

## Treinar (tela crítica): cada comportamento

Um teste de navegador por comportamento (issue #5). O rascunho é conferido no IndexedDB do aparelho.
Ponto de partida: `tests/e2e/fixtures/treinar-backup.json`,
importado pela tela Mais. O descanso usa o relógio controlado do Playwright (`page.clock`), sem esperas fixas.

| Comportamento | Onde vive | Testes | Testes de navegador |
|---|---|---|---|
| Abrir pela aba Treinar sem rascunho: formulário vazio, data de hoje | `js/app.js` (Treinar) | — | `treinar.spec.js`: pela aba Treinar sem rascunho |
| Abrir pelo atalho "Treinar: <ficha>" do Início: ficha já carregada | `js/app.js` (Treinar) | — | `treinar.spec.js`: pelo atalho |
| Fichas desativadas não aparecem no seletor | `js/app.js` (Treinar) | — | `treinar.spec.js`: fichas desativadas |
| Escolher a ficha carrega exercícios e séries (reps de cada série da ficha, carga do último treino) | `js/app.js` (Treinar) | — | `treinar.spec.js`: escolher a ficha |
| Dica "da última vez" da ficha escolhida | `js/app.js` (Treinar) | — | `treinar.spec.js`: dica "da última vez" |
| Aquecimento pré-preenchido com reps e peso do treino anterior (RIR em branco) | `js/app.js` (Treinar) | — | `treinar.spec.js`: aquecimento pré-preenchido |
| "Repetir último treino desta ficha" preenche exercícios, reps e cargas | `js/app.js` (Treinar) | — | `treinar.spec.js`: "Repetir o último treino desta ficha" |
| Trocar de ficha no meio substitui os exercícios | `js/app.js` (Treinar) | — | `treinar.spec.js`: trocar de ficha no meio |
| Editar reps, carga, RIR e observação da série | `js/app.js` (Treinar) | — | `treinar.spec.js`: editar reps, carga, RIR e observação |
| Carga com vírgula (`27,5`) fica 27,5 (regressão do iPhone) | `js/app.js` (Treinar) | — | `treinar.spec.js`: carga com vírgula |
| Adicionar série | `js/app.js` (Treinar) | — | `treinar.spec.js`: adicionar série |
| Tirar a última série (sempre sobra uma) | `js/app.js` (Treinar) | — | `treinar.spec.js`: tirar a última série |
| Tocar no número da série marca como feita e inicia o descanso; tocar de novo só desmarca | `js/app.js` (Treinar) | — | `treinar.spec.js`: tocar no número da série |
| Contador de progresso conta só as séries feitas | `js/app.js` (Treinar) | — | `treinar.spec.js`: contador de progresso |
| Descanso começa ao marcar a série, com o tempo dos Ajustes | `js/app.js` (Treinar) | — | `treinar.spec.js`: começa ao marcar a série |
| Descanso: botão de somar tempo (+15s) | `js/app.js` (Treinar) | — | `treinar.spec.js`: botão de somar tempo |
| Descanso: parar | `js/app.js` (Treinar) | — | `treinar.spec.js`: parar |
| Fim do descanso só muda de cor: sem som, sem vibração, sem piscar | `js/app.js` (Treinar) | — | `treinar.spec.js`: no fim só muda de cor |
| Descanso continua certo depois de o app ir para segundo plano (conta pelo horário de término) | `js/app.js` (Treinar) | — | `treinar.spec.js`: continua certo depois de o app ir para segundo plano |
| Adicionar exercício da Biblioteca, do catálogo e criando um novo | `js/app.js` (Treinar) | — | `treinar.spec.js`: adicionar exercício da Biblioteca / do catálogo / criando um novo |
| Remover um exercício | `js/app.js` (Treinar) | — | `treinar.spec.js`: remover um exercício |
| Adicionar um exercício que já está no treino avisa e não duplica | `js/app.js` (Treinar) | — | `treinar.spec.js`: o mesmo exercício não entra duas vezes no treino |
| Responder **Não** mantém o que foi preenchido: trocar de ficha, "Repetir o último treino", remover exercício preenchido, Cancelar | `js/app.js` (Treinar) | — | `treinar.spec.js`: responder "Não" mantém o que foi preenchido (4 testes) |
| Aquecimento por exercício (reps, peso, RIR) | `js/app.js` (Treinar) | — | `treinar.spec.js`: aquecimento por exercício |
| Cardio e observações | `js/app.js` (Treinar) | — | `treinar.spec.js`: cardio e observações |
| Toda alteração grava o rascunho; recarregar a página no meio do treino continua de onde parou | `js/app.js` (Treinar) | — | `treinar.spec.js`: toda alteração grava o rascunho |
| Sair do app (página oculta) grava o rascunho na hora | `js/app.js` (Treinar) | — | `treinar.spec.js`: sair do app (página oculta) |
| **Cancelar** descarta as alterações e o rascunho | `js/app.js` (Treinar) | — | `treinar.spec.js`: Cancelar descarta |
| **Cancelar** na edição de um treino salvo volta ao detalhe dele, sem mudar nada | `js/app.js` (Treinar) | — | `treinar.spec.js`: Cancelar na edição de um treino salvo |
| Apagar tudo o que foi digitado apaga o rascunho | `js/app.js` (Treinar) | — | `treinar.spec.js`: apagar tudo o que foi digitado |
| Salvar funciona em navegador sem `crypto.randomUUID` | `js/app.js` (Treinar) | — | `treinar.spec.js`: salva o treino mesmo sem crypto.randomUUID |
| Rascunho de **outro** treino: abrir um treino diferente não mistura os dados (continuar ou descartar) | `js/app.js` (Treinar) | — | `treinar.spec.js`: rascunho de outro treino (2 testes) |
| Treino inválido não é salvo e mostra o motivo | `js/app.js` (Treinar) | — | `treinar.spec.js`: treino inválido |
| Salvar leva ao Início com o resumo; o treino aparece no Calendário e no histórico de cada exercício | `js/app.js` (Treinar) | — | `treinar.spec.js`: salvar leva ao Início |
| Linha "Recorde" quando bate a maior carga anterior | `js/app.js` (Treinar) | — | `treinar.spec.js`: linha "Recorde" |
| Depois de salvar, o rascunho some | `js/app.js` (Treinar) | — | `treinar.spec.js`: depois de salvar, o rascunho some |
| Treino existente: abrir pelo detalhe, editar e salvar (sem duplicar) | `js/app.js` (Treinar) | — | `treinar.spec.js`: abrir pelo detalhe, editar e salvar |
| Treino existente: excluir | `js/app.js` (Treinar) | — | `treinar.spec.js`: excluir o treino |
| Treino existente: exportar como texto (formato do WhatsApp, só a data no topo) | `js/app.js` (Treinar) | — | `treinar.spec.js`: exportar como texto |

## Início (tela crítica): cada comportamento

Um teste de navegador por comportamento (issue #19). Ponto de partida: `tests/e2e/fixtures/inicio-backup.json`,
importado pela tela Mais, com o relógio da página parado em 20/05/2026 (`page.clock.setFixedTime`). Variações
(sem backup, meta menor, última ficha diferente) são montadas no próprio teste com `readFixture`.

| Comportamento | Onde vive | Testes | Testes de navegador |
|---|---|---|---|
| Primeiro uso sem dados: estado vazio correto, sem erro no console | `js/app.js` (Início) | — | `inicio.spec.js`: primeiro uso sem dados |
| Aviso do rascunho aparece com um treino em andamento (descrição do rascunho) | `js/app.js` (Início) | — | `inicio.spec.js`: aparece com um treino em andamento |
| Aviso do rascunho: **Continuar** abre o Treinar com o rascunho | `js/app.js` (Início) | — | `inicio.spec.js`: Continuar abre o Treinar |
| Aviso do rascunho: **Descartar** remove o rascunho e o aviso | `js/app.js` (Início) | — | `inicio.spec.js`: Descartar remove o rascunho e o aviso |
| Aviso do rascunho descreve a edição de um treino salvo ("Edição do treino de <data>") | `js/app.js` (Início) | — | `inicio.spec.js`: descreve a edição de um treino salvo |
| Progresso das metas: treinos (x/meta) e minutos de cardio (x/meta), com as barras | `js/app.js` (Início) | — | `inicio.spec.js`: progresso das metas |
| Meta batida: selo "Meta batida" e barras cheias, sem passar de 100% | `js/app.js` (Início) | — | `inicio.spec.js`: meta batida |
| Treino com data fora da janela da semana não conta na semana atual (e não se perde) | `js/app.js` (Início) | — | `inicio.spec.js`: treino com data fora da janela |
| Aviso de **semana encerrada** depois de 7 dias, com o resultado final | `js/app.js` (Início) | — | `inicio.spec.js`: aviso de semana encerrada |
| Confirmar o aviso avança para a próxima janela (e fica gravado) | `js/app.js` (Início) | — | `inicio.spec.js`: confirmar o aviso avança |
| "Treinar: <ficha>" sugere a próxima ficha certa (pela rotina) e abre o Treinar com ela carregada | `js/app.js` (Início) | — | `inicio.spec.js`: "Treinar: <ficha>" sugere a próxima ficha |
| Atalho Treinar some enquanto existe um rascunho | `js/app.js` (Início) | — | `inicio.spec.js`: some enquanto existe um rascunho |
| Fichas desativadas não são sugeridas no atalho | `js/app.js` (Início) | — | `inicio.spec.js`: fichas desativadas não são sugeridas |
| Lembrete de backup aparece quando nunca houve backup | `js/app.js` (Início) | — | `inicio.spec.js`: aparece quando nunca houve backup |
| Lembrete de backup aparece quando o último backup está velho; some quando está em dia | `js/app.js` (Início) | — | `inicio.spec.js`: aparece quando o último backup está velho |
| Lembrete de backup some depois de fazer um backup | `js/app.js` (Início) | — | `inicio.spec.js`: some depois de fazer um backup |
| Lembrete de backup: ✕ "Lembrar depois" esconde | `js/app.js` (Início) | — | `inicio.spec.js`: "Lembrar depois" (✕) esconde o lembrete |
| Treinos recentes: data e nome da ficha, do mais recente para o mais antigo | `js/app.js` (Início) | — | `inicio.spec.js`: lista com data e nome da ficha |
| Tocar num treino da lista abre o detalhe | `js/app.js` (Início) | — | `inicio.spec.js`: tocar num treino abre o detalhe |
| Ficha renomeada aparece com o nome novo na lista | `js/app.js` (Início) | — | `inicio.spec.js`: ficha renomeada aparece com o nome novo |
| Botão de compartilhar da linha abre o texto do treino | `js/app.js` (Início) | — | `inicio.spec.js`: o botão de compartilhar da linha |

## Limites conhecidos

- **Cobertura do `js/app.js` sem meta fixa** (`documentation/REFACTOR.md`, seção 4). Todo caminho que a pessoa
  dispara tem teste de navegador; o que fica fora da conta (`npm run test:e2e:coverage` lista) são avisos de erro
  inesperado (`guard`, falha ao criar exercício, falha do IndexedDB ao gravar/apagar o rascunho) e itens de ficha
  sem séries nem reps (o app não grava assim). "Atualizar app" **tem teste** (`dados.spec.js`), mas não entra na
  conta: o próprio app recarrega a página, o que descarta os contadores, e segurar a navegação para tirar a foto
  trava o perfil do V8.
- **Wrapper de módulo do `core.js`** (detecção Node × navegador) fica fora da meta de cobertura: cada
  ambiente executa um dos lados. O lado do navegador é testado em `module.test.js` (carrega o core num
  escopo sem `module.exports` e confere que as funções viram globais).
