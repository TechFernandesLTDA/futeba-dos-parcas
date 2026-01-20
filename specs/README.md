# Spec-Driven Development (SDD) - Futeba dos Parças

## Fluxo Obrigatório

**NENHUMA feature ou bugfix deve ser implementada sem uma SPEC aprovada nesta pasta.**

```
1. REQUIREMENTS    → Definir o problema, casos de uso, critérios de aceite
2. UX/UI          → Fluxo de telas, navegação, wireframes, estados (loading/empty/error/success)
3. TECHNICAL      → Arquitetura, modelos, APIs, cache, offline, segurança
4. TASKS          → Breakdown em tarefas atômicas (máx 4h cada)
5. IMPLEMENTATION → Código seguindo a spec aprovada
6. VERIFY         → Testes, code review, checklist DoD, demo
```

## Estrutura de Arquivos

| Arquivo | Uso |
|---------|-----|
| `DECISIONS.md` | Log de decisões técnicas e de produto |
| `_TEMPLATE_FEATURE_MOBILE.md` | Template para novas features |
| `_TEMPLATE_BUGFIX_MOBILE.md` | Template para correção de bugs |
| `_TEMPLATE_SCREEN_UI.md` | Template focado em design de tela |
| `_CHECKLIST_MOBILE_DOD.md` | Checklist de Definition of Done |

## Como Usar

1. **Nova feature?** Copie `_TEMPLATE_FEATURE_MOBILE.md` → `feat-YYYY-MM-DD-nome-da-feature.md`
2. **Bug fix?** Copie `_TEMPLATE_BUGFIX_MOBILE.md` → `fix-YYYY-MM-DD-descricao-bug.md`
3. **Só tela/UX?** Copie `_TEMPLATE_SCREEN_UI.md` → `screen-YYYY-MM-DD-nome-tela.md`
4. **Preencha todas as seções** antes de começar a implementar
5. **Decisões importantes** vão para `DECISIONS.md`
6. **PR deve incluir** link para a spec e checklist DoD preenchido

## Regras de Ouro

- Spec primeiro, código depois
- Sem spec aprovada = sem merge
- Toda decisão relevante deve ser registrada
- Atualize a spec se o escopo mudar durante implementação
