# Checklist de cobertura — funcionalidade → testes

Mapa de **cada funcionalidade do app** para os testes que a cobrem. Serve para responder
"isso está testado?" sem precisar ler os testes inteiros.

- Testes: `node --test tests/` (sem dependências).
- Cobertura: `node tools/coverage-gate.js` (o CI exige **100% de linhas e ramos em `js/core.js`**).
- Lógica pura fica em `js/core.js` de propósito: é o que dá para testar sem navegador.
- Telas/manipulação de DOM (`js/app.js`) são verificadas estaticamente pelo `check.ps1`
  (ids, handlers, assets, versão, anti-zoom) e usam a lógica testada do `core.js`.

| Funcionalidade | Onde vive | Testes |
|---|---|---|
| Datas (ISO ↔ BR, somar dias, fuso local) | `core.js`: `pad2`, `fmtDate`, `parseDate`, `todayISO`, `addDaysISO`, `fmtBR`, `dateParts`, `fmtDateTimeBR` | `core.test.js` (datas), `core-edge-cases.test.js` (formato vazio) |
| Semana flexível (janela de 7 dias, metas, aviso) | `core.js`: `defaultSettings`, `weekWindow`, `isValidWorkout` | `core.test.js`, `core-edge-cases.test.js` (`weekWindow` sem argumento) |
| Números com vírgula (bug do iPhone) | `core.js`: `parseLocalNumber`, `toNum`, `toNumOrNull`, `formatDecimal` | `core.test.js` (inclui regressão da carga `27,5`) |
| Busca sem acentos | `core.js`: `normalizeText` | `core.test.js` |
| Escapar HTML (XSS no que vem do banco) | `core.js`: `esc` | `core.test.js`, `setsSummaryLines` |
| Aquecimento (reps/carga/RIR) | `core.js`: `warmupHasData`, `warmupLine`, `previousWarmupFields` | `core.test.js`, `core-edge-cases.test.js` |
| Séries e agrupamento **por id** | `core.js`: `setLine`, `setsSummaryLines`, `groupSets`, `exerciseKey` | `core.test.js`, `core-edge-cases.test.js` (mesmo nome/ids diferentes, só aquecimento, registro sem nome) |
| Histórico por exercício (gráfico, PR, tendência) | `core.js`: `workoutRecords`, `lastLoadsForExercise`, `lastWarmupForExercise`, `sessionsForExercise`, `bestSetForExercise`, `exerciseMatches` | `core.test.js`, `core-edge-cases.test.js` (renomear não perde histórico; nomes iguais não se misturam; ordenação), `form-and-progress.test.js` (recordes: primeira vez e carga igual não contam) |
| Nome **atual** de exercício e de ficha (sem nome congelado) | `core.js`: `exerciseLabel`, `sheetLabel`, `exerciseTarget` | `core.test.js`, `core-edge-cases.test.js` |
| Renomear exercício propaga (fichas antigas e histórico) | `core.js`: `renameInSheets`, `renameInWorkouts`, `linkSheetItemsToExercises` | `core.test.js`, `sample-data.test.js` (fixture antiga religada) |
| Dica "Última vez" e repetir o último treino da ficha | `core.js`: `lastSessionForExercise`, `lastSessionLine`, `lastWorkoutForSheet`, `formFromWorkout` | `form-and-progress.test.js` (ignora o treino em edição, `typeId` antigo, RIR/obs em branco) |
| Rascunho do treino em andamento | `core.js`: `draftHasContent` (gravação/restauração no `app.js`) | `form-and-progress.test.js` |
| Timer de descanso | `core.js`: `restSecondsOf`, `fmtClock` | `form-and-progress.test.js` |
| Lista curta do Início e filtro por ficha | `core.js`: `recentCutoff`, `visibleWorkoutCount`, `sheetFilterOptions` | `form-and-progress.test.js` (virada do ano, mínimo de treinos) |
| Evolução semanal (volume, treinos, cardio) | `core.js`: `workoutVolume`, `weeklyTotals` | `form-and-progress.test.js` (aquecimento fora do volume, treino inválido) |
| Texto do treino para enviar à professora | `core.js`: `workoutAsText` | `core.test.js`, `core-edge-cases.test.js` (nome atual, série sem número, treino vazio) |
| Fichas: criar/editar/excluir, itens, migração por nome | `core.js`: `normalizeSheet*`, `linkSheetItemsToExercises` | `core.test.js`, `core-edge-cases.test.js` |
| Importar ficha em JSON (contrato `FICHA-JSON.md`, sugestão de exercício parecido, lista para a IA) | `core.js`: `parseSheetImportText`, `parseSheetImport`, `suggestExercises`, `exerciseNamesText` | `core.test.js` (cerca ```json, JSON quebrado, formatos aceitos, reps, erros, ordem das sugestões, nomes sem repetir) |
| Biblioteca do usuário × catálogo | `core.js`: `isUserExercise`, `libraryExercises`, `fixLibrarySources` | `core.test.js`, `core-edge-cases.test.js` |
| Backup: nome do arquivo, status e lembrete | `core.js`: `backupFileName`, `backupStatus` | `core.test.js`, `core-edge-cases.test.js` |
| Backup: exportar/compartilhar (um arquivo só) | `core.js`: `backupAction`, `backupSharePayload`, `isBackupPayload`, `backupHint` | `core.test.js` (payload sem `text`/`title`; evento de clique não vira backup) |
| Backup: importar e compatibilidade entre versões | `core.js`: `normalizeBackup`, `normalizeWorkout`, `normalizeSet`, `normalizeWarmup`, `normalizeSettings` | `core.test.js` + `tests/fixtures/backup-v1.json`, `backup-v2-sheets.json` |
| Dados de exemplo (3 fichas, 12 treinos) | `core.js`: `materializeSampleData` + `data/sample-data.json` | `sample-data.test.js` (estrutura, integridade referencial, progressão de cargas, normalização) |
| Catálogo embutido (ids únicos, contíguos, estáveis) | `data/exercises.json` | `core.test.js` (travas de ids) + `check.ps1` |
| Registro dos módulos no navegador (globais) | `js/core.js` (UMD) | `module.test.js` (roda o core num escopo de navegador) |
| Base antiga (era sem ids) sobrevive ao init | `core.js`: `fixLibrarySources`, `linkSheetItemsToExercises`, `historyTarget`, `normalizeBackup` | `old-db.test.js` (nenhuma série/carga/aquecimento/item se perde; histórico por nome guardado) |
| PWA: versão consistente, precache, offline | `index.html`, `sw.js`, `manifest.webmanifest` | `check.ps1` (13 verificações) |
| Exportar/importar/apagar dentro do app (telas) | `js/app.js` | `check.ps1` (ids e handlers) + lógica do `core.js` |
| Telas da importação de ficha (colar, revisão, botão Revisar → Importar), desativar/reativar ficha, tela #/ia, card Debug | `js/app.js` | `check.ps1` (ids e handlers) + lógica do `core.js` (`parseSheetImportText`, `suggestExercises`, `exerciseNamesText`, `normalizeSheet` mantém `active: false`) |
| Importar/desfazer/dados de exemplo sem risco de perder tudo (apaga e grava numa transação só) | `db.js`: `dbReplaceAll` (usado por `restoreAll` no `app.js`) | `db.test.js` (IndexedDB falso: uma transação, `clear` antes do `put`, `abort` em registro inválido) |
| Calendário: trocar de mês (inclusive nos dias 29–31) | `core.js`: `shiftMonth` | `core-edge-cases.test.js` (31/out ‹ vai para setembro; 31/jan › vai para fevereiro; virada do ano) |
| Selo de PR na evolução do exercício (some quando não há carga) | `core.js`: `maxBestLoad` | `core-edge-cases.test.js` (peso do corpo = 0, sem "PR 1 kg"; maior carga; carga < 1 kg) |
| Backup importado não confia no arquivo (ids e datas) | `core.js`: `normalizeBackup` (`hasSafeId`), `normalizeWorkout`, `normalizeSettings` | `core-edge-cases.test.js` (id com aspas/tags é descartado; formatos antigos de id mantidos; data inválida vira "sem data"; início da semana inválido; idempotência) |
| Service worker: `?v=N` sai do cache primeiro (abre rápido com sinal fraco); resto é rede primeiro | `sw.js` | `sw.test.js` (cache e rede falsos: produção × localhost, offline, versão nova = URL nova, o que não é interceptado) |
| Iniciar próxima semana (pula as semanas perdidas de uma vez) | `core.js`: `nextWeekAnchor` | `core-edge-cases.test.js` (1 semana, 3 semanas paradas, virada do ano, mesmo dia da semana) |
| Formulário do Treinar: linha da série (carga larga, número como texto) | `core.js`: `setRowHtml`, `setHeaderHtml` | `form-and-progress.test.js` (colunas 1-2-3-2-4, "102,5" cabe, handlers `setField`, teclados, escape) |
| Remover exercício do treino em andamento (confirma se há algo preenchido) | `core.js`: `groupHasData` (pergunta no `app.js`: `removeFormExercise`) | `form-and-progress.test.js` (série/aquecimento preenchidos, RIR 0, em branco, confirmação antes do `splice`) |
| Carga com vírgula também no resumo, histórico e texto exportado | `core.js`: `setLine`, `warmupLine`, `setsSummaryLines`, `workoutAsText` (parâmetro `useComma`) | `core-edge-cases.test.js` (vírgula quando pedido; sem o parâmetro o formato antigo não muda) |
| Treino aberto sobrevive a recarregar a página (`#/detail/<id>`) | `core.js`: `parseRoute` (usado pelo `navigate` no `app.js`) | `core-edge-cases.test.js` (id no endereço, endereços antigos sem id, endereço vazio, app sempre navega com id) |
| Não repetir o mesmo exercício no treino nem na ficha | `core.js`: `hasExercise` (avisos no `app.js`: `addExerciseToForm`, `addSheetExercise`) | `core-edge-cases.test.js` (por id, id do catálogo como texto, item de ficha com `name`, registro antigo sem id; prova do agrupamento que motivou o bloqueio) |
| Ficha: no máximo 20 séries por exercício (editor, importação e backup) | `core.js`: `normalizeSheetItem` (usado também por `saveSheetEditor` no `app.js`) | `core-edge-cases.test.js` (500 vira 20, lista de reps longa, formato v2, fichas normais intactas) |
| Dois treinos no mesmo dia: o mais recente vem primeiro | `core.js`: `byDateDesc` (usado em toda ordenação por data) | `core-edge-cases.test.js` (qualquer ordem de entrada, sem `createdAt`, "última vez"/cargas/aquecimento do treino mais novo) |
| Busca de exercício (seletor do treino, da ficha e do cadastro) | `core.js`: `pickerHtml` (os três `render*Results` do `app.js`) | `picker.test.js` (Biblioteca × catálogo, busca sem acento, Criar, limites, escape, handlers existem e aceitam id como texto, código morto não voltou) |
| Resumo no card do Início (exercícios · volume · cardio · recordes) | `core.js`: `workoutSummary`, `fmtThousands` (+ `workoutRecords`) | `features.test.js` (linha completa, partes zeradas, singular, dados de exemplo, card usa o resumo) |
| Começar o treino em um toque (botão "Treinar: <ficha>" no Início) | `core.js`: `nextSheet` (botão e carga da ficha no `app.js`) | `features.test.js` (próxima ficha em ordem alfabética, volta ao início, ficha desativada/excluída, sem fichas, dados v1) |
| Remover a última série de um exercício no Treinar | `core.js`: `setHasData` (botão "− série" no `app.js`: `removeFormSet`) | `features.test.js` (série em branco × preenchida, nunca remove a única, confirma antes) |
| Marcar a série como feita inicia o descanso (botão no número da série) | `core.js`: `setRowHtml` (ação no `app.js`: `toggleSetDone`) | `features.test.js` (botão, estado feito, acessibilidade, carga continua larga, `done` não vai para o treino salvo, sem som/vibração) |
| Calendário: tocar no dia abre o treino daquele dia | `core.js`: `workoutsByDate` (link no `app.js`: `renderCalendar`) | `features.test.js` (agrupa por dia, mais recente primeiro, sem data fica de fora, link `#/detail/<id>`) |
| 1RM estimado na evolução do exercício (Epley) | `core.js`: `estimate1RM`, `best1RMForExercise` | `features.test.js` (fórmula, 1 rep, sem carga/reps, mais reps com a mesma carga = progresso, melhor série do exercício) |
| Avisos de sucesso somem sozinhos (toast); erros e perguntas continuam bloqueando | `index.html`: `#appToast`; `app.js`: `showToast` | `features.test.js` (5 mensagens de sucesso viraram toast, erros continuam `alert`, texto puro) |
| Área de toque de 44px nos botões só com ícone | `css/styles.css`: `.btn-sm[aria-label]` | `features.test.js` (regra presente; todo botão de ícone tem `aria-label`) |
| Card Debug fechado por padrão (atrás de "Opções avançadas") | `index.html`: `<details>` | `features.test.js` (começa fechado, contém atualizar/apagar/exemplo, backup continua à vista) |
| Campos do aquecimento com nome para leitor de tela | `app.js`: `renderFormSets` | `features.test.js` (reps, peso e RIR com `aria-label`) |

## Limites conhecidos

- **`js/app.js` (DOM) não tem teste automatizado de tela**: isso exigiria um ambiente de navegador
  (jsdom/npm) e a decisão do projeto foi manter **zero dependências** — a lógica foi extraída para o
  `core.js` e o resto é coberto pelas verificações estáticas.
- **Wrapper de módulo do `core.js`** (detecção Node × navegador) fica fora da meta de cobertura: cada
  ambiente executa um dos lados. O lado do navegador é testado em `module.test.js` (carrega o core num
  escopo sem `module.exports` e confere que as funções viram globais).
- **Manipulação do `Bootstrap` e do IndexedDB** é verificada no app publicado, não em teste automatizado.
- Se um dia entrar um ambiente de DOM, o alvo natural é cobrir `js/app.js` e mover a meta de cobertura
  para lá também.
