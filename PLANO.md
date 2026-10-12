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
- **FR-05 — Exercícios (biblioteca)**: CRUD de exercícios (nome, grupo muscular, observação/lembrete); ao criar, é possível selecionar de um **catálogo embutido** de exercícios em pt-BR.
- **FR-06 — Colinha**: seção de consulta rápida (RIR, tempo de descanso, lembretes) editável pelo usuário.
- **FR-07 — Calendário de frequência**: visão mensal com os dias em que treinou e quantidade de treinos no mês.
- **FR-08 — Backup**: exportar todos os dados em JSON (download); importar JSON restaurando os dados após confirmação, com **backup automático do estado atual antes de importar**.
- **FR-09 — PWA**: instalável na tela inicial, funciona offline após a primeira carga.
- **FR-10 — Fichas de treino**: CRUD de fichas com lista **ordenada** de exercícios; cada exercício da ficha tem **nº de séries**, **reps de cada série** (podem variar, ex.: 12-10-8) e **observação da professora**. É a ficha que você seleciona ao registrar o treino.
- **FR-11 — Editar/excluir treino**: qualquer treino registrado pode ser aberto para edição ou exclusão.
- **FR-12 — Aquecimento por exercício**: cada exercício no registro do treino tem sua própria linha de aquecimento, onde o aluno anota **reps, peso e RIR**.

## 4. Regras de negócio
- **Semana**: janela de 7 dias `[início, início + 6]` a partir da data marcada. Treinos são sempre atribuídos a uma semana **pela data**. Ao passar 7 dias, o app mostra um aviso "semana encerrada" com o resultado final da semana; o usuário confirma para avançar para a próxima janela. Treinos com data fora da janela atual **nunca se perdem** (ficam salvos por data). É possível redefinir o início a qualquer momento em Ajustes.
- **Meta padrão**: 3 treinos/semana e 120 min de cardio/semana (editável em Ajustes).
- **Treino válido**: conta para a meta se tiver pelo menos 1 série registrada ou cardio > 0.
- **Cardio**: minutos registrados dentro do treino (um treino pode ser "só cardio").
- **Aquecimento**: cada exercício do treino tem sua própria linha de aquecimento (reps, peso, RIR), salva junto do treino; **não** entra no desempenho por exercício nem na tonelagem.
- **Fichas**: ao registrar, seleciona uma ficha; os exercícios dela entram no formulário na ordem cadastrada (com opção de substituir o que já estava). O nome da ficha é copiado para o treino (snapshot) para preservar o histórico.
- **Catálogo embutido**: o app traz `data/exercises.json` (927 exercícios em pt-BR: fonte `gugeldev/exercicios-bd-ptbr`, licença CC0-1.0, + curadoria própria de exercícios comuns de academia). Cada item tem `id` inteiro sequencial **permanente** (nunca reatribuído ou reutilizado), `sourceId` original, `name` e `group`. Ao montar uma ficha (ou adicionar um exercício extra ao treino), dá para escolher do catálogo ou criar um próprio.
- **Pré-preenchimento**: ao carregar a ficha, o app cria as séries com as **reps de cada série** definidas na ficha e usa a **carga da última execução** do exercício (se houver). RIR e observação de série começam vazios. **Carga e RIR pertencem ao treino**, não à ficha.
- **Criação on-the-fly**: na busca de exercícios (ao montar a ficha ou registrar o treino), se o nome não existir, o app oferece "Criar \"...\"" e cadastra o exercício na hora.
- **Desempenho**: por exercício, mostra a última sessão (carga × reps) vs a sessão anterior e o **PR** (maior carga já registrada em uma série; em empate, a série com mais reps).
- **Tonelagem** (opcional, Fase 2): `Σ(reps × carga)` por exercício e por treino, com exibição por toggle.
- **Fotos** (opcional, Fase 2): 1 foto por exercício, armazenada no IndexedDB (Blob) e incluída no JSON de export como base64.
- **Import**: restaura/substitui os dados locais após confirmação; antes de substituir, o app gera um backup automático do JSON atual.
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
| Dashboard | Meta da semana, aviso de semana encerrada, últimos treinos (editar/excluir), desempenho por exercício |
| Registrar treino | Data, ficha (selecionar/criar; carrega os exercícios dela), **aquecimento por exercício (reps/peso/RIR)**, séries (reps/carga/RIR/obs), cardio |
| Fichas e exercícios | Abas: **fichas** (grupo ordenado de exercícios) e **biblioteca de exercícios** + correção |
| Calendário | Frequência mensal |
| Colinha | RIR, descanso, lembretes |
| Ajustes | Meta semanal, início da semana, atalho para fichas, exportar/importar JSON |

## 7. Arquitetura / arquivos
```
index.html
css/styles.css
js/app.js + js/db.js
vendor/bootstrap/ (Bootstrap 5 local)
vendor/bootstrap-icons/ (ícones locais)
manifest.webmanifest
sw.js (service worker)
icons/icon-192.png, icon-512.png
serve.ps1 (servidor local para teste)
data/exercises.json (catálogo embutido de exercícios, pt-BR, CC0)
PLANO.md
```
- Service worker: cache-first para o "shell" do app; **nenhum dado é enviado a servidor**.
- Privacidade: sem analytics, sem chamadas externas; `Content-Security-Policy` no `index.html`.
- Teste local sem Node/Python: `serve.ps1` sobe um servidor HTTP local via PowerShell (`localhost` é contexto seguro, então o PWA pode ser testado antes de publicar).

## 8. Distribuição (GitHub Pages)
1. Repositório: `https://github.com/tbsiqueira/controle-academia.git` (branch `main`).
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
