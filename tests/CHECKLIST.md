# Checklist de cobertura — funcionalidade → testes

Mapa de **cada funcionalidade do app** para os testes que a cobrem. Serve para responder
"isso está testado?" sem precisar ler os testes inteiros.

- Testes de unidade: `node --test tests/` (sem dependências).
- Testes de navegador: `npm run test:e2e` (Playwright, pasta `tests/e2e/`; instalação em `documentation/agents/workflow.md`).
  Coluna **Testes de navegador**: "—" quer dizer que ainda falta (issues #6 e #7 da refatoração). Treinar e
  Início são **telas críticas**: cada comportamento delas ganha linha e teste próprios.
- Cobertura: `node tools/coverage-gate.js` (o CI exige **100% de linhas e ramos em `js/core.js`**).
- Lógica pura fica em `js/core.js` de propósito: é o que dá para testar sem navegador.
- Telas/manipulação de DOM (`js/app.js`) são verificadas estaticamente pelo `check.ps1`
  (ids, handlers, assets, versão, anti-zoom) e, cada vez mais, pelos testes de navegador.

| Funcionalidade | Onde vive | Testes | Testes de navegador |
|---|---|---|---|
| Abrir o app sem erro, as 5 abas e telas internas, nada sai do aparelho, cabe em 375px | `index.html`, `js/app.js` (`navigate`) | — | `smoke.spec.js` |
| Datas (ISO ↔ BR, somar dias, fuso local) | `core.js`: `pad2`, `fmtDate`, `parseDate`, `todayISO`, `addDaysISO`, `fmtBR`, `dateParts`, `fmtDateTimeBR` | `core.test.js` (datas), `core-edge-cases.test.js` (formato vazio) | — |
| Semana flexível (janela de 7 dias, metas, aviso) | `core.js`: `defaultSettings`, `weekWindow`, `isValidWorkout` | `core.test.js`, `core-edge-cases.test.js` (`weekWindow` sem argumento) | `inicio.spec.js` |
| Números com vírgula (bug do iPhone) | `core.js`: `parseLocalNumber`, `toNum`, `toNumOrNull`, `formatDecimal` | `core.test.js` (inclui regressão da carga `27,5`) | `treinar.spec.js` (carga `27,5` no Treinar) |
| Busca sem acentos | `core.js`: `normalizeText` | `core.test.js` | — |
| Escapar HTML (XSS no que vem do banco) | `core.js`: `esc` | `core.test.js`, `setsSummaryLines` | — |
| Aquecimento (reps/carga/RIR) | `core.js`: `warmupHasData`, `warmupLine`, `previousWarmupFields` | `core.test.js`, `core-edge-cases.test.js` | `treinar.spec.js` (pré-preenchido e editado no Treinar) |
| Séries e agrupamento **por id** | `core.js`: `setLine`, `setsSummaryLines`, `groupSets`, `exerciseKey` | `core.test.js`, `core-edge-cases.test.js` (mesmo nome/ids diferentes, só aquecimento, registro sem nome) | — |
| Histórico por exercício (gráfico, PR, tendência) | `core.js`: `workoutRecords`, `lastLoadsForExercise`, `lastWarmupForExercise`, `sessionsForExercise`, `bestSetForExercise`, `exerciseMatches` | `core.test.js`, `core-edge-cases.test.js` (renomear não perde histórico; nomes iguais não se misturam; ordenação), `form-and-progress.test.js` (recordes: primeira vez e carga igual não contam) | — |
| Nome **atual** de exercício e de ficha (sem nome congelado) | `core.js`: `exerciseLabel`, `sheetLabel`, `exerciseTarget` | `core.test.js`, `core-edge-cases.test.js` | `inicio.spec.js` (ficha renomeada na lista) |
| Renomear exercício propaga (fichas antigas e histórico) | `core.js`: `renameInSheets`, `renameInWorkouts`, `linkSheetItemsToExercises` | `core.test.js`, `sample-data.test.js` (fixture antiga religada) | — |
| Dica "Última vez" e repetir o último treino da ficha | `core.js`: `lastSessionForExercise`, `lastSessionLine`, `lastWorkoutForSheet`, `formFromWorkout` | `form-and-progress.test.js` (ignora o treino em edição, `typeId` antigo, RIR/obs em branco) | `treinar.spec.js` |
| Rascunho do treino em andamento | `core.js`: `draftHasContent` (gravação/restauração no `app.js`) | `form-and-progress.test.js` | `treinar.spec.js` (gravar, recarregar, página oculta, cancelar, outro treino) |
| Timer de descanso | `core.js`: `restSecondsOf`, `fmtClock` | `form-and-progress.test.js` | `treinar.spec.js` (relógio da página controlado) |
| Lista curta do Início e filtro por ficha | `core.js`: `recentCutoff`, `visibleWorkoutCount`, `sheetFilterOptions` | `form-and-progress.test.js` (virada do ano, mínimo de treinos) | — |
| Evolução semanal (volume, treinos, cardio) | `core.js`: `workoutVolume`, `weeklyTotals` | `form-and-progress.test.js` (aquecimento fora do volume, treino inválido) | — |
| Texto do treino para enviar à professora | `core.js`: `workoutAsText` | `core.test.js`, `core-edge-cases.test.js` (nome atual, série sem número, treino vazio) | `treinar.spec.js` (exportar do Treinar) |
| Fichas: criar/editar/excluir, itens, migração por nome | `core.js`: `normalizeSheet*`, `linkSheetItemsToExercises` | `core.test.js`, `core-edge-cases.test.js` | — |
| Importar ficha em JSON (contrato `FICHA-JSON.md`, sugestão de exercício parecido, lista para a IA) | `core.js`: `parseSheetImportText`, `parseSheetImport`, `suggestExercises`, `exerciseNamesText` | `core.test.js` (cerca ```json, JSON quebrado, formatos aceitos, reps, erros, ordem das sugestões, nomes sem repetir) | — |
| Importar treinos antigos + fichas recriadas (contrato `TREINO-JSON.md`, fichas reaproveitadas pelo nome, treinos repetidos pulados) | `core.js`: `parseHistoryImportText`, `parseHistoryImport`, `sheetByName`, `splitImportedSheets`, `importedWorkout`, `workoutFingerprint`, `splitImportedWorkouts`, `historyExerciseNames`, `sheetNamesText`, `historyImportSummaryHtml`, `historyImportToast` | `history-import.test.js` (resumo da revisão e aviso final, exemplo do contrato, datas BR/ISO/futuro, números com vírgula, erros com o lugar exato, carga da última vez pela ficha recriada, reimportar não duplica), `features.test.js` (card em Mais, janela, precache, revisar/importar ligados, fichas gravadas antes dos treinos, revisão de exercícios compartilhada com Criar com IA) | — |
| Biblioteca do usuário × catálogo | `core.js`: `isUserExercise`, `libraryExercises`, `fixLibrarySources` | `core.test.js`, `core-edge-cases.test.js` | — |
| Backup: nome do arquivo, status e lembrete | `core.js`: `backupFileName`, `backupStatus` | `core.test.js`, `core-edge-cases.test.js` | `inicio.spec.js` (lembrete no Início) |
| Backup: exportar/compartilhar (um arquivo só) | `core.js`: `backupAction`, `backupSharePayload`, `isBackupPayload`, `backupHint` | `core.test.js` (payload sem `text`/`title`; evento de clique não vira backup) | — |
| Backup: importar e compatibilidade entre versões | `core.js`: `normalizeBackup`, `normalizeWorkout`, `normalizeSet`, `normalizeWarmup`, `normalizeSettings` | `core.test.js` + `tests/fixtures/backup-v1.json`, `backup-v2-sheets.json` | — |
| Dados de exemplo (3 fichas, 12 treinos) | `core.js`: `materializeSampleData` + `data/sample-data.json` | `sample-data.test.js` (estrutura, integridade referencial, progressão de cargas, normalização) | `smoke.spec.js` (carregar pela tela Mais; Início e Calendário com dados) |
| Catálogo embutido (ids únicos, contíguos, estáveis) | `data/exercises.json` | `core.test.js` (travas de ids) + `check.ps1` | — |
| Registro dos módulos no navegador (globais) | `js/core.js` (UMD) | `module.test.js` (roda o core num escopo de navegador) | — |
| Base antiga (era sem ids) sobrevive ao init | `core.js`: `fixLibrarySources`, `linkSheetItemsToExercises`, `historyTarget`, `normalizeBackup` | `old-db.test.js` (nenhuma série/carga/aquecimento/item se perde; histórico por nome guardado) | — |
| PWA: versão consistente, precache, offline | `index.html`, `sw.js`, `manifest.webmanifest` | `check.ps1` (13 verificações) | `smoke.spec.js` (versão no rodapé × arquivos × cache; abre offline com o catálogo) |
| Exportar/importar/apagar dentro do app (telas) | `js/app.js` | `check.ps1` (ids e handlers) + lógica do `core.js` | — |
| Telas da importação de ficha (colar, revisão, botão Revisar → Importar), desativar/reativar ficha, modal Criar com IA (texto para a IA + colar a resposta), card Debug | `js/app.js` | `check.ps1` (ids e handlers) + lógica do `core.js` (`parseSheetImportText`, `suggestExercises`, `exerciseNamesText`, `normalizeSheet` mantém `active: false`) | — |
| Importar/desfazer/dados de exemplo sem risco de perder tudo (apaga e grava numa transação só) | `db.js`: `dbReplaceAll` (usado por `restoreAll` no `app.js`) | `db.test.js` (IndexedDB falso: uma transação, `clear` antes do `put`, `abort` em registro inválido) | — |
| Calendário: trocar de mês (inclusive nos dias 29–31) | `core.js`: `shiftMonth` | `core-edge-cases.test.js` (31/out ‹ vai para setembro; 31/jan › vai para fevereiro; virada do ano) | — |
| Selo de PR na evolução do exercício (some quando não há carga) | `core.js`: `maxBestLoad` | `core-edge-cases.test.js` (peso do corpo = 0, sem "PR 1 kg"; maior carga; carga < 1 kg) | — |
| Backup importado não confia no arquivo (ids e datas) | `core.js`: `normalizeBackup` (`hasSafeId`), `normalizeWorkout`, `normalizeSettings` | `core-edge-cases.test.js` (id com aspas/tags é descartado; formatos antigos de id mantidos; data inválida vira "sem data"; início da semana inválido; idempotência) | — |
| Service worker: `?v=N` sai do cache primeiro (abre rápido com sinal fraco); resto é rede primeiro | `sw.js` | `sw.test.js` (cache e rede falsos: produção × localhost, offline, versão nova = URL nova, o que não é interceptado) | — |
| Iniciar próxima semana (pula as semanas perdidas de uma vez) | `core.js`: `nextWeekAnchor` | `core-edge-cases.test.js` (1 semana, 3 semanas paradas, virada do ano, mesmo dia da semana) | `inicio.spec.js` |
| Formulário do Treinar: linha da série (carga larga, número como texto) | `core.js`: `setRowHtml`, `setHeaderHtml` | `form-and-progress.test.js` (colunas 1-2-3-2-4, "102,5" cabe, handlers `setField`, teclados, escape) | `treinar.spec.js` |
| Remover exercício do treino em andamento (confirma se há algo preenchido) | `core.js`: `groupHasData` (pergunta no `app.js`: `removeFormExercise`) | `form-and-progress.test.js` (série/aquecimento preenchidos, RIR 0, em branco, confirmação antes do `splice`) | `treinar.spec.js` |
| Carga com vírgula também no resumo, histórico e texto exportado | `core.js`: `setLine`, `warmupLine`, `setsSummaryLines`, `workoutAsText` (parâmetro `useComma`) | `core-edge-cases.test.js` (vírgula quando pedido; sem o parâmetro o formato antigo não muda) | — |
| Treino aberto sobrevive a recarregar a página (`#/detail/<id>`) | `core.js`: `parseRoute` (usado pelo `navigate` no `app.js`) | `core-edge-cases.test.js` (id no endereço, endereços antigos sem id, endereço vazio, app sempre navega com id) | — |
| Não repetir o mesmo exercício no treino nem na ficha | `core.js`: `hasExercise` (avisos no `app.js`: `addExerciseToForm`, `addSheetExercise`) | `core-edge-cases.test.js` (por id, id do catálogo como texto, item de ficha com `name`, registro antigo sem id; prova do agrupamento que motivou o bloqueio) | — |
| Ficha: no máximo 20 séries por exercício (editor, importação e backup) | `core.js`: `normalizeSheetItem` (usado também por `saveSheetEditor` no `app.js`) | `core-edge-cases.test.js` (500 vira 20, lista de reps longa, formato v2, fichas normais intactas) | — |
| Dois treinos no mesmo dia: o mais recente vem primeiro | `core.js`: `byDateDesc` (usado em toda ordenação por data) | `core-edge-cases.test.js` (qualquer ordem de entrada, sem `createdAt`, "última vez"/cargas/aquecimento do treino mais novo) | — |
| Busca de exercício (seletor do treino, da ficha e do cadastro) | `core.js`: `pickerHtml` (os três `render*Results` do `app.js`) | `picker.test.js` (Biblioteca × catálogo, busca sem acento, Criar, limites, escape, handlers existem e aceitam id como texto, código morto não voltou) | `treinar.spec.js` (seletor do Treinar: Biblioteca, catálogo, Criar) |
| Resumo no card do Início (exercícios · volume · cardio · recordes) | `core.js`: `workoutSummary`, `fmtThousands` (+ `workoutRecords`) | `features.test.js` (linha completa, partes zeradas, singular, dados de exemplo, card usa o resumo) | — |
| Começar o treino em um toque (botão "Treinar: <ficha>" no Início) | `core.js`: `nextSheet` (botão e carga da ficha no `app.js`) | `features.test.js` (próxima ficha em ordem alfabética, volta ao início, ficha desativada/excluída, sem fichas, dados v1) | `inicio.spec.js`, `treinar.spec.js` |
| Remover a última série de um exercício no Treinar | `core.js`: `setHasData` (botão "− série" no `app.js`: `removeFormSet`) | `features.test.js` (série em branco × preenchida, nunca remove a única, confirma antes) | `treinar.spec.js` |
| Marcar a série como feita inicia o descanso (botão no número da série) | `core.js`: `setRowHtml` (ação no `app.js`: `toggleSetDone`) | `features.test.js` (botão, estado feito, acessibilidade, carga continua larga, `done` não vai para o treino salvo, sem som/vibração) | `treinar.spec.js` |
| Calendário: tocar no dia abre o treino daquele dia | `core.js`: `workoutsByDate` (link no `app.js`: `renderCalendar`) | `features.test.js` (agrupa por dia, mais recente primeiro, sem data fica de fora, link `#/detail/<id>`) | — |
| 1RM estimado na evolução do exercício (Epley) | `core.js`: `estimate1RM`, `best1RMForExercise` | `features.test.js` (fórmula, 1 rep, sem carga/reps, mais reps com a mesma carga = progresso, melhor série do exercício) | — |
| Avisos de sucesso somem sozinhos (toast); erros e perguntas continuam bloqueando | `index.html`: `#appToast`; `app.js`: `showToast` | `features.test.js` (5 mensagens de sucesso viraram toast, erros continuam `alert`, texto puro) | — |
| Área de toque de 44px nos botões só com ícone | `css/styles.css`: `.btn-sm[aria-label]` | `features.test.js` (regra presente; todo botão de ícone tem `aria-label`) | — |
| Card Debug fechado por padrão (atrás de "Opções avançadas") | `index.html`: `<details>` | `features.test.js` (começa fechado, contém atualizar/apagar/exemplo, backup continua à vista) | — |
| Mais → Instalar o app (botão do navegador, instrução para iPhone e menu, "já instalado") | `core.js`: `installHint` (evento no `app.js`: `renderInstall`, `installApp`) | `features.test.js` (4 casos do texto, card entre Dados e Opções avançadas, `beforeinstallprompt` guardado, botão ligado) | — |
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
| Aquecimento por exercício (reps, peso, RIR) | `js/app.js` (Treinar) | — | `treinar.spec.js`: aquecimento por exercício |
| Cardio e observações | `js/app.js` (Treinar) | — | `treinar.spec.js`: cardio e observações |
| Toda alteração grava o rascunho; recarregar a página no meio do treino continua de onde parou | `js/app.js` (Treinar) | — | `treinar.spec.js`: toda alteração grava o rascunho |
| Sair do app (página oculta) grava o rascunho na hora | `js/app.js` (Treinar) | — | `treinar.spec.js`: sair do app (página oculta) |
| **Cancelar** descarta as alterações e o rascunho | `js/app.js` (Treinar) | — | `treinar.spec.js`: Cancelar descarta |
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
| Treinos recentes: data e nome da ficha, do mais recente para o mais antigo | `js/app.js` (Início) | — | `inicio.spec.js`: lista com data e nome da ficha |
| Tocar num treino da lista abre o detalhe | `js/app.js` (Início) | — | `inicio.spec.js`: tocar num treino abre o detalhe |
| Ficha renomeada aparece com o nome novo na lista | `js/app.js` (Início) | — | `inicio.spec.js`: ficha renomeada aparece com o nome novo |

## Limites conhecidos

- **Testes de navegador ainda parciais**: fumaça (abrir, navegar, offline, privacidade, 375px), o Treinar
  e o Início inteiros. Os outros fluxos entram nas próximas issues da Fase 1 da refatoração (`documentation/REFACTOR.md`).
- **Wrapper de módulo do `core.js`** (detecção Node × navegador) fica fora da meta de cobertura: cada
  ambiente executa um dos lados. O lado do navegador é testado em `module.test.js` (carrega o core num
  escopo sem `module.exports` e confere que as funções viram globais).
