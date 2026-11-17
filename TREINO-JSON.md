# Contrato: treinos antigos + fichas em JSON (Meu Treino)

Este arquivo explica para qualquer pessoa ou IA (LLM) como converter um histórico de treinos
**já feitos** (planilha do Excel, Google Sheets, anotações) para o JSON que o app
**Meu Treino** importa em **Mais → Importar treinos antigos**.

O JSON tem duas partes:

- **`treinos`**: o histórico. Um treino = **um dia** em que a pessoa treinou (data, exercícios,
  séries com reps e carga).
- **`fichas`**: o plano atual, recriado a partir dos treinos **mais recentes**. É a ficha que a
  pessoa vai usar daqui para frente no app. Com ela, ao treinar, o app já preenche a carga da
  última vez de cada exercício.

## Instruções para a IA

Você vai receber o histórico de treinos de uma pessoa, normalmente uma planilha. Converta-o
para JSON seguindo exatamente as regras abaixo.

### Geral

1. Responda **só com o JSON**, sem texto antes ou depois (um bloco ```json está ok).
2. O topo é **um objeto** `{ "fichas": [...], "treinos": [...] }`.
3. Leia o arquivo **inteiro**: **todas as abas** da planilha e todas as páginas. Se você lê o
   arquivo com código, abra todas as abas, não só a primeira (ex.: em Python,
   `pandas.read_excel(arquivo, sheet_name=None)`). Antes de responder, confira que usou todas as
   abas que têm treinos. Ignore totais, médias, gráficos e dados pessoais.
4. **Nomes dos exercícios:** se junto com este contrato vier a lista "Exercícios que já
   existem no app", use o nome **exatamente** como está na lista sempre que for o mesmo
   exercício (prefira "Minha biblioteca" ao "Catálogo"). Só invente um nome novo quando não
   houver nenhum equivalente; nesse caso use português do Brasil, curto e comum em academia.
   Use **sempre o mesmo nome** para o mesmo exercício, em todos os treinos e nas fichas: é
   por ele que o app liga a ficha ao histórico e acha a carga da última vez.
   Nunca coloque séries, reps ou carga no nome.
5. **Não invente nada.** Se um número não está na planilha, omita o campo.

### Treinos (o histórico)

6. **Um objeto por dia de treino**, em ordem de data. Se a planilha tem uma coluna por dia,
   uma aba por semana ou uma linha por série, junte tudo de modo que cada dia vire um treino.
   Dois treinos no mesmo dia (ex.: manhã e noite) são dois objetos com a mesma data.
7. `date` é obrigatória, no formato **`AAAA-MM-DD`** (ex.: `"2025-03-14"`). Planilhas
   brasileiras usam dia/mês/ano: `14/03/2025` é `2025-03-14`. Se só há dia e mês, descubra o
   ano pelo contexto (título, abas, ordem); se não der, pergunte antes de responder.
   Treino sem data em lugar nenhum: deixe de fora (não invente a data).
8. `ficha` é o nome do treino daquele dia (ex.: `"TREINO A"`, `"Treino B - costas"`). Quando o
   dia corresponde a uma ficha de `fichas` (ou a uma ficha da lista "Fichas que já existem no
   app"), use **exatamente o mesmo nome**. Se a planilha não diz qual treino foi, omita.
9. `sets` traz **uma entrada por série feita**, na ordem. "3x12 com 40 kg" vira três séries
   `{ "reps": 12, "load": 40 }`; "12/10/8 com 40/45/50" vira três séries com cada par.
   Se a planilha tem uma coluna do que era planejado e outra do que foi feito, use o **feito**.
10. `load` é a carga levantada em **kg**, número com ponto (`27.5`). Em libras (lb): converta
    (× 0,4536) e arredonde para 0,5. Peso do corpo / sem carga: omita `load`. Não some o peso da
    barra se a planilha não somou. Série sem `reps` e sem `load`: deixe de fora.
11. `rir` (repetições na reserva) só se a planilha tiver. Se ela usa RPE, `rir = 10 - RPE`.
12. Aquecimento separado na planilha vai em `warmup` (um por exercício), **não** em `sets`.
13. Cardio (esteira, bike, escada…): some os minutos do dia em `cardioMinutes`; não crie
    exercício para ele. Observação do dia em `notes`; do exercício (técnica, ajuste, dor) em
    `note` do exercício; de uma série (ex.: "falhou", "drop-set") em `note` da série. Curto.

### Fichas (o plano atual)

14. Crie **uma ficha para cada treino diferente da rotina mais recente** (ex.: se nos últimos
    meses a pessoa alternava A, B e C, crie as fichas A, B e C). Não crie fichas para rotinas
    antigas que ela não faz mais: esses treinos ficam no histórico só com o nome em `ficha`.
15. Os exercícios da ficha, e a ordem deles, são os do **último** treino daquela ficha.
16. `sets` = quantas séries foram feitas no último treino daquele exercício. `reps` = as reps
    planejadas, se a planilha tiver o plano; senão, as reps feitas na última vez, série por série
    (ex.: `[12, 10, 8]`). Faixa como "8-12": use o número maior e escreva a faixa em `note`.
17. **Não coloque carga na ficha** (a carga fica nos treinos; o app busca a da última vez).
    Cadência, descanso e técnica vão em `note` da ficha, curto.
18. Se uma ficha já está na lista "Fichas que já existem no app", **não** a repita em `fichas`:
    só use o nome dela em `ficha` nos treinos.
19. Cada ficha tem um nome **diferente**. Se não der para saber como a planilha chama cada
    treino, use "TREINO A", "TREINO B"… na ordem em que aparecem.

### Histórico muito longo

20. Se não couber numa resposta só, divida por período (ex.: um JSON por trimestre, do mais
    antigo ao mais recente) e diga qual período cada resposta cobre. Ponha `fichas` **só na
    resposta do período mais recente**; nas outras, `"fichas": []`. O app aceita importar
    várias vezes e pula os treinos que já foram importados.

## Formato

```json
{
  "fichas": [
    {
      "name": "TREINO A - inferiores",
      "exercises": [
        { "name": "Agachamento livre", "sets": 3, "reps": [12, 10, 8], "note": "descer em 3s" },
        { "name": "Cadeira extensora", "sets": 3, "reps": [15, 15, 12] }
      ]
    },
    {
      "name": "TREINO B - superiores",
      "exercises": [
        { "name": "Supino reto", "sets": 2, "reps": [10, 8] },
        { "name": "Barra fixa", "sets": 2, "reps": [6, 5] }
      ]
    }
  ],
  "treinos": [
    {
      "date": "2025-03-14",
      "ficha": "TREINO A - inferiores",
      "cardioMinutes": 15,
      "notes": "joelho incomodou no fim",
      "exercises": [
        {
          "name": "Agachamento livre",
          "warmup": { "reps": 15, "load": 20 },
          "sets": [
            { "reps": 12, "load": 40, "rir": 2 },
            { "reps": 10, "load": 45, "rir": 1 },
            { "reps": 8, "load": 50, "rir": 0, "note": "falhou na 8ª" }
          ],
          "note": "pés mais abertos"
        },
        {
          "name": "Cadeira extensora",
          "sets": [
            { "reps": 15, "load": 35 },
            { "reps": 15, "load": 35 },
            { "reps": 12, "load": 40 }
          ]
        }
      ]
    },
    {
      "date": "2025-03-16",
      "ficha": "TREINO B - superiores",
      "exercises": [
        { "name": "Supino reto", "sets": [{ "reps": 10, "load": 30 }, { "reps": 8, "load": 32.5 }] },
        { "name": "Barra fixa", "sets": [{ "reps": 6 }, { "reps": 5 }] }
      ]
    }
  ]
}
```

### Campos de cada ficha (`fichas`)

Iguais aos de `FICHA-JSON.md`:

| Campo       | Tipo   | Obrigatório | O que é |
|-------------|--------|-------------|---------|
| `name`      | texto  | sim         | Nome da ficha, diferente das outras |
| `exercises` | lista  | sim (≥ 1)   | Exercícios na ordem do último treino dessa ficha |
| `exercises[].name`  | texto | sim  | Nome do exercício |
| `exercises[].sets`  | número inteiro ≥ 1 | não (padrão 3) | Número de séries |
| `exercises[].reps`  | número ou lista de números | não | Reps por série (um número vale para todas) |
| `exercises[].note`  | texto | não  | Observação |

### Campos de cada treino (`treinos`)

| Campo           | Tipo               | Obrigatório | O que é |
|-----------------|--------------------|-------------|---------|
| `date`          | texto `AAAA-MM-DD` | sim         | Dia do treino. Não pode ser no futuro |
| `ficha`         | texto              | não         | Nome da ficha/treino daquele dia |
| `exercises`     | lista              | sim, se não houver `cardioMinutes` | Exercícios na ordem do dia |
| `cardioMinutes` | número             | não         | Minutos de cardio no dia |
| `notes`         | texto              | não         | Observação do dia |

### Campos de cada exercício do treino

| Campo    | Tipo   | Obrigatório | O que é |
|----------|--------|-------------|---------|
| `name`   | texto  | sim         | Nome do exercício |
| `sets`   | lista  | sim (≥ 1)   | Uma entrada por série feita, na ordem |
| `warmup` | objeto | não         | Aquecimento: `{ "reps", "load", "rir" }` (todos opcionais) |
| `note`   | texto  | não         | Observação do exercício naquele dia |

### Campos de cada série

| Campo  | Tipo           | Obrigatório      | O que é |
|--------|----------------|------------------|---------|
| `reps` | número inteiro | `reps` ou `load` | Repetições feitas |
| `load` | número (kg)    | `reps` ou `load` | Carga levantada |
| `rir`  | número inteiro | não              | Repetições na reserva |
| `note` | texto          | não              | Observação da série |

`fichas` pode faltar ou ser `[]`. O app também aceita só a lista de treinos `[ {...}, {...} ]`.
Datas `DD/MM/AAAA` também são aceitas, mas prefira `AAAA-MM-DD`.
Campos que não estão nestas tabelas são ignorados.

## O que o app faz ao importar

- Liga cada exercício pelo nome (sem diferenciar maiúscula/acento) a um exercício da sua
  Biblioteca ou do catálogo. Fichas e treinos usam o **mesmo** exercício, então a ficha já
  mostra a carga da última vez.
- Cria as fichas novas. Ficha com o mesmo nome de uma que já existe no app **não** é
  duplicada: a que já existe é usada.
- Liga cada treino à ficha de mesmo nome. Se não há ficha com esse nome, o treino guarda só
  o nome.
- Mostra uma revisão antes de gravar: fichas, quantos treinos e de que período; para cada nome
  de exercício sem par exato, sugere os mais parecidos; você escolhe um deles ou "Criar novo"
  (vai para a Biblioteca, grupo "Outros").
- Pula treinos que já existem no app (mesma data e mesmas séries), então importar o mesmo
  JSON duas vezes não duplica nada.
- JSON inválido: nada é gravado e o app diz qual treino e qual campo está errado.

## Como pedir para a IA

No app, abra **Mais → Importar treinos antigos**. A janela junta este contrato com a lista
das fichas e dos exercícios que já existem. Toque em **Copiar texto**, cole na IA,
**anexe a planilha** (ou cole as linhas dela) e escreva logo abaixo:

> Converta o histórico da planilha em anexo para o JSON do contrato acima: um treino para
> cada dia e uma ficha para cada treino da rotina mais recente. Responda só com o JSON.

Copie o JSON da resposta, cole na caixa de texto logo abaixo, na mesma janela, e toque
em **Revisar**.
