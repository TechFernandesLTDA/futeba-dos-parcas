# BUGFIX: C1 — Android sem superfície de enforcement anti-bot (phone+CPF órfãos, gate `verified` inexistente)

> **Status:** `APPROVED` — placement decidido pelo usuário em 2026-05-17: **Opção (b) Post-login gate em MainActivityCompose**
> **Severidade:** `CRITICAL`
> **Autor:** Claude (discovery do PR #1312, auditoria CPF 2026-05-17)
> **Data:** 2026-05-17
> **Issue:** #1302
> **Deadline duro:** grace period termina **2026-06-04** (~18 dias a partir de 2026-05-17)
> **Depende de:** #1303 (H1-H3) — ✅ resolvido em PR #1312 (pré-requisito p/ ligar a tela sem reproduzir a saga de token)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

O anti-bot Phone+CPF (specs `SPEC_FEATURE_PHONE_CPF_VERIFICATION` / `SPEC_PHONE_CPF_FASE5_ENFORCEMENT`) **não tem nenhuma superfície de enforcement no Android**. Discovery do PR #1312:

| Achado | Situação |
|--------|----------|
| `OnboardingFlow.kt` | Só passos 0-3 (Welcome→Permissions→ProfileSetup→WelcomeCarousel) — sem passo phone-verify nem CPF |
| `PhoneVerificationScreen` | Código órfão — zero call sites fora do próprio ViewModel |
| `CpfVerificationScreen` | Código órfão — registrado só no Koin DI |
| `VerificationBanner` | Definida, nunca usada |
| Gate do claim `verified` | **Inexistente no Android** — nem `AppNavGraph.kt`, nem `MainActivityCompose.kt`, nem interceptor |

### 1.2 Comportamento Esperado (Correto)

Usuário Android passa por verificação de telefone **e** CPF; o claim `verified` é gated em uma superfície real (bloqueia/redireciona usuário não-verificado após o grace period, com paridade ao web).

### 1.3 Impacto / Risco de Deadline

Em **2026-06-04** o grace period termina. A partir daí, conforme onde o enforcement realmente vive:
- Se enforcement for **client-side apenas**: Android **bypassa o anti-bot inteiramente** (bots entram via Android).
- Se enforcement for **server-side (rules/functions)**: **todo usuário Android** sem `verified` é bloqueado (não há caminho Android para obter o claim) → outage de facto no Android.

> ⚠️ **Pré-requisito para a spec ser acionável:** confirmar ONDE o enforcement `verified` realmente roda hoje (firestore.rules? Cloud Functions? só cliente web?). Isso muda o risco e a urgência. A discovery da implementação DEVE responder isto antes de codar.

---

## 2. Análise de Causa Raiz

Telas de phone/CPF construídas (Fase 3 #446) mas nunca cabeadas ao nav graph; o gate do claim `verified` nunca foi implementado no Android (existe no web). Auditoria original framou como "tela CPF órfã" (C1); a realidade é a ausência completa da superfície de enforcement Android.

### 2.1 Arquivos prováveis (a confirmar na discovery)

| Arquivo | Motivo |
|---------|--------|
| `app/.../ui/navigation/NavDestinations.kt` | destinos phone-verify + CPF |
| `app/.../ui/navigation/AppNavGraph.kt` | rotas / gate de navegação |
| `app/.../ui/main/MainActivityCompose.kt` | candidato a post-login gate global (opção b) |
| `app/.../ui/onboarding/OnboardingFlow.kt` | candidato a steps 4-5 (opção a) |
| `firestore.rules` / `functions/` | **somente leitura** — confirmar onde `verified` é enforced (não editar nesta spec) |

---

## 3. Solução Proposta

### 3.1 PLACEMENT DECIDIDO: Opção (b) — Post-login gate em `MainActivityCompose`

✅ **Usuário escolheu (b) em 2026-05-17.** Razão: única opção que cobre usuários **existentes** sem `verified` (críticos pós-grace-period) + paridade arquitetural com o `AuthGate` web. Opções (a)/(c) abaixo mantidas só como registro da decisão.



| Opção | Descrição | Prós | Contras |
|-------|-----------|------|---------|
| **(a)** Steps 4-5 no `OnboardingFlow` | phone-verify + CPF como passos finais do onboarding | Linear, fácil de testar | Só cobre usuários novos; usuários existentes sem `verified` não passam pelo onboarding |
| **(b)** Post-login gate em `MainActivityCompose` ⭐ | Após login, se `verified != true`, redireciona p/ fluxo phone→CPF antes de liberar o app | Cobre **todos** (novos + existentes); paridade com `AuthGate` web; padrão do projeto p/ gates globais | Mais invasivo; precisa de cuidado com loop de navegação |
| **(c)** Spec/feature separada maior | Tratar como feature, não bugfix | Mais espaço de design | Não cabe no deadline 2026-06-04 |

**Recomendação:** **(b)** — é a única que cobre usuários existentes (críticos pós-grace-period) e tem paridade arquitetural com o web `AuthGate`. **Usuário deve confirmar antes de APPROVED.**

### 3.2 Abordagem (assumindo opção b — ajustar conforme decisão)

1. Discovery (obrigatória, parte da implementação): confirmar onde `verified` é enforced server-side; mapear o fluxo de login Android até a 1ª tela pós-auth.
2. Adicionar destinos `PhoneVerification` e `CpfVerification` em `NavDestinations.kt`.
3. Gate em `MainActivityCompose` (ou equivalente pós-login): ler claim `verified` do token (`getIdToken(false)` → refresh controlado), e se `false` → navegar para phone-verify → CPF → de volta ao app. Pular se `verified==true`. Reaproveitar `CpfVerificationViewModel` (já corrigido, #1303) e `PhoneVerificationViewModel`.
4. Tratar o caso "claim stale" reusando o `refreshTokenWithRetry` já introduzido no #1312.

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Loop de navegação no gate | Testar estados: verified, não-verified, claim stale; gate idempotente |
| Reproduzir saga de token | #1303 já mitigado; reusar `refreshTokenWithRetry` |
| Deadline 2026-06-04 | Priorizar opção (b) mínima viável; phone-verify pode ser fase 1, CPF fase 2 se necessário |
| Enforcement server-side desconhecido | **Discovery primeiro** — não codar antes de confirmar |

---

## 4. Verificação

- [ ] `./gradlew compileDebugKotlin` + `./gradlew detekt` verdes
- [ ] Testes de gate: verified⇒passa; não-verified⇒redireciona; claim stale⇒refresh+reavalia (não loop)
- [ ] Usuário novo e usuário existente sem `verified` ambos passam pelo fluxo
- [ ] Paridade verificada vs web `AuthGate`
- [ ] Sucesso server-side nunca mostra erro (regressão #1303)

## 5. Prevenção Futura

- Fix de enforcement aplicado a uma plataforma DEVE abrir issue de paridade nas outras no mesmo PR.
- Audit de navegação periódico: telas registradas no DI mas sem call site = dead code de enforcement.

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Claude | Discovery via PR #1312 — escopo real de C1 documentado; aguardando decisão de placement |
