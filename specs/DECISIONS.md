# Decision Log - Futeba dos Parças

Registro de decisões técnicas e de produto. Cada entrada deve ter contexto, alternativas consideradas e justificativa.

---

## Template de Decisão

```markdown
### [YYYY-MM-DD] Título da Decisão

**Contexto:** Por que essa decisão foi necessária?

**Alternativas consideradas:**
1. Opção A - prós/contras
2. Opção B - prós/contras

**Decisão:** O que foi decidido?

**Justificativa:** Por que essa opção?

**Consequências:** Impactos esperados, trade-offs aceitos.

**Relacionado:** Links para specs, PRs, issues.
```

---

## Decisões Registradas

### [2026-05-11] iOS Bundle ID: `com.futebadosparcas` (sem sufixo `.ios`)

**Contexto:** Master `iosApp/iosApp/Info.plist` tinha `CFBundleIdentifier` hardcoded como `com.futebadosparcas.ios` (sufixo separava Android/iOS). Ao registrar app iOS no Firebase Console + rodar pela primeira vez no Simulator (PR #1055), decidi unificar com Android (`com.futebadosparcas`).

**Alternativas consideradas:**
1. **Manter `com.futebadosparcas.ios`** — pro: separação visual; contra: configurações Firebase/Apple Developer separadas pra mesma app, deeplink schemes precisam handling distinto, mais confusão pra App Store / TestFlight reviewer
2. **Migrar pra `com.futebadosparcas`** — pro: paridade total com Android, identidade única cross-platform, deep links unificados; contra: muda master (mas iOS nunca shipped, sem usuário afetado)

**Decisão:** Migrar pra `com.futebadosparcas` via `$(PRODUCT_BUNDLE_IDENTIFIER)` (Xcode var) resolvido em `project.yml` como `PRODUCT_BUNDLE_IDENTIFIER: com.futebadosparcas`.

**Justificativa:**
- iOS nunca foi shipped publicamente, então sem usuários afetados por mudança de bundle ID
- Apple permite mesmo bundle ID em iOS/Android (lojas separadas, não há conflito)
- Match com Android namespace `com.futebadosparcas` (`applicationId`)
- Firebase iOS app já criado pra esse bundle ID (`1:490094091078:ios:e51b069afe7aefa3b5a347`)
- Convenção moderna: `$(PRODUCT_BUNDLE_IDENTIFIER)` em Info.plist, valor definido em build settings (xcodegen `PRODUCT_BUNDLE_IDENTIFIER`)

**Consequências:**
- Apple Developer Portal: registrar App ID = `com.futebadosparcas` (não `.ios`)
- TestFlight (futuro, spec `IOS_TESTFLIGHT_SETUP.md`): mesmo bundle ID
- Deep links / Universal Links: unificar com Android (mesmo `applinks:` no apple-app-site-association)
- `fastlane match` (TestFlight phase): certs e provisioning profiles com bundle `com.futebadosparcas`

**Relacionado:** PR #1055, `specs/IOS_TESTFLIGHT_SETUP.md`, memory `project_ios_simulator_firebase_running_2026_05_11`.

---

### [2026-05-03] CodeQL Java/Kotlin desabilitado em macOS ARM64

**Contexto:** Pipeline CodeQL Security Analysis migrada para self-hosted Mac M-series (PRs #386, #389, #404). Java/Kotlin analyzer falha em todos os build-modes testados em runners ARM64.

**Alternativas consideradas:**

1. **build-mode: manual** (compileDebugKotlin) — Tracer libtrace.dylib é x86_64-only (`codeql/tools/osx64/libtrace.dylib`), não injeta via DYLD_INSERT_LIBRARIES em processos JDK ARM64 nativos. Build completa OK mas tracer captura nada. Erro: "no source code seen during build."
2. **build-mode: none** — Extrator Kotlin não processa source files sem build (apenas Java é suportado nesse modo). Erro: "could not process any code written in Java/Kotlin."
3. **build-mode: autobuild** — Heurística do extrator roda `./gradlew assemble` que falha resolvendo dependência `com.github.webassembly:binaryen:123` do target wasmJs do `:composeApp`. Erro: "We were unable to automatically build your code."
4. **JDK x86_64 + arch -x86_64 ./gradlew** — Funcionaria mas requer JDK x86_64 separado (~200MB), runner host só tem Temurin 17 ARM64 (`/usr/libexec/java_home -V` confirma). Overhead duplo de manutenção.
5. **Mover Java analyzer pra ubuntu-latest** — GitHub Actions billing bloqueado a nível org (per SESSION_HANDOFF.md 2026-05-03). Auto self-hosted resolve esse bloqueio.
6. **continue-on-error: true** — Esconde falha permanentemente, contradiz propósito de security analysis.

**Decisão:** Remover Java/Kotlin do matrix CodeQL. Manter apenas JavaScript/TypeScript (`build-mode: none`) que cobre backend Express, Cloud Functions e web app React.

**Justificativa:**
- Tracer macOS x86_64-only é limitação documentada do CodeQL (GitHub team: "Rosetta is currently required for CodeQL")
- JDK runner é ARM64-only e Rosetta não roda binário ARM64 (`Bad CPU type in executable`)
- Áreas mais críticas para análise estática (XSS, injection, prototype pollution, IDOR) estão em JS/TS — Kotlin/Compose tem menos surface de vulnerabilidades automatizadas
- Tempo investido (4 commits, 3 modos testados) excedeu valor incremental do Java analyzer

**Consequências:**
- ✅ Pipeline CodeQL passa consistentemente em master
- ✅ JS/TS cobre 100% do código backend e ~60% das vulnerabilidades OWASP relevantes do projeto
- ⚠️ Vulnerabilidades específicas de Kotlin/Android (e.g., insecure intent flags, exported components) não detectadas automaticamente — mitigado por code review manual e detekt
- 🔄 Reabilitar quando: (a) GitHub liberar tracer ARM64-native, OU (b) projeto migrar pra runner Linux (billing org desbloqueado), OU (c) instalar JDK x86_64 separado no runner

**Relacionado:** PR #405, SESSION_HANDOFF.md, CLAUDE.md "CI Known Behaviors"

---

### [2025-01-20] Adoção de Spec-Driven Development (SDD)

**Contexto:** O projeto precisa de um processo mais rigoroso para garantir qualidade, evitar retrabalho e documentar decisões.

**Alternativas consideradas:**
1. Continuar sem processo formal - rápido mas propenso a bugs e retrabalho
2. Adotar SDD completo - mais estruturado, documenta decisões
3. Usar apenas issues do GitHub - menos overhead mas sem templates padronizados

**Decisão:** Adotar SDD com fases obrigatórias (Requirements → UX/UI → Technical → Tasks → Implementation → Verify).

**Justificativa:** Garante que todas as features tenham consideração de UX, estados, offline, acessibilidade e testes antes de implementar.

**Consequências:**
- (+) Menos retrabalho por requisitos mal definidos
- (+) Documentação viva do sistema
- (-) Overhead inicial para features simples
- Trade-off aceito: simplicidade vs. qualidade

**Relacionado:** `/specs/README.md`, `CLAUDE.md`

---

### [2026-02-01] iOS Development via Kotlin Multiplatform + Compose Multiplatform

**Contexto:** O app precisa expandir para iOS. Três opções foram avaliadas para a UI.

**Alternativas consideradas:**
1. **SwiftUI Nativo** - Reuso ~70% (só lógica), requer aprender Swift, UI nativa
2. **Compose Multiplatform** - Reuso ~95% (UI + lógica), Kotlin único, LLM-friendly
3. **React Native/Expo** - Reescrita completa, JavaScript/TypeScript

**Decisão:** Usar Compose Multiplatform para UI + Kotlin Multiplatform para lógica.

**Justificativa:**
1. **LLM Optimization**: Uma única linguagem (Kotlin) para toda a codebase facilita geração de código, refatorações e debugging com IA
2. **Reuso máximo**: Telas Compose existentes podem ser adaptadas com mínimo esforço
3. **Investimento estratégico**: Compose Multiplatform é o caminho recomendado pelo Google/JetBrains
4. **Infraestrutura existente**: 85 arquivos em commonMain já prontos

**Consequências:**
- (+) Desenvolvimento 50% mais rápido que SwiftUI nativo
- (+) Manutenção centralizada
- (+) Consistência de UX entre plataformas
- (-) Widgets iOS requerem SwiftUI separado
- (-) Algumas APIs iOS precisam de bridges Swift

**Relacionado:** `/specs/SPEC_IOS_KMP_DEVELOPMENT.md`

---

### [2026-02-01] Remoção de ACCESS_BACKGROUND_LOCATION (v1.7.2)

**Contexto:** Google Play exige vídeo demonstrativo para apps com background location. O feature de check-in automático via geofence NÃO está implementado - apenas check-in manual.

**Alternativas consideradas:**
1. **Gravar vídeo** - Mas feature não existe ainda
2. **Remover permissão** - Manter apenas foreground location
3. **Implementar geofence rapidamente** - Risco de bugs, atrasar release

**Decisão:** Remover ACCESS_BACKGROUND_LOCATION e documentar roadmap para implementação futura.

**Justificativa:**
- Check-in atual é MANUAL (jogador abre app → clica botão → GPS valida)
- Sem geofence implementado, permissão era desnecessária
- Evita problemas com Google Play Review

**Consequências:**
- (+) Release imediata possível
- (+) Menor escrutínio do Play Store
- (-) Check-in automático adiado para v1.8.0+

**Relacionado:** `/specs/ROADMAP_BACKGROUND_LOCATION.md`, AndroidManifest.xml

---

### [2026-03-29] Manter UTC-3 fixo para America/Sao_Paulo nos lembretes de jogo

**Contexto:** A função `parseScheduledTime` em `functions/src/reminders.ts` (linhas 128-143) usa um offset fixo de `-3` horas para converter horário local (BRT) em UTC ao calcular quando enviar lembretes de jogos. O código não usa uma biblioteca de timezone dinâmica.

**Alternativas consideradas:**
1. **Offset fixo UTC-3** — Simples, zero dependências extras, funciona para o Brasil atual
2. **`date-fns-tz` ou `luxon`** — Suporte completo a DST, mas adiciona dependência e complexidade
3. **`Intl.DateTimeFormat`** — Nativo no Node, mas API verbosa para conversões de offset

**Decisão:** Manter offset fixo `BRAZIL_UTC_OFFSET = -3` (UTC-3 / Horário de Brasília).

**Justificativa:**
- O horário de verão no Brasil foi **abolido definitivamente pelo Decreto nº 9.772/2019**. Não há DST desde outubro de 2019.
- UTC-3 é o horário fixo permanente de toda a região BRT (exceto Acre/Fernando de Noronha, fora do escopo do app).
- Adicionar `date-fns-tz` ou `luxon` apenas para suportar um DST inexistente seria over-engineering.

**Consequências:**
- (+) Sem dependências extras no bundle de Cloud Functions
- (+) Código simples e direto
- (-) Se o DST for reintroduzido no Brasil, este valor precisará ser dinâmico
- **Plano de migração se necessário**: substituir o offset fixo por `date-fns-tz` ou `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'`

**Relacionado:** `functions/src/reminders.ts` linhas 128-143

---

### [2026-05-12] Cashbox de grupo — política de permissão "global flag + check de grupo no call site"

**Contexto:** Issue #1077 / matrix PERMISSION_MATRIX row #9 levantou divergência entre `UserPermissions.MANAGE_GROUP_CASHBOX` (FIELD_OWNER/ADMIN global) vs Firestore rules (membro lê / group admin escreve) vs Web (sem gate, segundo o matrix). Auditoria do código atual mostrou que **a divergência aparente é por design**:

- `UserPermissions.kt:72-77` documenta explicitamente que `MANAGE_GROUP_CASHBOX` é flag global ("user pertence a um role que **pode** gerenciar cashbox") e que o **caller deve verificar group-specific admin status**.
- `web/src/pages/groups/CashboxScreen.tsx:127-139` faz exatamente isso: carrega o member doc do grupo e seta `isAdminOrOwner = memberRole in ['ADMIN', 'OWNER']`; o FAB só aparece quando true.
- `firestore.rules` (cashbox subcollection): read = member, create/update = group admin. Granularidade correta.

**Alternativas consideradas:**
1. **Apertar rules** (require `isGroupAdmin(groupId)` para write) — já é o caso.
2. **Afrouxar Android** (remover flag global) — mas a flag é genuinamente útil pra esconder shortcuts e quick-links em telas globais (ex: home tab pra FIELD_OWNER que tem >0 grupos administrados).
3. **Manter design atual e documentar** — política "global flag + check de grupo no call site" alinha com convenção do projeto (denormalização + verificação fina no use case).

**Decisão:** Manter design atual. Política oficial:
- **Layer 1 (UI gate global)**: `MANAGE_GROUP_CASHBOX` em `UserPermissions` controla se a entrada-de-menu/atalho/FAB aparece em telas globais.
- **Layer 2 (per-group check)**: telas que tocam cashbox de um grupo específico checam o role no `groups/{id}/members/{uid}` doc (ou `groups/{id}.owner_id`) antes de habilitar ações.
- **Layer 3 (rules)**: Firestore rules enforçam `isGroupAdmin(groupId)` no write de `groups/{id}/cashbox/{entryId}`.

**Justificativa:**
- Defense in depth — três camadas independentes. Cliente comprometido ainda é bloqueado por rules.
- Sem mudança de código — design já estava correto; matrix era stale.
- Comentários inline no `UserPermissions.kt:72-77` já documentavam — agora ficou explícito no decision log.

**Consequências:**
- (+) Sem regressão; sem trabalho extra.
- (+) Pattern reutilizável para outras "permissões com flag global + check granular" (ex: `MANAGE_OWN_LOCATIONS`).
- (-) Documentação dispersa entre UserPermissions.kt + DECISIONS.md + PERMISSION_MATRIX.md — manter sincronizado.

**Relacionado:** issue #1077, PERMISSION_MATRIX.md row #9, `shared/src/commonMain/kotlin/com/futebadosparcas/domain/authorization/UserPermissions.kt:72-77`, `web/src/pages/groups/CashboxScreen.tsx:127-139`, `firestore.rules` (bloco `match /groups/{groupId}/cashbox/{entryId}`).

---

## 2026-05-16 — Onboarding Moderno: North Star & Phasing

**Contexto:** Pedido de "onboarding completo e moderno, dicas de tela de primeira vez,
cobrindo todos os recursos". Risco: virar spec gigante que não embarca. Spec:
`/specs/feat-2026-05-16-modern-onboarding-tour.md`.

**Decisão 1 — North Star = time-to-first-game (TTFG).**
Todo item de onboarding é avaliado por "isso aproxima o usuário de jogar/entrar num
grupo mais rápido?". "% de slides vistos" NÃO é métrica de sucesso. Critério mata
discussão de escopo futura.

**Decisão 2 — "Todos os recursos" filtrado em 4 buckets:**
- **Core** (Home, Jogos, Grupos, Perfil) → slide no carousel + item na checklist
- **Gamificação** (XP, Badges, MVP, Liga/Season, Streak) → 1 slide consolidado + tip contextual
- **Descoberta** (Locations/Mapa, Search, Schedules) → empty states modernos (tour passivo), SEM slide/coach mark
- **Power** (LiveGame, Cashbox, Tática, Notificações) → tip contextual só na 1ª ação, SEM slide

> Consequência explícita: **Locations/Mapa, Cashbox e Tática NÃO ganham slide** no
> carousel — quem precisa descobre via menu/empty state. Evita carousel inchado.

**Decisão 3 — Phasing (a spec só embarca fatiada):**
- Fase 1: carousel moderno (substitui `AppGuideScreen` estático) + checklist gamificada no Home + analytics de funil. Paridade Android + Web.
- Fase 2: dicas one-shot em 3–4 telas de alto valor (estilo Linear/Notion, não wizard intrusivo).
- Fase 3: replay do tour em Ajuda/Settings + Remote Config + A/B.

**Decisão 4 — Reuso, não redesenho.** `OnboardingFlow` (Welcome→Permissões→Perfil→Guia)
é mantido; só o passo Guia é trocado. Verificação CPF/telefone é escopo separado,
intocada. Strings `welcome_step_*` reaproveitadas como conteúdo da checklist.

**Decisão 5 — iOS:** apenas o *state model* KMP (`OnboardingState` em
`shared/commonMain`) é especificado agora. UI iOS = follow-up (scaffold/TestFlight
bloqueado — specar UI agora seria premature).

**Decisão 6 — Recompensa de boas-vindas:** default é **badge "Bem-vindo"** (sistema
de badges isolado, sem efeito em ranking/season). XP de boas-vindas só após validação
com `xp-engine-guardian` e, se aprovado, concessão **server-side** (nunca client) por
causa de anti-cheat/`xp_logs`/season.

**Consequências:**
- (+) Spec tem chance real de embarcar (Fase 1 ≈ 38h, fatiável).
- (+) Critério TTFG + buckets travam escopo em revisões futuras.
- (-) Cobertura "todos os recursos" é deliberadamente parcial no carousel (por design).

**Relacionado:** `/specs/feat-2026-05-16-modern-onboarding-tour.md`,
`app/.../ui/onboarding/OnboardingFlow.kt`, `AppGuideScreen.kt`,
`functions/src/badges/badge-helper.ts`.

---

## 2026-05-16 — Arquitetura 4-plataformas (web desktop + web mobile + iOS + Android)

**Contexto:** Usuário quer publicar e manter em paridade: web desktop, web mobile,
iOS (App Store), Android (Play Store). Investigação do iOS revelou que o app que
**compila** é `iosApp/iosApp/` (shell SwiftUI → `ComposeView` → `MainViewControllerKt`
= UI **Compose Multiplatform** de `composeApp`). `iosApp/FutebaDosParcas-ios/` é
tentativa SwiftUI nativa **morta** (não compila: `let xp: Long`). `composeApp/commonMain`
tem ~2 telas; Android tem 56 `*Screen.kt` em `:app` (Android-only).

**Decisão:** 1 backend + 1 núcleo lógico + **2 codebases de UI** (não 4).

| Camada | Decisão |
|--------|---------|
| Backend | 1 só: Firebase + Cloud Functions + Firestore rules (garantidor real de paridade) |
| Núcleo lógico | 1 só: `shared/` KMP (domínio, modelos, validação, contratos de repo) |
| UI mobile (iOS+Android) | **1 só: Compose Multiplatform** (`composeApp`) — CMP Fase 3 |
| UI web (desktop+mobile) | **1 só: React+MUI responsivo** (`web/`) — breakpoints, não 2 apps |

**Rejeitado:**
- **SwiftUI nativo p/ iOS** → seria 4º codebase eterno; já foi tentado e morreu (`FutebaDosParcas-ios/`).
- **Compose-for-Web/wasm** → imaturo; React de vocês é maduro, melhor SEO/a11y/UX desktop.
- **App "web mobile" separado** → desktop vs mobile é responsividade, não codebase.

**Consequências:**
- (+) Paridade iOS+Android com 1 codebase; paridade web com 1 codebase responsivo.
- (+) "Paridade iOS" = CMP Fase 3 = portar telas Android → `composeApp/commonMain`
  (também moderniza Android p/ UI compartilhada incremental).
- (+) DeepSeek p/ iOS gera **Kotlin Compose commonMain**, não Swift; verify loop = gradle.
- (-) CMP Fase 3 é grande (56 telas a portar) — fatiar por buckets (Core→Gamif→Descoberta→Power).
- (-) `FutebaDosParcas-ios/` será deletado (em branch, reversível via git).

**Relacionado:** `specs/feat-2026-05-16-ios-parity-cmp-phase3.md`,
`specs/CMP_MULTIPLATFORM_MIGRATION.md` (Phase 3), `iosApp/project.yml`,
`composeApp/`, memória `project_ios_real_target_composeapp`.

---

<!-- Adicione novas decisões acima desta linha -->
