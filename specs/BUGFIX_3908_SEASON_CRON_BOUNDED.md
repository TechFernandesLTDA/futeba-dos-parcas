# BUGFIX #3908 — crons de temporada da Liga sem teto: conjunto ilimitado, laço sem cursor, standings acumulam em temporada obsoleta

| Campo | Valor |
|---|---|
| **Issue** | #3908 |
| **Status** | APPROVED |
| **Tipo** | Bugfix (regressão) |
| **Camadas** | Cloud Functions (crons + trigger) |
| **Origem** | Auditoria sobre o fix do #3896 (commit `ab7e969d`), já em produção |

---

## 1. Problema

O fix do #3896 trocou o escopo de `startNewSeason`/`archiveSeason` (`functions/src/growth/season-cycle.ts`) de um catálogo fixo de 11 grupos (`official-groups`) para **todo grupo com temporada ativa**, via `listManagedGroupIds()`. O escopo maior está correto — o problema é que ele é **ilimitado, monotonicamente crescente, e varrido em laço sequencial sem cursor** dentro de um teto de tempo fixo (`timeoutSeconds` implícito de 120s, herdado de `setGlobalOptions` em `index.ts`). Quando o teto é atingido, o rollover mensal trunca, e como a ordem de iteração é determinística, são sempre os mesmos grupos da cauda que ficam de fora — mesma família de inanição do #3875, agora na virada de temporada.

Quatro defeitos, todos raiz no mesmo commit:

### D1 — Comentário afirma exclusão de grupo dormente; o código não implementa isso

O comentário em `season-cycle.ts:16-20` (pré-fix) dizia que "grupo dormente fica de fora de propósito". Falso: `startNewSeason` faz `batch.set(seasonRef, {is_active:true, ...})` incondicional para **todo** grupo gerenciado, todo mês — não existe critério de dormência. Assim que um grupo entra no conjunto (basta um jogo finalizado), fica lá para sempre. O conjunto gerenciado só cresce.

### D2 — Laço sequencial sob teto fixo, sem cursor, sem retomada

Nenhuma das duas funções declara `timeoutSeconds`/`memory` explícitos. `archiveSeason` custa ~6 round trips por grupo; em ~250-300ms/grupo, 120s cobrem ~400-480 grupos. Sem cursor persistido, ao estourar o teto a invocação morre sem deixar estado de retomada, e a próxima invocação (mês seguinte, já que `startNewSeason` só dispara no dia 1º e `archiveSeason` só processa no último dia) reinicia do zero — starvando sempre a mesma cauda.

### D3 — Corrupção composta: standings acumulam em temporada obsoleta

Se `startNewSeason`/`archiveSeason` truncam antes de alcançar o grupo X, X fica com o mês anterior ainda `is_active:true`. Como o provisionamento sob demanda em `group-league.ts` só dispara quando **não há** temporada ativa, não há auto-cura: todo jogo seguinte incrementa `league_standings` no documento do mês antigo, que já foi (ou nunca será) arquivado. Histórico arquivado e standing vivo divergem permanentemente.

### D4 — Duas temporadas ativas por corrida + `limit(1)` sem `orderBy` + `start_date` incoerente

O provisionamento sob demanda em `group-league.ts` (transação de `onGameFinishedGroupLeague`) deriva `candidateSeasonRef` do **mês do jogo**. Dois jogos de meses diferentes finalizando concorrentemente não contendem no Firestore (documentos distintos), então ambos podem comitar — o grupo fica com duas temporadas `is_active:true`. A leitura (`activeSeasonQuery`, `.where("is_active","==",true).limit(1)`) não tinha `orderBy`, então qual delas "vence" era arbitrário. Além disso, a temporada provisionada gravava `start_date: serverTimestamp()` (o agora) mesmo quando `targetSeasonId` era um mês passado (jogo retroativo) — e `useGroupLeague` ordena por `start_date`.

## 2. Decisões de design

### D2.1 — Cursor persistido + orçamento de tempo, mesmo padrão de `gamification-nudges.ts` (#3875/#3901)

`listManagedGroupIds()` materializa a lista completa em memória (uma única query `collectionGroup`, sem round trip por grupo — não é o gargalo). O laço por grupo passa a operar sobre essa lista **ordenada** (`Array.sort()`), com cursor persistido em `system_state/season_cycle_{start,archive}_cursor` guardando `{month_key, last_group_id}`. Ao esgotar o orçamento, persiste o cursor e encerra; a invocação seguinte retoma do primeiro id **estritamente maior** que o cursor (`findIndex(id => id > lastGroupId)`) — robusto a grupo removido entre execuções, mesmo raciocínio do #3901 (não exigir existência do cursor, só posição).

Diferença deliberada em relação a `gamification-nudges.ts`: **sem teto de idade (`CURSOR_MAX_AGE_MS`)** para o cursor. O padrão de 48h dos nudges assume varredura *diária* (reiniciar amanhã é seguro); aqui a varredura é *mensal* — se a cauda legitimamente precisar de vários dias de execuções sucessivas, um teto de idade descartaria o cursor no meio do caminho e reiniciaria do índice 0, re-andando a cabeça da lista e nunca alcançando a cauda de novo. O único sinal de obsolescência usado é `month_key` divergente do mês corrente/pendente — isso já cobre o caso real (mês virou, trabalho do mês anterior é descartado deliberadamente).

`runWithConcurrency` **não** foi extraído para um módulo compartilhado com `gamification-nudges.ts`: é uma função de ~8 linhas, e reusá-la via import obrigaria tocar um arquivo com suíte de 851 linhas para zero ganho comportamental. Foi replicada localmente em `season-cycle.ts`.

### D2.2 — `startNewSeason` muda de mensal para diário, com portão barato

`startNewSeason` rodava só no dia 1º (`"0 1 1 * *"`) — se não terminasse, a próxima invocação só viria no dia 1º do **mês seguinte**, sem chance de retomar a cauda do mês corrente. O schedule passa a `"0 1 * * *"` (diário, 01:00 BRT). Dentro do handler, o portão é: dia 1º **ou** cursor pendente com `month_key` igual ao mês corrente → processa; caso contrário (2º-31º dia, sem pendência) → `return` **antes** de chamar `listManagedGroupIds()` — o portão lê só o doc de cursor (1 leitura pequena), não a collectionGroup inteira. Sem isso, o custo da varredura ilimitada seria multiplicado por ~30/mês para nada.

`archiveSeason` já roda diariamente (`"59 23 * * *"`, com `return` antecipado se não for o último dia) — o portão muda de "é o último dia?" para "há cursor pendente (retoma o mês que ficou incompleto, **independente do dia de hoje**) OU é o último dia (inicia o mês corrente)?". O `month_key` persistido no cursor de archive é o **mês sendo arquivado**, não o mês da invocação — dia 2 de agosto pode estar retomando o arquivamento de julho.

### D2.3 — `archiveSeason`: idempotência por existência do arquivo, não por `is_active`

Efeito colateral do D2.2 que não estava no plano original e que, sem correção, reintroduz uma variante do próprio bug do #3896: uma vez que `archiveSeason` pode retomar em dias **depois** da virada de mês, `startNewSeason` (já rodando para o mês N+1) pode alcançar um grupo da cauda **antes** de `archiveSeason` alcançá-lo para fechar o mês N. `startNewSeason` desativa qualquer `league_seasons` ativa que não seja o mês corrente (seu próprio reparo, preexistente) — então quando `archiveSeason` finalmente chega nesse grupo, a season do mês N **já está `is_active:false`**, e o guard antigo (`if (!seasonDoc.data()?.is_active) continue;`) pulava o arquivamento **para sempre**, sem backfill.

Fix: o guard de "já processado" deixa de olhar `is_active` e passa a checar a **existência do documento de archive** (`season-archive/{groupId}/seasons/{monthKey}`). Isso também torna `archiveSeason` idempotente por natureza (pré-requisito para poder rodar em múltiplos dias sem duplicar arquivo), e o `turnoverBatch.update(seasonRef, {is_active:false, ...})` continua sendo executado mesmo que já estivesse `false` (no-op idempotente).

### D2.4 — D1 (conjunto que só cresce): comentário corrigido, poda de grupo dormente **fora de escopo**

O comentário passa a descrever a realidade: o conjunto gerenciado é `official-groups` (sempre incluído, independente de atividade) ∪ todo grupo com `league_seasons` ativa — e esse segundo termo só cresce, por decisão, não por bug de implementação incompleta.

Considerado e descartado: podar do rollover mensal todo grupo cuja temporada prestes a virar não teve nenhum `league_standings` (zero jogos no mês). Motivo de **não** fazer isso neste PR:

1. A `Correção proposta` da própria issue #3908 não lista encolher o conjunto como item obrigatório — é uma "direção sugerida" a avaliar.
2. Uma vez que D2.1 garante retomada com cobertura total (nenhuma invocação morre sem deixar cursor), o tamanho do conjunto deixa de ser um problema de **corretude** — vira um problema de **custo** (mais grupos = mais round trips ao longo do mês, mas sempre dentro do orçamento, nunca truncando permanentemente).
3. "O que conta como dormente" é uma decisão de produto (1 mês sem jogo? 2? grupo oficial tem carência?) que merece issue própria com esse recorte, não uma bifurcação implícita dentro de um bugfix de disponibilidade.
4. Verificado nos dois casos de teste existentes que uma poda por "zero standings no mês" tocaria (`archiveSeason em dezembro cria a season de janeiro`, `archiveSeason apenas ativa a próxima season pré-existente`, ambos em `season-turnover-race.test.ts`): os dois seedam `official-groups/group-1`, que already fica sempre gerenciado independente de atividade — ou seja, mesmo implementando a poda com escopo restrito a grupo não-oficial, `startNewSeason` recriaria a season desse grupo específico no dia 1º de qualquer forma. A ausência de poda não é, portanto, o que faz esses testes passarem hoje; é uma decisão separada, documentada aqui para não ser reintroduzida por engano.

### D2.5 — `activeSeasonQuery`: `orderBy` determinístico + auto-cura na mesma transação

`group-league.ts`, dentro da transação de `onGameFinishedGroupLeague`: `activeSeasonQuery` ganha `.orderBy(FieldPath.documentId(), "desc").limit(5)` (mês mais recente primeiro; teto de 5 é defensivo — no caso normal há 0 ou 1 documento). Se a leitura retornar **mais de um** documento ativo (efeito da corrida D4), a transação desativa os extras (`tx.update(..., {is_active:false, end_date, updated_at})`) na mesma transação que resolve `targetSeasonId`, mantendo só o mais recente.

Isso **não elimina** a janela em que duas transações concorrentes, ambas vendo `activeSeasonQuery` vazio, provisionam meses diferentes ao mesmo tempo — Firestore só detecta conflito de transação em documentos que ambas as transações leem/escrevem, e aqui os dois documentos-alvo são distintos, então não há contenção real a nível de Firestore. Eliminar isso de verdade exigiria um documento "ponteiro" compartilhado por grupo pelo qual todo provisionamento teria que passar — mudança estrutural maior, não justificada aqui pela raridade do cenário (dois jogos de **meses diferentes** finalizando no mesmíssimo instante de commit, no mesmo grupo). O que este fix garante é **auto-cura na próxima invocação do trigger para aquele grupo** (a própria transação seguinte já limpa o excedente), em vez de esperar até um mês inteiro pelo reparo de `startNewSeason`.

### D2.6 — `start_date` deriva do mês da temporada, não do instante da escrita

Novo helper `monthKeyToStartDate(monthKey)` em `growth/season-naming.ts` (mesmo módulo sem efeito colateral que já hospeda `buildSeasonName`/`getMonthName`, por isso group-league.ts pode importá-lo sem puxar o scheduler): retorna `Date.UTC(ano, mês-1, 1, 3, 0, 0)` — 03:00 UTC = 00:00 America/Sao_Paulo (sem horário de verão no Brasil desde 2019), dia 1º do mês da temporada. Usado só no provisionamento sob demanda (`group-league.ts`), onde `targetSeasonId` deriva da data do jogo e pode ser um mês passado. Os crons (`season-cycle.ts`) continuam usando `serverTimestamp()`, porque ali o mês criado **é** o mês corrente (ou o seguinte, na virada atômica do #3882) — a diferença entre "agora" e "meia-noite do dia 1º" é de segundos/minutos, irrelevante para ordenação.

## 3. Mudanças

| Arquivo | Mudança |
|---|---|
| `functions/src/growth/season-cycle.ts` | Cursor persistido + orçamento de tempo + concorrência limitada nos dois crons; `startNewSeason` vira diário com portão barato; `archiveSeason` retoma independente do dia; guard de idempotência trocado de `is_active` para existência do archive; `timeoutSeconds:540`/`memory:512MiB` explícitos; comentário de D1 corrigido; `runStartNewSeason`/`runArchiveSeason` exportados (options-based, iguais em espírito a `runGamificationNudges`) |
| `functions/src/group-league.ts` | `activeSeasonQuery` com `orderBy(documentId(),"desc").limit(5)`; auto-cura de temporadas ativas duplicadas na mesma transação; `start_date` do provisionamento sob demanda passa a usar `monthKeyToStartDate` |
| `functions/src/growth/season-naming.ts` | Novo: `monthKeyToStartDate` |
| `functions/test/growth-season-cycle-scheduler.test.ts` | Mocks: `delete()` em `docRef`, `Timestamp` em `firebase-admin/firestore` |
| `functions/test/season-turnover-race.test.ts` | Mocks: `delete()` em `docRef`, `Timestamp` |
| `functions/test/group-league-season-fallback.test.ts` | Mocks: `orderBy`/`update` na query/tx fake, `.ref` nos docs de season ativa, `FieldPath`/`Timestamp` em `firebase-admin/firestore` |
| `functions/test/season-cycle-bounded-cron.test.ts` | Novo: retomada de cursor sob orçamento, portão barato em dia não-1º/não-último, archive não starva grupo com season já desativada por reparo |

## 4. Critérios de aceite

- [ ] Execução truncada por orçamento de tempo persiste cursor; execução seguinte cobre a cauda sem reprocessar a cabeça
- [ ] `archiveSeason` arquiva grupo cuja season já foi desativada por `startNewSeason` (reparo alcançou o grupo primeiro) — sem isso, mês fica sem archive para sempre
- [ ] Dia não-1º sem cursor pendente: `startNewSeason` retorna sem chamar `listManagedGroupIds()`
- [ ] Duas temporadas ativas simultâneas para o mesmo grupo: a transação seguinte de `onGameFinishedGroupLeague` desativa a mais antiga
- [ ] `start_date` de temporada provisionada sob demanda cai dentro do mês de `targetSeasonId`, não no instante da escrita
- [ ] Comentário de `listManagedGroupIds()` descreve o comportamento real (conjunto só cresce, poda fora de escopo)
- [ ] `npm run build`, `npm run lint` e `npx jest --no-coverage` verdes, sem regressão nos 3 arquivos de teste pré-existentes de season/liga
- [ ] Diff-coverage ≥80% nas linhas novas do PR

## 5. Não coberto

- Poda de grupo dormente do conjunto gerenciado (D2.4) — fora de escopo, decisão registrada.
- Eliminação estrutural da corrida de duas temporadas ativas via documento-ponteiro compartilhado (D2.5) — auto-cura por transação seguinte é o que este PR entrega; eliminação total exigiria redesenho do provisionamento sob demanda.
- Paginação da própria query `collectionGroup` dentro de `listManagedGroupIds()` — é uma única query (não N round trips), o custo real estava no laço por grupo, que D2.1 já limita.
