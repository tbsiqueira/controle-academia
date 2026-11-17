# Plano de refatoração

Acompanhamento: issue [#2](https://github.com/tbsiqueira/controle-academia/issues/2) (fixada no repositório), com uma
issue por PR, agrupadas nos milestones **Refatoração · Fase 0–3**.

Este documento diz **por que** refatorar, **para onde** o código vai e **quais regras** todo PR da refatoração segue.
O que fazer em cada passo está na issue correspondente.

## 1. Por que agora

O app funciona e a lógica está bem cuidada, mas a parte de tela virou um bloco só:

| Arquivo | Tamanho | Situação |
|---|---|---|
| `js/app.js` | ~2.700 linhas, 159 funções globais | Telas, render em strings HTML, eventos e estado global num arquivo só. **Nenhum teste roda no navegador.** |
| `js/core.js` | ~1.600 linhas | Lógica pura, **100% de cobertura** em testes de unidade. Está bem. |
| `js/db.js` | ~140 linhas | IndexedDB, com teste. Está bem. |
| `index.html` | ~480 linhas | Todas as telas; botões chamam funções globais com `onclick="…"`. |
| `css/styles.css` | ~1.400 linhas | Estilo do app inteiro. Fora do escopo desta refatoração. |

`core.js`, `db.js` e `app.js` dividem o mesmo escopo global: qualquer função de um é visível nos outros e no HTML.
É por isso que mudanças grandes no `app.js` já quebraram partes distantes do app (v43: um trecho apagou funções
vizinhas e abrir um treino passou a dar `ReferenceError`; v40 e v47: nomes e ids desencontrados entre telas).
O `check.ps1` pega parte disso estaticamente, mas não exercita o app.

Com mais gente interessada no projeto, cada mudança precisa de uma rede de segurança que não dependa de alguém
lembrar de testar tudo à mão.

## 2. Para onde vamos

**Princípios**

- **Continua sem build.** O navegador carrega os arquivos como estão no repositório; editar e recarregar continua
  funcionando. Nada de bundler, transpilador ou framework.
- **ES modules nativos** (`import`/`export`) no lugar do escopo global.
- **Lógica sem DOM vai para `core.js`, com teste.** A refatoração é a hora de tirar lógica escondida do `app.js`.
- **Comportamento neutro.** Nenhum PR da refatoração muda o que a pessoa vê ou os dados que ficam salvos.

**Estrutura alvo** (os limites exatos entre as áreas podem mudar em cada PR):

```
index.html                 casca do app; um único <script type="module" src="js/main.js">
js/
  main.js                  inicialização: carrega estado, rotas, registra o service worker
  core.js                  lógica pura (export)
  db.js                    IndexedDB (export)
  types.js                 só JSDoc @typedef dos dados (Fase 3)
  ui/                      peças compartilhadas: estado, rotas, toast, nomes por id, helpers de render
  screens/
    treino.js              Treinar: formulário, séries, aquecimento, rascunho, descanso, salvar
    fichas.js              Fichas, Criar com IA, importar treinos antigos
    biblioteca.js          Biblioteca, catálogo, seletor de exercícios
    dados.js               backup, armazenamento persistente, apagar dados, dados de exemplo
    inicio.js              Início, calendário, histórico/evolução, metas, Mais
tests/                     testes de unidade (node --test), como hoje
tests/e2e/                 testes de navegador (Playwright)
```

Os botões deixam de usar `onclick="funcao()"` e passam a declarar `data-action="…"`, tratados por delegação de
eventos em cada tela.

## 3. Fases e ordem dos PRs

A ordem importa: **primeiro a rede de segurança, depois mexer no código.**

| Fase | O que entrega | Issues |
|---|---|---|
| **0 — Plano** | Este documento e as regras abaixo | #3 |
| **1 — Testes de navegador** | Playwright no CI como check obrigatório; **cada comportamento** das telas críticas (Treinar e Início); testes de todos os fluxos do `tests/CHECKLIST.md`; catraca de cobertura do `app.js` | #4, #5, #19, #6, #7 |
| **2 — Módulos** | `core.js`/`db.js` como módulos; `app.js` como módulo sem `onclick` inline; `app.js` dividido por área, um PR por área | #8, #9, #10–#14 |
| **3 — Tipos** | Tipos dos dados em JSDoc checados por `tsc --noEmit` no CI; `// @ts-check` em todos os arquivos; documentação final | #15, #16, #17 |

Uma **Fase 4** (TypeScript de verdade, com build) não está planejada. Ela só será avaliada no fim (issue #17),
com a experiência das fases anteriores. Depois da Fase 3 essa migração seria quase mecânica.

## 4. Política de testes

1. **Lógica pura: 100%.** `js/core.js` continua com 100% de linhas e ramos cobertos por testes de unidade
   (`tools/coverage-gate.js`), como hoje.
2. **Telas críticas: cada comportamento.** **Treinar** e **Início** são as telas críticas: o Treinar é usado na
   academia, com pressa, e o Início é a primeira coisa que todo mundo vê. Nelas, **cada comportamento** que a
   pessoa consegue disparar tem o seu próprio teste de navegador e a sua própria linha no `tests/CHECKLIST.md`
   (lista completa nas issues #5 e #19). Todo PR que mexe numa tela crítica mantém esses testes verdes e traz
   teste para o que acrescentar ou mudar.
3. **Demais telas: funcionalidades, não linhas.** Toda funcionalidade listada no
   `tests/CHECKLIST.md` tem pelo menos um teste de navegador do caminho principal, e o CI falha se alguma ficar sem.
   Funcionalidade nova entra com teste de navegador; bug corrigido entra com um teste que o reproduz.
4. **Cobertura do `app.js` medida, com catraca.** Os testes de navegador medem quais linhas do código de tela
   rodaram. O número aparece no PR e **não pode cair** em relação à `main`. Não há meta fixa (como 100%): os
   últimos trechos são caminhos de erro do navegador que só se alcançam com testes frágeis e lentos, e testes
   instáveis ensinam a ignorar check vermelho.
5. **Testes de navegador estáveis e rápidos.** Celular (375px), tema claro, banco começando vazio ou com
   `data/sample-data.json`, sem esperas fixas. O job inteiro deve levar poucos minutos.

## 5. Ferramentas de desenvolvimento (npm)

Até aqui o projeto não tinha `package.json`. A partir da Fase 1 ele passa a existir **só para ferramentas de
desenvolvimento** (`@playwright/test` e, na Fase 3, `typescript`), com `package-lock.json` versionado e
`node_modules/` fora do git.

- O app publicado continua sendo exatamente os arquivos do repositório: o `package.json` não entra no app.
- Os testes de unidade continuam rodando com `node --test tests/`, sem instalar nada.
- `npm ci` só é necessário para rodar os testes de navegador e a checagem de tipos (no CI isso é automático).

## 6. Regras de todo PR da refatoração

- **Um PR por issue**, com `Closes #N` na descrição. Issue grande demais pode virar mais de um PR; diga isso na
  issue antes.
- **Comportamento neutro**: mesmas telas, mesmos textos, mesmos dados; backups antigos (`tests/fixtures/`)
  continuam importando sem perder nada.
- **Sem misturar**: nada de funcionalidade nova, correção de visual ou "aproveitei e mudei" num PR de refatoração.
  Achou um bug no caminho? Abra uma issue e corrija num PR separado.
- **Mexeu em `index.html`, `css/` ou `js/`** → sobe a versão (o job **Versão** cobra) e atualiza a lista `ASSETS`
  do `sw.js` quando arquivos entram ou saem.
- **Moveu ou apagou código** → busque cada nome em `js/`, `index.html`, `tests/` e na documentação (lição da v43).
- **Antes de abrir o PR**: `node --test tests/`, `check.ps1` e, a partir da Fase 1, os testes de navegador
  passando. Merge só por rebase, com todos os checks verdes.
- Testes que conferem o texto do `app.js` (`tests/features.test.js`) e checagens do `check.ps1` que procuram
  funções no `app.js` vão sendo ajustados junto com a mudança que os afeta, nunca desligados.
