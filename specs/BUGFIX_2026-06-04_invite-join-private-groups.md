# BUGFIX: Entrar por convite em grupos quebrado end-to-end (web + Android + rules)

> **Status:** `FIXED`
> **Severidade:** `HIGH`
> **Autor:** Claude (agente)
> **Data:** 2026-06-04
> **PR:** #TBD
> **Issues:** #2515 (web), #2516 (android), #2517 (firestore/regressão #2153)

---

## 1. Descrição do Bug

O fluxo de **entrar por convite em grupos** estava quebrado em todas as camadas.
São 3 bugs ACOPLADOS: a arquitetura da regra determina como web/Android gravam.

### 1.1 Comportamento Atual (Errado)

- **#2515 (web)** `web/src/hooks/useGroups.ts`: `joinByInviteCode` gravava o
  member doc SEM o campo `status`. A rule de self-create MEMBER exige
  `status=='ACTIVE'` → `null != 'ACTIVE'` → `batch.commit()` negado inteiro.
- **#2516 (android)** `FirebaseDataSource.kt`: a transação fazia
  `update(group, member_count++)` no cliente, mas a rule tornou `member_count`
  server-authoritative (`fieldUnchanged('member_count')`) → transação rejeitada.
  (Web já tinha removido isso em FIX #611/#626; Android ficou pra trás.)
  Bug latente adicional: o caminho Android NUNCA marcava o convite como `used`
  (criava o member direto), deixando o single-use furado.
- **#2517 (firestore/rules, regressão de #2153)** `firestore.rules`: o gate
  `is_public==true` no self-create MEMBER tornava IMPOSSÍVEL entrar por convite
  em grupo PRIVADO — que é justamente o propósito do convite. O comentário da
  própria regra previa "convite aprovado via trigger", mas esse trigger nunca
  foi criado para `invites/`.

### 1.2 Comportamento Esperado (Correto)

Entrar por convite funciona em grupo PÚBLICO e PRIVADO, em web e Android, sem
reabrir o buraco de #2153 (self-join arbitrário a grupo privado SEM convite
continua bloqueado).

### 1.3 Passos para Reproduzir

1. Gerar convite de um grupo PRIVADO.
2. Abrir `/join/:code` como outro usuário; clicar "Entrar no grupo".
3. Observar `PERMISSION_DENIED` (web/Android) — usuário não entra.

---

## 2. Causa-Raiz

1. **Regressão de #2153**: #2153 fechou uma escalada de acesso (qualquer auth
   conhecendo um `groupId` virava membro de grupo privado) adicionando o gate
   `is_public==true` ao self-create MEMBER. A correção sugerida de #2153 previa
   "ou convite/join_request aprovado **via Cloud Function**". O caminho de
   **join_request** ganhou seu trigger (`onJoinRequestApproved`); o caminho de
   **convite** ficou sem nenhum → entrar por convite em grupo privado virou
   impossível.
2. **Drift web↔Android**: o web removeu o `member_count++` do cliente
   (FIX #611/#626); o Android não.
3. **Trigger faltante** sobre `invites/`.

---

## 3. Decisão de Arquitetura: Opção A — trigger server-side

Avaliadas duas opções (registrada em `DECISIONS.md`):

- **Opção A (ESCOLHIDA): trigger `onInviteRedeemed`** que cria o member doc com
  privilégio admin quando um convite válido é marcado usado — espelhando
  `onJoinRequestApproved`. O cliente só marca o invite `used`; o trigger cria a
  membership (bypassa rules → funciona p/ grupo PRIVADO).
- **Opção B (rejeitada): relaxar a rule** para validar o invite via `get()`. A
  rule de member-create NÃO tem acesso ao code do convite (o code é o doc-id que
  o cliente possui; a rule nunca o recebe). Implementá-la exigiria acoplar o
  doc-id no member doc — frágil — e manteria o drift de schema web↔Android.

**Por que A:** torna o trigger o único writer da membership de convite, o que
unifica o schema (free side effect), é server-authoritative (mais seguro) e
funciona p/ público e privado. O gate `is_public==true` da rule fica INTACTO
(governa só o self-create direto do cliente, exclusivo de grupo público) →
proteção de #2153 preservada.

---

## 4. Implementação por Camada

| Camada | Arquivo | Mudança |
|--------|---------|---------|
| Functions | `functions/src/groups/invite-redeemed.ts` (novo) | Trigger `onInviteRedeemed` (used:false→true) cria member ACTIVE + `users/{uid}/groups`, SEM incrementar member_count e SEM flag `_counted_by_join_request` (deixa `onMemberWritten` fazer o +1). Idempotente, valida expiração/grupo ativo, busca name/photo de `users/{used_by}`. |
| Functions | `functions/src/index.ts` | Registra o export do novo trigger. |
| Rules | `firestore.rules` | Comentário do gate `is_public==true` atualizado: gate mantido (proteção #2153); convite passa pelo trigger, não pela rule. |
| Web | `web/src/hooks/useGroups.ts` | `joinByInviteCode` deixa de criar member/user-group; só faz `updateDoc(invite, {used, used_by, used_at})`. Aguarda member doc via `onSnapshot` (até ~8s) antes de resolver — evita race de leitura em grupo privado. |
| Android | `shared/.../FirebaseDataSource.kt` | Split modern/legacy. Modern (`invites/`): marca invite used + aguarda member doc (corrige #2516 e o single-use furado). Legacy (`groups.invite_code`): remove `member_count++` (#2516); member-create do cliente permanece (público-only via gate; limitação herdada documentada). |

### 4.1 Race de leitura pós-join (grupo privado)

Opção A torna a membership ASSÍNCRONA. Em grupo privado, navegar pro detalhe
antes do member doc existir causaria `PERMISSION_DENIED`. Ambos os clientes
aguardam o member doc aparecer (listener web / polling Android, timeout ~8s)
antes de resolver sucesso. Timeout não é erro — a membership já está garantida
pelo trigger; só a propagação pode atrasar (cold start). Em cold start acima da
janela de ~8s o cliente navega antes da propagação e a leitura do grupo pode
falhar momentaneamente; estado degradado, não bloqueante.

> **DEPENDÊNCIA DE REGRA (não remover):** o membership-wait só funciona porque a
> rule de read de `groups/{gid}/members/{memberId}` (firestore.rules ~L1428)
> permite `memberId == userId()` — o usuário lê a PRÓPRIA entrada mesmo antes de
> ser membro. Sem essa cláusula, o próprio listen/poll daria PERMISSION_DENIED e
> travaria os ~8s em TODO join privado. Não remover ao editar as rules.

### 4.2 Limitação herdada (não-regressão)

Convite **legado** (`groups.invite_code`, sem doc em `invites/`) no Android
permanece **público-only** (um joiner não pode criar `invites/{code}` p/ disparar
o trigger; a rule exige `inviter_id==self` + admin). A web não suporta legado.
Pré-existente, não é regressão deste PR.

---

## 5. Verificação (Testes)

- **Rules** (`firestore-rules-tests/src/invites.test.ts`):
  - (b, proteção #2153) self-create MEMBER SEM convite em grupo PRIVADO FALHA.
  - self-create em grupo público (discovery) ainda SUCEDE; sem `status` FALHA.
  - (c) update de convite expirado FALHA; `used_by != self` FALHA; convite válido
    de grupo privado pode ser marcado usado (membership via trigger).
- **Functions** (`functions/test/invite-redeemed.test.ts`):
  - (a) used:false→true cria member ACTIVE em grupo privado; NÃO incrementa
    member_count; NÃO seta flag; idempotente; expirado/grupo inativo/sem
    used_by/sem group_id abortam.
- **Web** (`web/src/hooks/useGroups.test.ts`): join chama `updateDoc` (não
  writeBatch), aguarda membership via listener.
