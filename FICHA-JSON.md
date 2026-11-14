# Contrato: ficha de treino em JSON (Meu Treino)

Este arquivo explica para qualquer pessoa ou IA (LLM) como montar uma ficha de treino que o
app **Meu Treino** importa em **Fichas → Importar ficha**.

## Instruções para a IA

Você vai receber o plano de treino de um(a) professor(a). Converta-o para JSON seguindo
exatamente as regras abaixo.

1. Responda **só com o JSON**, sem texto antes ou depois (um bloco ```json está ok).
2. Uma ficha = um dia/treino do plano (ex.: "TREINO A - inferiores"). Se o plano tem
   vários treinos (A, B, C...), devolva um **array** com uma ficha para cada.
3. Mantenha a **ordem** dos exercícios como está no plano.
4. **Nomes dos exercícios:** se junto com este contrato vier a lista "Exercícios que já
   existem no app", use o nome **exatamente** como está na lista sempre que for o mesmo
   exercício (prefira "Minha biblioteca" ao "Catálogo"). Só invente um nome novo quando não
   houver nenhum equivalente; nesse caso use português do Brasil, curto e comum em academia
   (ex.: "Agachamento livre", "Puxada frontal"). Nunca coloque séries, reps ou carga no nome.
5. Tudo que não é séries/reps (cadência, pausa, carga, descanso, técnica como drop-set,
   bi-set, "até a falha") vai em `note`, curto.
6. Não invente exercícios nem números. Se o plano não diz as reps, omita `reps`.
   Se não diz as séries, omita `sets` (o app usa 3).
7. Aquecimento ou cardio que não seja exercício com séries: coloque em `note` do primeiro
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

O topo do arquivo pode ser:

- um objeto (uma ficha): `{ "name": ..., "exercises": [...] }`
- uma lista de fichas: `[ {...}, {...} ]`
- ou `{ "fichas": [ {...}, {...} ] }`

Campos que não estão nesta tabela são ignorados.

## O que o app faz ao importar

- Liga cada exercício pelo nome (sem diferenciar maiúscula/acento) a um exercício da sua
  Biblioteca ou do catálogo.
- Mostra uma revisão antes de gravar: para cada nome sem par exato, sugere os exercícios
  mais parecidos; você escolhe um deles ou "Criar novo" (vai para a Biblioteca, grupo "Outros").
- Se já existe uma ficha **ativa** com o mesmo nome, a nova ganha " (importada)" no fim.
- Arquivo inválido: nada é gravado e o app diz qual campo está faltando.

## Como pedir para a IA

No app, abra **Fichas → Pedir uma ficha para a IA** (endereço `#/ia`). A tela junta este
contrato com a lista dos exercícios que já existem (sua Biblioteca + catálogo). Toque em
**Copiar**, cole na IA e escreva logo abaixo:

> Converta o plano de treino abaixo para o JSON do contrato acima. Responda só com o JSON.
>
> Plano:
> (cole o plano)

Salve a resposta como `ficha.json` e importe em **Fichas → Importar ficha**.
