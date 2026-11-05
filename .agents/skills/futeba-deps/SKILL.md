---
name: futeba-deps
description: Triagem e fix de Dependabot alerts + atualização de lockfiles do projeto Futeba. Use quando aparecer security alert, "Dependabot reportou X", "deps desatualizadas", ou periodicamente para audit.
---

# Futeba Deps Audit + Fix

Atualizações de dependências com foco em security + compatibilidade.

## Manifests do projeto

```
package-lock.json (raiz)            — husky, commitlint, scripts (dev only)
backend/package-lock.json           — Express + TypeORM + PostgreSQL
functions/package-lock.json         — Firebase Cloud Functions (Node 22)
web/package-lock.json               — React 18 + MUI 5 + Vite 5
scripts/package-lock.json           — Migration scripts (dev only)
kotlin-js-store/wasm/yarn.lock      — KMP wasmJs target (auto-gerado, build-time)
```

## Triagem de alerts

```bash
# Visão geral por severidade
gh api repos/TechFernandesLTDA/futeba-dos-parcas/dependabot/alerts --paginate \
  -q '[.[] | select(.state=="open") | .security_advisory.severity] | group_by(.) | map({severity: .[0], count: length})'

# Alerts agrupados por manifest
gh api repos/TechFernandesLTDA/futeba-dos-parcas/dependabot/alerts --paginate \
  -q '[.[] | select(.state=="open") | {manifest: .dependency.manifest_path, severity: .security_advisory.severity, package: .dependency.package.name, ghsa: .security_advisory.ghsa_id}] | group_by(.manifest) | map({manifest: .[0].manifest, count: length, items: .})'

# Lista detalhada
gh api repos/TechFernandesLTDA/futeba-dos-parcas/dependabot/alerts --paginate \
  -q '[.[] | select(.state=="open") | {sev: .security_advisory.severity, pkg: .dependency.package.name, manifest: .dependency.manifest_path, ghsa: .security_advisory.ghsa_id, summary: .security_advisory.summary}]'
```

## Estratégia por tipo

### npm packages (functions, backend, web, raiz)
```bash
cd <path>
npm audit --json > /tmp/audit.json
# Identificar parent package que traz vuln
npm ls <vulnerable-pkg>
# Update parent OU usar overrides
```

**`overrides` em package.json** quando parent não tem release pronto:
```json
"overrides": {
  "vulnerable-pkg": ">=safe-version"
}
```

### kotlin-js-store/wasm/yarn.lock
Auto-gerado por Kotlin/JS plugin. Solução: `WasmYarnPlugin.resolution()` em `build.gradle.kts` raiz:
```kotlin
rootProject.plugins.withType<WasmYarnPlugin> {
    rootProject.the<WasmYarnRootExtension>().apply {
        resolution("vulnerable-pkg", "safe-version")
    }
}
```
Depois: `./gradlew kotlinWasmUpgradeYarnLock`

### firebase-admin / Cloud SDK
Major bumps (10→13) frequentes. Cuidado com breaking changes:
- v13: removeu lazy `admin.firestore()` init → precisa `admin.initializeApp()` ANTES de outros imports (lazy pattern em PR #385)

## Workflow PR-by-manifest

Para evitar PR gigante, 1 PR por manifest. Use Agents em paralelo:

```
Agent 1: backend/package-lock.json (Opus se complexo)
Agent 2: package-lock.json (Sonnet)
Agent 3: kotlin-js-store/wasm/yarn.lock (Sonnet)
Agent 4: functions/package-lock.json (Sonnet)
```

Cada agente:
1. cria worktree isolada
2. `cd <path> && npm install && npm audit fix` (ou yarn install)
3. valida `npm run build` + `npm run lint`
4. commit + PR via `futeba-pr-flow`

## False positives

`npm audit` lê `package.json` transitivo, não overrides resolvidos. Se lockfile mostra versão segura mas audit reporta:
```bash
# Verificar lockfile
npm ls vulnerable-pkg | head
# Se versão segura: false positive, documentar no PR
```

## CHANGELOG

Após fix, atualizar `CHANGELOG.md` seção `## [Unreleased] > Segurança` com PRs envolvidos.
