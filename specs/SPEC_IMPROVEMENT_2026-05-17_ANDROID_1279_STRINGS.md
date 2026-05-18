# BUGFIX: strings hardcoded em componentes Android sem usar strings.xml

> **Status:** `APPROVED`
> **Severidade:** `LOW`
> **Autor:** Renan Locatiz Fernandes
> **Data:** 2026-05-17
> **PR:** #1279

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Vários componentes Android usam strings em PT-BR hardcoded diretamente no código Kotlin,
violando a regra #6 do projeto ("ALWAYS use strings.xml — no hardcoded strings") e impedindo
internacionalização futura.

### 1.2 Comportamento Esperado (Correto)

Todas as strings visíveis ao usuário devem estar em `app/src/main/res/values/strings.xml`
e referenciadas via `stringResource(R.string.xxx)` nos composables.

### 1.3 Passos para Reproduzir

1. Abrir qualquer um dos componentes listados abaixo no código-fonte
2. Observar strings em PT-BR hardcoded no parâmetro `text = "..."`

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Versão do app | 1.22.0 |
| Impacto | Apenas manutenção/i18n — sem impacto funcional |
| Frequência | Sempre presente |

### 1.5 Screenshots / Logs

N/A — não é bug de runtime, apenas violação de convenção.

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

Verificados manualmente os arquivos listados na issue #1279.

### 2.2 Causa Raiz

Strings adicionadas durante desenvolvimento sem seguir a convenção de `strings.xml`.

### 2.3 Arquivos Afetados

| Arquivo | String hardcoded |
|---------|-----------------|
| `ui/components/team/TeamPickerDialog.kt` | `"Escolha seu time"`, `"Nenhum"`, `"Buscar time..."` |
| `ui/profile/EditProfileScreen.kt` | `"Time do Coração"`, `"Selecionar time"` |
| `ui/games/teamformation/components/HeadToHeadSection.kt` | `"O primeiro confronto entre estes times!"` |
| `ui/groups/CashboxScreen.kt` | `"ESTORNADO"` |
| `ui/components/lists/GamesList.kt` | `"R$ %.2f"` (formato de moeda) |

---

## 3. Solução Proposta

### 3.1 Abordagem

1. Adicionar todas as strings em `app/src/main/res/values/strings.xml`
2. Substituir cada ocorrência por `stringResource(R.string.<key>)`
3. Para o formato de moeda (`"R$ %.2f"`), usar `stringResource(R.string.currency_format, value)`
4. Não alterar lógica/comportamento — apenas extração de strings

### 3.2 Código Antes/Depois

```kotlin
// ANTES
text = "Escolha seu time"

// DEPOIS
text = stringResource(R.string.team_picker_title)
```

```kotlin
// ANTES
text = "R$ %.2f".format(game.dailyPrice)

// DEPOIS
text = stringResource(R.string.games_list_daily_price, game.dailyPrice)
```

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Regressão visual | Strings extraídas com texto idêntico ao original |
| Formato de moeda | Usar `%1$.2f` no XML (formato de string Android) |

---

## 4. Verificação

### 4.1 Testes Adicionados

- Nenhum teste novo necessário (extração pura de strings, sem mudança de lógica)

### 4.2 Testes de Regressão

- [ ] `./gradlew compileDebugKotlin` verde

### 4.3 Checklist

- [ ] Strings extraídas com texto idêntico ao original
- [ ] Build compila sem erros
- [ ] Sem novos warnings

---

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

Faltou revisão de código com foco em strings hardcoded durante o desenvolvimento dessas features.

### 5.2 Ações para evitar bugs similares

- [ ] Script de auditoria `audit-hardcoded-strings.sh` para CI

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-17 | Renan Locatiz Fernandes | Bug reportado (issue #1279) |
| 2026-05-17 | Claude Code | Spec criada e aprovada |
| 2026-05-17 | Claude Code | Fix implementado |
