# SPEC: Melhorias de Recorrência — Preview Android, Skip/Cancel de Instância, End-date/Count

> **Status:** `APPROVED`
> **Autor:** Renan (via Claude)
> **Data:** 2026-06-03
> **PR:** #xxx (preencher quando criar)
> **Épico:** #2398

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O **motor de recorrência já existe e está deployado** (`functions/src/games/recurrence-engine.ts`; trigger `onGameFinishedCreateRecurrence` em `index.ts:2307`; cria UM próximo jogo ao finalizar, idempotência via flag `next_game_created`, teto de 52 ocorrências). Porém há 3 lacunas de produto:

1. **Preview no Android ausente.** O web já mostra preview das próximas 4 datas na criação (`CreateGameScreen.tsx:281-282` via `getNextRecurrenceDates()`, render `1297-1310`). O Android coleta a frequência mas **não exibe preview** (`CreateGameScreen.kt` não renderiza próximas datas).
2. **Skip/cancel de uma instância sem quebrar a série — ausente nos dois.** Hoje só existe `softDeleteGame` do jogo inteiro (`GameDetailScreen.tsx:506-516`; Android `GameDetailViewModel.kt:646`). Não há como pular/cancelar uma única ocorrência mantendo a série.
3. **Sem end-date ou contagem de ocorrências.** Ambas plataformas expõem apenas o dropdown de frequência (weekly/biweekly/monthly). Não há "repetir até X" ou "repetir N vezes" — o engine sempre vai ao teto de 52.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Dono do Jogo (Android) | Ativa recorrência e vê as próximas datas antes de criar | Preview de N datas (paridade com web) |
| UC2 | Dono do Jogo | Define data-fim ou número de ocorrências | Série respeita o limite, não vai a 52 cego |
| UC3 | Dono do Jogo | Cancela/pula UMA ocorrência (ex.: feriado) | Aquela data fica cancelada; próximas seguem normalmente |
| UC4 | Jogador | Vê que uma data da série foi cancelada | Estado visual claro "cancelado" na ocorrência |

### 1.3 Critérios de Aceite

- [ ] CA1: Android exibe preview das próximas N datas (mesmo N do web) ao ativar recorrência na criação.
- [ ] CA2: Form (web + Android) permite escolher **fim da recorrência** por uma de: data-fim OU número de ocorrências (decisão UX em §2).
- [ ] CA3: Engine respeita o limite escolhido (substitui/co-existe com teto 52 como hard cap).
- [ ] CA4: Existe ação "Cancelar esta ocorrência" no detalhe do jogo recorrente (web + Android) que NÃO apaga a série.
- [ ] CA5: Ocorrência cancelada não dispara criação da próxima de forma quebrada; a série continua a partir da próxima data válida.
- [ ] CA6: Idempotência preservada (sem dupla criação) — não regredir flag `next_game_created`.

### 1.4 Fora de Escopo

- iOS (CMP Fase 3).
- Reagendar (mover) uma ocorrência para outra data — apenas cancelar/pular nesta versão.
- Editar a frequência de uma série já em andamento.

---

## 2. UX/UI Design

### 2.1 Fluxo

```
[Create: ativa recorrência] --> [Preview próximas N datas + seletor de fim]
[GameDetail de jogo recorrente] --menu--> [Cancelar esta ocorrência] --confirm--> ocorrência cancelada, série segue
```

### 2.2 Decisão UX APROVADA (2026-06-03): **(C) Ambos**

Seletor com rádio/toggle de modo: **"N vezes"** | **"até DD/MM"**.
- Modo count: input numérico (2..52, hard cap 52).
- Modo data-fim: date picker; engine calcula ocorrências até a data (sem exceder 52).
- Persistência: gravar **apenas um** dos dois campos conforme o modo (`recurrence_count` XOR `recurrence_end_date`). O outro fica null. O engine deriva o limite efetivo de qualquer um (data-fim → calcula índice máximo on-the-fly), sempre respeitando o hard cap 52.
- Default: se o usuário não tocar no seletor, comportamento atual (vai ao teto 52) — manter retrocompat.

### 2.3 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| Create (recorrência ON) | Success | Dropdown frequência + seletor de fim + preview lista de datas |
| Create (conflito em data futura) | Warning | Indicador na data específica do preview (web já faz) |
| GameDetail recorrente | Success | Badge "Série • toda semana" + ação "Cancelar esta ocorrência" |
| GameDetail ocorrência cancelada | Empty/Info | Estado "Esta ocorrência foi cancelada" |

### 2.4 Acessibilidade

- [ ] Preview com `contentDescription` por data
- [ ] Ação de cancelar com confirmação (dialog) e texto claro de que afeta só 1 data
- [ ] Touch targets >= 48dp

---

## 3. Technical Design

### 3.1 Arquitetura

```
[Create UI] --> [CreateGameViewModel / CreateGameScreen.tsx] grava recurrence config (freq + limite)
[Firestore games/{id}] campos: recurrence_type, recurrence_count|recurrence_end, recurrence_parent_id
[recurrence-engine.ts onGameFinished] respeita limite + pula ocorrências canceladas
[GameDetail] ação cancelar marca a ocorrência (status) sem softDelete da série
```

### 3.2 Modelos de Dados (Firestore)

Campos atuais no engine: `recurrence_type`, `recurrence_parent_id`, `next_game_created`. **Adicionar:**

```
recurrence_count: number | null      // total de ocorrências desejadas (modo "N vezes")
recurrence_end_date: string | null   // ISO date (modo "até DD/MM"); XOR com recurrence_count
recurrence_index: number             // posição desta ocorrência na série (1-based)
recurrence_cancelled: boolean        // esta ocorrência foi pulada
```

Engine — limite efetivo (decisão "ambos"): ao criar a próxima ocorrência (data D, índice i+1), parar se **qualquer** condição for atingida:
- `recurrence_count != null && (i+1) > recurrence_count`, OU
- `recurrence_end_date != null && D > recurrence_end_date`, OU
- `i+1 > 52` (hard cap inviolável).

Se a ocorrência atual está `recurrence_cancelled`, ainda assim avançar a série a partir da data correta (cancelar ≠ encerrar série).

> **Nota de auditoria (2026-06-03):** existe uma coleção `schedules` + entidade `AndroidSchedule`/`Schedule` (KMP) que o Android grava ao criar jogo recorrente (`CreateGameViewModel.kt:907-928`), além de uma tela `SchedulesScreen`. **Porém nenhuma Cloud Function lê `schedules` para materializar jogos** — as únicas referências em `functions/` são deleção no account-cleanup (`index.ts:1850`). Ou seja, `schedules` é **metadata dormente**; o mecanismo real de recorrência é o chain-on-finish `recurrence-engine.ts`. Esta spec opera sobre o engine real; reconciliar/remover `schedules` está **fora de escopo** (avaliar em épico separado).

### 3.3 Cloud Functions

| Operação | Onde | Mudança |
|----------|------|---------|
| Criar próxima ocorrência | `recurrence-engine.ts` | respeitar `recurrence_count`; propagar `recurrence_index` |
| Cancelar ocorrência | nova callable OU update guard em rules | marcar `recurrence_cancelled=true` sem apagar |

**Idempotência:** manter flag `next_game_created`. Cancelar uma ocorrência futura ainda-não-criada = apenas marca config; cancelar a atual antes do trigger = engine deve pular para a próxima data.

### 3.4 Segurança

- [ ] Só o dono do jogo / admin do grupo pode cancelar ocorrência (rules + claim)
- [ ] Validar `recurrence_count` (2..52) server-side

### 3.5 Performance

- [ ] Preview calcula N datas client-side (sem reads extras) — web já faz; replicar no Android
- [ ] Lista de preview com `key` por data

### 3.7 Analytics

| Evento | Quando | Parâmetros |
|--------|--------|------------|
| `recurrence_configured` | Criar com recorrência | `type`, `count` |
| `recurrence_occurrence_cancelled` | Cancelar 1 ocorrência | `game_id` |

---

## 4. Tasks (Breakdown)

| # | Task | Estimativa | Status |
|---|------|------------|--------|
| 1 | Android: preview de N datas na criação (paridade web `getNextRecurrenceDates`) | 3h | ⬜ |
| 2 | Web + Android: seletor de fim (opção A — count) no form | 3h | ⬜ |
| 3 | Engine: respeitar `recurrence_count` + propagar `recurrence_index` | 2h | ⬜ |
| 4 | Cancelar ocorrência: callable/rules + UI web | 3h | ⬜ |
| 5 | Cancelar ocorrência: UI Android | 2h | ⬜ |
| 6 | firestore.rules: novos campos + guarda de cancelamento | 2h | ⬜ |
| 7 | Testes engine (Jest): count limit, skip de cancelada, idempotência | 3h | ⬜ |
| 8 | Testes UI (web Vitest + Android Compose) | 3h | ⬜ |

**Total estimado:** ~21h (candidato a quebrar em 2-3 PRs: [engine+count] / [cancel-instance] / [Android preview])

---

## 5. Verification

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Functions (Jest) | count limit, skip cancelada, idempotência, hard-cap 52 | ⬜ |
| Web (Vitest) | preview, seletor de fim, cancelar ocorrência | ⬜ |
| Android (Compose/Unit) | preview, seletor, cancelar | ⬜ |
| Rules (emulator) | quem pode cancelar; range de count | ⬜ |

### 5.2 Checklist

- [ ] `npx jest` (functions) verde
- [ ] `npm run test` (web) verde
- [ ] `:app:testDebugUnitTest` verde
- [ ] Sem dupla criação (idempotência)
- [ ] Série continua após ocorrência cancelada

---

## 6. Notas e Referências

- Épico: #2398
- Engine: `functions/src/games/recurrence-engine.ts`, `index.ts:2307`
- Web preview: `web/src/pages/game/CreateGameScreen.tsx:281-310`
- Memory: `project_epics_2397_2401_worklist`, `project_functions_audit_2026_06_01` (recurrence spawn não-atômico — checar antes de mexer no engine)

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-06-03 | Claude | Criação inicial (DRAFT) |
