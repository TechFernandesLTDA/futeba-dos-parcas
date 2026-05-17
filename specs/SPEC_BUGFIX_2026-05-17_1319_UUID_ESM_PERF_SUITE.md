# SPEC BUGFIX — #1319 perf suite quebrada por uuid@14 ESM

- **Status:** APPROVED
- **Data:** 2026-05-17
- **Issue:** #1319
- **Tipo:** Bugfix (CI / dependência)
- **Plataforma:** Cloud Functions (`functions/`)

## REQUIREMENTS

A check **Firestore Query Performance** (`npm run test:perf`) falha de forma
determinística em **todo PR que toca `functions/**`**, independente do conteúdo:

```
SyntaxError: Unexpected token 'export'
  node_modules/uuid/dist-node/index.js
```

4 suites / 22 testes morrem no setup `clearCollections` (`test/performance/utils.ts`).
Bloqueia o merge-train de qualquer PR de functions (false-red conhecido,
path-filtered — não roda em PR que não toca `functions/`).

## ROOT CAUSE

`functions/package.json` tinha **`overrides.uuid: ^14.0.0`** — um override npm
que força a árvore **inteira** de dependências (incluindo o `uuid` transitivo de
`firebase-admin`) para a v14. `uuid@14` é **ESM-only** (v14 removeu o entrypoint
CommonJS). O jest da perf suite usa `preset: ts-jest` cujo `transform` só cobre
`^.+\.tsx?$` (apenas `.ts`); `uuid/dist-node/index.js` é `.js` e cai no
`transformIgnorePatterns` default (`/node_modules/`). A unit suite passa porque
mocka `firebase-admin` — o `require('uuid')` real nunca executa; a perf suite
conecta no emulador e executa de verdade.

> Por isso `transformIgnorePatterns` **não** resolveria (ts-jest não transforma
> `.js`). O fix correto é forçar uma versão CJS de `uuid`.

## TECHNICAL DESIGN

`functions/package.json`:
- `dependencies.uuid`: `^14.0.0` → `^9.0.1`
- `overrides.uuid`: `^14.0.0` → `^9.0.1`  ← força árvore inteira p/ CJS
- `devDependencies.@types/uuid`: `^11.0.0` → `^9.0.8` (alinhar com runtime)

`package-lock.json` regenerado (`npm install --legacy-peer-deps`) — evita
drift de lockfile → `npm ci` EUSAGE no CI.

Nenhum código-fonte importa `uuid` diretamente (`grep` em `src/`/`test/` = 0
imports) ⇒ downgrade é risk-free; `firebase-admin` traz seu próprio uso interno
e funciona com qualquer 9/x CJS.

## TASKS

- [x] Pin `uuid` ^9.0.1 em `dependencies` + `overrides`
- [x] Alinhar `@types/uuid` ^9.0.8
- [x] Regenerar `package-lock.json`
- [x] Verificar `npm run build` (tsc) verde
- [x] Verificar unit suite 599 passed / 13 skipped (baseline mantido, 0 regressão)
- [x] Verificar `require('uuid')` resolve em CommonJS sem `SyntaxError`

## VERIFY

- `node -e "require('uuid')"` → OK (sem ESM error)
- `npm run build` → OK
- `npx jest --no-coverage` → 25 suites, 599 passed, 13 skipped (idêntico ao baseline pré-fix)
- Perf suite full requer emulador Firestore (validação completa no CI via
  `firebase emulators:exec`); a causa-raiz (`require` ESM) está comprovadamente eliminada.

## IMPACTO

Destrava o merge-train de **todos** os PRs futuros que tocam `functions/**`
(antes: false-red determinístico). Fecha #1319.
