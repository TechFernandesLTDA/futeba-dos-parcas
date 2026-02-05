# ShimmerLoading Audit - P2 #12

**Auditoria:** 2026-02-05
**Status:** 70% - Em Progresso
**Verificador:** Claude Code Agent

---

## RESUMO EXECUTIVO

De **25 telas com listas (LazyColumn/LazyRow)**:
- ✅ **19 telas** (76%) - Usando Shimmer corretamente
- ⚠️ **6 telas** (24%) - Usando CircularProgressIndicator em listas (PRECISA MIGRAR)

**Recomendação:** Migrar as 6 telas restantes para usar `LoadingState()` com tipos apropriados.

---

## 1. TELAS COM SHIMMER - CORRETAS ✅ (19)

### Componentes Específicos
1. **GamesScreen** - `ShimmerGameCard()`
2. **PlayersScreen** - `ShimmerPlayerCard()`

### Componentes Genéricos (LoadingState)
3. **CashboxScreen** - `LoadingState(shimmerCount = 1, itemType = LoadingItemType.CARD)`
4. **GroupDetailScreen** - Shimmer genérico
5. **GroupsScreen** - Shimmer genérico
6. **UserManagementScreen** - Shimmer genérico
7. **InvitePlayersScreen** - `UserItemShimmer()`
8. **FieldOwnerDashboardScreen** - Shimmer genérico

### Componentes de Caixa (ShimmerBox)
9. **HomeScreen** - `ShimmerBox()`
10. **LeagueScreen** - `ShimmerBox()`
11. **RankingScreen** - `ShimmerBox()`

### Componentes com Lógica Customizada
12. **GameDetailScreen** - Shimmer para comentários
13. **LiveEventsScreen** - Shimmer
14. **LiveStatsScreen** - Shimmer
15. **NotificationsScreen** - Shimmer
16. **ProfileScreen** - Shimmer
17. **StatisticsScreen** - Shimmer

### Componentes com ProgressIndicator Apropriado
18. **VoteResultScreen** - `LinearProgressIndicator` (barra de progresso, ✅ correto)
19. **LevelJourneyScreen** - `LinearProgressIndicator` (barra de progresso, ✅ correto)

---

## 2. TELAS COM CIRCULAR EM LISTAS - PRECISA MIGRAR ⚠️ (6)

### Tela 1: SchedulesScreen
- **Localização:** `app/src/main/java/com/futebadosparcas/ui/schedules/SchedulesScreen.kt`
- **Tipo de Conteúdo:** Lista de cronogramas em `LazyColumn`
- **Problema:** Usa `CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))`
- **Solução Recomendada:**
  ```kotlin
  is SchedulesUiState.Loading -> {
      LoadingState(shimmerCount = 8, itemType = LoadingItemType.LIST_ITEM)
  }
  ```
- **Prioridade:** 🔴 ALTA (tela importante)

### Tela 2: GlobalSearchScreen
- **Localização:** `app/src/main/java/com/futebadosparcas/ui/search/GlobalSearchScreen.kt`
- **Tipo de Conteúdo:** Resultados de busca em lista
- **Problema:** Usa `CircularProgressIndicator()`
- **Solução Recomendada:**
  ```kotlin
  is SearchUiState.Loading -> {
      LoadingState(shimmerCount = 8, itemType = LoadingItemType.CARD)
  }
  ```
- **Prioridade:** 🟡 MÉDIA

### Tela 3: LocationSelectorScreen
- **Localização:** `app/src/main/java/com/futebadosparcas/ui/games/LocationSelectorScreen.kt`
- **Tipo de Conteúdo:** Seleção de locais
- **Problema:** Usa `CircularProgressIndicator()` para loading inicial
- **Solução Recomendada:**
  ```kotlin
  is LocationSelectorUiState.Loading -> {
      LoadingState(shimmerCount = 8, itemType = LoadingItemType.LOCATION_CARD)
  }
  ```
- **Prioridade:** 🟡 MÉDIA

### Tela 4: LocationDetailScreen
- **Localização:** `app/src/main/java/com/futebadosparcas/ui/locations/LocationDetailScreen.kt`
- **Tipo de Conteúdo:** Detalhes de local
- **Problema:** Usa `CircularProgressIndicator()`
- **Solução Recomendada:**
  ```kotlin
  is LocationDetailUiState.Loading -> {
      LoadingState(shimmerCount = 4, itemType = LoadingItemType.LOCATION_CARD)
  }
  ```
- **Prioridade:** 🟡 MÉDIA

### Tela 5: TeamFormationScreen
- **Localização:** `app/src/main/java/com/futebadosparcas/ui/games/teamformation/TeamFormationScreen.kt`
- **Tipo de Conteúdo:** Formação de times com jogadores
- **Problema:** Usa `CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))`
- **Solução Recomendada:**
  ```kotlin
  is TeamFormationUiState.Loading -> {
      LoadingState(shimmerCount = 12, itemType = LoadingItemType.PLAYER_CARD)
  }
  ```
- **Prioridade:** 🔴 ALTA (tela importante)

### Tela 6: OwnerStatsScreen
- **Localização:** `app/src/main/java/com/futebadosparcas/ui/games/owner/OwnerStatsScreen.kt`
- **Tipo de Conteúdo:** Estatísticas do proprietário
- **Problema:** Usa `CircularProgressIndicator()` quando `isLoading = true`
- **Solução Recomendada:**
  ```kotlin
  if (isLoading) {
      LoadingState(shimmerCount = 6, itemType = LoadingItemType.CARD)
  } else {
      // conteúdo normal
  }
  ```
- **Prioridade:** 🟡 MÉDIA

---

## 3. TELAS COM CIRCULAR EM AÇÕES PONTUAIS - OK ✅

Essas telas usam `CircularProgressIndicator` de forma apropriada (em botões, dialogs, ações):

1. **LoginScreen** - Carregamento de login (ação pontual)
   - Uso: `AnimatedVisibility(visible = uiState is LoginState.Loading)`
   - ✅ CORRETO

2. **CreateGameScreen** - Criação de jogo + overlay de loading
   - Uso: Múltiplas instâncias para overlay e botão
   - ✅ CORRETO

3. **CreateGroupScreen** - Criação de grupo
   - Uso: Em botão de salvar
   - ✅ CORRETO

4. **BadgesScreen** - Renderização de progresso de badge
   - Uso: `CircularProgressIndicator(progress = { staticProgress })`
   - ✅ CORRETO (renderização, não loading)

---

## 4. PADRÕES DE CÓDIGO RECOMENDADOS

### ✅ PARA LISTAS (LazyColumn/LazyRow)
```kotlin
when (uiState) {
    is UiState.Loading -> {
        // Use LoadingState com tipo apropriado
        LoadingState(shimmerCount = 8, itemType = LoadingItemType.CARD)
    }
    is UiState.Success -> {
        // renderizar lista
        LazyColumn {
            items(data) { item ->
                ItemCard(item)
            }
        }
    }
    is UiState.Error -> {
        ErrorState(message = uiState.message)
    }
}
```

### ✅ PARA AÇÕES PONTUAIS (Botões, Dialogs)
```kotlin
Button(
    onClick = { /* ... */ },
    enabled = !isLoading
) {
    if (isLoading) {
        CircularProgressIndicator(
            modifier = Modifier.size(20.dp),
            strokeWidth = 2.dp
        )
    } else {
        Text("Confirmar")
    }
}
```

### ✅ PARA TELA INTEIRA COM OVERLAY
```kotlin
Box(modifier = Modifier.fillMaxSize()) {
    if (isLoading) {
        FullScreenLoadingState(message = "Carregando...")
    } else {
        // conteúdo normal
    }
}
```

---

## 5. TIPOS DE LOADING DISPONÍVEIS

Veja `app/src/main/java/com/futebadosparcas/ui/components/states/LoadingState.kt`:

```kotlin
enum class LoadingItemType {
    CARD,            // Card genérico 120dp height
    GAME_CARD,       // Card de jogo (específico)
    PLAYER_CARD,     // Card de jogador (específico)
    RANKING_ITEM,    // Item de ranking
    LIST_ITEM,       // Item simples 72dp height
    LOCATION_CARD    // Card de local com wave staggered
}
```

---

## 6. CHECKLIST DE IMPLEMENTAÇÃO

Para migrar cada tela:

- [ ] Remover import de `CircularProgressIndicator`
- [ ] Adicionar import: `import com.futebadosparcas.ui.components.states.LoadingState`
- [ ] Adicionar import: `import com.futebadosparcas.ui.components.states.LoadingItemType`
- [ ] Substituir bloco `is UiState.Loading` com chamada a `LoadingState()`
- [ ] Testar em emulador/dispositivo (visual)
- [ ] Verificar que animação funciona
- [ ] Confirmar que toca/não toca quando loading

---

## 7. IMPACTO DA MUDANÇA

| Aspecto | Impacto |
|---------|---------|
| **UX** | ⬆️ Melhorado - Usuário percebe que dados estão carregando |
| **Consistência** | ⬆️ Melhorada - Visual uniforme em todas as telas |
| **Performance** | ➡️ Sem impacto - Shimmer usa mesma animação que Circular |
| **Acessibilidade** | ⬆️ Melhorada - Shimmer não interfere com content descriptions |
| **Manutenção** | ⬆️ Melhorada - Padrão centralizado |

---

## 8. PRÓXIMAS AÇÕES

**Curto Prazo (Esta semana):**
1. Migrar **SchedulesScreen** (prioridade alta)
2. Migrar **TeamFormationScreen** (prioridade alta)
3. Testar em ambos os temas (claro/escuro)

**Médio Prazo (Próxima semana):**
4. Migrar **GlobalSearchScreen**
5. Migrar **LocationSelectorScreen**
6. Migrar **LocationDetailScreen**
7. Migrar **OwnerStatsScreen**

**Documentação:**
8. Adicionar seção de "ShimmerLoading" em `.claude/rules/compose-patterns.md`
9. Adicionar exemplos em `CLAUDE.md` de uso correto

---

## 9. REFERÊNCIAS

- **Componente:** `app/src/main/java/com/futebadosparcas/ui/components/modern/ShimmerLoading.kt`
- **LoadingState:** `app/src/main/java/com/futebadosparcas/ui/components/states/LoadingState.kt`
- **Padrão:** `.claude/rules/compose-patterns.md`

---

**Última Atualização:** 2026-02-05
**Checklist:** P2 #12 - Usar ShimmerLoading consistentemente
