# Model Selection Guide - Guia de Seleção de Modelos AI

Este arquivo ajuda a escolher o modelo AI correto para cada tipo de tarefa no projeto Futeba dos Parças.

## 🤖 Modelos Disponíveis

### Claude (Anthropic)

```yaml
opus-4.5:
  contexto: "200K tokens"
  velocidade: "Lenta"
  custo: "Muito alto ($$$$$)"
  qualidade: "Máxima"
  melhor_para:
    - Decisões arquiteturais críticas
    - Design de sistemas complexos
    - Security audits
    - Refatorações arquiteturais
    - Análise de trade-offs

sonnet-4.5:
  contexto: "200K tokens"
  velocidade: "Rápida"
  custo: "Médio ($$)"
  qualidade: "Muito alta"
  melhor_para:
    - Desenvolvimento diário
    - Implementação de features
    - Debugging
    - Code reviews (PRs médios)
    - Testes unitários
```

### Gemini (Google)

```yaml
gemini-3-pro-high:
  contexto: "10M tokens"
  velocidade: "Lenta"
  custo: "Alto ($$$$)"
  qualidade: "Máxima"
  melhor_para:
    - Análise multimodal (screenshots, diagramas)
    - Code execution (Python para análise)
    - Deep research mode
    - Revisão de projeto completo

gemini-3-pro:
  contexto: "2M tokens"
  velocidade: "Média"
  custo: "Médio ($$$)"
  qualidade: "Alta"
  melhor_para:
    - Análise visual de UI
    - Debugging com screenshots
    - Análise de dados via Python
    - Validação de diagramas

gemini-3-flash:
  contexto: "1M tokens"
  velocidade: "Muito rápida"
  custo: "Baixo ($)"
  qualidade: "Boa"
  melhor_para:
    - Correções simples
    - Consultas rápidas
    - Ajustes de UI
    - Renomeações
```

---

## 🎯 Matriz de Decisão

### Por Tipo de Tarefa

| Tarefa | Modelo Recomendado | Alternativa |
|--------|-------------------|-------------|
| **Decisão Arquitetural** | Opus 4.5 | - |
| **Design de Sistema** | Opus 4.5 | Gemini 3 Pro High |
| **Security Audit** | Opus 4.5 | - |
| **Implementar Feature** | Sonnet 4.5 | Gemini 3 Pro |
| **Debugging** | Sonnet 4.5 | Gemini 3 Pro |
| **Code Review (< 500 linhas)** | Sonnet 4.5 | - |
| **Code Review (> 500 linhas)** | Opus 4.5 | - |
| **Análise Visual** | Gemini 3 Pro | Gemini 3 Pro High |
| **Correção Simples** | Gemini 3 Flash | Sonnet 4.5 |
| **Consulta Rápida** | Gemini 3 Flash | - |
| **Testes Unitários** | Sonnet 4.5 | Gemini 3 Pro |
| **Refatoração (< 300 linhas)** | Sonnet 4.5 | - |
| **Refatoração (> 300 linhas)** | Opus 4.5 | - |

---

## 📊 Fluxograma de Decisão

```
┌─── Preciso fazer uma tarefa
│
├─── É uma decisão arquitetural crítica?
│    ├─── Sim → Opus 4.5
│    └─── Não → Continue
│
├─── Envolve análise visual (screenshot, diagrama)?
│    ├─── Sim → Gemini 3 Pro / Pro High
│    └─── Não → Continue
│
├─── É algo trivial (<10 linhas de código)?
│    ├─── Sim → Gemini 3 Flash
│    └─── Não → Continue
│
├─── É implementação/debugging/code review normal?
│    ├─── Sim → Sonnet 4.5
│    └─── Não → Opus 4.5
```

---

## 🎯 Casos de Uso do Projeto

### Gamificação (30% completo)

| Tarefa | Modelo | Razão |
|--------|--------|-------|
| Criar LeagueViewModel | Sonnet 4.5 | Feature implementation simples |
| Criar BadgesViewModel | Sonnet 4.5 | Feature implementation simples |
| Completar LeagueFragment | Sonnet 4.5 | UI + lógica padrão |
| **Arquitetar auto-award badges** | **Opus 4.5** | Decisão crítica (race conditions, consistência) |
| Implementar auto-award (após design) | Sonnet 4.5 | Implementação após Opus definir arquitetura |
| Analisar UI de badges | Gemini 3 Pro | Screenshots + feedback visual |

**Workflow:**
1. Opus 4.5: Design arquitetura auto-award (ADR)
2. Sonnet 4.5: Implementar LeagueViewModel, BadgesViewModel
3. Sonnet 4.5: Completar LeagueFragment
4. Sonnet 4.5: Implementar auto-award (seguindo design do Opus)
5. Gemini 3 Pro: Revisar UI com screenshots

---

### Pagamentos (10% completo)

| Tarefa | Modelo | Razão |
|--------|--------|-------|
| **Escolher gateway (Asaas/MP/PagSeguro)** | **Opus 4.5** | Decisão arquitetural crítica |
| **Definir arquitetura (Firebase/Backend)** | **Opus 4.5** | Decisão arquitetural crítica |
| **Modelo de dados Firestore** | **Opus 4.5** | Decisão crítica (segurança PCI) |
| Criar PaymentRepository | Sonnet 4.5 | Implementação após design |
| Criar PaymentViewModel | Sonnet 4.5 | Implementação padrão |
| Criar UI de pagamento | Sonnet 4.5 | UI padrão |
| Analisar UI de QR Code | Gemini 3 Pro | Screenshot + validação visual |

**Workflow:**
1. Opus 4.5: ADR completo (gateway + arquitetura + modelo dados)
2. Sonnet 4.5: Implementar PaymentRepository
3. Sonnet 4.5: Implementar PaymentViewModel + UI
4. Gemini 3 Pro: Validar UI com screenshots

---

### Jogos (95% completo)

| Tarefa | Modelo | Razão |
|--------|--------|-------|
| Adicionar edição de jogos | Sonnet 4.5 | Feature simples |
| Implementar cancelamento | Sonnet 4.5 | Feature simples |
| Notificações FCM confirmações | Sonnet 4.5 | Integração padrão |
| Melhorar algoritmo balanceamento | Opus 4.5 | Lógica complexa (fairness) |
| Corrigir typo em UI | Gemini 3 Flash | Trivial |

---

### Security & Performance

| Tarefa | Modelo | Razão |
|--------|--------|-------|
| **Audit firestore.rules** | **Opus 4.5** | Security crítico |
| Otimizar queries Firestore | Opus 4.5 | Performance crítico |
| Adicionar índices compostos | Sonnet 4.5 | Implementação após análise |
| Revisar validação de inputs | Opus 4.5 | Security crítico |

---

## 💰 Estimativa de Custo

### Cenário: Completar Gamificação (30% → 100%)

**Opção 1: Tudo com Opus 4.5**
```
- Arquitetura auto-award: 20K tokens ($$$$$)
- LeagueViewModel: 10K tokens ($$$$$)
- BadgesViewModel: 10K tokens ($$$$$)
- Completar Fragments: 15K tokens ($$$$$)
- Code reviews: 10K tokens ($$$$$)

Total: ~65K tokens | Custo: ~$10-15 USD
```

**Opção 2: Opus + Sonnet (RECOMENDADO)**
```
- Arquitetura auto-award (Opus): 20K tokens ($$$$$)
- LeagueViewModel (Sonnet): 10K tokens ($$)
- BadgesViewModel (Sonnet): 10K tokens ($$)
- Completar Fragments (Sonnet): 15K tokens ($$)
- Code reviews (Sonnet): 10K tokens ($$)

Total: ~65K tokens | Custo: ~$3-5 USD (economia de 50-70%)
```

**Opção 3: Opus + Sonnet + Gemini (ÓTIMO)**
```
- Arquitetura auto-award (Opus): 20K tokens ($$$$$)
- LeagueViewModel (Sonnet): 10K tokens ($$)
- BadgesViewModel (Sonnet): 10K tokens ($$)
- Completar Fragments (Sonnet): 15K tokens ($$)
- UI reviews (Gemini 3 Pro): 5K tokens ($$$)
- Correções triviais (Gemini Flash): 5K tokens ($)

Total: ~65K tokens | Custo: ~$2-4 USD (economia de 60-80%)
```

---

## 🚦 Quando Escalar/Desescalar

### 🔺 Escale para Opus 4.5 quando:

1. **Decisão afeta arquitetura do app**
   - Exemplo: Escolher gateway de pagamento
   - Impacto: Alto (meses de trabalho)

2. **Trade-offs complexos**
   - Exemplo: Firebase vs Backend Node.js
   - Impacto: Médio a Alto

3. **Segurança crítica**
   - Exemplo: Validação de firestore.rules
   - Impacto: Alto (vulnerabilidades)

4. **Refatoração grande** (>500 linhas)
   - Exemplo: Refatorar GameRepositoryImpl
   - Impacto: Médio (risco de bugs)

5. **Você não tem certeza**
   - Se em dúvida entre abordagens, peça Opus para analisar

### 🔻 Desescale para Sonnet 4.5 quando:

1. **Implementação de decisão já tomada**
   - Opus decidiu arquitetura → Sonnet implementa

2. **Feature bem definida**
   - ViewModel seguindo padrão existente

3. **Bug fix conhecido**
   - Root cause identificado, só corrigir

4. **Code review de PR médio** (<500 linhas)

### ⚡ Desescale para Gemini Flash quando:

1. **Correção trivial** (<10 linhas)
2. **Consulta de informação** (Onde está X?)
3. **Renomeação simples**
4. **Ajuste de UI** (cor, padding, etc.)

---

## 🎯 Estratégias de Custo-Eficiência

### Estratégia 1: Opus para Design, Sonnet para Build

```
1. Use Opus 4.5 para:
   - ADR (Architecture Decision Record)
   - Definir interfaces
   - Definir modelo de dados
   - Identificar riscos

2. Use Sonnet 4.5 para:
   - Implementar as decisões
   - Escrever código
   - Testes unitários
   - Bug fixes

3. Use Gemini para:
   - Validação visual
   - Análises de dados
   - Tarefas triviais
```

### Estratégia 2: Batch de Decisões

```
Ao invés de:
- Pequena decisão 1 (Opus) → Implementar (Sonnet)
- Pequena decisão 2 (Opus) → Implementar (Sonnet)

Faça:
- Todas decisões de uma vez (Opus) → Implementar tudo (Sonnet)

Economia: ~30-40% (menos context switching)
```

### Estratégia 3: Use Gemini para Pesquisa

```
Antes de usar Opus para decisão:
1. Use Gemini 3 Pro para pesquisar opções
2. Gemini levanta 3-4 alternativas com prós/contras
3. Opus valida e decide com contexto completo

Economia: ~20-30% (Opus foca em decisão, não pesquisa)
```

---

## 📋 Checklists de Decisão

### Antes de usar Opus 4.5, pergunte:

- [ ] Esta decisão afeta a arquitetura do app?
- [ ] Existem múltiplas soluções válidas (trade-offs)?
- [ ] O impacto é crítico (segurança, performance, custo)?
- [ ] A decisão é irreversível ou muito custosa para mudar?
- [ ] Preciso de análise profunda de código (>500 linhas)?

**Se 2+ respostas "sim"** → Use Opus 4.5

### Antes de usar Sonnet 4.5, pergunte:

- [ ] A tarefa está bem definida?
- [ ] Existe padrão/template a seguir?
- [ ] É implementação de decisão já tomada?
- [ ] Não envolve análise visual?
- [ ] Não é trivial demais?

**Se 3+ respostas "sim"** → Use Sonnet 4.5

### Antes de usar Gemini 3 Pro, pergunte:

- [ ] Envolve análise de imagem/screenshot/diagrama?
- [ ] Preciso executar código (Python) para análise?
- [ ] Contexto muito grande (>200K tokens)?
- [ ] Preciso de multiple rounds de pesquisa?

**Se 1+ respostas "sim"** → Use Gemini 3 Pro

### Antes de usar Gemini 3 Flash, pergunte:

- [ ] A tarefa é trivial (<10 linhas)?
- [ ] É apenas consulta de informação?
- [ ] Não envolve lógica complexa?
- [ ] Velocidade é mais importante que profundidade?

**Se 2+ respostas "sim"** → Use Gemini 3 Flash

---

## 🎓 Regras de Ouro

1. **Opus = Arquiteto** - Design de sistemas, decisões críticas
2. **Sonnet = Desenvolvedor** - Implementação diária, features, bugs
3. **Gemini Pro = Designer** - Análise visual, validação de UI
4. **Gemini Flash = Assistente** - Tarefas rápidas, consultas

5. **Se em dúvida**: Comece com Sonnet. Escale para Opus se necessário.

6. **Não use Opus para**: Implementação de código, correções triviais

7. **Não use Gemini Flash para**: Decisões, código complexo, arquitetura

8. **Combine modelos**: Opus (design) → Sonnet (build) → Gemini (review visual)

---

## 📊 Resumo Visual

```
Complexidade vs Custo vs Velocidade

Opus 4.5
██████████ Complexidade: Máxima
██████████ Custo: Muito Alto
████░░░░░░ Velocidade: Lenta

Sonnet 4.5
████████░░ Complexidade: Alta
████░░░░░░ Custo: Médio
████████░░ Velocidade: Rápida

Gemini 3 Pro
███████░░░ Complexidade: Média-Alta
█████░░░░░ Custo: Médio-Alto
██████░░░░ Velocidade: Média

Gemini 3 Flash
████░░░░░░ Complexidade: Baixa
██░░░░░░░░ Custo: Baixo
██████████ Velocidade: Muito Rápida
```

---

## 🎯 Próximas Tarefas do Projeto

| Tarefa | Modelo Recomendado | Prioridade |
|--------|-------------------|-----------|
| Criar LeagueViewModel.kt | Sonnet 4.5 | URGENTE |
| Criar BadgesViewModel.kt | Sonnet 4.5 | URGENTE |
| Completar LeagueFragment.kt | Sonnet 4.5 | URGENTE |
| **Arquitetar auto-award badges** | **Opus 4.5** | **CRÍTICO** |
| Implementar auto-award | Sonnet 4.5 | Alta |
| **Design arquitetura pagamentos** | **Opus 4.5** | **CRÍTICO** |
| Implementar PaymentRepository | Sonnet 4.5 | Alta |
| **Security audit firestore.rules** | **Opus 4.5** | **CRÍTICO** |
| Otimizar queries Firestore | Opus 4.5 | Média |
| Validar UI com screenshots | Gemini 3 Pro | Baixa |

---

**Última atualização**: 27/12/2024
**Próxima revisão**: Após completar gamificação
