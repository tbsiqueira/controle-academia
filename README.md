# Meu Treino

Aplicativo web instalável (**PWA**) para registrar treinos de academia: fichas com exercícios ordenados,
aquecimento por exercício, séries com carga e RIR, metas semanais flexíveis, calendário de frequência e
exportação do treino como texto para enviar à professora.

📖 **Como usar o app, passo a passo: [MANUAL.md](MANUAL.md)**

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

### Verificações automáticas

```powershell
powershell -ExecutionPolicy Bypass -File .\check.ps1
```

Confere JSONs, referências de `id`, handlers `onclick`, arquivos de asset e o catálogo (ids únicos).

---

## Publicar no GitHub Pages (deploy por tag)

Nada é publicado por push na `main`. O deploy acontece **somente quando você envia uma tag de versão**
(`v1`, `v2`, ...), através do workflow `.github/workflows/deploy.yml`:

```
push na main            → nada acontece com o site publicado
push da tag v2          → roda check.ps1 e publica no GitHub Pages
```

Assim você desenvolve tranquilo na `main` e o app publicado só muda quando você decide marcar uma versão.

### Configurar (uma vez só)

1. No repositório, abra **Settings** → **Pages**.
2. Em **Build and deployment** → **Source**, escolha **GitHub Actions**.
3. Pronto. A URL publicada fica em `https://<usuario>.github.io/<repositorio>/`.
4. Abra essa URL no celular e use **"Adicionar à tela inicial"**:
   - **Android/Chrome**: menu ⋮ → *Adicionar à tela inicial* / *Instalar app*.
   - **iPhone/Safari**: botão **Compartilhar** → *Adicionar à Tela de Início*.

> O repositório precisa ser **público** para o Pages no plano gratuito (em repositório privado, só com
> GitHub Pro/Team).

### Publicar uma versão nova

```powershell
# 1) desenvolva e salve na main (isso NÃO publica)
git checkout main
git add -A
git commit -m "feat: ..."
git push

# 2) confira antes de publicar
powershell -ExecutionPolicy Bypass -File .\check.ps1

# 3) marque e envie a tag -> o deploy começa sozinho
git tag -a v2 -m "v2: <resumo das mudancas>"
git push origin v2
```

Acompanhe em **Actions → Publicar no GitHub Pages**. Leva ~1 minuto.
No aparelho, feche e abra o app (ou use **Mais → Atualizar app**) para pegar a versão nova.

### Voltar para uma versão anterior

Na aba **Actions**, abra a execução da tag desejada (ex.: `v1`) e clique em **Re-run all jobs** —
o Pages volta a publicar aquele conteúdo. (Ou envie uma tag nova a partir do commit correto.)

### Publicar manualmente (emergência)

Aba **Actions** → **Publicar no GitHub Pages** → **Run workflow** (publica o estado atual da branch
selecionada). Use só quando precisar.
## Estrutura

```
index.html                  app shell (telas, modais)
css/styles.css              estilos (tema, navegação inferior, calendário, botões)
js/db.js                    camada IndexedDB (workouts, exercises, sheets, settings, colinha)
js/app.js                   lógica do app (busca, fichas, treinos, histórico, backup)
data/exercises.json         catálogo embutido com 927 exercícios em pt-BR
vendor/                     Bootstrap 5 + Bootstrap Icons (locais, sem CDN)
manifest.webmanifest        manifest do PWA
sw.js                       service worker (network-first, com fallback offline)
reset.html                  página de escape: desregistra o service worker e limpa o cache
serve.ps1                   servidor local de desenvolvimento
check.ps1                   verificações estáticas
MANUAL.md                   manual do usuário (como usar, exemplos, FAQ)
PLANO.md                    plano/requisitos e histórico de revisões
```

## Modelo de dados (IndexedDB v2)

| Store | Conteúdo |
|---|---|
| `workouts` | treinos: `date`, `sheetId`/`sheetName`, `cardioMinutes`, `notes`, `warmups[]`, `sets[]` |
| `sheets` | fichas: `name` + `exercises[]` (`name`, `sets`, `reps[]` por série, `note`) |
| `exercises` | biblioteca do usuário: `name`, `group`, `correction`, `source` (`custom`) |
| `settings` | metas semanais, início da semana, preferências |
| `colinha` | anotações de consulta rápida |

## Versionamento

Ao alterar `index.html`, `css` ou `js`, atualize a versão em três lugares:

1. `index.html`: os `?v=N` das tags `<link>`/`<script>` e o `<span id="appVersion">`;
2. `sw.js`: `CACHE_NAME` (`meu-treino-vN`) e os `?v=N` da lista `ASSETS`.

Isso garante que o app instalado receba a versão nova (o rodapé de **Mais** mostra a versão carregada).

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
