# Contrato: ficha de treino em JSON (Meu Treino)

Este arquivo explica para qualquer pessoa ou IA (LLM) como montar uma ficha de treino que o
app **Meu Treino** importa em **Fichas → Criar com IA**.

## Instruções para a IA

Você vai receber o plano de treino de um(a) professor(a), em texto ou em PDF, com um ou
vários treinos. Converta-o para JSON seguindo exatamente as regras abaixo.

1. Responda **só com o JSON**, sem texto antes ou depois (um bloco ```json está ok).
2. Responda **sempre com um array**, mesmo que o plano tenha um treino só.
   Uma ficha = um treino do plano (ex.: "TREINO A - inferiores"). Leia o plano **inteiro**
   (todas as páginas do PDF) e crie uma ficha para **cada** treino, na ordem do plano.
3. Cada ficha tem um nome **diferente**, igual ao título do treino no plano
   (ex.: "TREINO A - inferiores", "TREINO B - superiores"). Se o plano repete os treinos
   em fases/semanas com exercícios ou números diferentes, crie uma ficha por treino em cada
   fase e coloque a fase no nome (ex.: "TREINO A - semanas 1-4"). Se não muda nada, uma ficha só.
4. Mantenha a **ordem** dos exercícios como está no plano. Ignore cabeçalho, rodapé,
   logotipo e dados pessoais do PDF.
5. **Nomes dos exercícios:** se junto com este contrato vier a lista "Exercícios que já
   existem no app", use o nome **exatamente** como está na lista sempre que for o mesmo
   exercício (prefira "Minha biblioteca" ao "Catálogo"). Só invente um nome novo quando não
   houver nenhum equivalente; nesse caso use português do Brasil, curto e comum em academia
   (ex.: "Agachamento livre", "Puxada frontal"). Nunca coloque séries, reps ou carga no nome.
6. Tudo que não é séries/reps (cadência, pausa, carga, descanso, técnica como drop-set,
   bi-set, "até a falha") vai em `note`, curto.
7. Não invente exercícios nem números. Se o plano não diz as reps, omita `reps`.
   Se não diz as séries, omita `sets` (o app usa 3).
8. Aquecimento ou cardio que não seja exercício com séries: coloque em `note` do primeiro
   exercício, ou ignore.

## Formato

```json
[
  {
    "name": "TREINO A - inferiores",
    "exercises": [
      { "name": "Agachamento livre", "sets": 4, "reps": [12, 10, 8, 8], "note": "descer em 3s" },
      { "name": "Cadeira extensora", "sets": 3, "reps": 15 },
      { "name": "Stiff", "sets": 3, "reps": [12, 12, 10], "note": "drop-set na última" }
    ]
  },
  {
    "name": "TREINO B - superiores",
    "exercises": [
      { "name": "Supino reto", "sets": 4, "reps": 10 },
      { "name": "Puxada frente", "sets": 3, "reps": [12, 10, 8], "note": "pegada aberta" }
    ]
  }
]
```

### Campos da ficha

| Campo       | Tipo   | Obrigatório | O que é |
|-------------|--------|-------------|---------|
| `name`      | texto  | sim         | Nome da ficha, ex.: `"TREINO B - superiores"` |
| `exercises` | lista  | sim (≥ 1)   | Exercícios na ordem do plano |

### Campos de cada exercício

| Campo   | Tipo                 | Obrigatório | O que é |
|---------|----------------------|-------------|---------|
| `name`  | texto                | sim         | Nome do exercício |
| `sets`  | número inteiro ≥ 1   | não (padrão 3) | Número de séries |
| `reps`  | número ou lista de números | não   | Reps por série. Um número vale para todas as séries; uma lista dá as reps de cada série, na ordem (ex.: `[12, 10, 8]`). Faixa como "8-12": use o número maior e escreva a faixa em `note`. |
| `note`  | texto                | não         | Observação da professora |

O topo deve ser uma lista de fichas: `[ {...}, {...} ]`. O app também aceita uma ficha
sozinha `{ "name": ..., "exercises": [...] }` ou `{ "fichas": [ {...}, {...} ] }`.

Campos que não estão nesta tabela são ignorados.

## O que o app faz ao importar

- Liga cada exercício pelo nome (sem diferenciar maiúscula/acento) a um exercício da sua
  Biblioteca ou do catálogo.
- Importa todas as fichas do JSON de uma vez.
- Mostra uma revisão antes de gravar: para cada nome sem par exato, sugere os exercícios
  mais parecidos; você escolhe um deles ou "Criar novo" (vai para a Biblioteca, grupo "Outros").
- Se já existe uma ficha **ativa** com o mesmo nome, a nova ganha " (importada)" no fim.
- JSON inválido: nada é gravado e o app diz qual campo está faltando.

## Como pedir para a IA

No app, abra **Fichas → Criar com IA**. A janela junta este
contrato com a lista dos exercícios que já existem (sua Biblioteca + catálogo). Toque em
**Copiar texto**, cole na IA, **anexe o PDF** da professora (ou cole o plano em texto) e escreva
logo abaixo:

> Converta o plano de treino em anexo para o JSON do contrato acima, com uma ficha para
> cada treino do plano. Responda só com o JSON.

Copie o JSON da resposta, cole na caixa de texto logo abaixo, na mesma janela, e toque
em **Revisar**.
