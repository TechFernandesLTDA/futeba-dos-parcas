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

### [2026-07-16] Separar o contêiner de scroll Web por breakpoint do layout

**Contexto:** `#main-content` tem `overflow: auto` em todos os tamanhos, mas só
possui altura limitada em md+. Em xs/sm ele cresce com o conteúdo e quem rola é
a janela. Inferir o contêiner apenas pelo `overflow` conectava o listener ao
elemento errado no mobile.

**Alternativas consideradas:**
1. Testar `scrollHeight > clientHeight` ao montar. Pode falhar antes do conteúdo
   assíncrono terminar de carregar e muda o contêiner conforme o tamanho da tela.
2. Limitar também o main no mobile. Alteraria a arquitetura de scroll, safe area
   e comportamento do chrome móvel.
3. Usar a mesma fronteira md (900 px) do layout: janela em xs/sm e main em md+.

**Decisão:** Adotar a opção 3 com media query reativa. Um id explícito continua
tendo prioridade para consumidores especializados.

**Justificativa:** O contrato acompanha diretamente o CSS existente, não depende
do momento em que conteúdo assíncrono chega e não cria um segundo scroller no
mobile.

**Consequências:** A troca de orientação/breakpoint rebinda o listener. Mudanças
futuras na fronteira md precisam manter hook e layout alinhados.

**Relacionado:** spec `BUGFIX_2026-07-16_web-mobile-gesture-feedback.md`, issue #3762.

### [2026-06-25] iOS Liquid Glass: manter chrome translúcida no ComposeApp e adiar bridge SwiftUI nativa

**Contexto:** A auditoria do épico iOS (#2670) mostrou que a chrome atual do
`composeApp` usa aproximação por transparência em
`composeApp/src/commonMain/kotlin/com/futebadosparcas/ui/adaptive/PlatformChrome.kt`
(`surface.copy(alpha=0.86–0.94)` + `tonalElevation`) e não implementa blur real.
O código iOS/Compose não contém `UIBlurEffect`, `.ultraThinMaterial`,
`glassEffect` ou equivalente. A issue #2951 pediu uma decisão explícita entre
construir uma bridge SwiftUI nativa para Liquid Glass real ou assumir a
aproximação atual e ajustar o critério do épico.

**Alternativas consideradas:**
1. **Bridge SwiftUI nativa para chrome Liquid Glass real.** Prós: fidelidade mais
   alta ao HIG 2026, blur real do conteúdo por trás da tab/nav bar. Contras:
   aumenta bastante a complexidade arquitetural, divide a ownership da chrome
   entre SwiftUI/UIKit e Compose, exige spec SDD própria e amplia o risco em
   navegação, safe area, theming e manutenção.
2. **Manter a chrome translúcida em Compose e redefinir o critério como
   aproximação intencional.** Prós: preserva a arquitetura KMP atual, fecha a
   decisão imediatamente, mantém foco no backlog com maior impacto
   (acessibilidade, rotas, size class, Dynamic Type). Contras: não entrega o
   efeito visual exato de Liquid Glass.

**Decisão:** **Opção 2.** O app iOS seguirá, por ora, com chrome translúcida
adaptativa implementada em Compose. O critério do épico deixa de exigir "Liquid
Glass real" e passa a exigir chrome iOS translúcida/coesa com safe area,
contraste e comportamento adaptativo corretos.

**Justificativa:** O custo de uma bridge SwiftUI nativa é desproporcional ao
ganho imediato para o estado atual do produto. Há itens ainda abertos no épico
iOS com impacto funcional e de acessibilidade mais alto do que trocar toda a
camada de chrome por uma solução híbrida. A aproximação atual já entrega
consistência visual suficiente para avançar, desde que o requisito seja descrito
com precisão e sem prometer blur real inexistente.

**Consequências:** O backlog iOS não cria uma nova frente arquitetural neste
momento. O efeito "Liquid Glass" fica explicitamente fora do escopo atual do
ComposeApp; se a necessidade de blur nativo voltar no futuro, ela deve abrir uma
nova spec/issue dedicada para bridge SwiftUI. O épico #2670 deve ser lido e
atualizado com esse critério revisado.

**Relacionado:** issues #2951, #2670, #2679.

### [2026-06-04] Read-rule de `groups`: ramo público satisfazível por list query (#2522)

**Contexto:** A tela "Descobrir Grupos" (web, `useGroups.ts` → `fetchPublicGroups`)
faz uma LIST query `where('is_public','==',true) + orderBy('created_at','desc') + limit(100)`
e dava `PERMISSION_DENIED` para todos os usuários. Num list query o Firestore
avalia a read-rule contra CADA doc retornado e nega a query INTEIRA se qualquer
doc não satisfaz a rule. A regra antiga (L1343) ANDava 3 cláusulas, incluindo um
gate de `deleted_at` e `isGroupActive(groupId)` (get()-based, status=='ACTIVE'),
que a query pública não garante. Bastava 1 grupo público SUSPENDED/soft-deleted
no top-100-por-created_at para quebrar a discovery de todos (bug data-dependente).
Confirmado no emulador de rules: `Null value error. for 'list' @ L1343`.
Não é regressão recente — `isGroupActive` na read-rule é de 2026-05-20 (8c912609),
exposto por mudança de dados.

**Alternativas consideradas:**
1. **Reestruturar a rule: ramo público sem get()/sem gate de deleted_at; gates
   estritos só no ramo privado.** Prós: corrige com mudança mínima e nenhuma
   alteração de query/índice; cliente já filtra DELETED/soft-deleted pós-fetch.
   Contras: metadata de grupo público archived/soft-deleted vira legível.
2. **Manter os gates e tornar a query satisfazível com `where('status','==','ACTIVE')`
   + denormalizar `deleted_at`.** Contras: mais pesado; `where('deleted_at','==',null)`
   NÃO casa docs sem o campo (trap do campo ausente em Firestore); exige migração
   de dados e novo índice; ainda assim `isGroupActive` (get()) continuaria
   inviável em list query. Descartada.

**Decisão:** **Opção 1.** A `allow read` de groups passa a ser:
`isAuthenticated() && ( isAdmin() || is_public==true || (gates estritos privados) )`,
onde o ramo privado mantém `deleted_at`-gate + `isGroupActive()` + membership.

**Justificativa:** Opção 1 corrige o bug sem mudar a query nem migrar dados, e
mantém a proteção de grupos PRIVADOS intacta. O índice `is_public + created_at`
(que a query já requer) foi adicionado a `firestore.indexes.json` por
consistência (a query não mudou).

**Consequências:** Tradeoff aceito — metadata de grupo público
archived/soft-deleted fica legível por qualquer autenticado (baixa
sensibilidade: já era público). Subcoleções (members, cashbox) seguem
protegidas pelas suas próprias rules (#1035). Não-regressão de #511/#1035
provada por testes de rules (557 testes verdes): grupo privado alheio e privado
soft-deleted seguem invisíveis a não-membro.

**Relacionado:** `specs/BUGFIX_2026-06-04_discover-groups-list-permission.md`;
issue #2522; relacionado a #511/#1035 (privacidade de grupo privado), #2153.

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

## 2026-05-17 — Hash de CPF: aceitar determinístico+salt global no curto prazo; HMAC-KMS como follow-up (D1 / #1311)

**Contexto:** Auditoria CPF 2026-05-17 item D1 (`#1311`, design note — não-bug).
`cpf.ts:56-62` deriva `cpf_index` por hash determinístico com `CPF_SALT`
global único. CPF tem ~10⁹ valores → se `CPF_SALT` vazar, todo `cpf_index`
fica enumerável (rainbow table trivial), **sem caminho de rotação** (o CPF
plaintext nunca é armazenado, então não dá pra re-hashear).

**Decisão:** Manter o esquema atual no curto prazo. O risco está **mitigado em
defense-in-depth** pelas Firestore rules — `cpf_index` nega 100% de acesso
client-side (`firestore.rules:1951-1953`); o hash só é legível via Admin SDK.
O determinismo é **requisito funcional** (lookup de duplicidade de CPF sem
guardar plaintext — LGPD), então não é "bug a corrigir" e sim trade-off aceito.

**Rejeitado (agora):**
- **Salt por-usuário** → quebra o lookup de duplicidade (todo o ponto do índice).
- **Remover o índice** → reintroduz necessidade de plaintext ou full scan.

**Consequências:**
- (+) Sem mudança de schema/migração urgente; risco residual baixo enquanto
  as rules seguram `cpf_index` e o `CPF_SALT` é secret gerenciado.
- (-) Single point of failure no `CPF_SALT`; sem rotação.
- (→) **Follow-up rastreado (#1311, prioridade baixa):** migrar para HMAC-SHA256
  com **pepper em KMS** (Cloud KMS / Secret Manager com versão), permitindo
  rotação de versão de chave + dual-read durante migração. Não bloqueia a
  wave atual; reavaliar quando houver janela de migração de dados.

**Relacionado:** `#1311`, `.claude/audits/cpf-validation-audit-2026-05-17.md`,
`functions/src/**/cpf.ts`, `firestore.rules` (deny `cpf_index`),
memória `project_cpf_audit_2026_05_17`.

---

## 2026-05-19 — Waitlist #1336: feature aprovada + escopo corrigido por Fase 0

**Contexto:** Auditoria web #1336 ("Waitlist functionality not implemented").
SDD Regra #1 exige spec aprovada antes de implementar feature. Product owner
aprovou shipar via AskUserQuestion (2026-05-19); spec
`specs/feat-2026-05-18-web-waitlist-parity.md` → `APPROVED`.

**Decisão:** Implementar o **delta real**, não os ~19h estimados.

**Fase 0 (auditoria do código real) revelou:**
- `processExpiredWaitlistEntries` (`functions/src/reminders.ts`) já faz
  expiry/promote transacional via `onSchedule every 5 minutes` (Admin SDK).
- Android já tem waitlist completa (`WaitlistRepositoryImpl` escreve direto
  em `games/{gameId}/waitlist`, schema `GameWaitlist`).
- Web já **exibe** a aba de espera (`GameDetailScreen`).
- **Bug raiz cross-platform:** `firestore.rules` não tinha match para
  `games/{gameId}/waitlist/*`; o catch-all `match /{document=**} {allow
  read,write: if false}` **nega join em todos os clientes** (Android também).
  Só a sweep CF funciona (Admin SDK bypassa rules). Waitlist join nunca
  funcionou em produção em nenhuma plataforma.

**Escopo aprovado (delta):**
1. `firestore.rules`: regra `games/{gameId}/waitlist/{waitlistId}` —
   read autenticado; create só do próprio `user_id` + validação de schema;
   delete próprio/admin; **promote/update NUNCA no cliente** (server-only,
   mantém arquitetura anti-race do spec §3.1).
2. Web `useWaitlist` (join/leave/position) espelhando schema Android.
3. Fim do stub `HomeTab` ("(em breve)") + ação em `GameDetailScreen`.
4. Testes emulador (rules) + Vitest (hook).

**Rejeitado:** promoção client-side (viola spec §3.1 anti-race; CF server-side
já existe e é a fonte de verdade — paridade com Android).

**Consequências:** (+) conserta waitlist nas DUAS plataformas com 1 regra;
(+) sem reescrever CF/Android. (→) Finding #1336 "auto-promotion not
implemented" reconciliado como **server-side by-design** (CF pré-existe);
gap real era a rule + UI web.

**Relacionado:** `#1336`, `#1344`, `specs/feat-2026-05-18-web-waitlist-parity.md`.

---

## 2026-05-19 — Auditoria `backend/` Express: **ARQUIVADO** (decidido pelo PO) — #1356

**Contexto:** auditoria read-only de `backend/` (Express+TypeORM+PostgreSQL,
~5.6k LOC) por 3 agentes paralelos, Phase-0 validada. Descoberta de escopo:
o backend está **dormente** — nenhum cliente vivo o consome (web/Android/iOS
usam Firestore+Cloud Functions direto), sem CI, sem testes, sem deploy. A
nota de memória "backend nunca auditado" estava **errada**: git mostra waves
prévias (#379, #974, #797-#960, #801-#813 em comentários).

**Achados (read-confirmed):** 1 CRIT (`StatisticsService` conta todo placar
>0 como vitória — `game.teams` nunca carregado), 3 HIGH (N+1; `submitStats`
sem transação; `xp_processed` sem idempotência), drift de schema vs Firestore
(XP/level/game-state/season), e forte sinal de abandono (sem migrations, 0
`@Index`/28 entities, `TeamBalancerService` stub, WebSocket/multer anunciados
mas inexistentes, 0 testes/CI). Segurança e API surface **sem CRIT/HIGH** —
waves prévias landaram; só hardening de config (JWT/CORS/body-size).

**Decisão:** auditar para **decidir o destino** (não fix-wave em código que
nada executa — anti-churn). 3 agentes convergiram independentemente em
**ARQUIVAR**: reviver = rewrite (migrations+indexes+transações+paridade
XP/level/season+desestubar+testes+CI), não correção incremental, para
substituir um backend Cloud Functions que já funciona em produção.

**Status:** ✅ **DECIDIDO — Opção A (ARQUIVAR)**, escolhida pelo product
owner em 2026-05-19 (#1356). O PO inicialmente cogitou B por achar que o iOS
usava o Express; esclarecido que iOS usa Firestore+Cloud Functions via KMP
`shared` (zero consumidores em qualquer plataforma) → reconfirmou **A**.
Ação: `git mv backend/ → archive/backend/`; README "Production-ready" →
banner "ARQUIVADO/dormente"; refs em CLAUDE.md/AGENTS.md marcadas; #1352-#1355
fechadas `wontfix` (gated por #1356); #1356 fechada.

**Rejeitado:** (a) Opção B reviver — exigiria spec SDD com caso de uso
concreto + rewrite de meses (migrations/indexes/transações/paridade
XP/level/season/desestubar/testes/CI) para substituir um backend Cloud
Functions que já roda em produção, sem nenhum cliente pedindo. (b) fix-wave
multi-PR + deploy — não se aplica a código dormente sem consumidor (anti-churn).
Reconciliado: "nunca auditado" → já houve #379/#974.

**Relacionado:** `#1356`, `#1280-#1283` (audit Cloud Functions).

---

## 2026-05-22 — Sistema de version control / release notes ("Novidades")

**Contexto:** spec `feat-2026-05-22-version-control-release-notes.md` (APPROVED)
— entregue em 8 fases (A–H), PRs #1517–#1522. Sistema unificado de
versionamento, CHANGELOG, e tela/pop-up "Novidades" nas 3 plataformas
(Android `:app`, Web React, iOS `composeApp`).

**Decisões:**

1. **Versionamento independente por plataforma.** Cada plataforma mantém sua
   própria cadência e número de versão; `versions.json` na raiz é o registro
   central. Não há tentativa de sincronizar Android × Web × iOS — o drift é
   esperado e legítimo.

2. **`release-notes/<plataforma>/<versão>.md` como fonte única.** Um único
   arquivo-fonte (frontmatter YAML + corpo "Para o usuário" / "Técnico") gera os
   três artefatos: bloco AUTOGEN do `CHANGELOG.md`, bundle de fallback embarcado
   (`release-notes.json`) e o documento Firestore. Pipeline em
   `scripts/release-notes.js` (`validate` / `changelog` / `bundle` / `publish`).

3. **Canal dinâmico = Firestore + fallback embarcado.** A tela "Novidades" lê da
   coleção `release_notes` do Firestore; se indisponível (offline / primeiro
   boot), degrada para o `release-notes.json` empacotado no app. Sem Remote
   Config e sem Cloud Function callable — a publicação é feita via
   `firebase-admin` + service account no job `publish-release-notes` do
   `release.yml`. `firestore.rules`: `read` para autenticados, `write` negada
   para todos os clientes.

4. **"Último build visto" persistido por dispositivo, não por usuário.** O
   pop-up pós-update dispara comparando o build atual com o último build visto
   gravado localmente (`LastSeenVersionStore` — Android `SharedPreferences`,
   iOS `NSUserDefaults`). Não é sincronizado por conta — trocar de dispositivo
   mostra o pop-up de novo, o que é o comportamento desejado.

5. **Schema i18n-ready, entrega PT-BR only.** O campo `content` do documento
   Firestore é chaveado por locale (`content["pt-BR"]`) desde o dia 1, mas só
   PT-BR é populado. Adicionar um idioma no futuro não exige migração de schema.

6. **UI iOS em `composeApp` com strings PT-BR hardcoded.** A UI de "Novidades"
   para iOS vive em `composeApp` (Compose-MP), separada do `:app` Android — o
   que mantém a convenção do projeto. As strings em `composeApp/commonMain` são
   PT-BR hardcoded (espelham o `strings.xml` do `:app`): é a convenção de-facto
   do módulo — zero arquivos de `composeApp/commonMain` usam `stringResource` /
   `compose.components.resources`. Wirar i18n no `composeApp` é trabalho próprio,
   fora do escopo desta spec.

**Status:** ✅ **IMPLEMENTADO.** Fases A–G entregues e mergeadas; Fase H tasks
#25 (testes/verificação) e #27 (esta decisão + code review) concluídas. Task #26
(deploy de produção — rules/índices + 1º publish + smoke live nas 3 plataformas
+ empacotar `release-notes.json` no bundle iOS) **pendente de autorização**.

**Rejeitado:** (a) Remote Config / Cloud Function callable para o canal dinâmico
— Firestore + service account na CI é mais simples e sem custo de invocação.
(b) Versão única cross-platform — as plataformas têm cadências de release
genuinamente diferentes; forçar sincronia criaria versões "fantasma".

**Relacionado:** `specs/feat-2026-05-22-version-control-release-notes.md`,
PRs #1517–#1522.

---

### [2026-05-30] Paridade cross-platform: divergências DEFERIDAS (épico #2312)

**Contexto:** Auditoria de paridade Web↔Android (épico #2312) encontrou duas
divergências que NÃO são gaps de funcionalidade, mas decisões de produto sobre
prominência/identidade. Ambas tocam app já em produção (v1.22.0), então caem na
Regra #1 (SDD) — exigem spec aprovada antes de alterar.

**Divergência A — Bottom navigation, tab 3 (#2182):**
- Web (`config/navItems.ts`): Home · Games · **Groups** · League · Profile
- Android (`MainActivityCompose.kt`): Home · Games · **Players** · League · Profile
- (A tab 4 já é "League" em ambos — a tabela do issue #2182 estava desatualizada
  citando "Ranking".)

Ambas plataformas TÊM as telas Groups e Players; a divergência é só qual ocupa o
slot privilegiado da bottom nav. Deferir não perde funcionalidade.

**Divergência B — Dark mode background (#2180):**
- Web: `#0F172A` (slate/azulado), surface `#1E293B`
- Android: `#0F1114` (neutro/true-black), surface `#15191C`

A web é afinada em torno do slate (sombras densificadas para esse fundo).
Unificar tem risco de regressão visual ampla.

**Decisão:** DEFERIR ambas para spec/decisão do PO.
- **Recomendação A:** Groups como tab 3 em ambos (grupo é a unidade
  organizadora — você entra num grupo antes de ver games/players/league). Mas é
  call de produto; marcar como pendente.
- **Recomendação B:** escolher uma paleta única (slate OU neutro) e aplicar nas
  duas plataformas numa spec dedicada de tema.

**Justificativa:** trocar tab primária / fundo de tema de app shipado afeta
memória muscular e identidade — não é fato de paridade, é preferência. Alterar
unilateralmente sem spec viola Regra #1.

**O que FOI feito no épico #2312 (sem precisar de spec):**
- `ConfirmationStatus` (shared) ganhou `ON_THE_WAY`/`CHECKED_IN` (já existiam no
  `:app` e na web — drift puro).
- Gamification dark colors da web alinhadas ao canônico do Android.
- Variantes de `EmptyState` da web sincronizadas com Android (#2197).
- `useHapticFeedback` na web (#2218).
- Fix de bateria no pulso de badge + tokens em High-Contrast/OLED (#2183).
- `DESIGN_TOKENS.md` criado como fonte única (#2239, absorve #2236/#2195).

**Relacionado:** épico #2312; `DESIGN_TOKENS.md`.

---

### [2026-06-04] Entrar por convite via trigger server-side (Opção A) — #2515/#2516/#2517

**Contexto:** O fluxo de entrar por convite estava quebrado end-to-end. O gate
`is_public==true` no self-create MEMBER (adicionado por #2153 para fechar
escalada de acesso) tornava IMPOSSÍVEL entrar por convite em grupo PRIVADO — o
propósito do convite. A correção de #2153 previa "convite aprovado via trigger",
mas esse trigger nunca existiu (só join_request ganhou o seu, `onJoinRequestApproved`).

**Alternativas consideradas:**
- **A — trigger server-side `onInviteRedeemed`**: cliente só marca o invite
  `used`; trigger cria a membership via admin SDK (bypassa rules → funciona p/
  privado). Espelha `onJoinRequestApproved`.
- **B — relaxar a rule** para validar o invite via `get()`. Rejeitada: a rule de
  member-create não tem acesso ao code do convite (doc-id que o cliente possui,
  nunca recebido pela rule); exigiria acoplar o doc-id no member doc (frágil) e
  manteria o drift de schema web↔Android.

**Decisão:** **Opção A.** O trigger vira o único writer da membership de convite
(unifica schema), é server-authoritative e funciona p/ público e privado. O gate
`is_public==true` da rule fica INTACTO (governa só self-create direto do cliente,
exclusivo de grupo público) → **proteção de #2153 preservada** (provado por teste
de rules: self-create MEMBER sem convite em grupo privado FALHA).

**Justificativa / detalhes:**
- O trigger NÃO incrementa `member_count` nem seta `_counted_by_join_request`;
  deixa `onMemberWritten` fazer o único +1 (evita double-count / count=0).
- Membership virou assíncrona → ambos os clientes aguardam o member doc aparecer
  (listener web / polling Android, timeout ~8s) antes de resolver sucesso, p/
  evitar `PERMISSION_DENIED` na leitura de grupo privado pós-join.
- Convite **legado** (`groups.invite_code`) no Android permanece público-only
  (joiner não cria `invites/` p/ disparar trigger). Limitação herdada, não
  regressão. Web não suporta legado.
- Bug latente corrigido: o caminho Android antigo nunca marcava o convite `used`
  (single-use furado) — agora o update é o gatilho do trigger.

**Relacionado:** `specs/BUGFIX_2026-06-04_invite-join-private-groups.md`;
issues #2515/#2516/#2517; regressão de #2153; paridade com #611/#626.

---

## 2026-07-01 — Auth Overhaul: CNPJ por-request (não em users), Google linking client-only, grace banner removido (épico #3183)

**Contexto:** Auditoria completa de login/onboarding (4 agentes, web+Android+iOS+functions+rules) originou o épico #3183 (spec `SPEC_FEATURE_AUTH_OVERHAUL_CNPJ_GOOGLE_LINK.md`). Três decisões de design:

**1. CNPJ vive no request de onboarding comercial, não no doc `users`.**
CNPJ é PII empresarial e só é relevante no fluxo `venue_owner_onboarding`. Segue o padrão do CPF (decisão #1311): armazenado como hash (SHA-256 + `CPF_SALT` reutilizado, com prefixo de domínio `cnpj:` no input para evitar colisão de espaço com hashes de CPF) + `cnpj_index/{hash}` deny-all para unicidade transacional. Alternativa rejeitada: campo em `users` (amplia superfície de PII já problemática — #2630).

**2. Google account linking é 100% client-side (Firebase Auth nativo).**
`linkWithPopup`/`linkWithCredential` mantêm o mesmo uid — zero mudança em Firestore/functions. Guard de desvinculação: só permite `unlink('google.com')` se restar provedor `password`; telefone não conta como método primário de login. Alternativa rejeitada: merge server-side de contas distintas (já existe `requestAccountMerge` manual para colisão de telefone; escopo separado).

**3. Grace-period banner de verificação removido.**
`VerificationBanner` (countdown até 2026-08-03) era código morto: `ProtectedRoute` já redireciona `verified===false` incondicionalmente desde a Fase 5 do enforcement (#448). O hard gate é a política vigente; manter o banner só gerava mensagem contraditória.

**Relacionado:** épico #3183, issues #3184-#3191, `specs/SPEC_FEATURE_AUTH_OVERHAUL_CNPJ_GOOGLE_LINK.md`, decisões #1311 e #3137.

---

## 2026-07-03 — Rede social da pelada: denormalização de autor, soft-delete e toggles de notif (épico #3240)

**Contexto:** Specs DRAFT criadas para as duas issues `priority:high` do épico #3240 — chat por jogo (#3230, `feat-2026-07-03-game-chat-realtime.md`) e mural de provocações (#3232, `feat-2026-07-03-group-wall-banter.md`). Ambas compartilham decisões de modelagem de dados que vale registrar antes da implementação.

**1. Denormalização de `sender_name`/`author_name` + photo URL no momento da escrita.**
Snapshota-se nome e foto do autor no doc da mensagem/post, em vez de fazer join com `users/{uid}` ao renderizar. Pró: evita N reads de perfil em listas paginadas (chat com 50 msgs, mural com 20 posts → 50/20 reads economizadas por render). Contras aceitos: staleness se o usuário edita nome/foto depois (aceitável para conteúdo efêmero de pelada; perfil editado reflete em escritas futuras, não retroativas). Alternativa rejeitada: lookup on-the-fly por UID em cada item (custo proibitivo em listas + jank).

**2. Soft-delete em vez de hard-delete para chat e mural.**
Campos `deleted_by` + `deleted_at` (e `deleted_at == request.time` enforced em rules). Pró: preserva auditoria de moderação (quem deletou o quê, quando), contagem consistente, recuperação possível. UI filtra `deleted_at == null`. Hard-delete fica `allow delete: if false` em rules. Alternativa rejeitada: hard-delete direto (perda de trilha de moderação; dificulta investigar abuso).

**3. `created_at` forçado como `request.time` em rules (não confiar no client).**
Previne backdate tanto de mensagens de chat quanto de posts de mural. Já é prática do projeto em games (`isFutureGameDate`); estendida às novas subcoleções.

**4. Toggles de notificação `gameChat` e `groupWall` adicionados a `notification_settings` com default `true`.**
Mesmo padrão dos toggles existentes (`mvpVotes`, `achievements`, etc. em `useNotificationSettings.ts:12`). Usuário pode silenciar notifs de chat/mural sem desligar tudo. Alternativa rejeitada: notif sem toggle (ruído → churn).

**5. Mural reserva campo `reactions: map | null` vazio desde o MVP.**
A issue #3233 (reações genéricas) é dependência futura do mural. Em vez de bloquear o mural atrás de #3233, lança-se com campo reservado; quando #3233 mergear, `<ReactionBar />` passa a ler/escrever esse mapa. Evita migration posterior.

**6. Chat por jogo arquivado (só-leitura) 7 dias após `game.date_time`.**
Enforced em rules (`timestamp.value(game.date_time + 7d) > request.time` no `allow create`). Pró: contém crescimento da subcoleção, foca o chat na janela útil (coordenação + zoeira imediata pós-jogo). Contras aceitos: usuários perdedores de "memória" após 7 dias — mitigado pelo fato de highlights/fotos persistirem separadamente.

**Consequências:** Modelagem consistente entre as duas features; regras de rules padronizadas (soft-delete, `request.time`, denormalização); notifs respeitam toggle. Risco residual: staleness de nome/foto aceito como trade-off.

**Relacionado:** épico #3240, issues #3230 e #3232, `specs/feat-2026-07-03-game-chat-realtime.md`, `specs/feat-2026-07-03-group-wall-banter.md`.

---

## 2026-07-04 — Reações sociais unificadas: mapa de emoji para UIDs, 1 reação ativa por usuário (#3233/#3240)

**Contexto:** O mural (#3232) já reserva `reactions`, e o épico social #3240
define #3233 como fundação para posts, fotos, highlights e futuramente MVP
(#3239). Era necessário fixar um modelo simples antes de criar componentes
web/Android e rules.

**Decisão:** Usar campo embutido `reactions: { emoji: [uid, ...] }` no documento
alvo, com lista curada de emojis (`🔥`, `😂`, `👏`, `😡`, `💀`, `🤡`, `👑`, `⚽`)
e no máximo **1 reação ativa por usuário por conteúdo**. A troca de reação
remove o UID de todos os emojis permitidos e adiciona ao emoji novo usando
operações atômicas `arrayRemove`/`arrayUnion`.

**Justificativa:** O modelo reaproveita o campo já reservado em `wall_posts`,
evita subcoleções e reads extras no MVP, e é suficiente para interações leves.
`arrayUnion`/`arrayRemove` reduz race condition em relação a read-modify-write.
Se conteúdos passarem de ~100 reações com frequência, migrar para subcoleção
`reactions/{uid}` com agregados por emoji.

**Consequências:** Rules devem permitir um ramo de update que altera somente
`reactions`, separado de texto/pin/soft-delete. UI deve mostrar top 3 emojis +
total e destacar a reação do usuário. MVP/Bola Murcha consome esta base em
#3239, não nesta issue.

**Relacionado:** specs/feat-2026-07-04-unified-reactions.md, #3233, #3239,
#3240.

---

## 2026-07-04 — Comentários livres em jogos: subcoleção persistente separada de recados (#3234/#3240)

**Contexto:** O jogo já possui chat em tempo real (`games/{gameId}/chat`) e
recados pós-jogo 1-por-usuário (`post_game_messages`), mas nenhum deles serve
como thread persistente de comentários. A issue #3234 pede uma base reutilizável
para conversas sobre jogos e, depois, resultado MVP/Bola Murcha (#3239).

**Decisão:** Criar `games/{gameId}/comments` como subcoleção própria, com
campos snake_case, denormalização de autor, `parent_id` opcional para 1 nível de
resposta, soft-delete e hard-delete bloqueado. `post_game_messages` permanece
inalterado como recado destacado; não haverá migração nesta entrega.

**Justificativa:** Separar os conceitos evita quebrar UX existente: chat segue
efêmero/coordenação, recado segue destacado por usuário, comentários viram
memória social do jogo. A topologia sob `games/{gameId}` permite copiar o gate
de acesso do chat e mantém rules localizadas.

**Consequências:** Rules precisam de ramos separados para criar, editar texto e
soft-delete. UI deve filtrar deletados e tratar loading/error/empty/success.
Comentários em mural e resultado de votação consomem esta base em issues
posteriores.

**Relacionado:** specs/feat-2026-07-04-game-comments-thread.md, #3234, #3239,
#3240.

---

## 2026-07-04 — Seguir jogadores via callable transacional, não batch client-side (#3235/#3240)

**Contexto:** O épico social #3240 precisa de um grafo de relações para
alimentar o feed futuro (#3236). A issue #3235 propôs `following`/`followers`
espelhados e contadores em `users`, mas deixou em aberto se a escrita seria por
batch client-side ou Cloud Function.

**Decisão:** Usar callable `toggleFollowUser` com Admin SDK e transaction para
criar/remover `users/{uid}/following/{targetUid}`,
`users/{targetUid}/followers/{uid}` e ajustar `following_count` /
`followers_count`. Firestore rules bloqueiam writes client-side nessas
subcoleções; clientes apenas leem e chamam a function.

**Justificativa:** Contadores incrementados pelo cliente são frágeis em retries
e exigiriam rules permitindo que um usuário altere contador de outro. A
transaction server-side torna follow/unfollow idempotente e estreita a
superfície de segurança.

**Consequências:** Web/Android precisam chamar a function para mutação. Rules
devem cobrir leitura autenticada e writes negados. #3236 pode consultar
`following` como fonte de quem o usuário segue.

**Relacionado:** specs/feat-2026-07-04-follow-system.md, #3235, #3236, #3240.

---

## 2026-07-04 — Feed social usa agregação client-side de murais, sem coleção global (#3236/#3240)

**Contexto:** O mural por grupo (`groups/{groupId}/wall_posts`) já cobre UGC,
mídia, pin, soft-delete e reações. A issue #3236 pede uma Home social agregada,
mas criar uma coleção raiz `posts` abriria superfície nova de moderação, rules,
fan-out e produto.

**Decisão:** Entregar primeiro a Opção A: feed social client-side que consulta
`collectionGroup('wall_posts')` com `where('group_id', 'in', chunkDeAte10)` e
`orderBy('created_at', 'desc')`, mescla os chunks no cliente e reusa
`WallPostCard`. Posts globais fora de grupo ficam fora desta issue.

**Justificativa:** A opção reaproveita infraestrutura já testada do mural, limita
exposição a grupos onde o usuário é membro e evita desenhar moderação pública
antes de existir necessidade de produto.

**Consequências:** É necessário índice de collection group para `wall_posts`
por `group_id` + `created_at desc`, rules específicas para collection group e
paginação inicialmente limitada por chunk/fonte, não por cursor global perfeito.

**Relacionado:** specs/feat-2026-07-04-social-feed.md, #3236, #3235, #3240.

---

## 2026-07-04 — Jogadores próximos só via callable com opt-in e distância aproximada (#3237/#3240)

**Contexto:** A issue #3237 pede descoberta de jogadores por proximidade, mas
localização cria risco real de LGPD e stalking se coordenadas de usuários
ficarem consultáveis diretamente em `users`.

**Decisão:** Usar opt-in explícito em `user_locations/{uid}` com
`location_sharing_enabled`, `location_consent_at`, `location_updated_at`,
`geohash`, `lat` e `lng`, e bloquear leitura direta de coordenadas por
terceiros nas rules. Embora a issue sugerisse campos em `users`, esse doc ainda
e legivel para perfis `is_searchable` e Firestore Rules nao fazem mascara por
campo; separar em `user_locations` evita o vazamento. A descoberta será feita exclusivamente pela callable
`discoverNearbyPlayers`, protegida por auth, App Check e rate-limit, retornando
somente perfil público mínimo e distância aproximada/faixa.

**Justificativa:** O cliente precisa escrever a própria localização para ativar
a descoberta, mas não deve ter permissão de consultar localização exata de
outros jogadores. Centralizar a query no server permite validar raio, truncar a
exposição, filtrar usuários inativos/deletados, aplicar limite de custo e
registrar logs sem PII.

**Consequências:** O release da feature depende de atualização da política de
privacidade, strings de consentimento e testes de rules provando que coords de
terceiros não vazam. Não haverá tracking em background; apenas localização em
foreground no opt-in/refresh manual.

**Relacionado:** specs/feat-2026-07-04-nearby-players.md, #3237, #3235, #3240.

---

## 2026-07-04 — Vídeos curtos usam ffmpeg estático sem ffprobe-static (#3238/#3240)

**Contexto:** Videos anexados a jogos trazem risco de custo de Storage/egress e
risco operacional em Cloud Functions por depender de ffmpeg/ffprobe para
validar MIME/duracao real e gerar thumbnail. A issue #3238 marca esse spike
como pre-requisito antes de codar UI.

**Decisão:** Aprovar a spec usando `@ffmpeg-installer/ffmpeg` como binário
determinístico para Functions v2 Node 22, sem `ffprobe-static` (descartado pelo
tamanho). A duração real será extraída do stderr do próprio ffmpeg, e a função
de thumbnail ficará separada em `functions/src/storage/generate-video-thumbnails.ts`
com memória/timeout explícitos.

**Justificativa:** Depender do ffmpeg presente no runtime seria frágil; empacotar
ffprobe-static adicionaria ~351MB. O pacote ffmpeg Linux x64 fica na ordem de
~68MB, aceitável para a função isolada, e evita uma dependência pesada extra.

**Relacionado:** specs/feat-2026-07-04-game-videos.md, #3238, #3240.

---

## 2026-07-10 — Live Game usa lifecycle servidor, limite de 500 eventos e encerramento de voto por gestor (#3495)

**Contexto:** Placar, eventos e votação precisam permanecer consistentes entre
clientes simultâneos, inclusive durante retries e na transição para o resultado
final. Agregar uma timeline ilimitada dentro da finalização aumentaria tempo,
memória e quantidade de writes de uma única chamada.

**Decisão:** `startGameLifecycle` aceita somente jogos `CONFIRMED`; jogos
`SCHEDULED` precisam ter a lista fechada antes de entrar em `LIVE`.
`finishGameLifecycle` adquire um lock transacional, bloqueia eventos concorrentes
e agrega no máximo 500 eventos oficiais. Acima disso, libera o lock e retorna
erro operacional sem finalizar parcialmente. O encerramento da votação continua
explícito e restrito a owner, coorganizador ou admin; qualquer eleitor pode votar,
mas não pode publicar o resultado.

**Justificativa:** A transição explícita preserva o estado da lista e a formação
dos times. O teto cobre com ampla margem uma partida comum e evita uma transação
de finalização sem limite. Restringir a conclusão mantém a publicação do resultado
sob autoridade do gestor, enquanto `voting_submitted_count` e listeners oferecem
feedback em tempo real.

**Consequências:** Formatos futuros com mais de 500 eventos devem adotar
compactação/paginação antes de elevar o teto. A UI deve explicar a transição
`CONFIRMED → LIVE`, manter CTA de encerramento para gestores e nunca escrever
placar, eventos oficiais ou agregados de votação diretamente pelo cliente.

**Relacionado:** #3495, PR #3496.

---

## 2026-07-13 — Checkpoint transacional por chunk no batch FCM (#3585/#3594)

**Contexto:** O envio FCM é um efeito externo que não pode participar da mesma
transação do documento da fila. Persistir progresso somente ao terminar todos
os chunks fazia o cleanup reabrir um lote sem conhecer chunks já confirmados.

**Decisão:** Registrar todos os tokens como pendentes antes do envio e, após
cada resposta de até 500 tokens, fazer uma transação curta que une tokens
entregues e substitui o conjunto pendente pelo restante mais falhas
transientes. Falha no checkpoint interrompe o processamento antes do próximo
chunk. A métrica de usuários alvo passa a ser derivada de um conjunto global
dos usuários aprovados por preferência.

**Consequências:** Cada chunk adiciona uma leitura e uma escrita Firestore. A
retomada não duplica chunks já persistidos, mas permanece a janela inerente
entre confirmação do FCM e commit Firestore, pois não existe exactly-once
distribuído entre os dois serviços.

**Relacionado:** specs/BUGFIX_2026-07-13_batch-notification-durability.md,
#3585, #3594.

---

## 2026-07-13 — Ownership de grupo exige coerência atômica entre grupo e memberships (#3589/#3592/#3601)

**Contexto:** Os clientes Web e Android transferem propriedade em um único
batch/transação, mas as Rules não vinculavam `groups/{id}.owner_id` aos papéis
dos dois memberships. Ao mesmo tempo, uma condição invertida bloqueava
promoções/rebaixamentos comuns e o ADMIN não-owner não conseguia aplicar o
soft-delete `REMOVED` esperado pelos clientes.

**Alternativas consideradas:**
1. Trocar apenas `resource.data.role` por `request.resource.data.role`. Corrige
   parte das ações, mas permitiria promover um segundo OWNER sem garantir a
   troca de `owner_id` e não evitaria transferência parcial.
2. Mover toda gestão de papéis para uma nova Cloud Function. Centraliza o fluxo,
   porém quebra os clientes atuais e amplia o escopo da correção.
3. Modelar transições nas Rules e usar `getAfter()` para exigir, no mesmo commit,
   novo `owner_id`, novo membership OWNER e rebaixamento do antigo OWNER.

**Decisão:** Adotar a opção 3. Trocas comuns ficam limitadas a `MEMBER <-> ADMIN`
e somente o OWNER atual pode fazê-las. Transições envolvendo `OWNER` exigem a
transferência atômica completa. ADMIN não-owner pode alterar status apenas de
MEMBER comum, inclusive para `REMOVED`; OWNER e ADMIN ficam protegidos contra
moderação por autoridade equivalente.

**Justificativa:** A solução preserva os fluxos já atômicos dos dois clientes,
corrige o fail-closed sem reduzir a autorização e torna o documento do grupo e
a membership canônica mutuamente coerentes.

**Consequências:** Qualquer cliente futuro que transfira ownership precisa
escrever grupo, novo OWNER e antigo OWNER no mesmo commit. Mudanças de role
isoladas para `OWNER` são deliberadamente negadas. O ADMIN global continua
podendo moderar metadados, mas não pivota `owner_id` pelo cliente; recovery
excepcional usa Admin SDK. O deploy deve incluir Firestore Rules e release
notes consolidadas para Web/Android.

**Relacionado:** `specs/BUGFIX_2026-07-13_group-member-role-rules.md`, #3589,
#3592, #3601.

---

## 2026-07-13 — Bola Murcha não desempata e ballot proíbe conflito positivo/negativo (#3590/#3598)

**Contexto:** O desempate alfabético usado nas categorias positivas também
escolhia um Bola Murcha em empate exato e aplicava penalidade. Além disso, votos
por categoria podiam apontar o mesmo jogador como destaque e Bola Murcha.

**Decisão:** `WORST` não terá vencedor em empate exato. `MVP` e
`BEST_GOALKEEPER` preservam o desempate determinístico e podem eleger o mesmo
goleiro. A autoridade server-side rejeita ballots onde `WORST` e qualquer
categoria positiva apontem para o mesmo jogador, inclusive entre chamadas
separadas; a Web apenas antecipa essa validação com feedback acessível.

**Justificativa:** Uma penalidade exige vantagem real de votos, enquanto o
desempate de uma recompensa mantém o resultado publicável. Validar o ballot no
servidor impede bypass e manter MVP/Goalkeeper compatíveis preserva a regra atual.

**Consequências:** Empates em Bola Murcha concluem com `worst_player_id` ausente,
flags negativas falsas e sem delta de XP. Não há migração retroativa de ballots
contraditórios já armazenados.

**Relacionado:** specs/BUGFIX_2026-07-13_voting_semantics.md, #3590, #3598.

---

## 2026-07-13 — SecureStorage iOS usa AfterFirstUnlockThisDeviceOnly sem access group (#3609)

**Contexto:** O wrapper KMP do Keychain descartava `OSStatus`, usava
delete+add e deixava a acessibilidade no default `WhenUnlocked`. O projeto nao
possui arquivo `.entitlements`, `CODE_SIGN_ENTITLEMENTS` ou requisito de
compartilhamento de credenciais entre apps.

**Decisao:** Novos itens e updates usam
`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`. Falhas diferentes de item
ausente sao propagadas com operacao e codigo, sem chave/valor. O app continua
no Keychain padrao do bundle, sem adicionar `keychain-access-groups`.

**Justificativa:** O modo escolhido permite leitura em background depois do
primeiro desbloqueio e impede que tokens/credenciais sejam restaurados em outro
aparelho. Inventar um access group sem provisioning correspondente criaria o
proprio `errSecMissingEntitlement` que a correcao precisa diagnosticar.

**Consequencias:** Migracao para outro aparelho exige reautenticacao. Um access
group futuro deve ser introduzido junto com entitlement, App ID/provisioning e
validacao em device assinado.

**Relacionado:** specs/BUGFIX_2026-07-13_IOS_SECURE_STORAGE_KEYCHAIN_3609.md,
#3609.

---

## 2026-07-13 — Retry de check-in QR exige nova ação, mas preserva token validado (#3612)

**Contexto:** Falhas transitórias de GPS ou do callable obrigavam o usuário a
ler novamente o mesmo QR, embora o token já tivesse passado pela validação
cliente. Reexecutar automaticamente, por outro lado, poderia duplicar chamadas
durante recuperação de rede ou cliques concorrentes.

**Decisão:** Após erro operacional, preservar `gameId`, token e nome do jogo,
mas retornar à confirmação somente por `Tentar novamente`. O retry não chama
GPS nem backend; uma nova confirmação executa o fluxo completo. Uma trava
síncrona por referência complementa o loading visual. Erros da validação inicial
continuam sem retry porque seus dados não foram aceitos.

**Consequências:** O usuário recupera falhas transitórias sem novo scan, enquanto
token, status, janela, localização, raio e idempotência continuam sob autoridade
do callable `checkInToGame`. A Web não cria uma segunda escrita de check-in.

**Relacionado:** `specs/BUGFIX_2026-07-13_web-checkin-recovery.md`, #3612.

---

## 2026-07-13 — Divisões da Liga usam contrato canônico PT com aliases somente na leitura (#3611)

**Contexto:** Functions e KMP persistem `BRONZE/PRATA/OURO/DIAMANTE` na escala
de rating 0–100, enquanto o Web mantinha seis tiers em inglês e fazia cast sem
validação. Valores canônicos acima de Bronze caíam no fallback visual Bronze.

**Decisão:** O contrato do Web passa a conter somente as quatro chaves
canônicas. A compatibilidade com dados antigos é feita por um normalizador na
leitura: `SILVER→PRATA`, `GOLD→OURO` e `DIAMOND/PLATINUM/CHAMPION→DIAMANTE`.
Valores desconhecidos fazem fallback para Bronze. A normalização não escreve
de volta no Firestore; qualquer migração persistente futura exige operação
administrativa separada e auditável.

**Consequências:** Tipos, ordem, thresholds, cores e chaves i18n do Web ficam
alinhados ao produtor servidor e ao KMP. O Web deixa de inferir divisão a partir
de pontos sazonais; progresso entre divisões só pode usar o rating 0–100 quando
esse campo estiver disponível. Testes de contrato protegem as quatro chaves e
os aliases legados.

**Relacionado:** `specs/BUGFIX_2026-07-13_league-division-contract.md`, #3611.

---

## 2026-07-13 — Labels traduzidos não alteram enums canônicos de perfil e grupo (#3614/#3616)

**Contexto:** Categorias de grupos oficiais e preferências de campo/posição são
persistidas como enums canônicos, mas algumas telas exibiam labels PT-BR vindas
diretamente de constantes ou literais. Traduzir o valor persistido quebraria
consultas e compatibilidade entre clientes.

**Decisão:** Manter `OfficialGroupCategory`, `preferred_position` e
`preferred_field_types` inalterados e resolver somente seus labels no limite da
UI via i18next. A descoberta usa as chaves canônicas das categorias como sufixo
de tradução; o onboarding traduz labels sem modificar os valores enviados.

**Consequências:** Trocar o locale muda apenas apresentação e acessibilidade.
Firestore, Functions, Rules e clientes mobile continuam recebendo os mesmos
enums. Novas categorias precisam adicionar a mesma chave aos três catálogos.

**Relacionado:** `specs/BUGFIX_2026-07-13_web-discovery-profile-i18n.md`,
#3614, #3616.

---

## 2026-07-13 — GameDetail serializa intenção de presença e mantém servidor autoritativo (#3642/#3643/#3645)

**Contexto:** O detalhe do jogo tratava convite pendente como ausência de
confirmação, não bloqueava toques concorrentes e ignorava falhas ao remover
jogadores. Snapshots em tempo real também podiam reconstruir a tela durante uma
mutação e apagar flags transitórias.

**Decisão:** Modelar confirmar, aceitar, cancelar/recusar e remover como mutações
explícitas. O ViewModel mantém um job de presença e jobs de remoção por jogador,
preserva flags entre snapshots e expõe loading/erro/retry. Remoção requer dialog
e só altera a lista local após `Result.success`. A confirmação continua na
callable `confirmGamePresence`, com documento determinístico e validação servidor;
o lock cliente é proteção de interação, não fonte de autoridade.

**Consequências:** Convite `PENDING` é recusado por cancelamento explícito,
toques repetidos não criam coroutines concorrentes, falhas permanecem visíveis e
repetíveis, e o organizador não perde a ordem de chegada por toque acidental.

**Relacionado:** `specs/BUGFIX_2026-07-13_game-presence-mutations.md`, #3642,
#3643, #3645.

---

## 2026-07-13 — Ações visuais Web usam controles semânticos canônicos (#3625/#3626/#3628)

**Contexto:** Miniaturas de fotos e o cartão de nível dependiam de `onClick` em
containers sem semântica, enquanto o favorito de local não expunha nome/estado
acessível reativo. Na galeria de jogo, transformar o container inteiro em botão
criaria um botão de exclusão aninhado inválido.

**Decisão:** Miniaturas usam `ButtonBase`, o cartão de nível usa
`CardActionArea` e a exclusão permanece uma ação irmã da miniatura. O favorito
expõe rótulo traduzido e `aria-pressed`, com o estado local sincronizado após a
persistência no `localStorage`. O `Dialog` do MUI preserva trap e restauração de
foco ao acionador.

**Consequências:** Clique, toque, Enter e Espaço disparam a mesma ação uma única
vez; Escape fecha o lightbox e devolve o foco; tecnologias assistivas recebem
nomes em PT-BR, inglês e espanhol. Payloads, limites e chaves persistidas não
mudam.

**Relacionado:** `specs/BUGFIX_2026-07-13_web-keyboard-accessibility.md`, #3625,
#3626, #3628.

---

## 2026-07-14 — Slugs conhecidos precedem heurística de ID e medalhas são superfícies (#3629/#3646)

**Contexto:** Slugs estáticos longos eram indistinguíveis de IDs pela heurística
de comprimento dos breadcrumbs, e tokens claros de medalha eram usados como
primeiro plano sobre cards claros.

**Decisão:** Caminhos e sub-rotas registrados são resolvidos antes da heurística
de ID; um ID sem pai dinâmico conhecido é omitido, nunca usado como label. As
rotas estáticas irmãs ficam declaradas antes das parametrizadas. No ranking, o
token gold/silver/bronze vira a superfície de um badge e o troféu recebe
`palette.getContrastText()`.

**Consequências:** Breadcrumbs preservam labels PT-BR/en/es sem expor IDs ou
slugs internos. Os tokens canônicos de gamificação não mudam e o troféu mantém
contraste mínimo em light, dark e dark OLED.

**Relacionado:** `specs/BUGFIX_2026-07-14_ranking-contrast-breadcrumbs.md`,
#3629, #3646.
---

## 2026-07-14 — Convite pendente não abre grupo privado antes do aceite (#3641)

**Contexto:** O corpo do card de convite caía em um `else` vazio. O
`referenceId` dessa notificação contém `inviteId`, não `groupId`; além disso, o
convidado ainda não é membro e as regras não permitem ler detalhes de grupo
privado antes do aceite.

**Decisão:** O ViewModel passa a tratar todo clique de notificação. Referências
`game` e `group` com ID válido emitem suas rotas. Para `invite`, o corpo exibe
orientação localizada para usar Aceitar/Recusar; esses botões continuam
processando o convite pelo `InviteRepository`. Referências ausentes ou
desconhecidas exibem erro, nunca no-op.

**Consequências:** Nenhum `inviteId` é usado como `groupId`, convites privados
não terminam em uma tela sem permissão e todo toque tem resultado observável.
Após o aceite, o usuário já membro pode acessar o grupo pelos fluxos normais.

**Relacionado:** `specs/BUGFIX_2026-07-14_android-navigation-dead-ends.md`,
#3633, #3638, #3641.
---

## 2026-07-14 — Enums Android guardam IDs de recursos, não texto localizado (#3617/#3618/#3620/#3624)

**Contexto:** Enums de estatística, avatar e streak misturavam identidade e
dados canônicos com labels PT-BR. O menu de gestão de membros também construía
ações reutilizáveis com literais Kotlin.

**Decisão:** Enums de apresentação Android passam a guardar `@StringRes Int` e
os Composables resolvem o texto no locale ativo. Identidade (`name`), cores,
ícones, limites e callbacks permanecem canônicos. Modelos genéricos que aceitam
texto dinâmico, como `UserCardMenuItem`, continuam com `String`; a fábrica
Compose resolve o recurso antes de instanciá-los.

**Consequências:** Labels podem variar por locale sem alterar payloads ou
persistência. Toda nova chave desta frente precisa existir em PT-BR, inglês e
espanhol, protegida por teste de paridade. Requisitos de desbloqueio de avatar
também usam IDs de recursos para que um uso futuro já nasça localizável.

**Relacionado:** `specs/BUGFIX_2026-07-14_android_enum_labels_i18n.md`, #3617,
#3618, #3620, #3624.
---

## 2026-07-14 — GameDetail Android apresenta votação pós-jogo sem alterar autoridade (#3644)

**Contexto:** O ViewModel já consultava `hasVoted`, mas o único acesso à
votação ficava no overflow e o resultado da consulta era descartado pela UI.

**Decisão:** Jogos `FINISHED` exibem um card primário quando o voto está
pendente e uma confirmação persistente quando já foi registrado. O overflow
continua como atalho secundário e reflete o mesmo estado. `null` é apresentado
como pendente para manter uma saída recuperável; elegibilidade e submissão
continuam sob autoridade do fluxo de votação existente.

**Consequências:** A descoberta do pós-jogo deixa de depender do overflow sem
criar uma segunda escrita ou contrato de votação. Falhas/expiração permanecem
tratadas pela tela de votação. A exclusão reversível também passa a ser descrita
como exclusão, alinhada ao Web, sem modificar `softDeleteGame`.

**Relacionado:** `specs/BUGFIX_2026-07-14_ANDROID_GAME_DETAIL_UX.md`, #3632,
#3635, #3639, #3644.

---

## 2026-07-14 — App Links convertem URLs externas em rotas internas seguras (#3640)

**Contexto:** O Web compartilhava links HTTPS de jogo, check-in e convites, mas
o Android não declarava associação com o domínio e a Activity Compose não podia
ser iniciada pelo sistema.

**Decisão:** Associar `futebadosparcas.web.app` ao pacote Android por
`assetlinks.json` e `autoVerify`, processar cold/warm start na Activity
`singleTop` e centralizar validação no `DeepLinkHelper`. Dados externos nunca
viram rotas diretamente: IDs são codificados, token de check-in é descartado da
rota e códigos de convite abrem apenas destinos nativos seguros já existentes.

**Consequências:** Links verificados abrem o app instalado e jogos/check-ins
chegam ao detalhe correto. Convites chegam a Grupos/Home sem confundir código
com ID; aceitar convite por código continua sendo capacidade exclusiva do Web
até existir uma tela nativa autoritativa dedicada.

**Relacionado:** `specs/BUGFIX_2026-07-14_android_verified_app_links.md`, #3640.

---

## 2026-07-14 — Caixa do Grupo é o título financeiro canônico (#3637)

**Contexto:** A mesma superfície financeira era intitulada "Caixinha do Grupo"
no Android e "Caixa do Grupo" no Web, enquanto outras strings Android também já
usavam a segunda forma.

**Decisão:** Usar "Caixa do Grupo" como título canônico PT-BR. Inglês e espanhol
recebem equivalentes naturais (`Group Cashbox` e `Caja del grupo`). A decisão
altera somente a copy apresentada; nomes de coleção, modelos, rotas e payloads
permanecem inalterados.

**Consequências:** Android e Web exibem o mesmo título em PT-BR e os três locales
Android deixam de depender do fallback em português para essa tela.

**Relacionado:** `specs/BUGFIX_2026-07-14_android-accessibility-copy.md`, #3637.

---

## 2026-07-14 — Histórico de busca Android é local, real e isolado por UID (#3627)

**Contexto:** A busca global já possuía persistência DataStore no ViewModel, mas
a tela ignorava essa fonte e apresentava histórico e buscas populares fictícios.
A preferência existente também era global ao app, o que permitiria que uma conta
visse termos pesquisados por outra conta no mesmo dispositivo.

**Decisão:** O `GlobalSearchViewModel` é a única fonte da busca e persiste até dez
termos em uma chave DataStore derivada do UID autenticado. Sem UID não há leitura
nem escrita. A seção de buscas populares é removida até existir uma fonte real e
confiável; nenhum dado curado será apresentado como comportamento do usuário.

**Consequências:** Histórico continua disponível offline, não cruza contas e a
tela vazia deixa explícito quando ainda não há buscas. A chave global legada não
é lida, evitando transformar dados potencialmente cruzados em histórico válido.

**Relacionado:** `specs/BUGFIX_2026-07-14_android-home-search-state.md`, #3627.

---

## 2026-07-14 — Disponibilidade de quadra é uma projeção sanitizada (#3688)

**Contexto:** A timeline consultava `games` diretamente. Como regras do
Firestore autorizam a consulta inteira, e não filtram cada resultado, um jogo
privado alheio ou soft-deleted causava `permission-denied` para toda a agenda.

**Decisão:** A disponibilidade passa a ser lida pelo callable autenticado
`getFieldAvailability`. O servidor consulta os jogos com Admin SDK, aplica os
status bloqueantes e devolve exclusivamente data, minuto inicial e minuto final.
App Check é exigido em produção e a janela máxima é de 60 dias.

**Consequências:** Slots privados continuam ocupando a quadra sem revelar ID,
grupo, dono, título ou visibilidade. A timeline deixa de depender de regras como
filtro e perde atualização push em tempo real; ela refaz a leitura quando seus
parâmetros mudam. O submit realiza nova leitura sanitizada do dia para não
depender do estado anterior da timeline.

**Relacionado:** `specs/BUGFIX_2026-07-14_FIELD_AVAILABILITY_PROJECTION.md`,
#3688.

---

## 2026-07-16 — Persistência de scroll é adiada, mas nunca descartada (#3792)

**Contexto:** O listener de scroll serializava e escrevia todo o mapa de posições
no `sessionStorage` em cada evento, introduzindo I/O síncrono no caminho de
renderização.

**Decisão:** Manter somente a posição mais recente em memória durante o gesto e
persisti-la após 150 ms sem novos eventos. O cleanup da rota e `pagehide` fazem
flush imediato, preservando restauração em navegação e encerramento da página.

**Consequências:** Um gesto contínuo produz uma única gravação ao terminar; troca
de rota e fechamento não perdem a última posição conhecida. O formato e a chave
do armazenamento permanecem compatíveis.

**Relacionado:** `specs/BUGFIX_2026-07-16_web-interaction-performance.md`, #3792.

---

### [2026-07-16] Identidade estável e anúncio derivado na navegação web

**Contexto:** O Command Palette vinculava rotas a rótulos em PT-BR, enquanto o
anúncio acessível dependia de `document.title` atualizado por outro efeito. O
foco também aguardava um atraso visual fixo de 320 ms.

**Alternativas consideradas:**
1. Manter rótulos como chave e duplicar mapas por idioma — frágil e sujeito a divergência.
2. Aguardar o efeito de SEO com outro temporizador — mantém a corrida e acopla acessibilidade a animações.
3. Usar IDs estáveis, título derivado da rota e foco no próximo frame — comportamento determinístico.

**Decisão:** Comandos rápidos usam IDs estáveis; o anúncio vem de
breadcrumbs/itens de navegação; o foco é aplicado com `requestAnimationFrame`.

**Justificativa:** Texto traduzido deixa de controlar comportamento, o anúncio
não depende da ordem de efeitos e a navegação assistiva não espera a animação.

**Relacionado:** `specs/BUGFIX_2026-07-16_web-a11y-i18n-navigation.md`, #3766,
#3784 e #3788.

---

### [2026-07-16] Breadcrumbs usam metadados publicados pelas telas

**Contexto:** Nomes de entidades estavam disponíveis nas telas, mas o breadcrumb
global conhecia apenas a URL. Consultar Firestore novamente duplicaria custo;
ler caches por chaves privadas acoplaria a navegação à implementação dos hooks.

**Alternativas consideradas:**
1. Novas leituras Firestore no hook — maior custo e listeners duplicados.
2. `queryClient.getQueryData` com listas de chaves — frágil e incompleto para hooks sem TanStack Query.
3. Provider de metadados alimentado pelas telas — sem I/O e independente da camada de dados.

**Decisão:** Telas publicam `tipo + id + nome` em um cache de navegação em memória;
o auto-breadcrumb consome esse cache e mantém fallback traduzido quando vazio.

**Justificativa:** Reaproveita dados já autorizados e carregados, funciona com
qualquer fonte e permite compartilhar o nome entre rotas durante a sessão.

**Relacionado:** `specs/BUGFIX_2026-07-16_web-route-context.md`, #3777, #3781.

---

## 2026-07-19 — XP pós-jogo permanece agregado e usa calendário BRT (#3846)

**Contexto:** O épico de Gamificação 2.0 propõe novos bônus por performance,
retorno, frequência e contribuição. O pipeline atual garante idempotência com
um único `xp_log` determinístico por jogo e jogador, enquanto streaks e seasons
já usam `America/Sao_Paulo`.

**Decisão:** Manter um único breakdown agregado por jogo+jogador e acrescentar
campos opcionais para cada bônus. Todos os marcadores mensais usam
`America/Sao_Paulo`; o bônus de primeira partida do mês incrementa XP global e
não redefine a competição sazonal. O processamento continua exclusivo do
backend na primeira transição válida para `FINISHED`, sem backfill.

**Consequências:** Retries compartilham o guard idempotente existente, clientes
antigos ignoram campos desconhecidos e a virada de mês segue uma única regra.
Qualquer evolução para ledger por ação ou season XP real exigirá spec e
migração próprias.

**Relacionado:** `specs/feat-2026-07-19-xp-performance-aderencia.md`,
#3846–#3856.

---

<!-- Adicione novas decisões acima desta linha -->
