---
name: issue-to-spec
description: Converte uma issue do GitHub em spec executável. Usar quando "transformar issue em spec", "criar spec da issue X", "documentar issue"
arguments: [issue_number]
disable-model-invocation: true
allowed-tools: Bash(gh *) Write Grep Glob Read
---

# Issue to Spec

Converte a issue `$0` em uma spec completa no diretório `specs/`, pronta para implementação.

## Fluxo

### 1. Extrair issue
```bash
gh issue view $0 --json title,body,labels,createdAt
```

### 2. Classificar
Baseado nas labels, escolher template:
- `bug` → `_TEMPLATE_BUGFIX_MOBILE.md`
- `feature` ou `enhancement` → `_TEMPLATE_FEATURE_MOBILE.md`
- `web` ou `android` ou `ios` + UI → `_TEMPLATE_SCREEN_UI.md`

### 3. Preencher spec
Preencher todas as seções do template com base no body da issue:

#### Para bugfix:
- **Descrição do bug**: extrair do body
- **Passos para reproduzir**: extrair ou inferir
- **Impacto em usuários**: estimar com base na severidade
- **Solução proposta**: sugerir baseado em padrões existentes
- **Arquivos afetados**: buscar com grep/glob

#### Para feature:
- **Visão geral**: extrair do body
- **UX Design**: propor fluxo baseado em padrões existentes
- **Requisitos**: enumerar R1, R2, ...
- **Non-goals**: o que NÃO está no escopo
- **Roadmap**: estimar fases

### 4. Salvar
Salvar em `specs/<tipo>-YYYY-MM-DD-<slug>.md`

### 5. Output
Mostrar spec completa e perguntar: "Spec aprovada? Posso marcar como READY e iniciar implementação?"

## Exemplo
```
/issue-to-spec 622
```
→ Cria `specs/feat-2026-05-09-user-feedback.md` com schema Firestore, UX design, Cloud Functions spec, acceptance criteria.
