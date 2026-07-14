# BUGFIX: Preview E2E conecta aos emuladores Firebase

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Run de evidência:** 29333943991

## 1. Problema

O workflow compila com `vite build` e serve com `vite preview`. Nesse artefato,
`import.meta.env.DEV` é `false`, então Auth, Firestore, Functions e Storage
ignoram `VITE_USE_EMULATOR=true`. O login E2E envia o POST para
`identitytoolkit.googleapis.com` em vez de `127.0.0.1:9099`.

## 2. Comportamento esperado

- `vite dev` com opt-in continua usando emuladores.
- o preview CI construído explicitamente no modo `e2e` usa emuladores mesmo
  sendo um build otimizado.
- `vite build` normal permanece conectado ao Firebase real, inclusive se
  `VITE_USE_EMULATOR=true` vazar acidentalmente para o ambiente.
- todos os serviços Firebase compartilham a mesma decisão.

## 3. Solução aprovada

Centralizar a decisão em um helper puro: exige browser, opt-in
`VITE_USE_EMULATOR=true` e, adicionalmente, `DEV=true` ou `MODE=e2e`. O workflow
executa `npm run build -- --mode e2e`. Nenhum deploy normal usa esse modo.

## 4. Verificação

- [x] testes unitários da matriz dev/e2e/production/browser
- [x] contrato do workflow e dos três serviços
- [x] lint, TypeScript/build e testes focados
- [x] build padrão não contém wiring dos emuladores
- [x] build `e2e` contém wiring de Auth/Firestore, Functions e Storage
- [x] `actionlint`, YAML e `git diff --check`

## 5. Riscos

- Um operador que executar intencionalmente `vite build --mode e2e` obterá um
  artefato local de teste; esse comando não pertence ao fluxo de deploy.
- O preview exige os emuladores ativos, como já previsto pelo workflow.

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-14 | Codex | Requisitos e modo E2E seguro aprovados antes da implementação |
| 2026-07-14 | Codex | Fix verificado em testes, contratos e bundles production/E2E |
