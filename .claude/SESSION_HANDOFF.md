# Session Handoff — 2026-05-05 (overnight session: 19 PRs merged)

## 🌙 Overnight session (2026-05-04 → 05)

**19 PRs mergeadas + deployed sem intervenção:**

### Phone+CPF anti-bot epic (#443) — 5/6 fases concluídas
- #450 Fase 1 Foundation (CPF validators 4 plataformas + verifyCpf/setUserVerified callables + secrets)
- #451 Fase 2 Web (PhoneVerificationScreen + CpfVerificationScreen + ProtectedRoute guard)
- #452 Fase 3 Android (KMP CpfValidator + Compose screens + Koin VMs)
- #456 Fase 5 Enforcement (isVerifiedOrGrace() em rules + 30-day grace 2026-06-04)
- #457 Android VerificationBanner companion
- #458 Fase 6 Anti-abuse (canSendSmsOtp rate limit + logVerificationFailure)

Pendente: #447 iOS (BLOCKED por PHASE_4 CMP).

### Security audit fixes — 22 issues fechadas
**CRITICAL (4)**: #427 self-promote OWNER, #428 impersonation conf, #429 setUserRole token revoke, #438 conf field whitelist (PR #454)

**Backend hardening**: #435 originalError leak, #437 soft-delete App Check (PR #460)

**Game lifecycle**: #421/#422 backdating, #423 status transition, #424 cross-group create, #425 events volume, #426 server-side check-in, #430 temporal overlap (PRs #462, #464, #466, #467)

**Stats integrity**: #431 conf immutables, #434 owner stats whitelist, #440 reviews uniqueness (PRs #463, #464)

**Location anti-fraud**: #432, #436 mock GPS detection (PR #461)

**XP doc sync**: #439 (PR #465)

### P2 visual — 5 issues fechadas
- #413 BottomNav theme tokens
- #414 ROLE_CONFIG dedup
- #417 IconButton touch targets
- #418 LiveGame toasts especificos
- #419 Empty state CTA

### Tooling — 2 PRs novos
- #453 semantic-index.js (Ollama nomic-embed-text indexa specs+issues)
- #455 ollama-review.js (code review local privacy-first)

## ⚠️ Backlog deferred

- **#441** batch race idempotência — mitigado por trigger lock, refactor pendente
- **#442** lat/lng PII — refactor de read profile necessário
- **#433** is_searchable PII — denormalização users/private requer migração
- **#415** PlayerCard 30+ hex — refactor extenso
- **#416** Adaptive nav (NavigationRail tablet/desktop) — design decision

## 🤖 Ollama setup

**Modelos baixados (tunados pra este Mac M-series):**
- nomic-embed-text (274 MB) - EN embeddings
- bge-m3 (1.2 GB) - multilíngue PT-BR
- llama3.2:3b (2 GB) - small fast
- qwen2.5-coder:7b (4.7 GB) - code review
- deepseek-r1:7b (4.7 GB) - reasoning
- gemma4:e4b (9.6 GB)
- phi-4:14b-q4_K_M (9 GB) - reasoning médio
- gemma4:31b (19 GB)
- qwen3.6:35b (23 GB)

**Config**: OLLAMA_MAX_LOADED_MODELS=2, OLLAMA_NUM_PARALLEL=2 (launchctl persist).

**Skill nova**: `futeba-ollama` (.claude/skills/futeba-ollama/SKILL.md) — guia completo de uso.

**Helpers**:
- `node scripts/semantic-index.js [index|query|stats]`
- `git diff | node scripts/ollama-review.js [--reasoning]`

## 📊 Estado pós-overnight

| Item | Estado |
|------|--------|
| Master HEAD | `8b85aac` |
| PRs abertos | 0 |
| Issues abertas | 5 (defer) + #443 EPIC + #447 iOS blocked |
| Hosting | 🟢 LIVE |
| Cloud Functions | 50+ deployed (incluindo verifyCpf, setUserVerified, canSendSmsOtp, logVerificationFailure, onConfirmationCreated, checkInToGame, onGameEventCreated) |
| Custom Claims | `verified` setado pós-onboarding |
| Firestore Rules | enforcement Phone+CPF (grace 30d) + helpers isFutureGameDate, isValidGameStatusTransition |

---



Consolidação completa para próxima sessão Claude Code começar saudável.

## 🟢 Estado final

| Item | Estado |
|------|--------|
| **Master HEAD** | `a765c36` (#405 CodeQL Java drop + JS/TS only) |
| **PRs abertos** | 0 |
| **Issues abertas** | 0 |
| **Hosting** | 🟢 200 OK — https://futebadosparcas.web.app |
| **Dependabot** | 1 medium (false positive `uuid` em backend — comprovado) |
| **Runners** | 2 online (Mac + Mac2), 6 idle dirs (~/actions-runner-3..8 sem service) |
| **RAM livre** | 10.2 GB |
| **Worktrees** | Limpas (apenas main repo) |
| **Branches locais** | Apenas `master` |
| **CodeQL** | ✅ JS/TS verde em master; Java desabilitado (decisão documentada) |

## ✅ O que foi feito (22 PRs total: #377-#405)

### Sessão 2026-05-03 (continuação) — PR #405
- Code Security habilitado no repo (Team plan inclui GHAS sem custo extra)
- node 25.9.0 instalado via brew (`/opt/homebrew/bin/node`) pra autobuild JS/TS
- Cleanup step no workflow: `rm -rf $RUNNER_TEMP/codeql_databases` antes do init
- Java/Kotlin removido do matrix CodeQL (incompat ARM64 documentado)
- 3 build-modes testados (manual/none/autobuild) antes do drop final

### Sessão original 2026-05-03 — 21 PRs (#377-#404)

### Segurança (Dependabot 47→1)
- #378 root deps (firebase-admin 10→13, jsonwebtoken)
- #379 backend deps (multer 1→2, typeorm bump, protobufjs critical)
- #380 + #384 wasm yarn.lock (resolutions via WasmYarnPlugin)

### Functions infra
- #385 lazy admin pattern + Node 22 + build config (rootDir + xp-constants copy)
- #393 testes legados fix (mvp-voting + user-management)
- #394 ESLint no-explicit-any + Auto Version Bump idempotência

### CI/CD
- #386 migrar workflows pra self-hosted Mac ARM64
- #388 fix script svc.sh sudo bug
- #389 → revertido por #404 (CodeQL self-hosted com Rosetta)
- #390 Claude bot allowed_bots
- #391 criar bump-version.js que faltava
- #395 + #399 + #400 + #401 fix action versions inválidas (artifact@v8, checkout@v6, setup-node@v6, github-script@v8)
- #392 web theme selector (closes issue #387)
- #383 fix Notifications + Statistics tests desatualizados
- #396 KMP iOS opt-in + types + abstract members
- #397 Xcode version 15.4 → latest-stable
- #398 quick wins (concurrency, timeouts, path filters, dedup steps)
- #402 perf optimizations (daemon reuse, gradle cache, dedup pr-check)
- #404 CodeQL self-hosted ARM64 (requer Rosetta 2 — instalada localmente)

### Docs / outros
- #377 CLAUDE.md completar (backend, iOS, fastlane, arquivos raiz)
- #381 CHANGELOG security entries

## ⚠️ Conhecidos pendentes

1. **CodeQL Java/Kotlin desabilitado em macOS ARM64** (PR #405, 2026-05-03):
   - Tracer `libtrace.dylib` é x86_64-only e não injeta em JDK ARM64 nativo
   - Build-modes testados: `manual` (no source seen), `none` (Kotlin não suportado), `autobuild` (falha em deps wasm)
   - JDK x86_64 + Rosetta inviável: runner só tem Temurin 17 ARM64
   - Pipeline atual roda apenas JavaScript/TypeScript (cobre backend, Cloud Functions, web)
   - Decisão completa em `specs/DECISIONS.md`
   - Reabilitar quando: (a) tracer ARM64-native do CodeQL, (b) runner Linux com billing org, OU (c) JDK x86_64 separado instalado
2. **6 runner dirs órfãos** (~/actions-runner-3..8) sem service — config preservada mas removidos do GitHub. Usar pra escalar quando precisar:
   ```bash
   cd ~/actions-runner-N && ./svc.sh install && ./svc.sh start
   # E re-registrar via TOKEN do gh api -X POST /actions/runners/registration-token
   ```
3. **GitHub Actions billing** ainda bloqueado (org). Self-hosted resolve. Para reativar: `https://github.com/organizations/TechFernandesLTDA/settings/billing`

## 🛠️ Skills criadas em `.claude/skills/`

14 skills cobrindo padrões deste projeto. Próxima sessão Claude Code descobre auto:

| Skill | Trigger |
|-------|---------|
| `futeba-status` | "status", "saúde" |
| `futeba-deploy` | "deploy", "publicar" |
| `futeba-pr-flow` | "criar PR", "push" |
| `futeba-ci-triage` | "CI falhou" |
| `futeba-runner` | "runner offline" |
| `futeba-spec` | "nova feature" |
| `futeba-deps` | "Dependabot", "atualizar deps" |
| `futeba-test-fix` | "teste quebrou" |
| `futeba-emulators` | "rodar local" |
| `futeba-kmp-build` | "compilar shared", "build iOS" |
| `futeba-merge-train` | "mergear todos" |
| `futeba-firestore-rules` | "alterar rules" |
| `futeba-rollback` | "reverter", "rollback" |
| `futeba-xp-validate` | "fix XP" |

`README.md` com lista completa.

## 🖥️ Setup local validado

- Xcode 26.4.1 instalado em `/Applications/Xcode.app`
- `xcode-select` apontando pra Xcode (não CLT)
- Rosetta 2 instalada (`arch -x86_64 echo OK` funciona)
- JDK 17 Temurin, Android SDK 36, CocoaPods, gcloud OK
- `~/.zshrc` com env vars corretos (JAVA_HOME, ANDROID_SDK_ROOT, PATH)
- 2 launchd services rodando: `actions.runner.TechFernandesLTDA-futeba-dos-parcas.{Mac,Mac2}`
- Husky hooks em `.husky/` executáveis

## 📝 Memory persistido

Em `~/.claude/projects/.../memory/`:
- Git workflow: branch + PR sempre (nunca push master)
- Autonomia ampla autorizada (incl downtime)
- Self-hosted runners macOS pattern
- Tente primeiro, escalate só se falhar
- Avaliações paralelas multi-modelo (Opus + Sonnet)
- Xcode + iOS Simulator instalados
- **CodeQL Java desabilitado em ARM64** (novo, PR #405)

## 🚀 Próxima sessão começa com

1. CLAUDE.md auto-loaded (657 linhas + sub-rules)
2. 14 skills `futeba-*` auto-disponíveis
3. Master limpo (`a765c36`), hosting LIVE, alerts mínimos
4. **Pipeline 100% green** — CodeQL passa (só JS/TS)
5. Worktrees + branches locais limpos
6. Memory atualizado com limitação CodeQL ARM64

Pode começar qualquer task — pedir status, criar feature (com spec), fix bug, deploy, etc.
