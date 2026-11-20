# Meu Treino

Aplicativo web instalável (**PWA**) para registrar treinos de academia: fichas com exercícios ordenados,
aquecimento por exercício, séries com carga e RIR, recordes e 1RM estimado, metas semanais flexíveis,
calendário de frequência com evolução semanal, exportação do treino como texto para a professora e importação
de fichas e de treinos antigos em JSON (contratos [FICHA-JSON.md](FICHA-JSON.md) e
[TREINO-JSON.md](TREINO-JSON.md)).

📖 **Como usar o app, passo a passo: [documentation/MANUAL.md](documentation/MANUAL.md)**

**Todos os dados ficam apenas no seu aparelho** (IndexedDB). Não existe backend, conta, login, analytics
ou qualquer chamada externa. O backup é feito por arquivo JSON (exportar/importar).

## Como rodar localmente

Não é necessário Node, Python ou qualquer build — é HTML/CSS/JS puro.

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

Depois abra <http://localhost:8080> no navegador. (`localhost` é contexto seguro, então o service worker
e a instalação como app funcionam.)

> Abrir o `index.html` direto pelo explorador de arquivos (`file://`) **não** funciona: o navegador bloqueia
> o `fetch` do catálogo e o registro do service worker. Use o `serve.ps1`.

## Testes, PRs e publicação

Comandos, checklist de cada mudança e regras de Git: **[documentation/agents/workflow.md](documentation/agents/workflow.md)**.
Resumo: `node --test tests/`, `powershell -ExecutionPolicy Bypass -File .\check.ps1` e `npm run test:e2e`
(para mudanças só de documentação bastam os dois primeiros). Toda mudança entra por branch e PR, com merge por
rebase; o `deploy.yml` publica no GitHub Pages e cria a tag `vN` quando a versão muda.

📋 **Qual teste cobre qual funcionalidade: [tests/CHECKLIST.md](tests/CHECKLIST.md)**

## Estrutura

O app é `index.html` + `css/styles.css` + `js/` (`core.js`: lógica pura; `app.js`: telas; `db.js`: IndexedDB),
com `sw.js`, `manifest.webmanifest`, `reset.html` e o catálogo embutido `data/exercises.json` (927 exercícios).
Onde cada coisa mora, o modelo de dados e as regras: [documentation/agents/architecture.md](documentation/agents/architecture.md).

## Dados de exemplo

`data/sample-data.json` tem **3 fichas**, **12 treinos** (4 por ficha) e **6 exercícios criados pelo usuário**.
No app: **Mais → Debug → Carregar dados de exemplo** (pode ser desfeito pelo botão **Desfazer**). Nos testes é a
fixture de `tests/sample-data.test.js`. É gerado por `tools/build-sample-data.ps1` a partir de
`tools/sample-data-content.json` — detalhes em [tools/README.md](tools/README.md).

## Privacidade

- Sem backend, sem contas, sem analytics, sem requisições a terceiros.
- `Content-Security-Policy` restringe o app a recursos do próprio site.
- Os dados só saem do aparelho quando **você** exporta um JSON ou compartilha o texto de um treino.

## Créditos

- Catálogo de exercícios em pt-BR: [gugeldev/exercicios-bd-ptbr](https://github.com/gugeldev/exercicios-bd-ptbr)
  (licença **CC0-1.0**, domínio público), complementado por uma curadoria própria de exercícios comuns de academia.
- UI: [Bootstrap 5](https://getbootstrap.com/) e [Bootstrap Icons](https://icons.getbootstrap.com/) (MIT),
  com arquivos servidos localmente.
