# Plano — App de Treinos (PWA)

## 1. Visão
Aplicativo web instalável (PWA) para registrar treinos de academia, acompanhar metas semanais flexíveis, manter fichas de exercícios e um calendário de frequência. Todos os dados ficam **100% no dispositivo** (IndexedDB), com backup em **JSON** (exportar/importar). Sem backend, sem publicação em lojas.

## 2. Decisões fechadas
- **Distribuição**: GitHub Pages (hospedagem estática gratuita; instala como app e funciona offline).
- **Armazenamento**: IndexedDB (nativo do navegador; funciona em Chrome/Edge e Safari/iOS).
- **Ciclo semanal**: aviso + confirmação ao fim dos 7 dias.
- **Stack**: HTML + CSS + JavaScript puro, sem build e sem dependências.
- **Idioma da interface**: pt-BR.

## 3. Requisitos funcionais
- **FR-01 — Registrar treino**: data, tipo/nome (ex.: "TREINO A - inferiores"), exercícios e cardio (minutos).
- **FR-02 — Séries por exercício**: cada série guarda nº, reps feitas, carga (kg), RIR (repetição na reserva) e observação livre. O app registra série por série, pois reps e carga podem variar.
- **FR-03 — Dashboard**: contador da semana (ex.: `1/3 treinos`, `30/120 min cardio`), últimos treinos e visão de desempenho.
- **FR-04 — Semana flexível**: o usuário marca "semana iniciada"; o app conta 7 dias a partir dessa data, sem fixar dias da semana.
- **FR-05 — Exercícios**: CRUD de fichas por exercício (nome, grupo muscular, séries/reps/carga padrão, lembrete de correção).
- **FR-06 — Colinha**: seção de consulta rápida (RIR, tempo de descanso, lembretes) editável pelo usuário.
- **FR-07 — Calendário de frequência**: visão mensal com os dias em que treinou e quantidade de treinos no mês.
- **FR-08 — Backup**: exportar todos os dados em JSON; importar JSON restaurando os dados.
- **FR-09 — PWA**: instalável na tela inicial, funciona offline após a primeira carga.

## 4. Regras de negócio
- **Semana**: janela de 7 dias `[início, início + 6]` a partir da data marcada. Treinos são sempre atribuídos a uma semana **pela data**. Ao passar 7 dias, o app mostra um aviso "semana encerrada" e o usuário confirma para avançar para a próxima janela. É possível redefinir o início a qualquer momento em Ajustes.
- **Meta padrão**: 3 treinos/semana e 120 min de cardio/semana (editável em Ajustes).
- **Treino válido**: conta para a meta se tiver pelo menos 1 série registrada ou cardio > 0.
- **Cardio**: minutos registrados dentro do treino (um treino pode ser "só cardio").
- **Tonelagem** (opcional, Fase 2): `Σ(reps × carga)` por exercício e por treino, com exibição por toggle.
- **Fotos** (opcional, Fase 2): 1 foto por exercício, armazenada no IndexedDB (Blob) e incluída no JSON de export como base64.
- **Import**: restaura/substitui os dados locais após confirmação (merge pode vir depois).

## 5. Modelo de dados (IndexedDB)
Stores:
- `workouts`: `{ id, date (YYYY-MM-DD), type, cardioMinutes, notes, sets[], createdAt, updatedAt }`
  - `sets[]`: `{ exerciseId, exerciseName (cópia do nome na época), number, reps, load, rir, note }`
- `exercises`: `{ id, name, group, defaultSets, defaultReps, defaultLoad, defaultRir, correction, photo?, active, createdAt, updatedAt }`
- `settings`: `{ id: 'app', weekAnchor (YYYY-MM-DD), weeklyWorkoutTarget, weeklyCardioTarget, tonnageVisible }`
- `colinha`: `{ id, title, content, order }`

## 6. Telas
| Tela | Função |
|---|---|
| Dashboard | Meta da semana, aviso de semana encerrada, últimos treinos |
| Registrar treino | Data, tipo, exercícios + séries (reps/carga/RIR/obs), cardio |
| Exercícios | CRUD das fichas + correção |
| Calendário | Frequência mensal |
| Colinha | RIR, descanso, lembretes |
| Ajustes | Meta semanal, início da semana, exportar/importar JSON |

## 7. Arquitetura / arquivos
```
index.html
css/styles.css
js/app.js (módulos: db.js, ui.js, ...)
manifest.webmanifest
sw.js (service worker)
icons/icon-192.png, icon-512.png
serve.ps1 (servidor local para teste)
PLANO.md
```
- Service worker: cache-first para o "shell" do app; **nenhum dado é enviado a servidor**.
- Teste local sem Node/Python: `serve.ps1` sobe um servidor HTTP local via PowerShell (`localhost` é contexto seguro, então o PWA pode ser testado antes de publicar).

## 8. Distribuição (GitHub Pages)
1. Criar repositório no GitHub e publicar os arquivos.
2. Habilitar GitHub Pages no repositório.
3. No celular, abrir a URL e usar "Adicionar à tela inicial" (Chrome/Edge/Safari).
4. Depois de instalado, o app abre pelo ícone e funciona offline.

## 9. Fases
- **Fase 1 (MVP)**: registro completo de treino (séries, cardio), dashboard com metas, semana com aviso + confirmação, CRUD de exercícios (correção em texto), colinha, calendário, export/import JSON, PWA instalável.
- **Fase 2 (extras)**: foto por exercício, tonelagem opcional, melhorias de UX.

## 10. Suposições a confirmar
1. Tonelagem fica para a Fase 2, como exibição opcional — ok?
2. Foto por exercício fica para a Fase 2 — ok?
3. Importar substitui os dados atuais após confirmação — ok?
4. Nome provisório do app: **"Meu Treino"**.
5. Regra da semana (item 4) atende ao que você imaginou?
