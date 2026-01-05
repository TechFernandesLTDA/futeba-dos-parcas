# Profile - Jetpack Compose Migration

## Visão Geral

O **ProfileFragment** foi migrado para **Jetpack Compose** mantendo toda a funcionalidade existente e seguindo as melhores práticas modernas do Android.

## Arquivos

### ProfileScreen.kt
Componente Compose principal que implementa toda a UI do perfil.

**Principais features:**
- ✅ Header com avatar circular, nome, email e role badge
- ✅ Card de nível com barra de progresso XP animada
- ✅ Preferências de campo (Society, Futsal, Campo)
- ✅ Ratings por posição com animação (Atacante, Meio, Defensor, Goleiro)
- ✅ Estatísticas resumidas em grid 3x3
- ✅ Badges recentes em LazyRow
- ✅ Botões de ação (Editar Perfil, Sair)
- ✅ Seção de configurações (Notificações, Preferências, Horários, Sobre)
- ✅ Seção administrativa (Admin/Field Owner apenas)
- ✅ Developer Menu (quando ativado via 7 cliques no avatar)
- ✅ Estados: Loading (Shimmer), Success, Error
- ✅ Animações suaves com `animateFloatAsState`
- ✅ Material Design 3

**Componentes extraídos:**
- `ProfileHeader` - Avatar, nome e role
- `LevelCard` - Nível e XP com progress bar
- `FieldPreferencesCard` - Preferências de campo
- `FieldTypeIcon` - Ícone individual de tipo de campo
- `RatingsCard` - Card com 4 ratings
- `RatingItem` - Rating individual com animação
- `StatisticsCard` - Grid de estatísticas
- `StatItem` - Item individual de estatística
- `BadgesSection` - Seção de badges
- `BadgeItem` - Badge individual
- `ActionButtonsSection` - Botões Editar/Sair
- `SettingsSection` - Menu de configurações
- `AdminSection` - Menu administrativo
- `SettingsMenuItem` - Item de menu genérico
- `AdminMenuItem` - Item de menu admin
- `DeveloperMenuCard` - Card do dev menu
- `ErrorState` - Estado de erro
- `ProfileLoadingShimmer` - Loading com shimmer

### ProfileFragment.kt
Fragment simplificado que hospeda o ProfileScreen via `ComposeView`.

**Responsabilidades:**
- Gerenciar navegação (via NavController)
- Observar estado de logout e navegar para LoginActivity
- Mostrar diálogo de confirmação de logout

### ProfileViewModel.kt
Mantido inalterado - usa `StateFlow` para expor estados.

## Padrões Seguidos

### Estados
```kotlin
sealed class ProfileUiState {
    object Loading : ProfileUiState()
    data class Success(...) : ProfileUiState()
    data class Error(val message: String) : ProfileUiState()
    object LoggedOut : ProfileUiState()
}
```

### Composables
- ✅ Uso de `collectAsStateWithLifecycle()` para StateFlows
- ✅ Animações com `animateFloatAsState` e `animateIntAsState`
- ✅ Extração de sub-composables para reusabilidade
- ✅ Preview-friendly (pode adicionar `@Preview` facilmente)
- ✅ Material Design 3 (MaterialTheme.colorScheme)
- ✅ Comentários em português

### Navegação
Callbacks via lambdas passados do Fragment:
```kotlin
onEditProfileClick: () -> Unit,
onSettingsClick: () -> Unit,
onLogoutClick: () -> Unit,
// etc.
```

### Secret Easter Egg
7 cliques consecutivos no avatar (menos de 1s entre cliques) ativam o Developer Mode.

## Testes

### Compilação
O código compila sem erros. Erros do módulo `shared` (KMP) são pré-existentes.

### Verificação
```bash
./gradlew :app:compileDebugKotlin
# Nenhum erro em ProfileScreen.kt ou ProfileFragment.kt
```

## Próximos Passos

1. **Testes de UI**: Adicionar testes de UI com Compose Testing
2. **Preview**: Adicionar `@Preview` para componentes
3. **Accessibility**: Revisar `contentDescription` e suporte a TalkBack
4. **Dark Theme**: Testar em tema escuro
5. **Refatoração**: Extrair constantes de padding/spacing para Design Tokens

## Migração de Outros Fragments

Este padrão pode ser replicado para outros fragments:

1. Criar `XScreen.kt` com a UI em Compose
2. Simplificar `XFragment.kt` para usar `ComposeView`
3. Manter o ViewModel inalterado (já usa StateFlow)
4. Usar callbacks para navegação
5. Extrair sub-composables para reusabilidade

## Recursos

- [Jetpack Compose](https://developer.android.com/jetpack/compose)
- [Material Design 3](https://m3.material.io/)
- [Migration Guide](https://developer.android.com/jetpack/compose/migrate)
- [Compose State](https://developer.android.com/jetpack/compose/state)
- [Compose Animation](https://developer.android.com/jetpack/compose/animation)
