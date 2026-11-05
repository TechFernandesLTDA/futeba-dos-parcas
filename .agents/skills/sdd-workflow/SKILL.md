---
name: sdd-workflow
description: Fluxo completo de Spec-Driven Development: da ideia ao PR mergeado. Usar quando "criar spec", "nova feature", "iniciar desenvolvimento", "processo SDD"
disable-model-invocation: true
allowed-tools: Bash(gh *) Bash(git *) Write Edit Grep Glob Read
---

# SDD Workflow

Fluxo completo Spec-Driven Development. Engloba as skills existentes `futeba-spec` e `futeba-pr-flow` em um pipeline contínuo.

## Fases

### 0. Triagem
- Se partir de issue: `/context-pack <issue>` para carregar contexto
- Se ideia nova: criar issue `gh issue create --repo ...`

### 1. Spec (`futeba-spec`)
Criar spec em `specs/` usando o template apropriado:
- Feature mobile: `_TEMPLATE_FEATURE_MOBILE.md`
- Bugfix: `_TEMPLATE_BUGFIX_MOBILE.md`
- Screen UI: `_TEMPLATE_SCREEN_UI.md`

### 2. Validação
- Verificar Checklist DoD (`_CHECKLIST_MOBILE_DOD.md`)
- Rodar `AGENTS.md` compliance check
- Verificar regras aplicáveis em `.Codex/rules/`

### 3. Implementação
- Criar branch: `git checkout -b <tipo>/<descricao>` from master
- Implementar seguindo o spec
- Validar: `npm run build` (web), `tsc` (functions), `./gradlew compileDebugKotlin` (android)

### 4. PR + Merge (`futeba-pr-flow`)
- Commit Conventional Commits
- Push + `gh pr create`
- Admin merge squash

## Exemplo de uso

Usuário: "quero implementar sistema de notificações push"
Codex: [roda /sdd-workflow]
1. Cria spec em `specs/feat-2026-05-09-push-notifications.md`
2. Mostra checklist DoD preenchido
3. Pergunta: "Spec aprovada? Posso implementar?"
4. Se sim: implementa → commit → PR → merge

## Referências

- Specs existentes: `specs/` (74 arquivos)
- Templates: `specs/_TEMPLATE_*.md`
- Decisões: `specs/DECISIONS.md`
- AGENTS.md: regras de arquitetura e convenções
