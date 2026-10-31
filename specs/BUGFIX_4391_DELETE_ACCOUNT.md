# BUGFIX: callable `deleteAccount` não existe em produção; exclusão de conta falha em todas as plataformas

> **Status:** `APPROVED` (autorizado pelo dono em 31/10/2026) → `FIXED` (aguardando deploy)
> **Severidade:** `CRITICAL` (bloqueador 1 do lançamento público; LGPD art. 18, VI; Google Play; App Store 5.1.1(v))
> **Autor:** Renan Locatiz Fernandes (com Claude Code)
> **Data:** 2026-10-31
> **Issue:** #4391 (parent #4398)
> **PR:** a abrir

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Web (`web/src/services/cloudFunctions.ts:740`, usado em `SettingsScreen.tsx:157`) e Android
(`AuthRepository.kt:232`) chamam a callable `deleteAccount`, que não existe em produção: a única
definição está em `functions/src/middleware/rate-limiter.example.ts:66`, arquivo de exemplo não
importado pelo `index.ts`. A chamada recebe `not-found` e a conta nunca é excluída.

### 1.2 Comportamento Esperado (Correto)

O titular exclui a própria conta pelo app ou pelo site. A conta some do Firebase Auth e nenhum dado
pessoal dele sobrevive nas coleções listadas na seção 3.4: o que é só dele é apagado, e o que também
pertence a outras pessoas é anonimizado.

### 1.3 Passos para Reproduzir

1. Entrar na web ou no Android com uma conta de teste.
2. Configurações → Excluir conta → confirmar.
3. Observar o erro (`functions/not-found`) e a conta intacta.

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versões | Web 1.53.0, Android 1.41.0, iOS sem tela de exclusão |
| Frequência | Sempre |
| Impacto | 100% das tentativas de exclusão |

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

- Evidência da issue: `gcloud functions list` (31/10/2026) com 173 funções, nenhuma `deleteAccount`. Na
  sonda HTTP relatada na issue, a URL da callable devolveu 404 e a de uma callable existente, 400.
- Já existe o trigger `onUserDeleted` (`functions/src/auth/account-cleanup.ts`, Auth v1 `onDelete`,
  `failurePolicy: true`, teto de 24h), com a cascata LGPD de ~16 coleções. Faltava a porta de entrada
  para o próprio usuário.
- Ao reproduzir o trigger num fake com `recursiveDelete` real, apareceu um segundo defeito: o
  `recursiveDelete` de `users/{uid}` (#4139) rodava no **início** do trigger e apagava
  `users/{uid}/groups` antes de a anonimização de membros e do financeiro do grupo (#4113) ler esses
  links. Desde o #4139, `groups/*/members/{uid}`, `cashbox.player_name` e `payers` mensais deixaram de
  ser anonimizados. O teste antigo não pegava porque o fake não tinha `recursiveDelete` (o `TypeError`
  era engolido pelo `try/catch`). Com o fake corrigido, o código do master falha em 8 dos 18 casos de
  `account-cleanup-writer-shapes.test.ts`.

### 2.2 Causa Raiz

1. A callable foi escrita só como exemplo e nunca exportada (#1029, #1142, #1166 e #3301 foram
   fechadas sem ela chegar a produção).
2. Ordem das etapas do `onUserDeleted`: o subtree do titular era apagado antes de ser lido.

### 2.3 Diff entre irmãos (`account-merge.ts` × `account-cleanup.ts`)

Comparação das coleções e formas de campo que cada irmão enumera, conferidas nos escritores:

| Item | merge | cleanup (antes) | Ação neste fix |
|---|---|---|---|
| `confirmations.userId` (legado) | lê | não lia | cleanup passa a ler |
| `games.owner_id` / `co_organizers` | migra | não tocava | anonimiza `owner_name`, tira o uid de `co_organizers` |
| `groups/*/members` por `collectionGroup` | via links | só via links (e links já apagados) | `collectionGroup("members").user_id` + links |
| seguidores (`users/{x}/followers/{uid}`) | não | não | apaga espelhos e corrige contadores |
| `games/{id}/waitlist/{uid}` | não | não | apaga |
| `notification_settings/{uid}` | não | não | apaga |
| `mvp_votes.voted_player_id` | migra | não | lacuna (seção 3.5) |
| `locations`, `schedules`, `live_games`, `live_scores` (`owner_id`) | migra | não | lacuna (seção 3.5) |
| `account_aliases` | grava | não | lacuna (seção 3.5) |
| chats, notifications, cashbox, reviews, post_game_reputation, game_photos/videos, group_invites, rate_limits, sessions, user_streaks | não | cobre | ponto cego do **merge**, fora deste fix (follow-up) |

### 2.4 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `functions/src/auth/delete-account.ts` | **novo**: callable `deleteAccount` |
| `functions/src/auth/account-deletion-cascade.ts` | **novo**: etapas da cascata e classificação de grupos |
| `functions/src/auth/account-cleanup.ts` | ordem do `recursiveDelete`, etapas novas, contagens |
| `functions/src/index.ts` | export de `deleteAccount` |
| `functions/test/auth/delete-account.test.ts` | **novo** |
| `functions/test/auth/account-cleanup-writer-shapes.test.ts` | fake com `recursiveDelete`, casos #4391 |
| `functions/test/account-cleanup-batch-reuse.test.ts` | consulta nova em `collectionGroup("members")` |
| `web/public/delete_account.html` | texto alinhado ao fluxo real |

---

## 3. Solução

### 3.1 Abordagem

```
cliente ── deleteAccount (callable) ──────────────────────────────┐
           1. secureCallable: App Check, login, 3/hora             │
           2. auth_time ≤ 10 min, senão failed-precondition        │  só leitura
           3. grupos de que é dono: outro membro ativo ⇒ bloqueia  │
           4. grupos sem mais ninguém ⇒ soft delete (cascata)      ┘
           5. getAuth().deleteUser(uid)  ← POR ÚLTIMO (user-not-found = sucesso)
           6. audit_logs: ACCOUNT_DELETED, uid_sha256, contagens
                                   │
                                   ▼ (Auth onDelete)
                         onUserDeleted (única cascata, retry 24h)
```

**Decisão "Auth por último":** a exclusão no Auth é a última etapa da callable; a limpeza em massa
roda no `onUserDeleted`, assíncrona, disparada por ela. Motivos:

- os SDKs desistem da callable em cerca de 70s. Uma cascata síncrona de minutos reportaria falha para
  uma exclusão que deu certo;
- o trigger já tem retry (`failurePolicy`) com teto de 24h e é o mesmo caminho das exclusões feitas
  pelo console. Uma segunda cascata na callable duplicaria escrita e divergiria com o tempo;
- tudo o que a callable decide (login recente, posse de grupo) acontece **antes** da primeira escrita.
  Uma exclusão bloqueada deixa a conta intacta e o usuário pode tentar de novo.

### 3.2 Contrato da callable

| Item | Valor |
|---|---|
| Nome | `deleteAccount` (região `southamerica-east1`) |
| Payload | nenhum (ignorado) |
| Sucesso | `{success: true}` |
| Sem login | `unauthenticated` |
| Sem App Check | `failed-precondition` (mensagem do wrapper) |
| Excesso de chamadas (mais de 3 por hora) | `resource-exhausted` |
| Login antigo | `failed-precondition`, `details: {reason: "requires-recent-login", maxAgeSeconds: 600}` |
| Dono de grupo com outros membros | `failed-precondition`, `details: {reason: "sole-owner-groups", groupCount, groups: [{id, name}]}` |
| Erro inesperado | `internal` (sem detalhe, padrão SECFIX #435) |

- **Login recente:** `auth_time` (segundos) do ID token com no máximo 10 minutos, com 60s de tolerância
  de relógio. Sem `auth_time` conta como antigo. Dez minutos, e não cinco, porque o fluxo web tem duas
  etapas e pede para digitar o e-mail.
- **App Check:** exigido (default do `secureCallable` fora do emulador), **sem consumir o token**
  (`consumeAppCheckToken: false`). O cliente repete a chamada depois de transferir um grupo ou entrar de
  novo, e um token reaproveitado seria recusado como replay. Login recente e rate limit cobrem o abuso.
- **Audit do wrapper desligado** (`enableAuditLog: false`): ele grava o uid cru e o IP em
  `audit_logs.userId`, campo fora do alcance do `onUserDeleted`, e grava depois do handler, ou seja,
  depois da varredura. A callable grava o próprio registro: `action: ACCOUNT_DELETED`,
  `uid_sha256`, `deleted_at`, `already_deleted`, `counts.orphan_groups_soft_deleted`. Sem IP, nome ou
  e-mail.
- **Idempotência:** segunda chamada com o token ainda válido encontra `auth/user-not-found` e responde
  sucesso (`already_deleted: true`). O trigger é idempotente (testado rodando duas vezes).

### 3.3 Dono único de grupo

**Decisão: bloquear, não transferir sozinho.** Se o titular é `owner_id` (ou `ownerId` legado) de um
grupo não excluído com **outro membro ativo** (status `ACTIVE`, ou sem status, como no
`member-counter.ts`), a callable responde `sole-owner-groups` com a lista de grupos e não escreve nada.

- Transferir automaticamente para o admin mais antigo passaria o caixa e a responsabilidade financeira
  do grupo a alguém sem o consentimento dela. A transferência já existe no app
  (`transferGroupOwnership`) e leva segundos.
- Grupos em que **só o titular** continua ativo são excluídos junto, com o mesmo
  `softDeleteGroupCascade` do `softDeleteGroup` (jogos do grupo marcados juntos). Se essa etapa falhar,
  o Auth não é excluído e o usuário pode repetir.
- Grupos já `DELETED` ou com `deleted_at` não entram na decisão. Grupo em `DELETING` (cascata de uma tentativa anterior interrompida) é tratado como órfão e a cascata é retomada; sem isso ele ficaria preso em `DELETING` com o dono já excluído.

### 3.4 Tabela da cascata (coberto)

Ação: **apagar**, **anonimizar** (nome vira "Usuário removido", foto vira `null` ou `""`) ou
**manter**. "Quem" = callable (C) ou `onUserDeleted` (T).

| Coleção / caminho | Campo-chave | Ação | Quem |
|---|---|---|---|
| Firebase Auth | uid | apagar (por último na callable) | C |
| `groups` sem outro membro ativo e dono = titular | `owner_id`/`ownerId` | soft delete do grupo e dos jogos | C |
| `users/{uid}` | ID | apagar (inclui `fcm_token`) | T |
| `users/{uid}/**` (groups, badges, preferences, following, followers, game_templates, upcoming_games, blocked...) | subtree | apagar (`recursiveDelete`, agora **depois** das etapas que leem o subtree) | T |
| `users_private/{uid}` | ID | apagar (telefone, CPF, hashes) | T |
| `cpf_index/{hash}`, `phone_index/{hash}` | `uid` | apagar se ainda apontar para o titular | T |
| `push_tokens`, `push_token_devices` | `userId` | apagar | T |
| `users/{x}/followers/{uid}`, `users/{y}/following/{uid}` (espelhos em outros usuários) + `followers_count`/`following_count` | ID = uid | apagar espelho e decrementar contador na mesma transação (**novo**) | T |
| `sessions/{uid}` | ID | apagar | T |
| `audit_logs` | `target_user_id`, `actor_user_id`, `performed_by`, `manager_uid`, `source_user_id` | apagar | T |
| `rate_limits` | `user_id` + prefixos legados | apagar | T |
| `verification_failures` | `uid` | apagar | T |
| `notifications` | `user_id` | apagar | T |
| `notification_settings/{uid}` | ID | apagar (**novo**) | T |
| `confirmations` de jogo futuro/cancelado | `user_id`, `userId` (legado, **novo**) | apagar (a vaga volta pelo `onConfirmationWrite`) | T |
| `confirmations` de jogo FINISHED/LIVE | `user_id`, `userId` | anonimizar `user_name`/`userName` e fotos (**novo**; antes apagava e mexia no `players_count` de partida encerrada) | T |
| `games/{id}/waitlist/{uid}` (jogos dos grupos do titular) | ID = uid | apagar (**novo**) | T |
| `games` | `owner_id` | anonimizar `owner_name`; o jogo fica com o grupo (**novo**) | T |
| `games` | `co_organizers` (array) | tirar o uid do array (**novo**) | T |
| `mvp_votes` | `voter_id` | apagar | T |
| `xp_logs` | `user_id` | apagar | T |
| `statistics/{uid}` | ID e `user_id` legado | apagar | T |
| `season_participation` | `user_id` | apagar (sai do ranking) | T |
| `activities` | `user_id` | apagar | T |
| `user_badges` | `user_id` | apagar | T |
| `user_streaks` | ID e `user_id` | apagar | T |
| `user_locations/{uid}` | ID | apagar (GPS) | T |
| `group_invites` endereçados ao titular | `invited_user_id`/`invitedUserId` | apagar | T |
| `group_invites` enviados pelo titular | `invited_by_id` | anonimizar `invited_by_name` | T |
| `groups` em que é dono (restantes) | `owner_id`/`ownerId` | anonimizar `owner_name` | T |
| `groups/{g}/members/{uid}` | `user_id` (links **e** `collectionGroup`, **novo**) | anonimizar nome/foto e marcar `INACTIVE` (sai do grupo; `member_count` desce uma vez) | T |
| `groups/{g}/cashbox` (quem lançou) | `created_by` (collectionGroup) | anonimizar `created_by_name` | T |
| `groups/{g}/cashbox` (pagador) | `player_id` | anonimizar `player_name` e o nome dentro de `description` | T |
| `groups/{g}/monthly_finance_periods/{p}/payers/{uid}` | `user_id` | anonimizar nome/foto | T |
| `locations/{id}/reviews` | `user_id` (collectionGroup) | anonimizar nome/foto | T |
| `post_game_reputation` | `reviewer_id`, `target_user_id` | anonimizar nome/foto (nota e comentário ficam) | T |
| `chats/{id}/messages` | `sender_id` | anonimizar remetente (texto fica) | T |
| `game_photos`, `game_videos` + objetos no Storage | `uploaded_by`, `storage_path` | apagar | T |
| Storage `users/{uid}/`, `profile_photos/{uid}.*`, miniaturas | prefixo | apagar | T |
| `audit_logs` `ACCOUNT_DELETED` | `uid_sha256` | **manter por obrigação legal** (prova do atendimento ao art. 18, VI; sem PII) | C |

**DMs (decisão):** anonimizar o remetente e manter o texto (comportamento do #4120). A mensagem também
é do interlocutor, que já a leu. Apagar o texto quebraria a conversa dele, e sem nome e foto o texto não
identifica o titular por si.

**Histórico de partidas e ranking:** partidas encerradas mantêm a confirmação anonimizada (súmula e
contagem de jogadores dos outros ficam corretas). O ranking da temporada é recalculado a partir de
`season_participation`, que é apagado.

### 3.5 Lacunas conhecidas (follow-up, NÃO cobertas por este fix)

Coleções com uid ou PII do titular que esta mudança não trata. Precisam de issue própria, lendo os
escritores antes:

| Coleção | Por que ficou fora |
|---|---|
| `mvp_votes` (`voted_player_id`, votos recebidos) | o merge migra; o cleanup não apaga. Decidir se voto recebido é dado do votante ou do votado |
| `locations`, `schedules`, `live_games`, `live_scores` (`owner_id`) | dono de quadra ou de agenda; precisa decidir entre transferir, desativar ou anonimizar |
| `account_aliases` | aliases de merge apontando para o titular |
| `game_events`, `live_player_stats`, `player_stats`, `teams`, `league_standings`, `rankings`, `weekly-rankings`, `season_final_standings`, `season-archive` | possível nome denormalizado; escritores não auditados |
| `groups/{g}/wall_posts`, `comments`, `post_game_messages`, `group_polls`/`group_poll_votes` | conteúdo do titular em espaço do grupo; escritores não auditados |
| `game_summons`, `game_rides`, `game_requests`, `groups/{g}/join_requests/{uid}` | convocações, caronas e pedidos pendentes |
| `reports`, `user_feedback`, `challenge_progress` | denúncias e feedback (podem ter obrigação de guarda) |
| `cancellations` (`user_id`) | campo isento de índice em `firestore.indexes.json`: a consulta falharia |
| `games/{id}/waitlist` de jogos fora dos grupos do titular | o escritor exige membro ativo, então não deve existir |
| `audit_logs.userId` + IP gravados por **outras** callables via `secureCallable` | o cleanup não varre `userId`; afeta todas as callables com audit ligado |
| Ponto cego do merge (`chats`, `notifications`, `cashbox`, `reviews`, `post_game_reputation`, `game_photos`/`videos`, `group_invites`, `user_streaks`, seguidores, waitlist) | direção inversa do diff entre irmãos |

Nenhuma dessas coleções está na tabela 3.4, de propósito: o critério de aceite é "nenhuma coleção
**listada** mantém dado pessoal".

### 3.6 Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Bloqueio por posse de grupo vira beco sem saída se o cliente não mostrar o motivo | `details.reason` estruturado; mudanças de cliente listadas na seção 5 |
| `recursiveDelete` depois das etapas: falha transitória deixa o subtree | com `anonFailed` o subtree é mantido de propósito para o retry achar os grupos e seguidores |
| Membro vira `INACTIVE` e muda o `member_count` | igual ao `leaveGroup` do KMP; o `onMemberWritten` aplica um delta idempotente |
| Hash SHA-256 sem sal no audit | uid é aleatório (28 caracteres), não enumerável; o registro não guarda nada além do hash |

---

## 4. Verificação

### 4.1 Testes

- `functions/test/auth/delete-account.test.ts` (12 casos, `secureCallable` real): login obrigatório,
  App Check, rate limit, login antigo, token sem `auth_time`, dono com membros (bloqueia sem escrever),
  membro legado sem status, grupo só do titular (soft delete antes do Auth), falha no soft delete não
  exclui o Auth, auditoria sem PII, idempotência (`user-not-found`), erro inesperado.
- `functions/test/auth/account-cleanup-writer-shapes.test.ts`: fake com `recursiveDelete` real (prova a
  regressão do #4139) e 6 casos #4391: seguidores, confirmations futuras × encerradas × legadas, fila
  de espera, jogos, grupo já deixado, idempotência (rodar duas vezes).

### 4.2 Checklist

- [x] `npm run build`, `npm run lint` (0 erros) e `npx jest --no-coverage` verdes
- [ ] Deploy: `firebase deploy --only functions:deleteAccount,functions:onUserDeleted`
- [ ] `gcloud functions list` mostra `deleteAccount` em southamerica-east1
- [ ] Ponta a ponta com conta de teste em web, Android e iOS
- [ ] Após a exclusão, nenhuma coleção da tabela 3.4 mantém PII do uid

---

## 5. Clientes (o que precisa mudar)

| Plataforma | Situação | Mudança necessária |
|---|---|---|
| Web (`SettingsScreen.tsx`) | já chama `deleteAccount()`; no erro, o `finally` faz logout | ler `err.details.reason`: `requires-recent-login` ⇒ pedir novo login (`reauthenticateWithCredential`/popup) e repetir; `sole-owner-groups` ⇒ listar `details.groups` com atalho para transferir a posse. Hoje `getFunctionErrorMessage` troca `failed-precondition` por "Recarregue a página", e o logout no `finally` em caso de erro faz o usuário sair sem ter excluído |
| Android (`AppNavGraph.kt` → `AuthRepository.deleteAccount`) | chama a callable; falha é **ignorada** (sem mensagem) | mostrar erro; tratar os dois `reason` como na web; reautenticar antes de chamar |
| iOS (composeApp) | sem tela | tela de exclusão chamando `deleteAccount` com o mesmo contrato; App Check do iOS precisa estar ativo (o `secureCallable` exige) |

---

## 6. Prevenção Futura

- Fake de teste sem `recursiveDelete` escondeu a regressão do #4139. Fakes de Firestore precisam
  implementar toda API que o código chama (ou falhar alto), não deixar `TypeError` ser engolido.
- Callable que os clientes chamam precisa de teste que importe o `index.ts` e confirme o export. Aqui:
  `functions/test/index.test.ts` ("exporta a callable deleteAccount") importa o `index.ts` real e falha
  se o export sumir (conferido removendo a linha do export).
