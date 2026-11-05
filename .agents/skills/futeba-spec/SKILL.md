---
name: futeba-spec
description: Cria nova spec a partir do template apropriado em /specs/ — feature mobile, bugfix mobile ou screen UI. OBRIGATÓRIO antes de qualquer feature/bugfix per AGENTS.md Regra #1. Use quando o usuário pedir "nova feature", "fix de bug não-trivial", ou "começar X".
---

# Futeba Spec

Spec-Driven Development obrigatório per AGENTS.md.

## Regra #1 (AGENTS.md)

> NUNCA implementar feature ou bugfix sem spec aprovada em `/specs/`. Status deve ser `APPROVED` antes de iniciar implementação.

## Templates disponíveis

| Tipo | Template | Quando usar |
|------|----------|-------------|
| Feature mobile | `specs/_TEMPLATE_FEATURE_MOBILE.md` | Nova funcionalidade Android (tela, fluxo, integração) |
| Bugfix mobile | `specs/_TEMPLATE_BUGFIX_MOBILE.md` | Bug não-trivial Android (>1 arquivo afetado) |
| Screen UI | `specs/_TEMPLATE_SCREEN_UI.md` | Nova tela (com estados Loading/Empty/Error/Success) |

## Workflow

```bash
cd /Users/renanlocatizfernandes/Code/personal/TechFernandesLTDA/futeba-dos-parcas

# 1. Copiar template apropriado com nome descritivo + data
DATE=$(date +%Y-%m-%d)
NAME="feat-${DATE}-<descricao-curta-kebab-case>"
cp specs/_TEMPLATE_FEATURE_MOBILE.md "specs/${NAME}.md"

# 2. Editar com Edit/Write tool — preencher TODAS as fases:
# - Requirements (problema, casos de uso, critérios de aceite, fora de escopo)
# - UX/UI Design (fluxo navegação, telas+estados, responsividade, a11y)
# - Technical Design (arquitetura, datasource, ViewModel, integração)
# - Tasks (lista numerada de implementação)
# - Implementation (vazio — preenchido durante codificação)
# - Verify (DoD checklist)

# 3. Status deve começar `DRAFT` → enviar pra revisão → mudar pra `APPROVED`
# IMPORTANTE: aguardar `APPROVED` ANTES de codificar
```

## Fases obrigatórias

```
REQUIREMENTS → UX/UI → TECHNICAL DESIGN → TASKS → IMPLEMENTATION → VERIFY
```

Não pular fases.

## Mobile DoD (Definition of Done)

Antes de marcar spec como `IMPLEMENTED`, validar:
- [ ] Responsividade: phone portrait, landscape, tablet
- [ ] Acessibilidade: contentDescription, touch targets ≥48dp
- [ ] Performance: zero recompositions desnecessárias (Compose Layout Inspector)
- [ ] Offline/Errors: comportamento definido (cache/retry/fallback)
- [ ] Estados obrigatórios na tela: Loading, Empty, Error, Success
- [ ] Strings em `strings.xml` (não hardcoded)
- [ ] Cores via `MaterialTheme.colorScheme.*` (não hardcoded)
- [ ] Comments em PT-BR
- [ ] Testes unitários do ViewModel

Veja `specs/_CHECKLIST_MOBILE_DOD.md` para checklist completa.

## Decision log

Toda decisão técnica/produto relevante vai pra `specs/DECISIONS.md` (formato ADR-lite).

## Dica

Se mudança é trivial (1-2 linhas, fix óbvio sem ambiguidade), spec pode ser PR description ao invés de arquivo `.md` — mas verifique com user antes.
