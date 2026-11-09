# FEAT: conta de revisão da Google Play liberada pelo servidor

> **Status:** `APPROVED`
> **Severidade:** `CRITICAL` (segundo bloqueio da recusa da 1.42.0)
> **Autor:** Claude (autorizado pelo dono)
> **Data:** 2026-11-09

---

## 1. Problema

A Play recusou a 1.42.0. A splash presa foi corrigida no PR #4533 (1.43.0, build 84). Falta o segundo bloqueio: a conta
de revisor (e-mail e senha no Firebase Auth de produção, e-mail verificado) só tem a claim `{role: "PLAYER"}`, sem
`verified` e sem `profileComplete`.

- `firestore.rules` `isVerifiedOrGrace()`: a carência venceu em 2026-10-03. Sem `verified`, o revisor não lê jogos
  (get/list), chat e comentários, nem confirma presença.
- `isProfileComplete()` (claim ou o fallback `users_private.phoneVerifiedAt` + `cpfVerifiedAt`): sem ele, não cria
  jogos nem grupos.
- O app (`VerificationGateViewModel`, `ProfileGate`) bloqueia pelo token.
- `verified` só é concedido depois de SMS + CPF (`verification.ts`, `account-merge.ts`). O revisor não faz nenhum dos
  dois.
- `computeProfileComplete` exige `cpfVerifiedAt` e telefone BR no Auth. O trigger `onUserProfileWritten` e a callable
  `recomputeMyProfileClaim` recalculam a claim, então uma claim posta à mão seria desfeita.

Decisão do dono: liberar a conta de revisão **pelo servidor**, sem CPF nem telefone falsos.

## 2. Desenho

### 2.1 Onde fica a lista

Documento `system_config/play_review_accounts`, formato:

```json
{ "uids": ["<uid da conta de revisão>"] }
```

- `system_config` não tem `match` em `firestore.rules`: cai no deny-all final (`match /{document=**}`). Nenhum
  cliente lê ou grava, nem ADMIN pela claim. Só o Admin SDK. Não usamos `app_settings`, que qualquer autenticado lê.
- `firestore.rules` **não muda**. O teste `firestore-rules-tests/src/system-config.test.ts` prova a negação (anônimo,
  jogador, a própria conta listada e ADMIN, em leitura, listagem, criação, update e delete).
- Formato inválido (sem `uids`, `uids` não array) vira lista vazia. Entradas que não são string não vazia são
  ignoradas.
- **Repositório público:** UID, e-mail e senha do revisor nunca entram no código, nos testes, nos docs nem nos
  commits. Os testes usam UIDs fictícios (`review-uid-test`).

### 2.2 Claims efetivas

Para UID listado: `{...claims atuais, verified: true, profileComplete: true}` (role e demais claims preservados).

- `functions/src/auth/review-accounts.ts`: `parseReviewAccountUids`, `loadReviewAccountUids`, `isReviewAccount`,
  `buildReviewAccountClaims`, `hasReviewAccountClaims`, `applyReviewAccountClaims`.
- `setProfileCompleteClaim` (usado pelo trigger `onUserProfileWritten` **e** pela callable `recomputeMyProfileClaim`)
  consulta a lista antes do cálculo normal. UID listado mantém as duas claims e nunca é rebaixado. UID não listado
  segue exatamente a regra antiga. `computeProfileComplete` continua puro, porque `verification.ts` e
  `account-merge.ts` dependem do significado atual.
- Erro ao ler a lista **sobe** (o trigger tem `retry: true`). Engolir o erro rebaixaria a claim em silêncio.
- Outros caminhos que gravam claims e foram conferidos: `setUserVerified` e o backfill de `verification.ts` exigem
  telefone no Auth (o revisor não tem, então saem antes). `account-merge` exige telefone canônico. `onUserCreate`
  (`user-management.ts`) grava `{role: "PLAYER"}` sem preservar as outras claims, mas só na criação da conta. As
  trocas de role em `custom-claims.ts` preservam as claims (`...existingClaims`).
- `requireProfileComplete`, `join-public-game.ts`, check-in, votação etc. leem só as claims do token, então passam
  com as claims aplicadas.

### 2.3 Como aplicar depois do deploy

Script `functions/src/scripts/apply-review-account-claims.ts`, no padrão de `backfill-phone-identity.ts`:

```bash
cd functions && npm run build
node lib/scripts/apply-review-account-claims.js            # dry-run (padrão)
node lib/scripts/apply-review-account-claims.js --execute  # grava
```

- Usa Application Default Credentials (login gcloud) e o projeto `futebadosparcas` (ou `GCLOUD_PROJECT`).
- É idempotente e não revoga refresh tokens (isso derrubaria a sessão do revisor).
- Imprime só contadores e o índice da conta (`conta 1/1: applied`), nunca UID ou e-mail.
- Resultados possíveis: `applied`, `would-apply` (dry-run), `already-current`, `user-not-found`.

Alternativa descartada: callable só para admin. Exige App Check e um cliente admin logado em produção, ou seja, mais
superfície para um uso pontual. Também descartado: um trigger no documento de config, que aplicaria as claims sozinho
mas cria uma função nova e um efeito colateral automático numa escrita manual.

### 2.4 App (entra na 1.43.0)

`VerificationGateViewModel.check()` lia só o token em cache (`getIdToken(false)`). Um login feito **depois** de as
claims serem aplicadas já recebe um token novo com elas, sem mudança no app. Mas uma sessão aberta **antes** ficaria
com token velho até 1 h e cairia no fluxo SMS/CPF, que o revisor não completa.

Mudança: se o cache disser `verified != true`, `check()` faz uma renovação forçada (`getIdToken(true)`, com o mesmo
teto de 15 s) antes de decidir. Se a renovação falhar ou estourar o teto, o resultado vem do cache (`Unverified`), como
antes. Usuário offline não regride para `Failed`. A renovação também atualiza o token que
`AuthRepository.checkProfileComplete` lê do cache.

## 3. Testes

- `functions/test/auth/review-accounts.test.ts`: parse e formatos inválidos, documento ausente, erro de leitura
  sobe, preservação de role, (a) UID listado recebe as claims, dry-run não grava, idempotência, (c) UID não listado
  não é tocado, usuário inexistente, falha transitória do Auth.
- `functions/test/auth/profile-complete-claim.test.ts`: (a) a callable dá as duas claims ao UID listado sem
  CPF/telefone; (b) o trigger não remove as claims do UID listado quando a presença de `cpfVerifiedAt` muda, e
  restaura se alguém as baixou; (c) UID não listado segue a regra antiga com a lista preenchida; lista malformada não
  libera ninguém; erro ao ler a lista sobe. O mock de config é separado do `users/{uid}`.
- `firestore-rules-tests/src/system-config.test.ts`: negação total para clientes.
- `VerificationGateViewModelTest`: cache false e renovado true → `Verified`; renovação falha → `Unverified`;
  renovação nunca responde → `Unverified` após o teto.

## 4. Passos de produção (precisam de autorização do dono)

1. Deploy das Functions `onUserProfileWritten` e `recomputeMyProfileClaim` (as duas usam `setProfileCompleteClaim`).
   As rules não mudam.
2. Gravar `system_config/play_review_accounts` = `{uids: ["<uid da conta de revisão>"]}` pelo console ou pelo Admin
   SDK.
3. Rodar o script em dry-run (esperado: `would-apply: 1`), depois com `--execute` (esperado: `applied: 1`). Rodar de
   novo dá `already-current: 1`.
4. Subir a 1.43.0 com a mudança do gate. Com as claims já aplicadas, o login do revisor recebe o token certo mesmo
   sem a mudança do app.

**Rollback:** tirar o UID da lista e redefinir as claims à mão (sem `verified`, com `profileComplete: false`). Nenhum
código do servidor grava `verified: false`.

## 5. Fora do escopo

- Criar jogo exige também um grupo do próprio usuário com pelo menos 5 membros
  (`canCreateGameForQualifiedOwnedGroup`). Mesmo com as claims, o revisor pode não conseguir criar jogo se não tiver
  esse grupo.
- Nenhum atalho por e-mail no cliente. Nenhuma mudança em rules.
