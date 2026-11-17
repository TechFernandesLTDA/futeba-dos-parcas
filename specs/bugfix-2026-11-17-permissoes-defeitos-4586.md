# BUGFIX: Seis defeitos de permissão achados pelos testes do #4586

> **Status:** `APPROVED` (aprovada pelo Renan em 2026-11-17; decisões D1 e D2 = recusar bloqueado também gestor e admin; D3 = só admin define MVP; D5 = BLOCKED vale como REMOVED; D6 = corrigir)
> **Severidade:** 2 `HIGH` (D3, D5), 2 `MEDIUM` (D2, D4), 1 `HIGH` (D1), 1 `LOW` latente (D6)
> **Autor:** Claude (sessão de correção, a pedido do Renan)
> **Data:** 2026-11-17
> **Base:** `origin/master` em `bcfcf788` (conferir de novo antes de criar o branch)
> **Testes de origem:** PR #4586, branch `test/permissoes-funcionalidades-20261116` (cabeça `cbd966b2`)
> **Spec da suíte:** `specs/test-2026-11-16-permissoes-funcionalidades.md`

---

## 1. Problema

Os testes de permissão do #4586 marcam seis defeitos reais com `it.fails`, `test.failing` ou `@Disabled`.
O comportamento que o teste espera é o correto. A correção faz esse comportamento acontecer, sem
enfraquecer nenhuma asserção, e troca a marcação de defeito por teste normal.

Os marcadores dos testes citam linhas que mudaram; a lista abaixo usa as linhas de `origin/master`
conferidas nesta spec. Quando a correção for feita, o marcador `[DEFEITO: ...]` sai do título do teste.

| ID | Área | Defeito | Arquivo corrigido (master) | Teste que vira teste normal |
|----|------|---------|----------------------------|-----------------------------|
| D1 | Jogo (fila de espera) | Membro bloqueado entra na fila de um jogo `PUBLIC_OPEN` | `functions/src/waitlist/join-game-waitlist.ts` | `functions/test/permissions/game-presence-waitlist.test.ts:278` |
| D2 | Jogo (confirmação) | Gestor confirma jogador bloqueado no grupo | `functions/src/games/confirm-player-as-manager.ts` | `functions/test/permissions/game-presence-waitlist.test.ts:336` |
| D3 | Votação | Dono grava `mvp_id` de si mesmo em jogo `FINISHED` | `firestore.rules` (cláusula de MVP, linhas 1298-1301) | `firestore-rules-tests/src/permissions-voting.test.ts:170` |
| D4 | Convites | Falha na checagem de membro vira "não é membro" e o convite é criado | `app/.../domain/usecase/group/InviteToGroupUseCase.kt` (linhas 72-75) | `app/src/test/.../permissions/InviteToGroupPermissionsTest.kt:156` |
| D5 | Papéis | Papel de membro `REMOVED`/`INACTIVE`/`BLOCKED` volta como se fosse ativo | `app/.../data/repository/GroupRepository.kt` (`getMyRoleInGroup`, linhas 432-447) | `app/src/test/.../permissions/GroupMemberStatusRoleTest.kt:69` |
| D6 | Jogo (gestão, web) | `canManageGame` lança `TypeError` quando o jogo não tem `coOrganizers` | `web/src/types/game.ts` (linha 454) | `web/src/test/permissions/marcacao-espera-votacao.test.ts:141` |

Marcadores desatualizados a corrigir junto com a correção:
- D3: o marcador cita `firestore.rules:1285`; a cláusula real está em 1298-1301.
- D5: o marcador cita `GroupRepository.kt:405`, que hoje é o `catch` de `getGroupMembers`; o defeito está em 432-447.

---

## 2. Análise de causa raiz

### D1: fila de espera de jogo público não confere bloqueio

- `join-game-waitlist.ts` lê só `groups/{g}/members/{uid}` (linhas 113-125).
- A autorização (linhas 126-128) é `!isGameManager && !isActiveMember && !isOpenToPublic`. Com jogo `PUBLIC_OPEN`,
  qualquer usuário passa, mesmo com `groups/{g}/blocked_players/{uid}`.
- `join-public-game.ts` (linhas 336-345) faz esse teste de bloqueio com `tx.get` antes da regra de entrada. O
  handler de fila não tem o equivalente.

### D2: confirmação por gestor não confere bloqueio

- `confirm-player-as-manager.ts` checa `isGameManager` (linha ~175), status (~182) e convite (~190), e não lê
  `blocked_players`. Nenhuma ocorrência de "blocked" no arquivo.
- `confirmGamePresence` (`join-public-game.ts` ~332-345) já faz essa checagem.

### D3: cláusula de MVP aceita dono

- Em `firestore.rules`, a cláusula `((canManageGame(resource.data) || isAdmin()) && resource.data.status == 'FINISHED' && onlyAllowedFields(['mvp_id']))`
  permite que o dono grave `mvp_id` em jogo `FINISHED`. O `fieldUnchanged('mvp_id')` do ramo principal
  (linha 1270) não se aplica a essa cláusula independente.
- Nenhum cliente grava `mvp_id`. A escrita legítima é a Cloud Function `concludeMvpVoting` (`mvp-voting.ts:1450`),
  com Admin SDK, que não passa pelas regras.
- **Atenção à intenção de produto:** o comentário acima da cláusula diz "Apenas dono do jogo ou admin pode definir
  MVP". O teste diz o contrário. Ver decisão D3 na seção 6.

### D4: fail-open na checagem de membro do convite

- `InviteToGroupUseCase.kt:72-75` usa `isMemberResult.isSuccess && isMemberResult.getOrDefault(false)`. Se a
  consulta falha, a condição vira `false` e o fluxo segue até `createGroupInvite` (linha ~114).
- O padrão correto já existe no mesmo arquivo: `roleResult` (linhas 60-63) relança a exceção quando falha.

### D5: papel devolvido sem olhar o status

- `GroupRepository.getMyRoleInGroup` (432-447) só checa `memberDoc.exists()` e devolve `member?.getRoleEnum()`.
  Não olha o campo `status`.
- Documentos saem com `REMOVED` (`removeMember`, ~688), `INACTIVE` (`leaveGroup`, ~734) e `BLOCKED` (enum
  `GroupMemberStatus`), mas mantêm o campo `role`. Um ex-ADMIN removido continua com `ADMIN`.
- Os gates de convite, remoção, promoção e saída dependem desse valor (chamadores listados no relatório dos analistas).
- `isMemberOfGroup` (~468-470) e `isUserMemberOfGroup` (~1397-1399) já checam `status == ACTIVE`. A
  inconsistência é interna ao repositório.

### D6: `canManageGame` sem tolerância a campo ausente

- `web/src/types/game.ts:454`: `game.ownerId === userId || game.coOrganizers.includes(userId)`. Documento legado
  sem `coOrganizers`, consultado por quem não é dono, lança `TypeError`.
- O resto do web já usa `?.` no mesmo campo (`GameDetailScreen.tsx:351`, `MVPVoteScreen.tsx:205`, `LiveGameScreen.tsx:95`).
- A função exportada não tem importadores de produção em `web/src`. O impacto em runtime hoje é nulo; o risco
  é latente.

---

## 3. Solução proposta

### 3.1 Abordagem geral

- Uma correção por defeito, com o menor diff possível e o padrão que o próprio repositório já usa.
- Não muda assinatura pública, não muda modelo de dados, não faz migração.
- Cada correção vem junto com a troca do marcador do teste. Nenhuma asserção é alterada.

### 3.2 Por defeito

**D1 (`join-game-waitlist.ts`)**
- Dentro da transação, quando houver `groupId`, ler `groups/{groupId}/blocked_players/{uid}` com `tx.get`,
  no mesmo padrão de `join-public-game.ts:336-345`.
- Se existir, lançar `HttpsError("permission-denied", "Você está bloqueado neste grupo.")`.
- Todas as leituras ficam antes de qualquer `tx.set`.
- Teste: `game-presence-waitlist.test.ts:278` vira `test(...)`; sem mudança de asserção.

**D2 (`confirm-player-as-manager.ts`)**
- Logo após a checagem de `isGameManager` (depois de ~180) e antes da checagem de status, ler
  `groups/{groupId}/blocked_players/{userId}` com `tx.get` e lançar `permission-denied` se existir.
- `groupId` vem de `game.group_id ?? game.groupId`, validado como string não vazia sem `/`.
- Teste: `game-presence-waitlist.test.ts:336` vira `test(...)`.

**D3 (`firestore.rules`)**
- Trocar `(canManageGame(resource.data) || isAdmin())` por `isAdmin()` na cláusula de MVP (linhas 1298-1301).
  Admin já passa pelo ramo `isAdmin() && gameValidationFieldsUnchanged()` na linha 1259, mas essa é a regra
  de validação, não a de MVP; a cláusula de MVP continua necessária para o admin.
- Se o Renan decidir que o dono **deve** poder definir MVP (ver decisão D3), esta spec é cancelada para D3 e
  o teste `permissions-voting.test.ts:170` é removido junto com o comentário que diz o contrário.
- Teste: `permissions-voting.test.ts:170` vira `it(...)`.
- Não muda Cloud Function.

**D4 (`InviteToGroupUseCase.kt`)**
- Substituir as linhas 72-75 por:
  ```kotlin
  val isMemberResult = groupRepository.isUserMemberOfGroup(params.groupId, invitedUserId)
  if (isMemberResult.isFailure) {
      throw isMemberResult.exceptionOrNull() ?: Exception("Erro ao verificar se o usuário já é membro")
  }
  if (isMemberResult.getOrDefault(false)) {
      throw InviteToGroupException("Este usuário já é membro do grupo")
  }
  ```
  (Os acentos e a string original seguem o arquivo; a versão acima é só para leitura.)
- Teste: remover `@Disabled` de `InviteToGroupPermissionsTest.kt:156`; asserção igual.

**D5 (`GroupRepository.kt`, `getMyRoleInGroup`)**
- Trocar o ramo `memberDoc.exists()` por: ler o `GroupMember` com `toObjectTolerant`; se for `null` ou se
  `member.status != GroupMemberStatus.ACTIVE.name` (comparando a string bruta, não `getStatusEnum`), devolver
  `Result.success(null)`; senão `Result.success(member.getRoleEnum())`.
- O caminho `!exists()` não muda.
- Não usar `getStatusEnum()` como gate: ele cai em `ACTIVE` para valor inválido e mascararia o problema.
- Teste: remover `@Disabled` de `GroupMemberStatusRoleTest.kt:69`, atualizar o marcador. Opcional e recomendado:
  acrescentar `assertTrue(result.isSuccess)` para que um `Result.failure` não passe por engano.

**D6 (`web/src/types/game.ts`)**
- Trocar o corpo por: `return game.ownerId === userId || (game.coOrganizers?.includes(userId) ?? false);`
- Teste: `marcacao-espera-votacao.test.ts:141` de `it.fails` para `it`; remover o marcador do título e
  atualizar o comentário "DEFEITO LATENTE" (linhas 138-140).

### 3.3 Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| D1/D2 bloqueiam gestor ou admin bloqueado | É o comportamento de `join-public-game` e `confirmGamePresence`. Decisão D1 e D2 (seção 6). |
| D3 quebra um fluxo manual de MVP do dono | Busca no repo não achou fluxo de cliente; votação usa Admin SDK. Confirmar com o Renan (decisão D3). |
| D4 muda o caminho de falha | Único caso novo: falha vira erro. Demais testes do arquivo não mudam (testes de membro verdadeiro e falso continuam iguais). |
| D5 tira papel de ex-membro que hoje ainda usa ação | Efeito pretendido. Gates de convite, remoção e saída passam a recusar ex-membro. Conferir a UI de caixa e criação de jogo (`CashboxViewModel.kt:64`, `CreateGameViewModel.kt:830`). |
| D5 e `LeaveGroupUseCase` | Membro `INACTIVE` que tenta sair recebe "Você não é membro deste grupo" em vez de regravar `INACTIVE`. Aceito. |
| D6 com `?.` disparar lint | Mesmo padrão já usado em três telas. Rodar lint do web. |
| Leitura extra por transação | Uma leitura de documento a mais em D1, D2 e D5 (D5 não é transação). Custo leve. |

---

## 4. Verificação

### 4.1 Testes que mudam de estado

- [ ] `game-presence-waitlist.test.ts:278` passa como `test` (D1)
- [ ] `game-presence-waitlist.test.ts:336` passa como `test` (D2)
- [ ] `permissions-voting.test.ts:170` passa como `it` (D3)
- [ ] `InviteToGroupPermissionsTest.kt:156` roda e passa (D4)
- [ ] `GroupMemberStatusRoleTest.kt:69` roda e passa (D5)
- [ ] `marcacao-espera-votacao.test.ts:141` passa como `it` (D6)

### 4.2 Testes de regressão

- [ ] Suíte inteira de `functions/test/permissions` (incluindo `game-presence-waitlist` com 200 seeds da fila cheia) e `join-public-game`
- [ ] Suíte de regras do #4586 com emulador (`firestore-rules-tests`)
- [ ] Testes de `web/src/test/permissions` (Vitest)
- [ ] `./gradlew :app:testDebugUnitTest --tests "com.futebadosparcas.permissions.*"` (offline)
- [ ] Lint do web e `npm run lint` nas functions

### 4.3 Checklist

- [ ] Nenhuma asserção enfraquecida; diff dos testes só troca marcador e `@Disabled`
- [ ] Nenhum `test.failing`/`it.fails` restante nos seis pontos
- [ ] `specs/DECISIONS.md` com entrada nova
- [ ] Pre-push local rodado antes do PR (`.githooks/pre-push`, se estiver ativado)
- [ ] PR aberto **sem merge**; nenhuma versão publicada nas lojas

---

## 5. Fora do escopo (seguir como follow-up)

- `InviteToGroupUseCase.kt:81-83` (`hasPendingGroupInvite`) tem o mesmo padrão fail-open. Pode criar convite
  duplicado se a consulta falhar. Não tem teste neste arquivo; vira issue própria com teste análogo.
- `canManageGame` exportada é código morto fora dos testes. Decidir se é removida ou mantida.
- Cobertura ainda faltante no #4586: `createInvite` só para dono no Android; admin global criando grupo;
  último ADMIN saindo; votação com janela no cliente; temporada.
- Os seis defeitos não incluem caixa: nenhum teste de caixa tem marcador de defeito.

---

## 6. Decisões que dependem do Renan

| # | Pergunta | Proposta desta spec |
|---|----------|---------------------|
| D1 | Gestor ou admin global **bloqueado** continua podendo entrar na fila de jogo público? | Não: segue `join-public-game`. |
| D2 | Admin global também fica impedido de confirmar jogador bloqueado? | Sim, como em `confirmGamePresence`. |
| D3 | O dono de um jogo `FINISHED` **pode** definir o MVP? O comentário da regra diz que sim; o teste diz que não. | Não. A votação grava via Cloud Function. Se a resposta for sim, tiramos D3 desta spec. |
| D5 | `BLOCKED` deve valer igual a `REMOVED` para papel? | Sim: nenhum papel ativo. |
| D6 | Corrigir `canManageGame` ou remover a função exportada (código morto)? | Corrigir (uma linha). Remover fica para outra mudança. |

---

## 7. Entrega

- Branch novo a partir de `origin/master`, por exemplo `fix/permissoes-defeitos-4586-20261117`.
- Trazer os testes do #4586 para o branch (`git checkout test/permissoes-funcionalidades-20261116 -- <arquivos>`),
  sem trazer a spec de suíte nem o histórico de merge.
- Commit em Conventional Commits, assunto em minúsculas (commitlint).
- PR sem `Closes #N` (não fecha issue; o corpo do PR lista os seis pontos). Sem auto-merge.
- Nenhuma versão publicada, nenhum tag, nenhum release.
