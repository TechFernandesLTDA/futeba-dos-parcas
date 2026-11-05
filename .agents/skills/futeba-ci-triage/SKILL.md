---
name: futeba-ci-triage
description: Diagnostica falha de workflow CI no projeto Futeba e propõe fix. Use quando "CI falhou", "workflow vermelho", "deploy quebrou", ou após qualquer notificação de falha do GitHub Actions.
---

# Futeba CI Triage

Investigação rápida + categorização de falha CI + fix proposto.

## Falhas conhecidas + soluções

| Sintoma | Causa | Fix |
|---------|-------|-----|
| `account payments have failed` | Billing GH Actions bloqueado | User: settings → billing OU manter self-hosted |
| `Could not load module metadata...descriptor.bin` | Cache Gradle corrompido (concorrência runners) | `rm -rf ~/.gradle/caches/modules-2/metadata-*` + retry |
| `Gradle build daemon disappeared unexpectedly` | OOM (RAM) | Verificar `vm_stat`; se `mds_stores` >5%: `osascript -e 'do shell script "killall -KILL mds_stores" with administrator privileges'` |
| `spawn Unknown system error -86` | CodeQL precisa Rosetta 2 em ARM64 | `sudo softwareupdate --install-rosetta --agree-to-license` |
| `tag 'v1.X.0' already exists` | Auto Version Bump não-idempotente | PR #394 fixou — verificar se rev veio antes |
| `Cannot find module '...bump-version.js'` | Script faltando | PR #391 criou — verificar se em master |
| `upload-artifact@v8/v7` 404 | Versões inexistentes | Trocar por `@v4` (latest stable) |
| `Could not automatically select an Xcode project` | iosApp/ sem .xcodeproj real (CMP Phase 4) | Setar `vars.IOS_PHASE_4_ENABLED=true` quando Phase 4 vier; senão skipa |
| `KMP iOS compile errors @OptIn` | Faltando opt-in global | `shared/build.gradle.kts` `languageSettings.optIn("kotlinx.cinterop.ExperimentalForeignApi")` |
| `xcodebuild error 'tool requires Xcode'` | `xcode-select` aponta CLT, não Xcode.app | `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` |
| `Setup Xcode: version not available` | maxim-lobanov/setup-xcode pede versão inexistente | Trocar `xcode-version: '15.4'` → `'latest-stable'` |
| `Workflow initiated by non-human actor: Codex (type: Bot)` | Codex-action sem allowed_bots | Add `allowed_bots: '*'` no workflow yml |
| `actions/checkout@v6 / setup-node@v6 / github-script@v8` 404 | Versões inexistentes | Trocar por `@v5/@v4/@v7` respectivamente |
| `Malformed root json at app/google-services.json` | shell injection — `echo '${{ secrets.JSON }}'` quebra com aspas/parens dentro do JSON | env + `printf '%s' "$VAR" > file` (PR #530) |
| `Keystore file 'app/***' not found` | path como secret é mascarado pelo GH | hardcode path em workflow; secret só pra valor sensível (PR #531) |
| `keystore password was incorrect` | senha com `$digit` foi expandida ao `gh secret set --body` | usar `_B64` versions + decode no workflow (PR #533) |
| `conditional binary operator expected` em workflow shell | interpolação raw de `${{ secrets.X }}` em `[[ ... ]]` quebra com `()` `[]` | env vars + `[[ "$VAR" == ... ]]` (PR #527) |
| `npm error ERESOLVE` em CI mas `npm install` local OK | `npm ci` é strict (peer deps), `npm install` é lax | bumpar peer deps ou `--legacy-peer-deps` (PR #529) |
| `Gradle: keystore password was incorrect` mas `keytool list` OK no mesmo job | Gradle config cache reusando valores antigos | `bundleRelease --no-configuration-cache --rerun-tasks` (PR #537) |
| `Google Play API has not been used` | API não habilitada no GCP | Owner: https://console.developers.google.com/apis/api/androidpublisher.googleapis.com/overview?project=490094091078 |
| `caller does not have permission` (Play Store) | SA sem Release Manager no Play Console | Owner: https://play.google.com/console → Usuários e permissões → convidar SA email (skill `futeba-play-store`) |

## Workflow falhas esperadas (ignorar)

Per AGENTS.md:
- Build Shared KMP Framework em Linux runners (precisa macOS)
- Notify Build Status (cascata de KMP)
- Build iOS App em PRs que não tocam :shared (até Phase 4)

## Comandos de diagnóstico

```bash
# 1. Identificar workflow que falhou
gh run list --repo TechFernandesLTDA/futeba-dos-parcas --status failure --limit 5 --json databaseId,workflowName,createdAt

# 2. Ver job + steps
gh run view <run-id> --repo TechFernandesLTDA/futeba-dos-parcas

# 3. Logs de steps que falharam
gh run view <run-id> --repo TechFernandesLTDA/futeba-dos-parcas --log-failed 2>&1 | grep -E "error|FAILED|✘|fatal" | head -10

# 4. Annotations (rápido)
gh run view <run-id> --repo TechFernandesLTDA/futeba-dos-parcas 2>&1 | grep -A 2 ANNOTATIONS

# 5. Re-run só os jobs que falharam (após fix)
gh run rerun <run-id> --repo TechFernandesLTDA/futeba-dos-parcas --failed
```

## Fluxo de fix

1. Identificar sintoma na tabela acima
2. Se conhecido: aplicar fix listado
3. Se novo: investigar log → propor fix → criar PR via `futeba-pr-flow`
4. Após fix merged: rerun ou aguardar próximo push triggera CI
