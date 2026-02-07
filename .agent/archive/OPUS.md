# OPUS.md

Instruções para Claude Opus 4.6 ao trabalhar neste repositório.

## 🎯 Quando Usar Claude Opus 4.6

**Claude Opus 4.6 é o modelo mais avançado da Anthropic** - Use com sabedoria devido ao custo elevado.

```yaml
opus-4.6:
  capacidades:
    - "Raciocínio arquitetural profundo"
    - "Análise de trade-offs complexos"
    - "Design de sistemas"
    - "Security audits detalhados"
    - "Refatorações arquiteturais"

  contexto: "200K tokens"
  velocidade: "Lenta"
  custo: "Muito alto (5x Sonnet)"
  precisão: "Máxima"

  quando_usar:
    ✅ "Decisões arquiteturais críticas"
    ✅ "Design de features complexas (gamificação, pagamentos)"
    ✅ "Refatoração de código legado"
    ✅ "Análise de segurança profunda"
    ✅ "Code review de PRs grandes"
    ✅ "Resolução de bugs arquiteturais"

  quando_NÃO_usar:
    ❌ "Implementação de código simples"
    ❌ "Correções de typos"
    ❌ "Ajustes de UI"
    ❌ "Consultas rápidas"
    ❌ "Desenvolvimento diário"
```

**Regra de ouro**: Se Sonnet 4.6 consegue fazer, use Sonnet. Reserve Opus para decisões críticas.

---

## ⚡ TL;DR - Contexto em 30 segundos

```yaml
projeto: "Futeba dos Parças - App Android de peladas"
progresso: "75-80% completo"
linguagem: "Kotlin 2.0.21"
arquitetura: "MVVM + Clean + Hilt"
backend: "Firebase (Firestore/Auth/FCM)"
build_status: "✅ SUCCESS"

prioridades_opus:
  1_crítica: "Design de arquitetura de pagamentos PIX (10% completo)"
  2_importante: "Refatoração da gamificação (30% completo)"
  3_segurança: "Audit de firestore.rules (312 linhas)"
  4_performance: "Otimização de queries Firestore"

modelos_do_time:
  decisões_arquiteturais: "Claude Opus 4.6 (você)"
  desenvolvimento_diário: "Claude Sonnet 4.6"
  tarefas_rápidas: "Gemini 3 Flash"
  análise_visual: "Gemini 3 Pro (multimodal)"

arquivos_críticos:
  regras: ".agentrules"
  estado: ".agent/PROJECT_STATE.md"
  navegação: ".agent/QUICK_REFERENCE.md"
  seleção: ".agent/MODEL_SELECTION.md"
```

---

## 🏗️ Arquitetura do Projeto

```
UI Layer (Fragment/Activity)
    ↓ ViewBinding/Compose
ViewModel Layer (@HiltViewModel)
    ↓ StateFlow<UiState>
Repository Layer (Interface + Impl)
    ↓ Result<T> / Flow<T>
Data Source (Firebase)
    ↓ Firestore / Auth / Storage / FCM
```

**Princípios Arquiteturais:**
- **MVVM + Clean Architecture** - Separação clara de camadas
- **Dependency Inversion** - Dependa de abstrações (Hilt)
- **Single Responsibility** - Cada classe uma responsabilidade
- **Open/Closed** - Aberto para extensão, fechado para modificação

**Stack Técnico:**
```yaml
linguagem: "Kotlin 2.0.21"
min_sdk: 24
target_sdk: 35
di: "Hilt 2.51.1"
async: "Coroutines 1.9.0 + Flow"
ui: "ViewBinding + Compose (híbrido)"
backend: "Firebase BoM 33.7.0"
cache: "Room 2.6.1"
navegação: "Navigation Component 2.8.5 + SafeArgs"
```

---

## 🎯 Tarefas Específicas para Opus 4.6

### 1. Design de Arquitetura de Pagamentos (PRIORITÁRIO)

**Status Atual**: 10% completo (apenas models)

**Desafio:**
- Integração com gateway PIX (Asaas, Mercado Pago, ou PagSeguro)
- Segurança de transações
- Sincronização com Firebase
- Crowdfunding para jogos
- Gestão de mensalistas vs avulsos
- Cobrança automática

**Sua Missão (Opus):**
1. **Analise 3 arquiteturas possíveis**:
   - Gateway direto (Asaas/Mercado Pago)
   - Firebase Functions + webhook
   - Backend Node.js (existe mas não está em uso)

2. **Considere**:
   - Segurança (PCI compliance, não armazenar dados sensíveis)
   - UX (geração rápida de QR Code PIX)
   - Confiabilidade (webhook failures, retry logic)
   - Custo (taxas do gateway, Firebase Functions pricing)
   - Manutenibilidade (código complexo? documentação?)
   - Escalabilidade (1000+ transações/mês)

3. **Entregue**:
   - Documento de decisão arquitetural (ADR)
   - Diagrama de sequência
   - Modelo de dados Firestore
   - Plano de implementação em fases
   - Estimativa de risco

**Arquivos existentes:**
- `data/model/Payment.kt` - Models já criados
- Ver `.agent/PROJECT_STATE.md` seção Pagamentos

---

### 2. Refatoração da Gamificação (IMPORTANTE)

**Status Atual**: 30% completo (Repository pronto, falta UI)

**Desafio:**
- Sistema complexo: Seasons, Badges, Streaks, PlayerCards, HeadToHead
- Auto-award de badges após jogos
- Cálculo de pontos e ranking
- Promoção/rebaixamento entre divisões
- Animações de desbloqueio de badges

**Sua Missão (Opus):**
1. **Revise a arquitetura atual**:
   - `data/repository/GamificationRepository.kt` (340 linhas)
   - `data/model/Gamification.kt` - Models complexos

2. **Analise**:
   - Padrão atual está escalável?
   - Auto-award pode causar race conditions?
   - Cálculo de ranking é eficiente?
   - Há risco de inconsistência de dados?

3. **Proponha**:
   - Melhorias arquiteturais
   - Padrões de sincronização
   - Estratégia de cache
   - Testes críticos a implementar

**Arquivos:**
- `data/repository/GamificationRepository.kt`
- `data/model/Gamification.kt`
- `.agent/PROJECT_STATE.md` seção Gamificação

---

### 3. Security Audit do Firestore (CRÍTICO)

**Arquivo**: `firestore.rules` (312 linhas)

**Sua Missão (Opus):**
1. **Audite as regras de segurança**:
   - Vulnerabilidades de autenticação
   - Possíveis bypasses de permissões
   - Validação insuficiente de dados
   - Regras muito permissivas ou restritivas

2. **Analise vetores de ataque**:
   - Usuário malicioso pode escalar privilégios?
   - Dados sensíveis estão expostos?
   - Rate limiting está implementado?
   - Validação de enums/status está correta?

3. **Recomende**:
   - Correções de segurança
   - Melhorias de performance (índices)
   - Testes de segurança a implementar

**Arquivo**: `firestore.rules`

---

### 4. Otimização de Performance Firestore

**Problema:**
- Queries podem estar ineficientes
- Leitura de documentos desnecessários
- Falta de índices compostos

**Sua Missão (Opus):**
1. **Analise queries críticas**:
   - Busca de jogos (filtros: status, data, usuário)
   - Ranking de liga (sort por pontos)
   - Estatísticas (agregações)

2. **Identifique**:
   - Queries N+1
   - Over-fetching de dados
   - Índices faltantes
   - Listeners desnecessários

3. **Proponha**:
   - Otimizações específicas
   - Índices compostos necessários
   - Estratégia de cache com Room
   - Paginação onde necessário

**Arquivos:**
- `data/repository/GameRepositoryImpl.kt` (470 linhas - queries complexas)
- `firestore.indexes.json`

---

### 5. Code Review Arquitetural

**Quando usar Opus para review:**
- PRs grandes (>500 linhas alteradas)
- Mudanças arquiteturais
- Refatorações críticas
- Código de segurança (auth, pagamentos)

**O que procurar:**
1. **Arquitetura**:
   - Violação de Clean Architecture?
   - Dependency Inversion correta?
   - Separação de concerns?

2. **Segurança**:
   - Input validation
   - Error handling
   - Secrets hardcoded
   - SQL injection equivalents (Firestore)

3. **Performance**:
   - Memory leaks
   - Operações pesadas na UI thread
   - Queries ineficientes

4. **Manutenibilidade**:
   - Código legível
   - Documentação adequada
   - Testes críticos

---

## 🌐 Idioma (CRÍTICO)

```kotlin
// ✅ CORRETO
// Processa o pagamento PIX
fun processPixPayment(amount: Double): Result<Payment>

// ❌ ERRADO
// Process PIX payment
fun processarPagamentoPix(amount: Double): Result<Payment>
```

**Regra:**
- Comentários: Português (PT-BR)
- Strings UI: Português (PT-BR)
- Código: English

---

## 🎯 Padrões Obrigatórios

### Análise de Trade-offs (Use para decisões)

**Template para decisões arquiteturais:**

```markdown
# ADR-XXX: [Título da Decisão]

## Status
[Proposto | Aceito | Rejeitado | Deprecated]

## Contexto
[Descreva o problema e por que uma decisão é necessária]

## Opções Consideradas

### Opção 1: [Nome]
**Prós:**
- [Benefício 1]
- [Benefício 2]

**Contras:**
- [Desvantagem 1]
- [Desvantagem 2]

**Riscos:**
- [Risco 1]
- [Risco 2]

### Opção 2: [Nome]
[Repetir estrutura]

### Opção 3: [Nome]
[Repetir estrutura]

## Decisão
[Qual opção foi escolhida e por quê]

## Consequências
**Positivas:**
- [Consequência 1]

**Negativas:**
- [Consequência 2]

## Plano de Implementação
1. [Passo 1]
2. [Passo 2]

## Métricas de Sucesso
- [Como medir se a decisão foi boa]

## Referências
- [Links, documentos, discussões]
```

---

## 🔥 Firebase - Pontos Críticos

### Collections Schema (Crítico para Opus)

**Ver schema completo**: `.agent/QUICK_REFERENCE.md`

**Pontos de atenção para segurança:**

1. **users**:
   - Campo `role` (Admin/FieldOwner/Player) - Validar mudanças
   - Campo `isMock` - Apenas para desenvolvimento
   - Email validation

2. **games**:
   - Campo `status` - Validar transições (SCHEDULED → CONFIRMED → LIVE → FINISHED)
   - Campos de contadores (`confirmationCount`, `goalkeeperCount`) - Sincronizar com subcollection
   - Campo `createdBy` - Apenas criador ou admin pode editar

3. **confirmations** (subcollection):
   - Validar que userId do confirmation == auth.uid
   - Não permitir duplicatas

4. **payments** (a criar):
   - NUNCA armazenar dados de cartão
   - Apenas IDs de transação do gateway
   - Validar webhooks com assinatura

---

## 📊 Métricas de Qualidade (Opus deve validar)

```yaml
métricas_arquiteturais:
  acoplamento: "Baixo (Dependency Inversion via Hilt)"
  coesão: "Alta (cada classe uma responsabilidade)"
  complexidade_ciclomática: "<10 por método"
  profundidade_herança: "<4 níveis"

métricas_código:
  cobertura_testes: "> 70% (atualmente ~0% - URGENTE)"
  duplicação: "< 5%"
  linhas_por_arquivo: "< 500 (exceto repositories grandes)"

métricas_segurança:
  vulnerabilidades_conhecidas: "0"
  secrets_hardcoded: "0"
  validação_input: "100% (boundaries do sistema)"

métricas_performance:
  tempo_inicialização: "< 2s"
  tempo_navegação: "< 300ms"
  memória_uso: "< 100MB (idle)"
  queries_firestore: "< 10 por tela"
```

---

## 🛠️ Ferramentas de Análise

### 1. Análise Estática

```bash
# Lint Android
./gradlew lint

# Detekt (Kotlin static analysis)
./gradlew detekt

# Dependency analysis
./gradlew dependencyInsight --dependency [nome]
```

### 2. Profiling

```bash
# Build com profiling
./gradlew --profile --offline --rerun-tasks assembleDebug

# Ver report em: build/reports/profile/
```

### 3. Security

```bash
# Verificar dependências vulneráveis
./gradlew dependencyCheckAnalyze
```

---

## 🎯 Decisões Arquiteturais Pendentes (Para Opus)

### Decisão 1: Gateway de Pagamento

**Contexto**: Sistema de pagamentos 10% completo

**Opções**:
1. Asaas (brasileiro, bom para PIX)
2. Mercado Pago (mais conhecido)
3. PagSeguro (alternativa)
4. Stripe (internacional, mais caro)

**Precisa decidir**:
- Qual gateway usar
- Arquitetura (direct ou via backend)
- Modelo de dados Firestore
- Tratamento de webhooks

**Responsável**: Opus 4.6

---

### Decisão 2: Backend Node.js vs Firebase Only

**Contexto**:
- Backend Node.js existe (5% implementado) mas não está em uso
- Firebase funciona bem para MVP
- Para escalar, talvez precise backend custom

**Opções**:
1. Continuar Firebase only (simples, rápido)
2. Migrar para Node.js backend (mais controle)
3. Híbrido (Firebase + Functions para lógica complexa)

**Precisa decidir**:
- Vale a pena migrar?
- Quando migrar (se sim)?
- O que migrar primeiro?

**Responsável**: Opus 4.6

---

### Decisão 3: Estratégia de Testes

**Contexto**: Projeto não tem testes (~0% coverage)

**Precisa decidir**:
- Qual % de cobertura almejar?
- Quais componentes testar primeiro?
- Unit tests vs Integration tests (proporção)
- Mockito vs MockK?
- Estratégia de CI/CD

**Responsável**: Opus 4.6

---

## 📚 Documentação de Referência

```yaml
arquitetura: "Este arquivo (OPUS.md)"
regras_universais: ".agentrules"
estado_projeto: ".agent/PROJECT_STATE.md"
navegação_código: ".agent/QUICK_REFERENCE.md"
seleção_modelos: ".agent/MODEL_SELECTION.md"

padrões_firebase: ".agent/FIREBASE_MODERNIZATION.md"
features_pendentes: "IMPLEMENTACAO.md"
setup: "README.md"

desenvolvimento_diário: "CLAUDE.md (Sonnet 4.6)"
análise_visual: "GEMINI.md (Gemini 3 Pro)"
```

---

## 🎯 Workflow Recomendado para Opus

### Para Decisão Arquitetural:

1. **Leia contexto completo**:
   - OPUS.md (este arquivo)
   - .agent/PROJECT_STATE.md
   - .agent/QUICK_REFERENCE.md

2. **Analise código relevante**:
   - Leia repositories, viewmodels relacionados
   - Entenda padrões existentes

3. **Considere trade-offs**:
   - Liste 3+ opções
   - Analise prós/contras de cada
   - Considere riscos

4. **Documente decisão**:
   - Use template ADR acima
   - Justifique escolha
   - Planeje implementação

5. **Valide com stakeholder**:
   - Apresente opções
   - Explique recomendação
   - Ajuste se necessário

---

## ⚠️ Avisos Críticos

1. **Custo**: Opus 4.6 é 5x mais caro que Sonnet - use com sabedoria
2. **Decisões > Implementação**: Opus para pensar, Sonnet para executar
3. **Documente tudo**: Decisões de Opus devem ser documentadas (ADRs)
4. **Valide suposições**: Sempre questione e valide antes de decidir
5. **Trade-offs explícitos**: Sempre mostre prós E contras de cada opção

---

## 🎓 Quando Delegar para Outros Modelos

**Delegue para Sonnet 4.6:**
- Implementação de código após decisão arquitetural
- Desenvolvimento de features bem definidas
- Bug fixes
- Code reviews de PRs pequenos (<500 linhas)

**Delegue para Gemini 3 Pro:**
- Análise visual (screenshots, diagramas)
- Code execution (análise de dados)
- Debugging com multimodal

**Delegue para Gemini 3 Flash:**
- Correções triviais
- Consultas rápidas
- Ajustes de UI

---

## 📊 Status do Projeto (Para Contexto)

```yaml
completas:
  autenticação: 100%
  jogos: 95%
  locais: 90%
  estatísticas: 85%
  jogo_ao_vivo: 80%

parciais_PRIORITÁRIAS_OPUS:
  gamificação: 30%  # Refatoração arquitetural
  pagamentos: 10%   # Design de arquitetura
  exp_jogo: 15%     # Design de features

não_iniciadas_DECISÃO_OPUS:
  schedules: 0%     # Decidir se implementar
  backend_nodejs: 5% # Decidir se migrar
```

---

## 🚀 Próximas Tarefas para Opus 4.6

### Prioridade 1: Design de Pagamentos PIX
- Analisar gateways (Asaas, Mercado Pago, PagSeguro)
- Definir arquitetura (Firebase Functions vs Backend)
- Modelo de dados Firestore
- Estratégia de segurança
- ADR completo

### Prioridade 2: Security Audit
- Revisar firestore.rules (312 linhas)
- Identificar vulnerabilidades
- Recomendar melhorias
- Plano de testes de segurança

### Prioridade 3: Refatoração da Gamificação
- Revisar GamificationRepository (340 linhas)
- Validar arquitetura de auto-award
- Estratégia de consistência de dados
- Performance de cálculo de ranking

---

**Última atualização**: 27/12/2024
**Claude Version**: Opus 4.6
**Context Window**: 200K tokens
**Uso recomendado**: Decisões arquiteturais e análises profundas
**Custo**: Muito alto - reserve para tarefas críticas
