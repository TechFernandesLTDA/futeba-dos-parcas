# SPEC: Phone + CPF Verification (Anti-Bot)

**Status:** APPROVED
**Date:** 2026-05-03
**Owner:** TechFernandesLTDA
**Type:** Feature (cross-platform: Android + iOS + Web)
**Priority:** CRITICAL (anti-fraud foundation)

---

## Contexto & Motivação

Auditoria de segurança 2026-05-03 (issues #421-#442) revelou múltiplos vetores de fraude que dependem da capacidade de criar contas em massa: account farming pra MVP votes (#411), inflar grupos (#430), check-in fraudulento (#426). Mitigar requer **identidade verificada do usuário real**.

Além disso, regulação LGPD + responsabilidade civil em gamificação com rankings pede identificação inequívoca dos participantes.

## Requisito de produto

> "Todo registro deve ter um número de telefone e CPF atrelado, isso é necessário para que não tenha pessoas falsas ou robôs cadastrados. Pode ser feito com a conta do Google cadastrando depois ou não. Mas todo método que deixe a pessoa real deve ser adotado. Deve funcionar em qualquer celular Android ou iOS."

## Requirements

### Funcional

- **R1**: Todo usuário novo precisa fornecer telefone + CPF antes de poder criar/participar de jogos
- **R2**: Telefone deve ser verificado via SMS OTP (Firebase Phone Auth)
- **R3**: CPF deve passar validação de formato + dígito verificador (algoritmo oficial)
- **R4**: Login por Google permanece disponível, mas onboarding pós-login pede phone+CPF antes de liberar app
- **R5**: Login por email/senha também passa pelo mesmo fluxo
- **R6**: 1 CPF = 1 conta (não permite registrar 2 contas com mesmo CPF)
- **R7**: 1 telefone = 1 conta (não permite reusar)
- **R8**: Funciona em Android (24+), iOS (atual), Web (PWA)
- **R9**: Usuários existentes recebem prompt obrigatório no próximo login (migration)

### Não-funcional

- **NF1**: SMS OTP delivery <30s em 95% dos casos (provedor confiável)
- **NF2**: CPF criptografado em rest (AES-256, chave em Firebase KMS)
- **NF3**: Telefone formato E.164 internacional (`+5511999998888`)
- **NF4**: CPF nunca exposto em UI fora do próprio perfil do usuário (mascarado: `***.123.456-**`)
- **NF5**: Rate limit: 3 SMS OTP por número/hora; 10 tentativas verify/hora
- **NF6**: LGPD compliance: consentimento explícito, dados sensíveis em coleção `users_private`
- **NF7**: Custom Claim `verified: true` setado após ambos passarem
- **NF8**: Security Rules de criação/escrita exigem `verified: true`

## Architecture

### Stack

- **Firebase Phone Auth** (built-in SMS OTP em Android/iOS/Web sem custo adicional do app)
- **CPF validator** custom (algoritmo de dígito verificador, sem dependência externa)
- **Firestore collection** `users_private/{uid}` — campos: `phone` (E.164), `cpfHash` (SHA-256+salt), `verifiedAt` timestamp
- **Custom Claim** `verified: true` setado por Cloud Function após ambos passarem
- **Anti-VoIP** (opcional, futuro): biblioteca `libphonenumber` flag VOIP/landline

### Data Model

```
users/{uid}              # Public profile
  ├── name, email, photoUrl, ...
  └── verifiedAt (Timestamp, mirror of users_private)

users_private/{uid}      # Restrita: só backend lê, cliente NUNCA
  ├── phone: "+5511999998888"
  ├── phoneVerifiedAt: Timestamp
  ├── cpfHash: "sha256(cpf+salt)" (não armazena CPF puro)
  ├── cpfMasked: "***.123.456-**"
  └── cpfVerifiedAt: Timestamp

cpf_index/{cpfHash}      # Lookup pra detectar duplicate
  └── uid: <uid>
```

### Fluxo de onboarding (novo usuário)

```
1. Usuário escolhe método (Google / Email+Senha)
2. Após auth, app verifica auth.token.verified
   - Se verified=true → home
   - Se verified=false → forced onboarding
3. Tela "Verificar telefone"
   - Input phone (libphonenumber-format)
   - Tap "Enviar código" → Firebase Phone Auth send OTP
   - Input código 6 dígitos → linkWithCredential (vincula phone à conta)
4. Tela "Verificar CPF"
   - Input CPF (mask 999.999.999-99)
   - Validate format + dígito
   - Cloud Function `verifyCpf({ cpf })` → checa duplicate em cpf_index
   - Se OK: cria users_private + cpf_index
5. Cloud Function setUserVerified(uid) → custom claim verified=true
6. Token refresh forçado no cliente
7. Redireciona para home (agora com acesso completo)
```

### Migration (usuários existentes)

```
1. Identificar todos users sem verifiedAt
2. Próximo login: forçar onboarding mesmo se já autenticado
3. Grace period: 30 dias contados a partir do deploy (banner amarelo)
4. Após 30 dias: bloquear ações até completar (read-only mode)
```

### Security Rules

```js
// Após verificação:
function isVerified() {
  return request.auth.token.verified == true;
}

// Aplicar em writes críticos
match /games/{gameId} {
  allow create: if isVerified() && isGroupMember(...);
  ...
}
match /confirmations/{confId} {
  allow create: if isVerified() && ...;
}
match /votes/{voteId} {
  allow create: if isVerified() && ...;
}
```

## Implementação por plataforma

### Web (React + Firebase JS SDK)
- `firebase/auth` `RecaptchaVerifier` + `signInWithPhoneNumber`
- Components: `PhoneVerificationScreen.tsx`, `CpfVerificationScreen.tsx`
- Route guard: `<RequireVerified>` wrapper

### Android (Kotlin + Firebase Auth Android SDK)
- `PhoneAuthProvider.verifyPhoneNumber` com `OnVerificationStateChangedCallbacks`
- Auto-detect SMS via `SmsRetriever` (sem permissão READ_SMS)
- Composables: `PhoneVerificationScreen.kt`, `CpfVerificationScreen.kt`

### iOS (Swift + Firebase Auth iOS SDK)
- `PhoneAuthProvider.provider().verifyPhoneNumber`
- APNs token integration (sem reCAPTCHA visual em iOS)
- SwiftUI: `PhoneVerificationView.swift`, `CpfVerificationView.swift`

### Cloud Functions
- `verifyCpf(cpf)` — valida formato + checksum + checa duplicate
- `setUserVerified(uid)` — chama `setCustomUserClaims({ ..., verified: true })`
- Trigger `onUserCreated` — cria `users_private/{uid}` doc skeleton

## Algoritmo CPF (validator)

Cliente + servidor validam:
1. Strip não-dígitos
2. Length === 11
3. Não pode ser sequência (00000000000, 11111111111, ...)
4. Calcula 1º dígito verificador (mod 11 de soma ponderada 10..2)
5. Calcula 2º dígito verificador (mod 11 de soma ponderada 11..2)
6. Confere com últimos 2 dígitos do CPF

Implementação compartilhada em:
- `web/src/utils/cpfValidator.ts`
- `app/src/main/java/com/futebadosparcas/util/CpfValidator.kt`
- `shared/commonMain/kotlin/.../CpfValidator.kt` (KMP shared se possível)
- `functions/src/validation/cpf.ts`

## Fases de implementação

### Fase 1: Foundation (PR #1)
- [ ] CPF validator: 4 implementações (web, android, KMP, functions)
- [ ] Firestore rules: stub `isVerified()` ainda permite tudo (rollout gradual)
- [ ] Custom Claim infra `verified` (Cloud Function `setUserVerified`)

### Fase 2: Web flow (PR #2)
- [ ] PhoneVerificationScreen + CpfVerificationScreen (web)
- [ ] Cloud Function `verifyCpf` callable
- [ ] OnboardingGuard route wrapper

### Fase 3: Android flow (PR #3)
- [ ] Compose PhoneVerificationScreen + CpfVerificationScreen
- [ ] Koin modules pra new ViewModels
- [ ] OnboardingNavigation guard

### Fase 4: iOS flow (PR #4)
- [ ] SwiftUI Phone/CPF verification (após PHASE_4 do CMP)
- [ ] APNs setup pra invisible reCAPTCHA

### Fase 5: Enforcement (PR #5)
- [ ] Firestore rules: `isVerified()` exigido em creates críticos
- [ ] Migration banner pra users existentes
- [ ] 30-day grace period

### Fase 6: Anti-abuse (PR #6)
- [ ] Rate limit SMS por número
- [ ] VoIP detection (libphonenumber type check)
- [ ] CPF blacklist pra contas suspeitas
- [ ] Audit log de tentativas falhadas

## Definition of Done (cada fase)

- [ ] Build verde em todas plataformas
- [ ] Tests unit + integration
- [ ] LGPD: termos atualizados em `public/privacy_policy.html`
- [ ] Smoke test cross-platform
- [ ] PR aprovado + merged + deploy

## Out of scope desta spec

- Receita Federal API integration (consulta ao CPF — caro + risco regulatório)
- Verificação biométrica (selfie + RG)
- 2FA contínuo após onboarding
- KYC completo (este é apenas anti-bot, não AML)

## Riscos & mitigações

| Risco | Mitigação |
|-------|-----------|
| Custo SMS OTP | Firebase Phone Auth gratuito até 10k/mês; rate limit por IP |
| LGPD violation se CPF vazar | Hash + salt server-side, nunca armazena puro |
| User abandonment no onboarding | UX cuidadoso: skip CPF até 7 dias após signup, mas required pra criar jogo |
| Telefone descartável (Twilio temp numbers) | Detect VoIP em fase 6 |
| iOS APNs setup complexo | Documentar setup detalhado em `iosApp/SETUP.md` |

## Issues GitHub

Epic issue será criada referenciando esta spec, com sub-issues por fase.

## Relacionado

- Audit issues: #421-#442 (security findings)
- specs/PERF_001_SECURITY_RULES_OPTIMIZATION.md (Custom Claims)
- CLAUDE.md "App Check" section
