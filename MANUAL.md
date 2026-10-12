# Manual do Meu Treino

Guia de uso do aplicativo, do zero até o dia a dia na academia.
Tempo de leitura: ~10 minutos. Não precisa ler tudo de uma vez — use o índice.

---

## Índice

1. [Primeiros passos](#1-primeiros-passos)
2. [Os conceitos do app](#2-os-conceitos-do-app)
3. [Montando sua primeira ficha](#3-montando-sua-primeira-ficha)
4. [Registrando um treino](#4-registrando-um-treino)
5. [Vendo como foi o treino e a evolução](#5-vendo-como-foi-o-treino-e-a-evolução)
6. [Metas da semana (como funciona a "semana")](#6-metas-da-semana-como-funciona-a-semana)
7. [Calendário de frequência](#7-calendário-de-frequência)
8. [Biblioteca de exercícios](#8-biblioteca-de-exercícios)
9. [Colinha](#9-colinha)
10. [Enviando o treino para a professora](#10-enviando-o-treino-para-a-professora)
11. [Backup, restauração e apagar dados](#11-backup-restauração-e-apagar-dados)
12. [Perguntas frequentes](#12-perguntas-frequentes)
13. [Problemas comuns e o que fazer](#13-problemas-comuns-e-o-que-fazer)
14. [Glossário](#14-glossário)

---

## 1. Primeiros passos

### Instalando no celular

1. Abra o endereço do app no navegador do celular (ex.: `https://tbsiqueira.github.io/controle-academia/`).
2. Adicione à tela inicial:
   - **Android (Chrome)**: menu **⋮** → *Instalar app* (ou *Adicionar à tela inicial*).
   - **iPhone (Safari)**: botão **Compartilhar** → *Adicionar à Tela de Início*.
3. Pronto: o app abre pelo ícone, em tela cheia, e **funciona sem internet**.

> **Seus dados ficam só no seu aparelho.** Não há login, conta ou servidor. Por isso, faça backups
> de vez em quando (veja o [item 11](#11-backup-restauração-e-apagar-dados)).

### O mapa do app

Na parte de baixo da tela existem 5 abas:

| Aba | Para que serve |
|---|---|
| **Início** | Sua semana: metas, treinos recentes |
| **Treinar** | Registrar o treino de hoje |
| **Fichas** | Montar seus treinos (fichas) e a biblioteca de exercícios |
| **Calendário** | Quantas vezes você treinou no mês |
| **Mais** | Metas, colinha, backup e configurações |

---

## 2. Os conceitos do app

Vale entender quatro palavras, porque elas aparecem o tempo todo:

| Conceito | O que é | Exemplo |
|---|---|---|
| **Exercício** | O movimento, com nome, grupo muscular e uma observação | *Elevação pélvica* (Glúteos), "pausa de 1s no topo" |
| **Ficha** | O seu treino completo: lista ordenada de exercícios, com nº de séries e as reps de cada série | *TREINO A - inferiores* → elevação pélvica 3×12-10-8, leg press 3×12, ... |
| **Treino** | O que você fez **em um dia**: você escolhe a ficha e preenche o que realmente aconteceu | 08/10/2026 · TREINO A · aquecimento 15 reps × 20 kg · série 1: 12 reps × 27 kg |
| **Aquecimento** | Linha por exercício, onde você anota reps, peso e RIR da série de aquecimento | 15 reps · 20 kg · RIR 3 |

E o que fica onde:

- **Ficha** guarda o **plano**: séries + reps de cada série + observação da professora.
- **Treino** guarda o **executado**: reps feitas, carga (kg), RIR e observações de cada série.
- **kg e RIR não ficam na ficha** — eles variam a cada dia, então são registrados no treino.

---

## 3. Montando sua primeira ficha

Vamos montar a ficha **TREINO A - inferiores** do zero.

1. Vá na aba **Fichas** → botão **Nova ficha**.
2. No campo **Nome da ficha**, escreva: `TREINO A - inferiores`.
3. Ainda na mesma tela, toque em **Adicionar exercício**. Abre uma busca com duas listas:
   - **Biblioteca** — exercícios que você já criou;
   - **Catálogo (pt-BR)** — 927 exercícios prontos (digite `elevacao pelvica` e ele acha, mesmo sem acento).
   - Se não achar, aparece **`Criar "o que você digitou"`** — toque e ele cria na hora.
4. Para cada exercício adicionado, preencha:
   - **Séries**: `3`
   - **reps por série**: `12`, `10`, `8` (repare que **cada série pode ser diferente** — é o famoso 3×12-10-8)
   - **observação da professora**: `cotovelos próximos ao corpo, pausa de 1s embaixo`
5. Repita para os outros exercícios. Use **↑ ↓** para ordenar na sequência que você vai treinar.
6. Toque em **Salvar ficha**.

O resultado na lista fica assim:

```
TREINO A - inferiores   [3]
Elevação pélvica 3×12-10-8 · Leg press 3×12 · Cadeira flexora 3×12 …
```

> **Dica**: criar a ficha é trabalho de uma vez só. Depois disso, todo treino começa escolhendo ela.

---

## 4. Registrando um treino

### O caminho rápido

1. Aba **Treinar**.
2. **Data**: já vem com hoje (mude se estiver registrando um treino de outro dia).
3. **Ficha de treino**: escolha `TREINO A - inferiores`
   → o app **carrega sozinho todos os exercícios** da ficha, com as séries já na tela.
4. Agora é só preencher o que aconteceu. O app já deixou pronto:
   - as **reps de cada série** (12, 10, 8) vindas da ficha;
   - a **carga da última vez** que você fez aquele exercício;
   - o **aquecimento** com as reps e o peso do treino anterior.
5. Você completa: **reps feitas** (se mudou), **carga**, **RIR** e, se quiser, uma **obs** por série.
6. **Cardio (minutos)**: ex. `30`, se fez esteira/bike.
7. **Observações**: como foi o treino no geral.
8. **Salvar**.

### Exemplo de tela preenchida

```
Data: 08/10/2026        Ficha: TREINO A - inferiores
Cardio: 30 min          Observações: treino leve hoje

Elevação pélvica                                    [3 séries]
  obs.: cotovelos próximos ao corpo, pausa de 1s embaixo
  🔥 Aquecimento   [15]  [20]  [3]        ← reps / peso / RIR
  série  reps  carga  RIR  obs
    1    [12]  [27]   [2]  [   ]
    2    [10]  [27]   [1]  [   ]
    3    [ 8]  [32]   [1]  [caiu a força]
  [+ série]
```

### Detalhes que ajudam

- **Série que ficar em branco é ignorada** — se você fez só 2 das 3 séries, pode deixar a terceira vazia e salvar.
- **Quer treinar algo fora da ficha?** Toque em **Adicionar exercício** (o mesmo buscador da ficha).
- **Não achou o exercício no catálogo?** Digite o nome e toque em **`Criar "..."`**.
- **Quer mais séries?** **+ série**. Quer tirar um exercício? Ícone da lixeira no cartão dele.
- **Errou algo?** Toque em **Cancelar** — nada é salvo e você volta para a tela anterior.
- **Precisa editar um treino já salvo?** Início → toque no treino → **Editar**.

---

## 5. Vendo como foi o treino e a evolução

**Ver um treino (somente leitura):**
Início → **toque no treino** na lista *Últimos treinos*. Aparece o resumo do dia: ficha, cardio,
observações e cada exercício com aquecimento, séries e cargas. Nessa tela: **Editar**, **Exportar** e **Excluir**.

**Ver a evolução de um exercício:**
Dentro do treino, **toque no nome do exercício**. Você vê:

```
Elevação pélvica                                     PR 32 kg 🏆
↑ 6 treinos com este exercício

Melhor série por dia
27/09/2026   ▓▓▓▓▓▓▓▓          27 kg × 12
01/10/2026   ▓▓▓▓▓▓▓▓▓         29 kg × 10
04/10/2026   ▓▓▓▓▓▓▓▓▓▓▓       32 kg × 8

Histórico
08/10/2026   TREINO A - inferiores
  🔥 Aquecimento: 15 reps · 20 kg · RIR 3
  Série 1: 12 reps · 27 kg · RIR 2
  Série 2: 10 reps · 27 kg · RIR 1
  ...
```

Isso responde a pergunta "estou evoluindo?" sem planilha: a **seta ↑/↓/**–** compara a última sessão com a
anterior, e as **barras** mostram a melhor série de cada dia.

---

## 6. Metas da semana (como funciona a "semana")

O app **não** fixa segunda, terça... Você decide quando a semana começa:

- Em **Mais → Metas da semana** você define:
  - **Treinos/semana** (padrão: 3)
  - **Cardio (min)** (padrão: 120)
  - **Semana iniciada em**: a data em que seu ciclo começa
- O app conta **7 dias** a partir dessa data. Exemplo: escolheu `08/10` → a semana vai de **08/10 a 14/10**.
- Passados os 7 dias, a tela Início mostra o aviso **"Semana encerrada!"** com um botão
  **Iniciar próxima semana** — nada acontece sem você confirmar.
- **Mudou a rotina?** Toque em **Iniciar semana** (em Mais) para recomeçar a contagem a partir de hoje.
- Treinos de datas fora da semana **não se perdem**: continuam salvos e aparecem no calendário/histórico.

No Início você acompanha as barras: `2/3 treinos` e `60/120 min cardio`.

---

## 7. Calendário de frequência

Aba **Calendário**:

- Dias com treino ficam destacados, com um **número** mostrando quantos treinos naquele dia;
- O **dia de hoje** aparece com contorno;
- Use **‹ ›** para navegar entre os meses;
- Embaixo: total de treinos do mês.

É a visão rápida de constância: "esse mês eu treinei quantas vezes?"

---

## 8. Biblioteca de exercícios

A aba **Fichas** tem duas partes: **Fichas** (seus treinos) e **Biblioteca** (seus exercícios).

A Biblioteca guarda **apenas os exercícios que você criou** (com nome, grupo muscular e observação).
Os **927 exercícios do catálogo** não são copiados para lá — eles já estão disponíveis na busca a qualquer momento.

O que você pode fazer:

- **Filtrar por grupo muscular** (dropdown) e **buscar por nome**;
- Ver **em quais fichas** cada exercício é usado (`📋 usada em: TREINO A, TREINO B` ou `⊖ não usada em nenhuma ficha`);
- **Editar** (nome, grupo, observação) ou **excluir** um exercício que não usa mais.

> **Quando criar um exercício próprio?** Quando a máquina/nome da sua academia é específico
> (ex.: "Puxada frente supinada na barra W"). Escreva e toque em **`Criar "..."`** — ele entra na Biblioteca e
> fica disponível para todas as fichas.

---

## 9. Colinha

**Mais → Colinha** é o seu bloco de notas de consulta rápida, para aquilo que você sempre esquece:

- O que é **RIR** (repetição na reserva) e como usar;
- **Tempo de descanso** entre séries;
- Observações da professora que valem para todo treino;
- Qualquer lembrete de execução.

Exemplos prontos para copiar:

| Título | Conteúdo |
|---|---|
| RIR | "RIR 2 = parar quando ainda conseguiria fazer 2 repetições boas. Se passar de 2, aumente a carga." |
| Descanso | "Compostos: 2–3 min. Isolados: 60–90 s. Aquecimento: sem pressa." |
| Técnica | "Nunca travar a respiração; expirar na fase de esforço." |

---

## 10. Enviando o treino para a professora

Dá para gerar uma **mensagem de texto** com o treino do dia — pronta para WhatsApp, e-mail, etc.

**Como:** Início → no treino desejado, toque no ícone **↗** (ou abra o treino e use **Exportar**).
Depois escolha **Copiar** ou **Compartilhar** (no celular abre a folha de compartilhamento).

**Exemplo do texto gerado:**

```
MEU TREINO — 08/10/2026
Ficha: TREINO A - inferiores

1. Elevação pélvica (obs.: cotovelos próximos ao corpo, pausa de 1s embaixo)
   Aquecimento: 15 reps · 20 kg · RIR 3
   Série 1: 12 reps · 27 kg · RIR 2
   Série 2: 10 reps · 27 kg · RIR 1
   Série 3: 8 reps · 32 kg · RIR 1 (caiu a força)

2. Leg press 45
   Aquecimento: 12 reps · 60 kg · RIR 4
   Série 1: 12 reps · 100 kg · RIR 2
   Série 2: 12 reps · 110 kg · RIR 2

Cardio: 30 min
Observações: treino leve hoje, ombro ok.
```

Traz tudo: data, ficha, aquecimento **dentro de cada exercício**, as séries com reps/carga/RIR,
as observações e o cardio. Campos vazios são omitidos automaticamente.

---

## 11. Backup, restauração e apagar dados

Tudo isso fica em **Mais → Dados**.

### Exportar (backup)
Toque em **Exportar** → o app baixa um arquivo como `meu-treino-backup-2026-10-12_13-35-42.json` (data **e hora** da geração, para não confundir backups do mesmo dia) com **todos** os seus dados.

**Quando fazer:** antes de trocar de celular, limpar o navegador, ou de vez em quando por segurança.
Guarde no Google Drive/OneDrive/e-mail — é um arquivo pequeno.

### Importar (restaurar)
Toque em **Importar** → escolha o arquivo `.json` → confirme.
Os dados atuais são substituídos pelos do arquivo. Mudou de ideia? O botão
**Desfazer** (aparece logo após importar) volta tudo como estava.

### Apagar todos os dados
Toque em **Apagar todos os dados** — abre uma **tela própria** com o aviso do que será apagado
(treinos, fichas, biblioteca, colinha e metas). Para confirmar, você precisa **digitar `APAGAR`**
e **marcar o checkbox**. É definitivo e não tem volta — se quiser guardar, exporte o backup antes.

### Atualizar app
O botão **Atualizar app** limpa o cache e recarrega a versão mais nova. Use se algo parecer "travado" ou
desatualizado (a versão atual aparece no rodapé desta tela, ex.: `v24`).

---

## 12. Perguntas frequentes

**Preciso de internet para usar?**
Só na primeira vez. Depois de instalado, funciona offline.

**Onde ficam meus dados? Alguém consegue ver?**
Ficam **somente no seu aparelho** (banco local do navegador, IndexedDB). Não há servidor, conta, login
nem analytics. Nada é enviado para lugar nenhum — só sai do aparelho quando **você** exporta o backup ou
compartilha o texto de um treino.

**O que é RIR?**
"Repetições na reserva": quantas repetições boas você ainda conseguiria fazer ao terminar a série.
RIR 2 = ainda dava 2. Quanto menor o RIR, mais perto da falha.

**Por que a carga não fica salva na ficha?**
Porque a carga muda a cada treino. O app guarda o **plano** na ficha (séries e reps) e o **executado** no
treino (reps, carga, RIR). A carga do dia você digita; o app já sugere a da última vez.

**Posso usar em dois celulares?**
Não simultaneamente. Cada aparelho tem o seu banco local — use **Exportar/Importar** para levar os dados
de um para o outro.

**Limpei os dados do navegador e perdi tudo. Tem como recuperar?**
Só se você tiver um backup JSON exportado. Vale a pena exportar de vez em quando.

**Preciso criar todos os exercícios?**
Não. Use o **catálogo** (927 exercícios em português) e só crie os que a sua academia tem de específico.

**A semana pode começar em qualquer dia?**
Sim — e é você que diz qual. Vá em **Mais → Metas da semana → Semana iniciada em**.

**Consigo anotar mais de uma série de aquecimento?**
Hoje o aquecimento é **uma linha por exercício** (reps, peso, RIR). Se precisar de mais linhas, fale com
quem mantém o app — é uma evolução prevista.

---

## 13. Problemas comuns e o que fazer

| Sintoma | Causa provável | Solução |
|---|---|---|
| Ícones aparecem como **quadradinhos** | Arquivos antigos em cache | **Mais → Atualizar app** |
| O app parece **desatualizado** (não aparece uma tela nova) | Service worker com versão antiga | **Mais → Atualizar app** ou abra `/reset.html` uma vez |
| **"Semana encerrada"** e as metas não avançam | Fim dos 7 dias | Toque em **Iniciar próxima semana** no aviso do Início |
| Toquei em **Salvar** e não salvou | Nenhuma série/aquecimento/cardio preenchido | Preencha ao menos uma informação (o app avisa) |
| Esqueci de registrar e quero lançar um treino de outro dia | — | Em **Treinar**, mude a **Data** |
| A tela dá **zoom** ao tocar num campo de texto (iPhone) | Safari amplia quando o campo tem fonte menor que 16px | Corrigido nas versões novas; se ainda acontecer, use **Mais → Atualizar app** |
| Exercícios que eu criei **sumiram da Biblioteca** | Bug corrigido na v27: o app escondia exercícios cujo nome também existia no catálogo | Use **Mais → Atualizar app** — seus exercícios nunca foram apagados |
| Importei o backup errado | — | **Mais → Dados → Desfazer** (logo após importar) |

---

## 14. Glossário

- **RIR (repetição na reserva)**: quantas reps ainda caberiam ao fim da série.
- **Série**: uma rodada do exercício.
- **Reps**: repetições feitas naquela série.
- **Carga**: peso usado (kg) naquela série.
- **Aquecimento**: série leve antes das séries de trabalho, para preparar o músculo e testar a carga.
- **Ficha**: seu treino completo, o plano que você segue (ex.: TREINO A - inferiores).
- **Tonelagem/volume**: soma de carga × reps. O app ainda **não** calcula (está previsto para uma fase futura).
- **PR**: *personal record* — sua melhor marca naquele exercício (maior carga registrada).

---

*Bom treino! 💪 Se encontrar algum comportamento estranho, anote o que você estava fazendo e a versão exibida em **Mais** (rodapé) — isso ajuda muito a corrigir.*
