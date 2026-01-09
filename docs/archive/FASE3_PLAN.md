# FASE 3: Telas de Detalhes - Plano de Migração

**Data:** 2026-01-05
**Status:** INICIADO
**Estimativa:** 8-10 horas

---

## 📊 Análise dos Fragments

### 1. **LiveEventsFragment** ⭐ (PRIORIDADE 1)
- **Linhas:** 77
- **Complexidade:** ⭐ Muito Baixa
- **Tipo:** Simples lista de eventos ao vivo
- **Adapter:** LiveEventsAdapter (RecyclerView)
- **ViewModel:** LiveEventsViewModel (observa Flow)
- **Dependências:** Recebe gameId via arguments
- **Estimativa:** 1-1.5 horas

**Características:**
- RecyclerView simples com LinearLayoutManager
- LiveEventsAdapter que submete listas
- Observa viewModel.events (Flow)
- Sem filtros, sem busca, sem menu
- Factory method `newInstance(gameId)`

---

### 2. **LiveStatsFragment** ⭐ (PRIORIDADE 2)
- **Linhas:** 77
- **Complexidade:** ⭐ Muito Baixa
- **Tipo:** Simples lista de estatísticas ao vivo
- **Adapter:** LiveStatsAdapter (RecyclerView)
- **ViewModel:** LiveStatsViewModel (observa Flow)
- **Dependências:** Recebe gameId via arguments
- **Estimativa:** 1-1.5 horas

**Características:**
- Idêntico ao LiveEventsFragment em estrutura
- Só muda o adapter e a source (viewModel.stats)
- Sem filtros, sem busca, sem menu
- Factory method `newInstance(gameId)`

---

### 3. **ManageLocationsFragment** ⭐⭐ (PRIORIDADE 3)
- **Linhas:** 216
- **Complexidade:** ⭐⭐ Média
- **Tipo:** CRUD de locais (campos de futebol)
- **Adapter:** ManageLocationsAdapter (RecyclerView)
- **ViewModel:** ManageLocationsViewModel (com UiState)
- **Features:** Busca, swipeRefresh, FAB, menu com ações
- **Estimativa:** 3-4 horas

**Características:**
- Busca com debounce (doAfterTextChanged)
- SwipeRefresh
- FAB para criar novo local
- Toolbar menu com 2 ações (seed database, deduplicate)
- Diálogos de confirmação para deleção
- Estados: Loading, Success, Error
- Exibe estatísticas (total locais, total campos)

**Migração desafiadora:**
- Busca em tempo real
- Integração com toolbar menu
- Diálogos de confirmação

---

### 4. **GroupDetailFragment** ⭐⭐⭐ (PRIORIDADE 4)
- **Linhas:** 370
- **Complexidade:** ⭐⭐⭐ Alta
- **Tipo:** Detalhes de grupo + gerenciamento de membros
- **Adapter:** GroupMembersAdapter (RecyclerView)
- **ViewModel:** GroupDetailViewModel
- **Features:** Menu com 6+ ações, diálogos, edição inline
- **Estimativa:** 4-5 horas

**Características:**
- Exibe dados do grupo (nome, descrição, imagem)
- Lista de membros com ações (promote, demote, remove)
- Toolbar menu com 8 ações:
  - Invite
  - Cashbox
  - Create Game
  - Edit
  - Transfer Ownership
  - Leave Group
  - Archive
  - Delete
- Múltiplos diálogos de confirmação
- Abre PlayerCardDialog ao clicar membro
- Usa navArgs para receber groupId
- Estados de loading/error

**Migração desafiadora:**
- Menu com muitas ações
- Múltiplos diálogos de confirmação
- Interações complexas com membros
- Gerenciamento de permissões (quem pode fazer o quê)

---

## 🎯 Ordem de Migração

1. **LiveEventsFragment** → LiveEventsScreen.kt (1-1.5h)
2. **LiveStatsFragment** → LiveStatsScreen.kt (1-1.5h)
3. **ManageLocationsFragment** → ManageLocationsScreen.kt (3-4h)
4. **GroupDetailFragment** → GroupDetailScreen.kt (4-5h)

**Total:** 9.5-12 horas estimadas

---

## 🏗️ Padrão a Seguir

Todos os Screens seguirão o mesmo padrão da FASE 2:

```kotlin
@Composable
fun XyzScreen(
    viewModel: XyzViewModel,
    onNavigationAction: (destination) -> Unit = {},
    // ... outros callbacks
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    when (uiState) {
        is XyzUiState.Loading -> LoadingState()
        is XyzUiState.Success -> SuccessContent(state)
        is XyzUiState.Error -> ErrorState(state)
    }
}
```

---

## 🔧 Especificações Técnicas

### LiveEventsScreen
- Composable raiz
- LazyColumn com LiveEventCard
- Estados: Loading (shimmer), Success (lista), Empty
- Sem toolbar (será do Fragment)
- Sem menu
- Atualização em tempo real

### LiveStatsScreen
- Composable raiz
- LazyColumn com LiveStatCard
- Estados: Loading (shimmer), Success (lista), Empty
- Sem toolbar (será do Fragment)
- Sem menu
- Atualização em tempo real

### ManageLocationsScreen
- Composable raiz
- LazyColumn com LocationCard
- Barra de busca (TextField)
- SwipeRefresh integration
- Toolbar menu (Material 3)
- FAB para criar
- Estados: Loading, Success, Error, Empty
- Diálogos de confirmação

### GroupDetailScreen
- Composable raiz
- LazyColumn com:
  - Header (grupo info)
  - Section "Membros"
  - LazyColumn com MemberCard
- Toolbar menu com 8 ações
- Estados: Loading, Success, Error
- Diálogos de confirmação
- PlayerCardDialog via callback

---

## 📋 Checklist

### LiveEventsFragment
- [ ] Explorar LiveEventsViewModel e LiveEventsAdapter
- [ ] Criar LiveEventsScreen.kt
- [ ] Migrar Fragment para ComposeView
- [ ] Testar compilação
- [ ] Commit

### LiveStatsFragment
- [ ] Explorar LiveStatsViewModel e LiveStatsAdapter
- [ ] Criar LiveStatsScreen.kt
- [ ] Migrar Fragment para ComposeView
- [ ] Testar compilação
- [ ] Commit

### ManageLocationsFragment
- [ ] Explorar ManageLocationsViewModel
- [ ] Criar ManageLocationsScreen.kt com busca
- [ ] Implementar SwipeRefresh
- [ ] Implementar toolbar menu
- [ ] Implementar diálogos de confirmação
- [ ] Migrar Fragment
- [ ] Testar compilação
- [ ] Commit

### GroupDetailFragment
- [ ] Explorar GroupDetailViewModel e GroupMembersAdapter
- [ ] Criar GroupDetailScreen.kt
- [ ] Implementar toolbar menu (8 ações)
- [ ] Implementar member actions (promote, demote, remove)
- [ ] Implementar múltiplos diálogos
- [ ] Migrar Fragment
- [ ] Testar compilação
- [ ] Commit

---

## 🎨 Components a Criar

### Shared
- ShimmerCard (para loading)
- EmptyState (para estados vazios)

### LiveEventsScreen
- LiveEventCard (mostra evento com tipo e timestamp)

### LiveStatsScreen
- LiveStatCard (mostra jogador com estatísticas)

### ManageLocationsScreen
- LocationCard (mostra local e campos)
- LocationSearchBar
- LocationMenuBar (com ações)

### GroupDetailScreen
- GroupDetailHeader (mostra info do grupo)
- GroupMemberCard (mostra membro com ações)
- GroupMemberActionMenu

---

## 🚨 Desafios Esperados

1. **LiveEvents/LiveStats:** Recebem gameId via arguments (navArgs → bundle)
   - Solução: Passar via composable parameter

2. **ManageLocations:** Busca em tempo real com debounce
   - Solução: LaunchedEffect + debounce

3. **ManageLocations:** SwipeRefresh em Compose
   - Solução: PullRefreshIndicator + material design 3

4. **GroupDetail:** Múltiplos diálogos de confirmação
   - Solução: Estado no ViewModel para mostrar/esconder diálogos

5. **Toolbar Menu:** Material 3 TopAppBar com menu items
   - Solução: Usar TopAppBar com menu composable

6. **NavArgs:** Usar safe-args generator para tipo safety
   - Já funciona nos Fragments, será passado como parâmetro

---

## ✅ Critérios de Sucesso

- ✅ Sem erros de compilação no módulo app
- ✅ Redução de 50-70% nas linhas do Fragment
- ✅ Todas as features preservadas
- ✅ Material Design 3 aplicado
- ✅ Estados (loading, success, error) implementados
- ✅ Navegação via callbacks
- ✅ Código documentado em PT-BR

---

**Próximo passo:** Começar com LiveEventsFragment (mais simples)
