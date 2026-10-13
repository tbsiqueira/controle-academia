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
| Datas (ISO ↔ BR, somar dias, fuso local) | `core.js`: `pad2`, `fmtDate`, `parseDate`, `todayISO`, `addDaysISO`, `fmtBR`, `fmtDateTimeBR` | `core.test.js` (datas), `core-edge-cases.test.js` (formato vazio) |
| Semana flexível (janela de 7 dias, metas, aviso) | `core.js`: `defaultSettings`, `weekWindow`, `isValidWorkout` | `core.test.js`, `core-edge-cases.test.js` (`weekWindow` sem argumento) |
| Números com vírgula (bug do iPhone) | `core.js`: `parseLocalNumber`, `toNum`, `toNumOrNull`, `formatDecimal` | `core.test.js` (inclui regressão da carga `27,5`) |
| Busca sem acentos | `core.js`: `normalizeText` | `core.test.js` |
| Escapar HTML (XSS no que vem do banco) | `core.js`: `esc` | `core.test.js`, `setsSummaryLines` |
| Aquecimento (reps/carga/RIR) | `core.js`: `warmupHasData`, `warmupLine`, `warmupSummary`, `previousWarmupFields` | `core.test.js`, `core-edge-cases.test.js` |
| Séries e agrupamento **por id** | `core.js`: `setLine`, `setsSummaryLines`, `groupSets`, `exerciseKey` | `core.test.js`, `core-edge-cases.test.js` (mesmo nome/ids diferentes, só aquecimento, registro sem nome) |
| Histórico por exercício (gráfico, PR, tendência) | `core.js`: `lastLoadsForExercise`, `lastWarmupForExercise`, `sessionsForExercise`, `bestSetForExercise`, `exerciseMatches` | `core.test.js`, `core-edge-cases.test.js` (renomear não perde histórico; nomes iguais não se misturam; ordenação) |
| Nome **atual** de exercício e de ficha (sem nome congelado) | `core.js`: `exerciseLabel`, `sheetLabel`, `exerciseTarget` | `core.test.js`, `core-edge-cases.test.js` |
| Renomear exercício propaga (fichas antigas e histórico) | `core.js`: `renameInSheets`, `renameInWorkouts`, `linkSheetItemsToExercises` | `core.test.js`, `sample-data.test.js` (fixture antiga religada) |
| Texto do treino para enviar à professora | `core.js`: `workoutAsText` | `core.test.js`, `core-edge-cases.test.js` (nome atual, série sem número, treino vazio) |
| Fichas: criar/editar/excluir, itens, migração por nome | `core.js`: `normalizeSheet*`, `linkSheetItemsToExercises` | `core.test.js`, `core-edge-cases.test.js` |
| Biblioteca do usuário × catálogo | `core.js`: `isUserExercise`, `libraryExercises`, `exercisesNeedingRepair` | `core.test.js`, `core-edge-cases.test.js` |
| Backup: nome do arquivo, status e lembrete | `core.js`: `backupFileName`, `backupStatus` | `core.test.js`, `core-edge-cases.test.js` |
| Backup: exportar/compartilhar (um arquivo só) | `core.js`: `backupAction`, `backupSharePayload`, `isBackupPayload`, `backupHint` | `core.test.js` (payload sem `text`/`title`; evento de clique não vira backup) |
| Backup: importar e compatibilidade entre versões | `core.js`: `normalizeBackup`, `normalizeWorkout`, `normalizeSet`, `normalizeWarmup`, `normalizeSettings` | `core.test.js` + `tests/fixtures/backup-v1.json`, `backup-v2-sheets.json` |
| Dados de exemplo (3 fichas, 12 treinos) | `core.js`: `materializeSampleData` + `data/sample-data.json` | `sample-data.test.js` (estrutura, integridade referencial, progressão de cargas, normalização) |
| Catálogo embutido (ids únicos, contíguos, estáveis) | `data/exercises.json` | `core.test.js` (travas de ids) + `check.ps1` |
| Registro dos módulos no navegador (globais) | `js/core.js` (UMD) | `module.test.js` (roda o core num escopo de navegador) |
| Base antiga (era sem ids) sobrevive ao init | `core.js`: `fixLibrarySources`, `linkSheetItemsToExercises`, `historyTarget`, `normalizeBackup` | `old-db.test.js` (nenhuma série/carga/aquecimento/item se perde; histórico por nome guardado) |
| PWA: versão consistente, precache, offline | `index.html`, `sw.js`, `manifest.webmanifest` | `check.ps1` (13 verificações) |
| Exportar/importar/apagar dentro do app (telas) | `js/app.js` | `check.ps1` (ids e handlers) + lógica do `core.js` |

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
