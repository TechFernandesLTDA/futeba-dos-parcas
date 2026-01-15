# PR PLAN - Plano de Evolução em PRs Pequenos

> Roadmap de pull requests para modernização incremental.
> Última atualização: 2025-01-10

---

## 1. ESTRATÉGIA GERAL

### 1.1 Princípios

- **PRs pequenos:** cada PR deve ser reviewável em < 30 min
- **Mudanças incrementais:** sem reescrita total
- **Validação a cada PR:** todos passam em testes + lint
- **Merge rápido:** não deixar PRs abertos por dias

### 1.2 Tamanho de PR

| Tamanho | Arquivos | Linhas | Complexidade |
|---------|----------|--------|-------------|
| **Pequeno** | 1-5 | < 200 | Baixa |
| **Médio** | 5-10 | 200-500 | Média |
| **Grande** | 10+ | 500+ | Alta (EVITAR) |

---

## 2. ROADMAP DE PRs

### 2.1 FASE 1: Base de Qualidade

#### PR1: Setup de Quality Gates

**Arquivos:** `.github/workflows/validate.yml` (novo)

**Escopo:**
- Adicionar workflow de CI para validação
- Configurar testes automatizados
- Adicionar lint check

**Critérios de Aceite:**
- [ ] CI roda em cada PR
- [ ] Falha se compilação falhar
- [ ] Falha se testes falharem
- [ ] Relatório de testes disponível

**Riscos:** Baixo
**Validação:** Criar PR, verificar CI funcionando

---

#### PR2: Adicionar Testes Base

**Arquivos:** `app/src/test/.../ViewModelTest.kt` (novos)

**Escopo:**
- Adicionar testes para ViewModels principais
- Cobertura mínima de 50% para GamesViewModel, HomeViewModel

**Critérios de Aceite:**
- [ ] Testes passando
- [ ] Cobertura > 50% dos ViewModels
- [ ] Sem mocking excessivo

**Riscos:** Baixo
**Validação:** `./gradlew test`

---

### 2.2 FASE 2: Reduzir Acoplamento

#### PR3: Extrair Interfaces de Repository

**Arquivos:** `shared/src/commonMain/.../repository/*Repository.kt`

**Escopo:**
- Criar interfaces para repositories principais
- Migrar implementações para usar interfaces

**Critérios de Aceite:**
- [ ] Interfaces criadas
- [ ] Implementações usando interfaces
- [ ] Sem quebra de funcionalidade

**Riscos:** Médio (pode quebrar testes)
**Validação:** Testes + manual smoke test

---

#### PR4: Remover Código Duplicado

**Arquivos:** Múltiplos

**Escopo:**
- Identificar código duplicado via IDE
- Extrair para funções/utilitários compartilhados
- Substituir usos

**Critérios de Aceite:**
- [ ] Código duplicado removido
- [ ] Testes passando
- [ ] Sem mudança de comportamento

**Riscos:** Baixo
**Validação:** Testes

---

### 2.3 FASE 3: Modernização UI Híbrida

#### PR5: Migrar CreateGame para Compose

**Arquivos:**
- `app/src/main/java/.../games/CreateGameScreen.kt` (novo)
- `app/src/main/res/layout/fragment_create_game.xml` (remover após)

**Escopo:**
- Criar CreateGameScreen em Compose
- Manter CreateGameFragment como wrapper
- Validar feature completa

**Critérios de Aceite:**
- [ ] Screen funciona idêntico ao XML
- [ ] Todos os estados (loading, error, success)
- [ ] Navegação funcionando
- [ ] Testes manuais passando

**Riscos:** Médio
**Validação:** Manual + screenshots

---

#### PR6: Migrar GameDetail para Compose

**Arquivos:**
- `app/src/main/java/.../games/GameDetailScreen.kt` (novo)
- `app/src/main/res/layout/fragment_game_detail.xml` (remover após)

**Escopo:**
- Criar GameDetailScreen em Compose
- Componentes reutilizáveis para cards, items

**Critérios de Aceite:**
- [ ] Tela funcional
- [ ] Performance OK (sem lag)
- [ ] Acessibilidade mantida

**Riscos:** Médio-Alto
**Validação:** Manual + Profiler

---

#### PR7: Migrar Games (lista) para Compose

**Arquivos:**
- `app/src/main/java/.../games/GamesScreen.kt` (novo)
- `app/src/main/res/layout/fragment_games.xml` (remover após)

**Escopo:**
- LazyColumn com items
- Pull-to-refresh
- Filtros

**Critérios de Aceite:**
- [ ] Lista funcional
- [ ] Pull-to-refresh funcionando
- [ ] Filtros funcionando
- [ ] Scroll suave

**Riscos:** Médio
**Validação:** Manual

---

### 2.4 FASE 4: Performance e Observabilidade

#### PR8: Adicionar Performance Monitoring

**Arquivos:**
- `app/src/main/java/.../util/PerformanceMonitor.kt` (novo)

**Escopo:**
- Adicionar traces customizadas
- Monitorar tempo de carregamento
- Alertas se threshold excedido

**Critérios de Aceite:**
- [ ] Traces configuradas
- [ ] Dashboard Firebase atualizado
- [ ] Alertas configurados

**Riscos:** Baixo
**Validação:** Firebase Console

---

#### PR9: Otimizar Imagens com Coil

**Arquivos:** Todos os AsyncImage usos

**Escopo:**
- Adicionar placeholders
- Configurar cache corretamente
- Otimizar tamanho

**Critérios de Aceite:**
- [ ] Imagens carregam rápido
- [ ] Placeholders visíveis
- [ ] Cache funcionando

**Riscos:** Baixo
**Validação:** Manual + Profiler

---

### 2.5 FASE 5: Cleanup e Documentação

#### PR10: Remover XML Desnecessário

**Arquivos:** Layouts XML não mais usados

**Escopo:**
- Remover layouts após migração completa
- Remover ViewBinding bindings não usados
- Limpar resources

**Critérios de Aceite:**
- [ ] Layouts removidos
- [ ] Build sem warnings
- [ ] APK menor

**Riscos:** Médio (pode quebrar)
**Validação:** Build completo + testes

---

#### PR11: Atualizar Documentação

**Arquivos:** `.claude/*.md`

**Escopo:**
- Atualizar PROJECT_MAP com novo estado
- Atualizar MIGRATION_MODERN_UI
- Documentar novos padrões

**Critérios de Aceite:**
- [ ] Docs atualizadas
- [ ] Sem obsolescência

**Riscos:** Baixo
**Validação:** Leitura

---

## 3. PRIORIZAÇÃO

### 3.1 Matriz Impacto x Risco

| PR | Impacto | Risco | Prioridade |
|----|---------|-------|------------|
| PR1 | Alto | Baixo | **1** |
| PR2 | Alto | Baixo | **2** |
| PR3 | Médio | Médio | 5 |
| PR4 | Médio | Baixo | **3** |
| PR5 | Alto | Médio | **4** |
| PR6 | Alto | Médio-Alto | 6 |
| PR7 | Alto | Médio | 7 |
| PR8 | Médio | Baixo | 8 |
| PR9 | Médio | Baixo | 9 |
| PR10 | Alto | Médio | 10 |
| PR11 | Médio | Baixo | 11 |

### 3.2 Ordem Sugerida

1. PR1 → PR2 → PR4 → PR5 → PR2 (b) → PR6 → PR7 → PR8 → PR9 → PR10 → PR11

---

## 4. TEMPLATE DE PR

### 4.1 Estrutura

```markdown
## Tipo
- [ ] Feature
- [ ] Bugfix
- [ ] Refactor
- [ ] Docs
- [ ] Tests

## Descrição
Breve descrição da mudança.

## Mudanças
- Arquivo 1: o que mudou
- Arquivo 2: o que mudou

## Testes
- [ ] Unit tests passando
- [ ] Manual test realizado
- [ ] Screenshots (se UI)

## Checklist
- [ ] Segue RULES.md
- [ ] Sem strings hardcoded
- [ ] Job tracking nos ViewModels
- [ ] `.catch {}` nos Flows
- [ ] `collectAsStateWithLifecycle()` no Compose
- [ ] `key` em LazyColumn items

## Validado
- [ ] `./gradlew compileDebugKotlin` ✓
- [ ] `./gradlew test` ✓
- [ ] `./gradlew lint` ✓

## Relacionado
Issue #, PR #
```

---

## 5. GESTÃO DE DEPENDÊNCIAS

### 5.1 PRs com Dependência

```
PR3 (Interfaces) → PR5 (CreateGame Screen)
    ↓
  PR5 não pode ser merged antes de PR3

Solução: Branch de PR5 baseado em PR3
```

### 5.2 Como Manusear

```
1. Criar branch feature/PR3
2. Merge PR3
3. Criar branch feature/PR5 baseado em main atualizado
4. Implementar PR5
5. Merge PR5
```

---

## 6. COMUNICAÇÃO

### 6.1 Antes de Abrir PR

- Self-review do código
- Rodar validação local
- Preparar descrição clara

### 6.2 Durante Review

- Responder feedback em 24h
- Fazer ajustes solicitados
- Não fazer force push sem aviso

### 6.3 Após Merge

- Deletar branch
- Atualizar tasks/issues
- Comemorar 🎉

---

## 7. ROLLBACK PLAN

### 7.1 Se PR Introduzir Bug Crítico

```
1. Reverter commit
2. Hotfix branch
3. PR de hotfix
4. Merge emergencial
```

### 7.2 Se Build Quebrar

```
1. Identificar PR causador
2. Reverter ou fix
3. CI deve voltar ao verde
```

---

## 8. MÉTRICAS

### 8.1 Acompanhar

| Métrica | Meta | Atual |
|---------|------|-------|
| PR tamanho médio | < 300 linhas | TBD |
| Tempo de merge | < 24h | TBD |
| % PRs revertidos | < 5% | TBD |
| Test coverage | > 50% | ~35% |

### 8.2 Revisão Mensal

- Avaliar PRs do mês
- Identificar padrões de problemas
- Ajustar processo se necessário
