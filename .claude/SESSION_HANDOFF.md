# Session Handoff — 2026-05-03

Consolidação completa para próxima sessão Claude Code começar saudável.

## 🟢 Estado final

| Item | Estado |
|------|--------|
| **Master HEAD** | `83c33be` (#404 CodeQL self-hosted) |
| **PRs abertos** | 0 |
| **Issues abertas** | 0 |
| **Hosting** | 🟢 200 OK — https://futebadosparcas.web.app |
| **Dependabot** | 1 medium (false positive `uuid` em backend — comprovado) |
| **Runners** | 2 online (Mac + Mac2), 6 idle dirs (~/actions-runner-3..8 sem service) |
| **RAM livre** | 10.2 GB |

## ✅ O que foi feito (21 PRs nesta sessão: #377-#404)

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

## 🚀 Próxima sessão começa com

1. CLAUDE.md auto-loaded (657 linhas + sub-rules)
2. 14 skills `futeba-*` auto-disponíveis
3. Master limpo, hosting LIVE, alerts mínimos
4. Pipeline 5/6 workflows green (CodeQL único pendente)

Pode começar qualquer task — pedir status, criar feature (com spec), fix bug, deploy, etc.
