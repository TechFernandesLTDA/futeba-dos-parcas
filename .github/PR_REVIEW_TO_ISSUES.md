# 🤖 PR Review to Issues - Automação

## 📋 O Que Faz

Este workflow **automaticamente converte** comentários críticos do **Claude Code Review** em **issues rastreáveis** no GitHub.

---

## ✨ Funcionalidades

### 1. **Detecção Automática**
Monitora comentários de code review e identifica:
- 🚨 **Critical** - Problemas críticos
- 🔴 **Error** - Erros que precisam correção
- ⚠️ **Warning** - Avisos importantes
- 🟡 **Issue** - Problemas médios
- 🔒 **Security Issue** - Vulnerabilidades de segurança
- 🐛 **Bug** - Bugs detectados
- ⚡ **Performance** - Problemas de performance
- 💾 **Memory Leak** - Vazamento de memória

### 2. **Criação Automática de Issues**
Para cada problema detectado, cria uma issue com:
- ✅ Título descritivo com prefixo `[Code Review]`
- ✅ Descrição completa do problema
- ✅ Link para o PR original
- ✅ Timestamp e contexto
- ✅ Checklist de ações recomendadas
- ✅ Labels automáticas apropriadas

### 3. **Labels Inteligentes**
Aplica automaticamente:
- **Por severidade:** `priority: critical`, `priority: high`, `priority: medium`
- **Por tipo:** `bug`, `security`, `performance`, `memory-leak`
- **Por módulo:** `module: games`, `module: players`, etc. (detectado automaticamente)
- **Controle:** `automated`, `needs-triage`

### 4. **Rastreamento no PR**
- Comenta no PR para cada issue criada
- Cria um sumário ao final com links para todas as issues
- Mantém histórico de rastreamento

---

## 🔧 Como Funciona

### Disparadores (Triggers)

```yaml
on:
  issue_comment:              # Comentários em PRs
  pull_request_review_comment: # Comentários inline de review
  pull_request_review:        # Reviews completos
```

### Fluxo de Execução

```
1. 💬 Claude Code Review comenta no PR
    ↓
2. 🤖 Workflow detecta comentário do bot
    ↓
3. 🔍 Analisa o texto buscando padrões críticos
    ↓
4. 📝 Para cada problema encontrado:
    ├─ Cria issue automaticamente
    ├─ Aplica labels apropriadas
    ├─ Detecta módulo relacionado
    └─ Comenta no PR sobre a issue
    ↓
5. 📊 Cria sumário com todas as issues criadas
```

---

## 📝 Exemplo de Issue Criada

**Título:**
```
[Code Review] Potential null pointer exception in GameRepository
```

**Corpo:**
```markdown
## 🤖 Auto-created from PR Review

**Source PR:** #14
**Detected:** CRITICAL severity issue
**Review Type:** Claude Code Review

---

### Issue Description

Potential null pointer exception in GameRepository.kt line 45. 
The method getGameById() doesn't handle the case where Firestore 
returns null, which could crash the app.

---

### Context

This issue was automatically created by analyzing the code review 
comments on PR #14.

**Review timestamp:** 2026-01-08T03:27:00.000Z
**Detected by:** Claude Code Review Bot

### Recommended Actions

- [ ] Review the issue description
- [ ] Assign to appropriate team member
- [ ] Link to related PRs if needed
- [ ] Update priority/labels if needed
- [ ] Create sub-tasks if complex
```

**Labels aplicadas:**
- `automated`
- `needs-triage`
- `priority: critical`
- `bug`
- `module: games`

---

## 🎯 Padrões Detectados

O workflow busca por estes padrões nos comentários:

| Emoji | Palavra-Chave | Severidade | Label |
|-------|---------------|------------|-------|
| 🚨 | **Critical** | Critical | `priority: critical` |
| 🔴 | **Error** | Critical | `priority: critical` |
| ⚠️ | **Warning** | High | `priority: high` |
| 🟡 | **Issue** | Medium | `priority: medium` |
| - | **Security Issue** | Critical | `security` |
| - | **Bug** | High | `bug` |
| - | **Performance** | Medium | `performance` |
| - | **Memory Leak** | Critical | `memory-leak` |

---

## 🚀 Como Usar

### Para Desenvolvedores

**Não precisa fazer nada!** O sistema funciona automaticamente quando:

1. Você abre um PR
2. Claude Code Review analisa o código
3. Se Claude encontrar problemas críticos, issues são criadas automaticamente

### Para Revisar Issues Criadas

1. Acesse a aba **Issues** do repositório
2. Filtrar por label: `automated` ou `needs-triage`
3. Revisar e fazer triagem:
   - Confirmar severidade
   - Atribuir responsável
   - Ajustar labels se necessário
   - Fechar se for falso positivo

### Para Desabilitar (se necessário)

Renomeie ou delete o arquivo:
```bash
rm .github/workflows/pr-review-to-issues.yml
```

---

## 📊 Métricas e Logs

### Durante execução, o workflow mostra:

```
Processing review comment from PR #14
Comment length: 1250
✅ Created issue #45: Potential null pointer exception
✅ Created issue #46: Unhandled edge case in user auth
✅ Total issues created: 2
```

### No PR, você verá comentários tipo:

```
🤖 Auto-created Issue #45

A critical severity issue was detected and tracked: 
https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/45

Issue: "Potential null pointer exception in GameRepository"
```

```
## 📋 Code Review Issues Summary

2 issue(s) were automatically created from this code review:

- #45
- #46

These issues are tagged with `automated` and `needs-triage` 
labels for tracking.
```

---

## 🛡️ Segurança

### Permissões necessárias:
```yaml
permissions:
  issues: write          # Criar issues
  pull-requests: read    # Ler PRs
  contents: read         # Ler código
```

### Filtros de segurança:
- ✅ Só processa comentários do Claude Code Review bot
- ✅ Valida tamanho mínimo de descrição (10 chars)
- ✅ Previne duplicação de labels
- ✅ Rate limiting automático do GitHub

---

## ❓ FAQ

### P: Quantas issues podem ser criadas por PR?
**R:** Sem limite técnico, mas tipicamente 2-5 issues por review completo.

### P: E se eu não quiser uma issue específica?
**R:** Basta fechar a issue criada com comentário "false positive" ou "won't fix".

### P: Como personalizar os padrões detectados?
**R:** Edite o array `criticalPatterns` no arquivo `pr-review-to-issues.yml`.

### P: Funciona com outros bots de review?
**R:** Sim! Basta ajustar o step `check-claude` para detectar outros bots.

### P: As issues são linkadas ao PR automaticamente?
**R:** Sim! Cada issue tem um link para o PR original no corpo.

---

## 🔗 Arquivos Relacionados

- `.github/workflows/pr-review-to-issues.yml` - Workflow principal
- `.github/workflows/claude-code-review.yml` - Bot de review
- `.github/workflows/issue-automation.yml` - Automação de labels

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs do workflow na aba **Actions**
2. Confira se as permissões estão corretas
3. Teste com um PR simples primeiro
4. Abra uma issue com label `automation` se precisar de ajuda

---

**Criado:** 2026-01-08  
**Versão:** 1.0.0  
**Autor:** Antigravity AI
