# Meu Treino

Aplicativo web instalável (**PWA**) para registrar treinos de academia: fichas com exercícios ordenados,
aquecimento por exercício, séries com carga e RIR, recordes e 1RM estimado, metas semanais flexíveis,
calendário de frequência com evolução semanal,
exportação do treino como texto para enviar à professora e **importação de fichas em JSON** (geradas por uma IA
a partir do plano/PDF da professora, seguindo o contrato [FICHA-JSON.md](FICHA-JSON.md)) e **importação de treinos
antigos** de uma planilha, com as fichas da rotina mais recente recriadas (contrato [TREINO-JSON.md](TREINO-JSON.md)).

📖 **Como usar o app, passo a passo: [documentation/MANUAL.md](documentation/MANUAL.md)**

**Todos os dados ficam apenas no seu aparelho** (IndexedDB). Não existe backend, conta, login, analytics
ou qualquer chamada externa. O backup é feito por arquivo JSON (exportar/importar).

---

## Como rodar localmente

Não é necessário Node, Python ou qualquer build — é HTML/CSS/JS puro.

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

Depois abra <http://localhost:8080> no navegador. (`localhost` é contexto seguro, então o service worker
e a instalação como app funcionam.)

> Abrir o `index.html` direto pelo explorador de arquivos (`file://`) **não** funciona: o navegador bloqueia
> o `fetch` do catálogo e o registro do service worker. Use o `serve.ps1`.

### Testes e verificações

```powershell
powershell -ExecutionPolicy Bypass -File .\test.ps1    # testes unitários (Node 18+, sem dependências)
powershell -ExecutionPolicy Bypass -File .\check.ps1   # verificações estáticas
npm run test:e2e                                       # testes de navegador (Playwright)
```

- **`test.ps1`** roda `node --test tests/`. Se o Node não estiver instalado, ele apenas avisa (os testes
  rodam no GitHub Actions de qualquer forma).
- **Testes de navegador** (`tests/e2e/`): abrem o app de verdade num Chromium de celular (375px). Precisam de
  `npm ci` e `npx playwright install chromium` uma vez; o `package.json` é só para essas ferramentas, o app
  não usa nada dele. `npm run test:e2e:ui` mostra cada passo; `npm run test:e2e:report` abre o relatório.
  Toda funcionalidade do `tests/CHECKLIST.md` tem teste de navegador (o CI cobra), e `npm run test:e2e:coverage`
  mostra quanto do `js/app.js` eles executam; no CI esse número não pode cair em relação à `main`.
- **`check.ps1`** confere JSONs, referências de `id`, handlers `onclick`, assets do HTML e do service
  worker, o catálogo (ids únicos/contíguos/estáveis), o versionamento e se o `core.js` está ligado.

Os dois rodam automaticamente no GitHub Actions:

| Workflow | Quando roda |
|---|---|
| `.github/workflows/tests.yml` | em todo pull request (checks obrigatórios do merge) e a cada push na `main` |
| `.github/workflows/deploy.yml` | a cada merge na `main` com versão nova — **só publica se os testes passarem** |

**O que os testes cobrem:** toda a lógica pura (`js/core.js`) — datas, janela da semana, busca sem acentos,
agrupamento de séries **por id**, aquecimento, histórico/PR, geração do texto exportado, backup
(nome/status/lembrete/payload), importação de ficha em JSON (validação, sugestão de exercício parecido) e, principalmente, **compatibilidade de dados entre versões**: backups antigos
(v1 com "tipos de treino", v2 com ficha de reps único) são normalizados sem perder nada, e a normalização
é idempotente. Os arquivos de referência ficam em `tests/fixtures/`.

**Cobertura:** `node tools/coverage-gate.js` roda os testes e exige **100% das linhas de `js/core.js` e
nenhum trecho da lógica sem teste** (no CI, `COVERAGE_ENFORCE=1` reprova o build se cair). Ele publica o
resultado como *annotations* do GitHub Actions, então dá para ver o que faltou sem abrir o log.

> `core.js` e `db.js` são **ES modules**: os testes (`tests/*.test.mjs`) fazem `import` deles direto. No
> navegador, a ponte temporária `js/bridge.js` publica os exports no `window` para o `app.js` (até a issue #9);
> `tests/module.test.mjs` confere a ponte e a ordem dos scripts no `index.html`.

📋 **Qual teste cobre qual funcionalidade: [tests/CHECKLIST.md](tests/CHECKLIST.md)**

---

## Fluxo de trabalho e publicação (PR → merge → deploy)

A `main` é protegida: **nada entra nela por push direto**. Toda mudança vai numa branch, abre um pull
request e só entra com **merge por rebase** depois que os checks passam. O site publica sozinho:

```
branch + PR               → roda tests.yml (Testes unitários, Verificações estáticas, Testes de navegador, Versão)
merge do PR (por rebase)  → deploy.yml: versão vN ainda sem tag? testa, publica no Pages e cria a tag vN
PR só de docs/CI          → mantém a versão → o deploy vê que vN já tem tag e não publica nada
```

O job **Versão** reprova o PR se `index.html`, `css/` ou `js/` mudaram e a versão não subiu (ou se a
versão já tem tag). Ninguém cria tag à mão: quem cria é o `deploy.yml`, depois de publicar.

### Configurar (uma vez só)

1. No repositório, abra **Settings** → **Pages**.
2. Em **Build and deployment** → **Source**, escolha **GitHub Actions**.
3. Pronto. A URL publicada fica em `https://<usuario>.github.io/<repositorio>/`.
4. Abra essa URL no celular e use **"Adicionar à tela inicial"**:
   - **Android/Chrome**: menu ⋮ → *Adicionar à tela inicial* / *Instalar app*.
   - **iPhone/Safari**: botão **Compartilhar** → *Adicionar à Tela de Início*.

> O repositório precisa ser **público** para o Pages no plano gratuito (em repositório privado, só com
> GitHub Pro/Team).

### Regras do repositório (já aplicadas)

- **Settings → General → Pull Requests**: só **Allow rebase merging** ligado (merge commit e squash
  desligados), **Allow auto-merge** e **Automatically delete head branches** ligados.
- **Settings → Rules → Rulesets → `main`**: bloqueia push direto, force push e exclusão; exige PR, histórico
  linear, merge por rebase e os checks `Testes unitários`, `Verificações estáticas`, `Testes de navegador` e `Versão` com a
  branch atualizada com a `main`. Mudou o nome de um job em `tests.yml`? Atualize o ruleset.
- **Settings → Environments → `github-pages`**: a regra de branch `main` permite o deploy.

### Publicar uma versão nova

```powershell
# 1) parta da main atualizada e crie uma branch
git checkout main
git pull --ff-only origin main
git switch -c feat/minha-mudanca

# 2) desenvolva, suba a versão (index.html + sw.js) e confira
node --test tests/
powershell -ExecutionPolicy Bypass -File .check.ps1
git commit -am "feat: ... (v75)"

# 3) atualize com a main, envie e abra o PR com merge automático por rebase
git fetch origin
git rebase origin/main
git push -u origin feat/minha-mudanca
gh pr create --base main --fill
gh pr merge --rebase --auto
```

Quando os checks passam, o PR entra na `main` e **Actions → Publicar no GitHub Pages** publica e cria a
tag. Leva ~1–2 minutos. No aparelho, feche e abra o app (ou use **Mais → Debug → Atualizar app**).

### Voltar para uma versão anterior

Reverta a mudança num PR (`git revert <commit>`) **e suba a versão de novo** (ex.: v75 → v76), senão os
celulares continuam com o cache. O merge publica a v76 normalmente.

### Se o deploy falhar

| Erro mostrado no Actions | Causa | Solução |
|---|---|---|
| `Branch "main" is not allowed to deploy to github-pages due to environment protection rules` | O ambiente `github-pages` não tem a regra da branch `main` | **Settings → Environments → `github-pages` → Deployment branches and tags** → adicione **Ref type: `Branch`**, **Name pattern: `main`**. Depois **Re-run all jobs** |
| Merge entrou mas nada foi publicado | a versão não subiu, então a tag `vN` já existia | esperado para PRs de docs/CI; se mexeu no app, o job **Versão** deveria ter barrado: confira o ruleset |
| `Get Pages site failed` / `Pages site not found` | Pages não está com a fonte **GitHub Actions** | **Settings → Pages → Source: GitHub Actions** |
| Falhou em "Rodar check.ps1" | versão inconsistente ou arquivo/id faltando | rode localmente `powershell -ExecutionPolicy Bypass -File .\check.ps1` e corrija num novo PR |
| Deploy "verde" mas o site não atualizou | cache do navegador/service worker | no aparelho: **Mais → Debug → Atualizar app**; no PC: Ctrl+F5 ou `/reset.html` |

### Publicar manualmente (emergência)

Aba **Actions** → **Publicar no GitHub Pages** → **Run workflow** (publica o estado atual da `main` e
cria a tag se faltar). Use só quando precisar.

## Estrutura

```
index.html                  app shell (telas, modais)
css/styles.css              estilos (tema verde-limão, navegação inferior, calendário, botões)
js/core.js                  lógica pura (datas, semana, agrupamento por id, histórico, exportação, backups)
js/app.js                   lógica do app (telas, fichas, treinos, histórico, backup)
js/db.js                    camada IndexedDB (workouts, exercises, sheets, settings, colinha)
js/bridge.js                ponte temporária: publica core.js e db.js (ES modules) no window para o app.js
js/package.json             só {"type": "module"}: o Node lê js/*.js como módulo
data/exercises.json         catálogo embutido com 927 exercícios em pt-BR
data/sample-data.json       dados de exemplo (3 fichas, 12 treinos) - usados no app e nos testes
tools/build-sample-data.ps1 gerador da fixture de exemplo (o check.ps1 confere se está em sincronia)
tools/sample-data-content.json  conteúdo em pt-BR dos dados de exemplo
tools/coverage-gate.js      roda os testes e exige 100% de cobertura de js/core.js
tests/core.test.mjs         testes da lógica pura e da compatibilidade de dados
tests/core-edge-cases.test.mjs testes de borda (dados ausentes/inválidos, nomes congelados, ids)
tests/module.test.mjs       core.js/db.js como módulos e a ponte js/bridge.js
tests/sample-data.test.mjs  testes da fixture de exemplo
tests/CHECKLIST.md          mapa funcionalidade -> testes
tests/fixtures/             backups de versões antigas usados nos testes
vendor/                     Bootstrap 5 + Bootstrap Icons + fonte Plus Jakarta Sans (OFL), locais, sem CDN
manifest.webmanifest        manifest do PWA
sw.js                       service worker (cache-first nos arquivos ?v=N, network-first no resto, com fallback offline)
reset.html                  página de escape: desregistra o service worker e limpa o cache
serve.ps1                   servidor local de desenvolvimento
test.ps1                    roda os testes unitários (Node)
check.ps1                   verificações estáticas
documentation/MANUAL.md     manual do usuário (como usar, exemplos, FAQ)
FICHA-JSON.md               contrato do JSON de ficha para a IA (servido pelo app e usado em Fichas → Criar com IA)
TREINO-JSON.md              contrato do JSON de treinos antigos + fichas (servido pelo app e usado em Mais → Importar treinos antigos)
documentation/PLANO.md      plano/requisitos e histórico de revisões
```

## Dados de exemplo (fixture)

`data/sample-data.json` é uma fixture com **3 fichas**, **12 treinos** (4 por ficha) e **6 exercícios criados
pelo usuário** — cada ficha mistura exercícios do catálogo com **2 exercícios custom**.

- **No app**: **Mais → Debug → Carregar dados de exemplo**. Substitui os dados atuais e pode ser
  desfeito pelo botão **Desfazer** do card Dados (o estado anterior fica em memória). As datas ficam em `dayOffset`
  (dias em relação a hoje), então a demonstração está sempre recente.
- **Nos testes**: `tests/sample-data.test.mjs` valida estrutura, integridade referencial, normalização de
  backup, migração de dados antigos e renomeação — é a rede de segurança contra quebra de dados entre versões.
- **Não** entra no precache do service worker: é buscada sob demanda (a primeira carga precisa de internet).
- **Reprodutível**: é gerada por `tools/build-sample-data.ps1` a partir de `tools/sample-data-content.json`
  (veja `tools/README.md`). O `check.ps1` regenera e compara o hash — se o JSON e o gerador saírem de
  sincronia, a pipeline avisa.

## Modelo de dados (IndexedDB v2)

**Regra do projeto: referência sempre por `id`; o nome é só uma cópia de apoio.** Todo registro que aponta
para um exercício ou para uma ficha guarda o `id` e, junto, o nome *como estava no dia* (para não perder
contexto se o registro for excluído). Na hora de exibir, o app resolve o **nome atual pelo id**
(`exerciseLabel`, `sheetLabel`) — por isso renomear um exercício ou uma ficha aparece em todo o app,
inclusive no histórico. Registros antigos, que só têm o nome, continuam funcionando pelo fallback.

Dois espaços de id, sem colisão: **biblioteca do usuário** = UUID (texto) e **catálogo embutido** = inteiro
(1..927). O `id` é sempre comparado **como texto** (`String(id)`) no core, porque ele pode chegar como número
(registro do banco) ou como texto (atributo `data-*` do HTML) — regra única em `exerciseMatches`,
`exerciseKey`, `exerciseLabel` e `sheetLabel`.

| Store | Conteúdo |
|---|---|
| `workouts` | treinos: `date`, `sheetId`/`sheetName`, `cardioMinutes`, `notes`, `warmups[]`, `sets[]` |
| `sheets` | fichas: `name`, `active` (false = desativada, fora do seletor do Treinar) + `exercises[]` (`exerciseId`, `name`, `sets`, `reps[]` por série, `note`) |
| `exercises` | biblioteca do usuário: `name`, `group`, `correction`, `source` (`custom`) |
| `settings` | metas semanais, início da semana, `lastBackupAt` (lembrete), preferências |
| `colinha` | anotações de consulta rápida |

Nos treinos, cada série/aquecimento tem `exerciseId` + `exerciseName` (cópia). Fichas antigas ganham o
`exerciseId` automaticamente na abertura do app (`linkSheetItemsToExercises`), quando o nome casa de forma
inequívoca com um exercício da biblioteca.

## Versionamento

Ao alterar `index.html`, `css` ou `js`, atualize a versão em **três** lugares: `index.html` (os `?v=N` das
tags `<link>`/`<script>` e o `<span id="appVersion">`), `sw.js` (`CACHE_NAME` = `meu-treino-vN` e os `?v=N`
da lista `ASSETS`) e `js/bridge.js` (os `?v=N` dos `import`). Isso garante que o app instalado receba a versão nova (o rodapé de **Mais** e a linha de
status do backup mostram a versão carregada). O `check.ps1` reprova o commit se saírem de sincronia.

## Privacidade

- Sem backend, sem contas, sem analytics, sem requisições a terceiros.
- `Content-Security-Policy` restringe o app a recursos do próprio site.
- Os dados só saem do aparelho quando **você** exporta um JSON ou compartilha o texto de um treino.

## Créditos

- Catálogo de exercícios em pt-BR: [gugeldev/exercicios-bd-ptbr](https://github.com/gugeldev/exercicios-bd-ptbr)
  (licença **CC0-1.0**, domínio público), complementado por uma curadoria própria de exercícios comuns de academia.
- UI: [Bootstrap 5](https://getbootstrap.com/) e [Bootstrap Icons](https://icons.getbootstrap.com/) (MIT),
  com arquivos servidos localmente.

## Decisões e trade-offs conhecidos

- **Sem build/toolchain**: dá para manter o app editando os arquivos direto, mas os handlers de eventos são
  atributos `onclick` (exigem funções globais e `'unsafe-inline'` no CSP). Trocar por *event delegation*
  é a próxima melhoria de qualidade, se o projeto crescer.
- **Catálogo embutido**: arquivo único (≈240 KB) carregado uma vez e cacheado pelo service worker.
- **Fonte de ícones em base64** dentro do CSS: evita falha de carregamento de fonte (ícones "quadradinhos"),
  às custas de um CSS maior.
