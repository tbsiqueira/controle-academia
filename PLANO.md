# Plano — App de Treinos (PWA)

## 1. Visão
Aplicativo web instalável (PWA) para registrar treinos de academia, acompanhar metas semanais flexíveis, manter fichas de exercícios e um calendário de frequência. Todos os dados ficam **100% no dispositivo** (IndexedDB), com backup em **JSON** (exportar/importar). Sem backend, sem publicação em lojas.

## 2. Decisões fechadas
- **Distribuição**: GitHub Pages (hospedagem estática gratuita; instala como app e funciona offline).
- **Armazenamento**: IndexedDB (nativo do navegador; funciona em Chrome/Edge e Safari/iOS).
- **Ciclo semanal**: aviso + confirmação ao fim dos 7 dias.
- **Stack**: HTML + CSS + JavaScript puro, sem build e sem dependências.
- **Idioma da interface**: pt-BR.
- **Idioma do código**: inglês (identificadores e comentários).
- **Fichas**: uma ficha agrupa vários exercícios (ex.: "TREINO A - inferiores"); ao registrar o treino, a ficha selecionada carrega automaticamente os exercícios dela.
- **Pré-preenchimento**: a ficha define **séries e reps de cada série**; a carga vem da **última execução**; RIR é preenchido no treino.
- **Desempenho**: progressão básica por exercício já no MVP.
- **UI framework**: Bootstrap 5 (arquivos locais em `vendor/`, sem CDN em runtime).

## 3. Requisitos funcionais
- **FR-01 — Registrar treino**: data, ficha (selecionada da lista; carrega os exercícios dela), cardio (minutos) e exercícios extras se quiser.
- **FR-02 — Séries por exercício**: cada série guarda nº, reps feitas, carga (kg), RIR (repetição na reserva) e observação livre. As séries são **pré-preenchidas** pelos padrões da ficha e editáveis.
- **FR-03 — Dashboard**: contador da semana (ex.: `1/3 treinos`, `30/120 min cardio`), últimos treinos e desempenho por exercício (última sessão vs anterior + PR).
- **FR-04 — Semana flexível**: o usuário marca "semana iniciada"; o app conta 7 dias a partir dessa data, sem fixar dias da semana.
- **FR-05 — Biblioteca de exercícios**: CRUD de exercícios (nome, grupo muscular, observação/lembrete), com **filtro por grupo** e **busca**; mostra **em quais fichas** cada exercício é usado. Ao criar, dá para selecionar de um **catálogo embutido** de exercícios em pt-BR.
- **FR-06 — Colinha**: seção de consulta rápida (RIR, tempo de descanso, lembretes) editável pelo usuário.
- **FR-07 — Calendário de frequência**: visão mensal com os dias em que treinou e quantidade de treinos no mês.
- **FR-08 — Backup**: exportar todos os dados em JSON (download); importar JSON restaurando os dados após confirmação, com **backup automático do estado atual antes de importar**.
- **FR-09 — PWA**: instalável na tela inicial, funciona offline após a primeira carga.
- **FR-10 — Fichas de treino**: CRUD de fichas com lista **ordenada** de exercícios; cada exercício da ficha tem **nº de séries**, **reps de cada série** (podem variar, ex.: 12-10-8) e **observação da professora**. É a ficha que você seleciona ao registrar o treino.
- **FR-11 — Editar/excluir treino**: qualquer treino registrado pode ser aberto para edição ou exclusão.
- **FR-12 — Aquecimento por exercício**: cada exercício no registro do treino tem sua própria linha de aquecimento, onde o aluno anota **reps, peso e RIR**.
- **FR-13 — Exportar treino em texto**: gerar uma mensagem legível de um treino específico (data, ficha, **aquecimento dentro de cada exercício**, séries com reps/carga/RIR/obs, cardio e observações) para **copiar** ou **compartilhar** com a professora.

## 4. Regras de negócio
- **Semana**: janela de 7 dias `[início, início + 6]` a partir da data marcada. Treinos são sempre atribuídos a uma semana **pela data**. Ao passar 7 dias, o app mostra um aviso "semana encerrada" com o resultado final da semana; o usuário confirma para avançar para a próxima janela. Treinos com data fora da janela atual **nunca se perdem** (ficam salvos por data). É possível redefinir o início a qualquer momento em Ajustes.
- **Meta padrão**: 3 treinos/semana e 120 min de cardio/semana (editável em Ajustes).
- **Treino válido**: conta para a meta se tiver pelo menos 1 série registrada ou cardio > 0.
- **Cardio**: minutos registrados dentro do treino (um treino pode ser "só cardio").
- **Aquecimento**: cada exercício do treino tem sua própria linha de aquecimento (reps, peso, RIR), salva junto do treino; **não** entra no desempenho por exercício nem na tonelagem.
- **Fichas**: ao registrar, seleciona uma ficha; os exercícios dela entram no formulário na ordem cadastrada (com opção de substituir o que já estava). O nome da ficha é copiado para o treino (snapshot) para preservar o histórico.
- **Catálogo embutido**: o app traz `data/exercises.json` (927 exercícios em pt-BR: fonte `gugeldev/exercicios-bd-ptbr`, licença CC0-1.0, + curadoria própria de exercícios comuns de academia). Cada item tem `id` inteiro sequencial **permanente** (nunca reatribuído ou reutilizado), `sourceId` original, `name` e `group`. Ao montar uma ficha (ou adicionar um exercício extra ao treino), dá para escolher do catálogo ou criar um próprio. Exercícios do catálogo **não** são copiados para a Biblioteca (a Biblioteca guarda apenas os exercícios criados pelo usuário).
- **Pré-preenchimento**: ao carregar a ficha, o app cria as séries com as **reps de cada série** definidas na ficha e usa a **carga da última execução** do exercício (se houver). O **aquecimento** também vem pré-preenchido com **reps e peso do treino anterior** (RIR em branco). **Carga e RIR pertencem ao treino**, não à ficha.
- **Criação on-the-fly**: na busca de exercícios (ao montar a ficha ou registrar o treino), se o nome não existir, o app oferece "Criar \"...\"" e cadastra o exercício na hora.
- **Desempenho**: por exercício, mostra a última sessão (carga × reps) vs a sessão anterior e o **PR** (maior carga já registrada em uma série; em empate, a série com mais reps).
- **Tonelagem** (opcional, Fase 2): `Σ(reps × carga)` por exercício e por treino, com exibição por toggle.
- **Fotos** (opcional, Fase 2): 1 foto por exercício, armazenada no IndexedDB (Blob) e incluída no JSON de export como base64.
- **Import**: restaura/substitui os dados locais após confirmação. O estado anterior fica em memória e pode ser recuperado com **"Desfazer importação"** (Mais → Dados) — sem downloads automáticos.
- **Edição**: treinos podem ser editados ou excluídos a qualquer momento; não há bloqueio de histórico.

## 5. Modelo de dados (IndexedDB)
Stores:
- `sheets` (fichas): `{ id, name, active, exercises[], createdAt, updatedAt }`
  - `exercises[]`: `{ exerciseId, name, sets, reps[] (reps de cada série), note (observação da professora) }` (na ordem da ficha)
- `workouts`: `{ id, date (YYYY-MM-DD), sheetId, sheetName (snapshot), cardioMinutes, notes, warmups[] { exerciseId, exerciseName, reps, load, rir }, sets[], createdAt, updatedAt }`
  - `sets[]`: `{ exerciseId, exerciseName (cópia do nome na época), exerciseNote (observação da ficha), number, reps, load, rir, note }`
- `exercises`: `{ id, name, group, correction, active, createdAt, updatedAt }` (biblioteca; sem carga/RIR — esses pertencem ao treino)
- `settings`: `{ id: 'app', weekAnchor (YYYY-MM-DD), weeklyWorkoutTarget, weeklyCardioTarget, tonnageVisible }`
- `colinha`: `{ id, title, content, order }`

## 6. Telas
| Tela | Função |
|---|---|
| Dashboard | Meta da semana, aviso de semana encerrada, últimos treinos (toque para **ver como foi**) |
| Ver treino (somente leitura) | Resumo do treino com aquecimento, séries, cardio e observações; toque no exercício para ver a **evolução**; botões Editar / Exportar / Excluir |
| Evolução do exercício | Melhor série por dia (barras), PR, tendência e histórico completo por data |
| Treinar (registro) | Data, ficha (selecionar/criar; carrega os exercícios dela), **aquecimento por exercício (reps/peso/RIR)**, séries (reps/carga/RIR/obs), cardio; ações **Salvar / Cancelar** (descarta) / Exportar texto / Excluir |
| Fichas e exercícios | Abas: **fichas** (grupo ordenado de exercícios) e **biblioteca** (filtro por grupo, busca e uso em fichas) + correção |
| Calendário | Frequência mensal |
| Colinha | RIR, descanso, lembretes |
| Ajustes | Meta semanal, início da semana, atalho para fichas, exportar/importar JSON, **apagar todos os dados** (tela própria com confirmação) |

## 7. Arquitetura / arquivos
```
index.html
css/styles.css
js/core.js (lógica pura, coberta por testes)
js/app.js + js/db.js
tests/core.test.js + tests/fixtures/ (testes de unidade e de compatibilidade de dados)
test.ps1 (roda os testes localmente)
vendor/bootstrap/ (Bootstrap 5 local)
vendor/bootstrap-icons/ (ícones locais)
manifest.webmanifest
sw.js (service worker)
icons/icon-192.png, icon-512.png
serve.ps1 (servidor local para teste)
check.ps1 (verificações estáticas: JSON, ids, handlers, assets, versão)
data/exercises.json (catálogo embutido de exercícios, pt-BR, CC0)
data/sample-data.json (dados de exemplo: 3 fichas, 12 treinos, 6 exercícios custom)
tools/build-sample-data.ps1 + tools/sample-data-content.json (gerador reprodutível da fixture)
README.md (como rodar, publicar no GitHub Pages, estrutura, versionamento)
MANUAL.md (documentação de uso: exemplos, FAQ, problemas comuns, glossário)
.gitattributes / .nojekyll (higiene do repositório e do GitHub Pages)
.github/workflows/deploy.yml (testes + verificação e deploy no Pages ao enviar uma tag v*)
.github/workflows/tests.yml (testes unitários e verificações a cada push na main / PR)
PLANO.md
```
- Service worker: cache-first para o "shell" do app; **nenhum dado é enviado a servidor**.
- Privacidade: sem analytics, sem chamadas externas; `Content-Security-Policy` no `index.html`.
- Teste local sem Node/Python: `serve.ps1` sobe um servidor HTTP local via PowerShell (`localhost` é contexto seguro, então o PWA pode ser testado antes de publicar).

## 8. Distribuição (GitHub Pages)
1. Repositório: `https://github.com/tbsiqueira/controle-academia.git`. Tudo na branch `main`; **a publicação no Pages acontece só ao enviar uma tag de versão** (`v1`, `v2`, ...) via GitHub Actions.
2. Habilitar GitHub Pages no repositório (Settings → Pages → branch `main`, pasta `/`).
3. No celular, abrir a URL e usar "Adicionar à tela inicial" (Chrome/Edge/Safari).
4. Depois de instalado, o app abre pelo ícone e funciona offline.

## 9. Fases
- **Fase 1 (MVP)**: fichas (grupo ordenado de exercícios) e biblioteca de exercícios com catálogo embutido, registro completo de treino (ficha carrega os exercícios, séries pré-preenchidas, cardio), edição/exclusão de treinos, dashboard com metas e desempenho por exercício, semana com aviso + confirmação, colinha, calendário, export/import JSON, PWA instalável.
- **Fase 2 (extras)**: foto por exercício, tonelagem opcional, melhorias de UX.

## 10. Suposições a confirmar
1. Tonelagem fica para a Fase 2, como exibição opcional — ok?
2. Foto por exercício fica para a Fase 2 — ok?
3. Importar substitui os dados atuais após confirmação (com backup automático) — ok?
4. Nome provisório do app: **"Meu Treino"**.
5. Regra da semana (item 4) atende ao que você imaginou?

## 11. Histórico de revisões
- **Revisão 1** (`dec-392110e34edd83a3`): distribuição via GitHub Pages, IndexedDB, semana com aviso + confirmação.
- **Revisão 2** (`dec-93a822fbea27513a`): tipo de treino como lista gerenciável, pré-preenchimento de séries, desempenho por exercício no MVP; edição/exclusão de treinos e backup automático no import.
- **Revisão 3**: catálogo embutido de exercícios (`data/exercises.json`, 869 itens pt-BR, CC0-1.0, fonte `gugeldev/exercicios-bd-ptbr`); idioma do código em inglês.
- **Revisão 4**: IDs do catálogo convertidos para inteiros sequenciais permanentes (1..869), com `sourceId` original preservado e política de estabilidade em `meta.idPolicy`.
- **Revisão 5** (`dec-a52daaa2e8f02e86`): UI framework Bootstrap 5, com arquivos vendados localmente (sem CDN em runtime).
- **Revisão 6**: busca do catálogo inline no modal de ficha (corrige modais sobrepostos); criação on-the-fly de exercícios; catálogo ampliado com +58 exercícios comuns de academia (ids 870–927, total 927).
- **Revisão 7**: "ficha" passa a ser o **treino completo** (agrupamento ordenado de exercícios) e "exercícios" viram a biblioteca; ao registrar, a ficha selecionada carrega os exercícios dela. Migração automática dos antigos "tipos de treino" para fichas (IndexedDB v2).
- **Revisão 8**: na ficha, cada exercício tem **séries + reps por série** (ex.: 3×12-10-8) e **observação da professora**; **carga e RIR saíram da ficha e da biblioteca** (pertencem ao treino). Biblioteca ficou com nome, grupo e observação.
- **Revisão 9**: **linha de aquecimento** no registro do treino (reps, peso, RIR), salva junto do treino.
- **Revisão 10**: o aquecimento passa a ser **por exercício** (cada exercício do treino tem sua própria linha de reps/peso/RIR), não um bloco único do treino.
- **Revisão 11**: aquecimento pré-preenchido com **reps e peso do treino anterior**; item do menu inferior "Exercícios" renomeado para **"Fichas"**.
- **Revisão 12**: acabamento visual — ícones em títulos/cards/botões, **barras de progresso** nas metas semanais, **seta de tendência** (↑/↓/=) no desempenho por exercício, badge de PR com troféu, numeração dos exercícios na ficha, destaque do **dia de hoje** no calendário e estados vazios com orientação.
- **Revisão 13** (`dec-23116a57a6ed6e0c`): aba "Exercícios" renomeada para **"Biblioteca"**, com **filtro por grupo muscular**, busca e indicação de **em quais fichas** cada exercício é usado.
- **Revisão 14**: item do menu "Registrar" renomeado para **"Treinar"**; cada treino pode ser **exportado como texto** legível (aquecimento, séries, cargas, RIR, observações, cardio) para copiar/compartilhar com a professora.
- **Revisão 15**: exercícios escolhidos do catálogo passam a ser **salvos na Biblioteca**; **tratamento de erro visível** nas ações (sem falhas silenciosas); treino com apenas aquecimento também salva; importação sem download automático, com **"Desfazer importação"**.
- **Revisão 16**: no texto exportado, o **aquecimento aparece dentro de cada exercício** (e exercícios só com aquecimento também são listados).
- **Revisão 17**: "Desempenho por exercício" saiu do Dashboard; novo fluxo de consulta: tocar num treino abre a tela **"Como foi o treino"** (somente leitura) e tocar num exercício abre a **Evolução** (melhor série por dia, PR, tendência e histórico).
- **Revisão 18**: botão **Cancelar** na tela de treino, descartando todas as alterações (volta ao "Como foi o treino" quando estava editando).
- **Revisão 19**: textos explicativos curtos na tela **Fichas** (o que é uma ficha, o que é a Biblioteca) e dica dentro do editor de ficha.
- **Revisão 20**: a **Biblioteca** passa a listar apenas os exercícios **criados pelo usuário** (os do catálogo não são mais copiados para lá nem aparecem na lista).
- **Revisão 21**: padronização das barras de botões (ações na **mesma linha**, botões de ícone com largura fixa `.btn-icon`) em todas as telas.
- **Revisão 42**: auditoria de **referências por id** em todo o app — `exerciseLabel`, `sheetLabel`, `exerciseTarget`, `exerciseMatches` e `exerciseKey` no core; agrupamento de séries, histórico, PR, fichas, pré-preenchimento e texto exportado passaram a resolver pelo id (nome guardado é só fallback para dados antigos/sem id); ids que eram descartados (`pickCatalogExercise`, adicionar do catálogo à ficha) passaram a ser gravados; itens inválidos de ficha são descartados na normalização.
- **Revisão 46**: Início passa a listar **todos os treinos** (não só os 5 recentes), com contador; ícones do app atualizados para os novos da pasta `icons/` (favicon 16/32, apple-touch 180, manifest 192/512 + maskable, precache no service worker).
- **Revisão 45**: teste de regressão de **base antiga** (`tests/old-db.test.js`): simula a era v33 (treinos/fichas sem id, nomes renomeados, `source: catalog` sem comprovação) passando pelo init (reparo + ligação por nome) e pela normalização — prova que nada se perde e que o histórico antigo continua encontrável pelo nome guardado (`historyTarget`). O reparo de sources ganhou uma versão pura (`fixLibrarySources`), usada pelo app.
- **Revisão 44**: cobertura **fechada em 100%** — o gate mede, além das linhas do Node, uma passada em **processo único** (sem os falsos positivos do relatório por processo) e exige zero trechos da lógica sem teste; ficou de fora só o wrapper de módulo (Node × navegador), validado por `tests/module.test.js`. No caminho, dois fallbacks inalcançáveis foram removidos do core. Gate agora **bloqueia** o CI (`COVERAGE_ENFORCE=1`).
- **Revisão 43**: **cobertura de testes 100%** de `js/core.js` (linhas e ramos) com gate no CI (`tools/coverage-gate.js` + `COVERAGE_ENFORCE=1`), lista funcionalidade → testes em `tests/CHECKLIST.md`, testes de borda e do registro do módulo no navegador. Decisão: **sem jsdom/npm**; o DOM fica coberto por verificações estáticas + lógica extraída para o core (ver "Limites conhecidos" no checklist).
- **Revisão 41**: corrigido o nome da ficha desatualizado na visão geral — o treino guarda o nome da ficha como snapshot, e as telas passaram a resolver o **nome atual pelo id** (`sheetLabel`, mesmo padrão do histórico de exercícios), inclusive no texto exportado; renomear/excluir ficha já atualiza Início, Fichas, seletor do treino e Calendário na hora.
- **Revisão 40**: compartilhamento manda **só o arquivo** (`{ files }`, sem `title` e sem `text`) — era o último campo capaz de virar um `.txt` no aparelho; a versão do app aparece ao lado do status do backup em **Mais → Dados** para conferir na hora se o telefone já tem o código novo.
- **Revisão 39**: **um botão só de backup** — "Exportar" (antes "Exportar" + "Compartilhar backup"): no celular abre o menu de compartilhamento, no computador baixa o arquivo; o ícone e a dica embaixo do botão (`backupHint`) mudam conforme o aparelho.
- **Revisão 38**: tela **Apagar dados** simplificada (só o checkbox, sem digitar `APAGAR`) e sem o botão de backup redundante; corrigido o botão de backup que baixava arquivo inválido (o handler recebia o evento de clique como argumento — agora validado por `isBackupPayload`, com teste de regressão).
- **Revisão 37**: compartilhamento do backup manda **apenas o arquivo** (`backupSharePayload`, sem `text`) — alguns aparelhos salvavam o texto como um segundo arquivo `.txt`; botões de atualização consolidados em um só (**"Atualizar app"** limpa o cache e recarrega), com o `reset.html` mantido apenas como página de escape.
- **Revisão 36**: corrigido o backup duplicado — a decisão virou regra pura (`backupAction`): **celular/tablet** abre o compartilhamento, **computador** baixa direto; se o compartilhamento falhar, o app **não** baixa sozinho (avisa e sugere "Exportar"). Feedback da ação ("Arquivo gerado: …" / "Backup compartilhado: …" / "cancelado").
- **Revisão 35**: fluxo de backup manual aprimorado — botão **Compartilhar backup** (Web Share API com arquivo: Drive, WhatsApp, Arquivos), **status do último backup** em Mais → Dados e **lembrete no Início** quando passa de 7 dias (dispensável). Decisão: manter 100% local, **sem** integração OAuth com o Google Drive.
- **Revisão 34**: campos de carga aceitam **vírgula** (`27,5`) e são exibidos com vírgula em pt-BR; no iPhone o campo decimal passou a `type="text"` + `inputmode="decimal"` (o `type="number"` bloqueava a tecla de vírgula) e o parser foi corrigido — antes `27,5` era salvo como `27`.
- **Revisão 33**: ferramentas de apoio versionadas (`tools/`) — o gerador da fixture de exemplo passou a ser reprodutível (`tools/build-sample-data.ps1` + conteúdo em `tools/sample-data-content.json`), e o `check.ps1` regenera e compara o hash para manter os dois em sincronia.
- **Revisão 32**: dados de exemplo (fixture) — `data/sample-data.json` com 3 fichas (5-6 exercícios do catálogo + 2 custom cada) e 12 treinos (4 por ficha, datas relativas), carregável em Mais → Dados de exemplo e usada como fixture nos testes de compatibilidade.
- **Revisão 31**: detalhes do treino em **listas** (`<ul>`) com o mesmo estilo das fichas; editor da ficha com rótulos claros; **referência por id (chave estrangeira)** nos itens de ficha — renomear um exercício atualiza fichas (por id e, para dados antigos, por nome) e o histórico que aponta para o id, com **migração automática** que liga fichas antigas à Biblioteca.
- **Revisão 30**: backup com **data e hora** no nome do arquivo (`meu-treino-backup-AAAA-MM-DD_HH-mm-ss.json`) e registro da **versão do app** dentro do arquivo.
- **Revisão 29**: lista de fichas redesenhada — cada ficha mostra os exercícios em uma **lista** (`<ul>`) numerada, com séries×reps em destaque e a observação ao lado, em vez da linha compacta.
- **Revisão 28**: correção da Biblioteca — o app não "adivinha" mais a origem pelo nome (`isUserExercise`): exercícios criados pelo usuário voltam a aparecer, e as marcações antigas sem `catalogId` são reparadas na inicialização.
- **Revisão 27**: correção do zoom automático do iOS ao focar campos de texto (controles de formulário com 16px em telas de celular).
- **Revisão 26**: extração da lógica pura para `js/core.js` (datas, semana, agrupamento de séries, aquecimento, histórico, exportação de texto e `normalizeBackup`) com **testes de unidade em Node** (`tests/core.test.js`, fixtures de backups v1/v2) e **pipelines** de testes (`tests.yml` a cada push/PR) e de deploy por tag (que só publica se os testes passarem).
- **Revisão 25**: fluxo de publicação seguro — apenas a branch `main` + **tags** de versão; o Pages é publicado por **GitHub Actions** quando uma tag `v*` é enviada (com `check.ps1` como portão antes do deploy).
- **Revisão 24**: `MANUAL.md` — documentação para usuários (primeiros passos, exemplo de ficha e de treino, evolução, metas, backup, FAQ, problemas comuns e glossário).
- **Revisão 23**: revisão geral de boas práticas — `README.md` completo (com passo a passo do GitHub Pages), `check.ps1` (verificações estáticas), `.gitattributes`, `.nojekyll`, `Content-Security-Policy` e `aria-label` nos botões de ícone.
- **Revisão 22**: busca **sem acentos** (ex.: "puxada maquina" encontra "Puxada máquina") em todas as buscas; a tela **Treinar** não cria mais fichas (o aluno cria na aba Fichas); nova tela **Apagar dados** (confirmação por digitação, sem `alert`).
