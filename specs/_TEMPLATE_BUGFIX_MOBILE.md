# BUGFIX: [Descrição curta do bug]

> **Status:** `TRIAGED` | `IN_PROGRESS` | `FIXED` | `VERIFIED`
> **Severidade:** `CRITICAL` | `HIGH` | `MEDIUM` | `LOW`
> **Autor:** [seu nome]
> **Data:** YYYY-MM-DD
> **PR:** #xxx

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
<!-- O que está acontecendo? -->

### 1.2 Comportamento Esperado (Correto)
<!-- O que deveria acontecer? -->

### 1.3 Passos para Reproduzir

1. Abrir o app
2. Navegar para [tela X]
3. Executar [ação Y]
4. Observar [comportamento errado]

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | 1.4.x |
| Dispositivo | Pixel 7 / Samsung S23 / etc |
| Android version | 14 |
| Frequência | Sempre / Às vezes / Raro |
| Impacto em usuários | X% afetados (se souber) |

### 1.5 Screenshots / Logs

<!-- Cole prints, stack traces, logs relevantes -->

```
// Stack trace ou log relevante
```

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

<!-- O que você descobriu ao investigar? -->

### 2.2 Causa Raiz

<!-- Por que o bug acontece? -->

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `path/to/File.kt` | ... |

---

## 3. Solução Proposta

### 3.1 Abordagem

<!-- Como você vai corrigir? -->

### 3.2 Código Antes/Depois

```kotlin
// ANTES (bugado)
fun funcaoProblematica() {
    // código com bug
}

// DEPOIS (corrigido)
fun funcaoCorrigida() {
    // código corrigido
}
```

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Regressão em X | Adicionar teste para X |
| Performance | Medir antes/depois |

---

## 4. Verificação

### 4.1 Testes Adicionados

- [ ] Teste unitário para o cenário do bug
- [ ] Teste de UI (se aplicável)

### 4.2 Testes de Regressão

- [ ] Funcionalidade relacionada A funciona
- [ ] Funcionalidade relacionada B funciona

### 4.3 Checklist

- [ ] Bug não reproduz mais
- [ ] Build passa
- [ ] Testes passam
- [ ] Sem novos warnings no lint
- [ ] Testado em múltiplos dispositivos/versões Android

---

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

<!-- Faltou teste? Caso edge não considerado? -->

### 5.2 Ações para evitar bugs similares

- [ ] Adicionar teste automatizado
- [ ] Melhorar validação de input
- [ ] Adicionar documentação
- [ ] Outro: ...

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| YYYY-MM-DD | Nome | Bug reportado |
| YYYY-MM-DD | Nome | Análise concluída |
| YYYY-MM-DD | Nome | Fix implementado |
