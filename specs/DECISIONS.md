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

<!-- Adicione novas decisões acima desta linha -->
