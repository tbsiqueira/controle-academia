# Ferramentas de desenvolvimento

Scripts de apoio do projeto. Não fazem parte do app publicado (não entram no precache do service worker),
mas ficam versionados para que qualquer mudança seja reproduzível.

| Ferramenta | Para que serve |
|---|---|
| `build-sample-data.ps1` | Gera `data/sample-data.json` (os "dados de exemplo" carregados em **Mais → Dados de exemplo**) |
| `sample-data-content.json` | Conteúdo em português dos dados de exemplo: exercícios custom, fichas (por id do catálogo), dias, cardio, observações e colinhas |

## Gerar os dados de exemplo

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\build-sample-data.ps1
```

O `check.ps1` (e a pipeline) **regenera a fixture e compara o hash** com o arquivo commitado — assim o
gerador e o JSON nunca ficam fora de sincronia. Se você mudar o conteúdo, rode o comando acima e commite
o `data/sample-data.json` resultante.

## Como as fichas de exemplo são montadas

Para cada ficha definida em `sample-data-content.json`:

- `catalogIds` — exercícios que vêm do **catálogo embutido** (`data/exercises.json`), referenciados só pelo
  **id** (o nome é lido do catálogo, garantindo que esteja sempre igual);
- `customIds` — exercícios **criados pelo usuário** (definidos em `customExercises`), que entram na
  Biblioteca e são vinculados às fichas por **chave estrangeira** (`exerciseId`);
- `dayOffsets` — quantos dias **atrás** cada treino aconteceu (relativo a hoje, para a demonstração ficar
  sempre recente);
- `cardioMinutes` e `notes` — cardio e observação de cada treino.

As cargas crescem a cada sessão (+2,5 kg) para os gráficos de evolução mostrarem progresso, e os três
primeiros exercícios de cada treino têm aquecimento preenchido.

## Por que o script é só ASCII

O Windows PowerShell 5.1 lê arquivos `.ps1` sem BOM como ANSI, o que quebraria acentos ("Elevação" viraria
lixo). Por isso todo texto em português vive no `sample-data-content.json`, lido explicitamente como UTF-8 —
e o script funciona igual no PowerShell 7 (Linux/CI).
