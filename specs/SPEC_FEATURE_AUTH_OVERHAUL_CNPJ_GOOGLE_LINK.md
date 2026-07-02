# SPEC: Auth & Onboarding Overhaul — Bugfixes + CNPJ (Donos de Quadra) + Google Account Linking

**Status:** APPROVED
**Data:** 2026-07-01
**Autor:** Claude (auditoria 4 agentes) + Renan
**Épico:** ver issue épico no GitHub (criado junto com esta spec)

---

## 1. REQUIREMENTS

### Contexto

Auditoria completa (2026-07-01) do sistema de login/onboarding nas 3 superfícies (web, Android, iOS/CMP) + Cloud Functions + Firestore rules. O backend de CPF está sólido (transação serializable em `cpf_index`, rate limiting, App Check). Os problemas estão concentrados no **client-side** (mapeamento de erros, validação, gates) e em **2 features ausentes**: CNPJ para donos de quadra e linking de conta Google.

### Requisitos funcionais

**RF1 — Bugs de login (Android):** erros de login/registro/reset de senha devem mostrar mensagens PT-BR amigáveis (wrong-password, user-not-found, email-already-in-use, too-many-requests, network) via `strings.xml`; validação client-side de email/senha antes do submit; feedback de reset de senha correto (não falso-positivo).

**RF2 — Bugs de login (Web):** mensagem de convite obrigatório no fluxo Google deve chegar à UI; claim `profileComplete` recomputado após ProfileSetup (evitar re-gate loop); estado global de erro sem mensagens raw do Firebase; grace-period banner alinhado com o hard gate.

**RF3 — Invite gate server-aware (Web/Google):** fluxo Google de registro deve validar o invite code server-side (`validateInviteCode`) ANTES de criar o documento do usuário, igual ao fluxo email/senha.

**RF4 — Admin consegue promover FIELD_OWNER:** whitelist de roles no Android admin corrigida (remove `MODERATOR` inexistente, adiciona `FIELD_OWNER`).

**RF5 — CNPJ para Donos de Quadra:**
- Validador de CNPJ (mod-11, 14 dígitos, rejeita sequências repetidas) nas 3 camadas: `functions/src/validation/cnpj.ts`, `web/src/utils/cnpjValidator.ts`, `shared/.../domain/util/CnpjValidator.kt` (mesmo padrão do CPF triplicado — AGENTS.md).
- `requestVenueOwnerOnboarding` aceita campo estruturado `cnpj` (opcional; valida formato + dígitos server-side quando presente), armazenado hasheado (`cnpj_index/{hash}` + `venue_owner_onboarding.cnpjMasked`) com verificação de unicidade transacional (mesmo padrão do `verifyCpf`).
- Web `OwnerOnboardingScreen`: campo CNPJ com máscara `99.999.999/9999-99` + validação client-side, substituindo o texto-livre "Documento comercial".
- CNPJ é por-request de onboarding comercial, NÃO no doc `users` (PII → padrão `users_private`-like).

**RF6 — Google Account Linking:**
- Usuário com conta email/senha pode vincular Google depois (web: `linkWithPopup`; Android: Credential Manager + `linkWithCredential`).
- Seção "Contas conectadas" no perfil/configurações (web + Android) mostrando provedores vinculados (senha, Google, telefone) com ação vincular/desvincular Google.
- Desvincular Google só permitido se restar outro método de login (senha ou Google — nunca deixar conta sem provedor de login primário; telefone não conta como método primário).
- Login com `auth/account-exists-with-different-credential` ou `auth/credential-already-in-use` (Google): mensagem clara orientando a entrar com o método original e vincular pelo perfil.

### Requisitos não-funcionais

- Anti-enumeração preservada (mensagens genéricas para credenciais inválidas).
- Rate limiting nos novos callables (padrão `withRateLimit`).
- Sem PII em logs. CNPJ mascarado `**.***.***/9999-**` quando exibido.
- i18n: todas as strings novas em `strings.xml` (Android) e i18next (web).

### Fora de escopo (issues separadas, não bloqueiam)

- Auth Blocking Functions para SMS/invite (já rastreado #940).
- PII read em `users` STAGE 2 (#2630/#578).
- iOS Google Sign-In real (stub CMP — Fase 4 CMP).
- Fluxo de signup "sou dono de quadra" com role própria no registro (mantém modelo atual: PLAYER + onboarding comercial revisado por admin, decisão #3137).

## 2. UX/UI

- **CNPJ (web OwnerOnboardingScreen):** TextField com máscara progressiva, erro inline "CNPJ inválido", helper "Obrigatório para empresas; deixe em branco se pessoa física" (CPF do usuário já verificado no onboarding).
- **Contas conectadas (web SettingsScreen / perfil):** lista de provedores com ícone, status "Conectado", botão "Vincular conta Google" / "Desvincular". Confirmação antes de desvincular. Toast de sucesso/erro.
- **Contas conectadas (Android EditProfile/Settings):** mesma estrutura, M3, strings via `strings.xml`.
- Estados obrigatórios: loading (spinner in-place nos botões), erro (Alert/Toast), sucesso.

## 3. TECHNICAL DESIGN

### 3.1 Android error mapping
Novo `app/.../util/AuthErrorMapper.kt`: `fun FirebaseAuthException.toUserMessageRes(): Int` mapeando `errorCode` (ERROR_WRONG_PASSWORD, ERROR_USER_NOT_FOUND → mesma string genérica anti-enum; ERROR_EMAIL_ALREADY_IN_USE; ERROR_TOO_MANY_REQUESTS; ERROR_INVALID_CREDENTIAL; ERROR_USER_DISABLED; ERROR_WEAK_PASSWORD; ERROR_NETWORK; default). ViewModels expõem `errorResId` (padrão já usado em CpfVerificationViewModel). Reset de senha ganha estado dedicado (`ResetEmailSent`) em vez de reusar `LoginState`.

### 3.2 Web fixes
- `AuthContext.signInWithGoogle`: lança erro com `code: 'app/invite-required'` (custom) e `getAuthErrorMessage` mapeia; chama `validateInviteCode` no caminho de usuário novo antes do `createUserDocument`.
- `ProfileSetupScreen.handleSave`: após salvar, `recomputeMyProfileClaim()` + `getIdToken(true)` (via `refreshClaims`) antes de navegar.
- `AuthContext`: `setError` passa por `getAuthErrorMessage`.
- Banner: remover grace-period morto OU restaurar grace no gate — decisão: **remover o countdown e transformar em redirect imediato** (o hard gate já é a política vigente desde Fase 5 enforcement).

### 3.3 CNPJ backend
- `functions/src/validation/cnpj.ts`: `isValidCnpj`, `stripCnpj`, `hashCnpj` (SHA-256 + `CPF_SALT` reutilizado — mesmo secret, prefixo de domínio `cnpj:` no input do hash), `maskCnpj`.
- `venue-owner-onboarding.ts` `requestVenueOwnerOnboarding`: aceita `cnpj?` (string). Valida formato; transação verifica `cnpj_index/{hash}` (bloqueia CNPJ de outra conta em request ativa/aprovada); grava `cnpjMasked` + `cnpj_hash` no request doc; `cnpj_index` write server-only.
- `firestore.rules`: `match /cnpj_index/{hash} { allow read, write: if false; }`.

### 3.4 Google linking
- Web: `web/src/components/settings/ConnectedAccounts.tsx` + hooks; `linkWithPopup(currentUser, googleProvider)`; trata `auth/credential-already-in-use` (Google já vinculado a outra conta), `auth/popup-*`; `unlink(currentUser, 'google.com')` gated por existência de `password` provider ou outro método primário.
- Android: `ConnectedAccountsSection` em Settings; Credential Manager → `GoogleAuthProvider.getCredential(idToken)` → `currentUser.linkWithCredential(...)`; mesmos guards.
- Nenhuma mudança server-side necessária (Auth nativo mantém uid; docs Firestore intactos).

### 3.5 Riscos
- `linkWithPopup` exige interação recente — tratar `auth/requires-recent-login` com re-auth.
- CNPJ hash reutilizando `CPF_SALT`: aceitável (mesma decisão #1311); prefixo `cnpj:` evita colisão de domínio.

## 4. TASKS

1. PR-A `fix(android)`: AuthErrorMapper + ValidationHelper wiring + reset flow + strings.xml + role whitelist fix.
2. PR-B `fix(web)`: invite-required error code, validateInviteCode no fluxo Google, recompute pós-setup, setError mapeado, banner alinhado, name minlength unificado.
3. PR-C `feat(functions+web)`: CNPJ validator + venue onboarding estruturado + cnpj_index + rules + testes Jest.
4. PR-D `feat(web)`: Contas conectadas + Google linking + recovery UX.
5. PR-E `feat(android)`: Contas conectadas + Google linking + CnpjValidator.kt (KMP) para uso futuro.

## 5. VERIFY

- Functions: Jest (novos testes cnpj.test.ts + venue-owner-onboarding cnpj cases).
- Web: `npm run build` + Vitest cnpjValidator.
- Android: `:app:compileDebugKotlin` + testes unitários AuthErrorMapper/CnpjValidator.
- Rules: cnpj_index deny-all coberto por rules-tests existentes de padrão index.
