# BUGFIX: CPF Android órfão + saga de token refresh não portada (C1+H1-H3)

> **Status:** `APPROVED` (aprovado pelo usuário em 2026-05-17 para implementação imediata)
> **Severidade:** `CRITICAL` (C1) + `HIGH` (H1-H3)
> **Autor:** Claude (auditoria CPF 2026-05-17)
> **Data:** 2026-05-17
> **Issues:** #1302 (C1), #1303 (H1-H3)
> **PR:** _(a preencher)_
> **Origem:** `.claude/audits/cpf-validation-audit-2026-05-17.md`

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

1. **C1:** O onboarding Android (`OnboardingFlow.kt`) tem apenas passos 0-3 (Welcome → Permissions → ProfileSetup → WelcomeCarousel). **Não existe passo de CPF.** `CpfVerificationScreen.kt`/`CpfVerificationViewModel.kt` existem mas estão registrados só no Koin DI — nunca no nav graph nem no fluxo. Usuário Android nunca informa CPF; custom claim `verified` nunca é setado por esse caminho.
2. **H1:** `CpfVerificationViewModel.kt:62-65` chama o callable `verifyCpf` sem `getIdToken(true)` antes → token stale entre phone-verify e click → `unauthenticated`.
3. **H2:** `CpfVerificationViewModel.kt:81` faz `getIdToken(true)` **dentro** do `try{}` (L60-89). `setUserVerified` revoga refresh tokens server-side → o refresh lança `user-token-expired` → cai no `catch` (L84) → mostra "Erro ao verificar CPF" **mesmo com sucesso server-side**.
4. **H3:** o refresh é único, sem retry/backoff → falha transitória de rede derruba a sessão na 1ª tentativa.

### 1.2 Comportamento Esperado (Correto)

- Após phone-verify, o onboarding Android apresenta o passo de CPF (gated pelo claim `verified` — pula se já verificado).
- `verifyCpf` é chamado com token fresco (pre-call refresh com retry).
- Sucesso server-side **sempre** resulta em estado de sucesso no cliente, independente de falha no refresh pós-verify.
- Refresh pós-verify é non-fatal, isolado, com retry/backoff (até 3×).

### 1.3 Passos para Reproduzir

- **C1:** completar onboarding no Android → CPF nunca é pedido → após grace period (2026-06-04) gates `isVerifiedOrGrace()` bypassados no Android.
- **H1-H3 (latentes):** ligar a tela de CPF sem corrigir → reproduz exatamente a saga web #1284/#1285/#1301 ("Sessão deslogado" / "Erro" com sucesso real).

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Android (web já corrigido em #1284/#1285/#1301) |
| Frequência | C1: sempre. H1-H3: sempre que a tela for ligada sem o fix |
| Impacto | Anti-bot Phone+CPF (SPEC_PHONE_CPF_FASE5_ENFORCEMENT) não cobre Android; deadline grace 2026-06-04 |

---

## 2. Análise de Causa Raiz

### 2.1 Causa Raiz

- **C1:** tela de CPF construída na Fase 3 (#446) mas nunca cabeada ao nav graph / OnboardingFlow.
- **H1-H3:** a saga de token refresh corrigida no web (3 PRs) nunca foi portada para o Android ViewModel — `setUserVerified` revoga refresh tokens, e o cliente Android não trata isso (sem pre-call refresh, refresh pós-verify dentro do try, sem retry).

### 2.2 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `app/.../ui/onboarding/CpfVerificationViewModel.kt` | H1 (pre-call refresh), H2 (mover refresh pós-verify p/ try isolado após Success), H3 (loop retry/backoff) |
| `app/.../ui/navigation/NavDestinations.kt` | C1 (destino CPF) |
| Superfície de gate do claim `verified` _(a DESCOBRIR)_ | C1 (passo CPF onde o claim `verified` é/deveria ser lido) |

> DI Koin já registra o ViewModel — **não** recriar binding.
>
> ⚠️ **Placement NÃO está decidido.** O audit provou que `OnboardingFlow.kt` tem só passos 0-3 — **não há passo phone-verify ali**. Antes de cabear C1, é OBRIGATÓRIO descobrir onde a verificação de telefone Android roda hoje e onde o claim `verified` é (ou deveria ser) gated — pode ser um `AuthGate`-equivalente, route guard em `AppNavGraph`, interceptor em `MainActivityCompose`, ou estar **também ausente**. A tela de CPF vai onde o claim `verified` é lido. Se nenhum gate existe, o gate também entra no escopo. Se o placement exigir mudança de spec, **parar e reportar** antes de implementar C1 (edição de ~5 linhas nesta spec).

---

## 3. Solução Proposta

### 3.1 Abordagem (ordem obrigatória: H1-H3 ANTES de C1)

1. **H1** — antes do callable `verifyCpf`, refresh com retry:
   ```kotlin
   private suspend fun refreshTokenWithRetry(user: FirebaseUser) {
       repeat(3) { attempt ->
           try { user.getIdToken(true).await(); return }
           catch (e: Exception) {
               if (attempt == 2) throw e
               delay((attempt + 1) * 600L)
           }
       }
   }
   ```
   Chamar antes de `getHttpsCallable("verifyCpf")`.
2. **H2** — mover o `getIdToken(true)` pós-`setUserVerified` para FORA do `try` principal: setar `_uiState.value = Success` primeiro, depois refresh non-fatal:
   ```kotlin
   _uiState.value = CpfVerificationUiState.Success
   runCatching { refreshTokenWithRetry(user) }
       .onFailure { Log.w(TAG, "Refresh pós-verify falhou (non-fatal)", it) }
   ```
3. **H3** — coberto pelo `refreshTokenWithRetry` (loop 3× backoff `(attempt+1)*600ms`).
4. **C1** — só depois de H1-H3 verdes:
   - **Discovery primeiro:** localizar onde a verificação de telefone Android roda e onde o claim `verified` é/deveria ser gated. Se o placement não bater com nenhum wire existente → parar e reportar (spec edit).
   - Adicionar destino em `NavDestinations.kt`.
   - Inserir passo/gate CPF na superfície real do claim `verified`, gated por `verified` claim (`FirebaseAuth.getInstance().currentUser?.getIdToken(false)` → `claims["verified"] == true` ⇒ pular). Se nenhum gate existe, criar o gate.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Ligar C1 sem H1-H3 reproduz a saga | Ordem obrigatória; H1-H3 verdes antes de cabear |
| Loop de refresh atrasa UX | Backoff curto (600/1200/1800ms), só 3× |
| Gate do claim lê token stale | Ler claim do token recém-refreshado (pós phone-verify) |

---

## 4. Verificação

### 4.1 Testes Adicionados
- [ ] `CpfVerificationViewModelTest`: sucesso server-side + falha de refresh pós-verify ⇒ `UiState.Success` (não Error)
- [ ] retry de refresh: 2 falhas + 1 sucesso ⇒ prossegue; 3 falhas ⇒ propaga
- [ ] pre-call refresh chamado antes do callable

### 4.3 Checklist
- [ ] `./gradlew compileDebugKotlin` passa
- [ ] `./gradlew :app:testDebugUnitTest --tests "*CpfVerificationViewModel*"` passa
- [ ] `./gradlew detekt` sem novos issues
- [ ] Onboarding Android pede CPF após phone-verify; pula se `verified=true`
- [ ] Sucesso server-side nunca mostra erro

---

## 5. Prevenção Futura

- Fix de auth/token aplicado a uma plataforma DEVE abrir issue de paridade nas outras (web→Android→iOS).
- Telas construídas mas não cabeadas ao nav graph = dead code detectável por audit de navegação.

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Auditoria → bug identificado (C1+H1-H3) |
| 2026-05-17 | Claude | Spec criada, APPROVED pelo usuário |
