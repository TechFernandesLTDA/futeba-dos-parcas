# Implementação: Swipe to Refresh na Tela de Jogadores

**Data**: 27/12/2024
**Funcionalidade**: Adicionado suporte para recarregar a lista de jogadores manualmente ("Reload").

## 🔧 Alterações Realizadas

### 1. Interface (XML)

- **Arquivo**: `app/src/main/res/layout/fragment_players.xml`
- **Modificação**: Envolvido o `RecyclerView` (`rvPlayers`) com um `SwipeRefreshLayout`.

### 2. Lógica (Kotlin)

- **Arquivo**: `app/src/main/java/com/futebadosparcas/ui/players/PlayersFragment.kt`
- **Listener**: Adicionado `setOnRefreshListener` para chamar `viewModel.loadPlayers()`.
- **Estado**: Atualizado observador do `uiState` para controlar a visibilidade do indicador de carregamento do SwipeRefresh.

## 🎯 Comportamento

1. Usuário arrasta a lista para baixo.
2. Indicador de refresh aparece.
3. ViewModel carrega jogadores novamente do Firestore.
4. Ao finalizar (sucesso ou erro), o indicador desaparece.
5. Em caso de erro, um Toast é exibido.

## ✅ Benefícios

- Permite ao usuário recuperar-se de erros de conexão ou carregamento (como o timeout do índice).
- Permite atualizar a lista para ver novos jogadores cadastrados sem sair da tela.
