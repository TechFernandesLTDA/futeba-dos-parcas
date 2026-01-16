# Mapeamento de Telas - Futeba dos Parças

**Gerado em:** 2026-01-16
**Total de Telas:** 39 (100% Compose)

## Visão Geral

| Categoria | Contagem |
|-----------|----------|
| Compose Screens | 39 |
| XML Fragments | 0 |
| XML Layouts (auxiliares) | 3 |

## Telas por Módulo

### Auth (2 telas)
- [x] `LoginScreen.kt` - Tela de login
- [x] `RegisterScreen.kt` - Tela de registro

### Home (1 tela)
- [x] `HomeScreen.kt` - Tela principal

### Games (3 telas)
- [x] `GamesScreen.kt` - Lista de jogos
- [x] `CreateGameScreen.kt` - Criar jogo
- [x] `GameDetailScreen.kt` - Detalhe do jogo

### Live Game (3 telas)
- [x] `LiveGameScreen.kt` - Jogo ao vivo
- [x] `LiveStatsScreen.kt` - Estatísticas ao vivo
- [x] `LiveEventsScreen.kt` - Eventos ao vivo

### Game Experience (1 tela)
- [x] `MVPVoteScreen.kt` - Votação de MVP

### Groups (5 telas)
- [x] `GroupsScreen.kt` - Lista de grupos
- [x] `CreateGroupScreen.kt` - Criar grupo
- [x] `GroupDetailScreen.kt` - Detalhe do grupo
- [x] `CashboxScreen.kt` - Caixinha do grupo
- [x] `InvitePlayersScreen.kt` - Convidar jogadores

### Players (1 tela)
- [x] `PlayersScreen.kt` - Lista de jogadores

### Profile (3 telas)
- [x] `ProfileScreen.kt` - Perfil do usuário
- [x] `EditProfileScreen.kt` - Editar perfil
- [x] `LevelJourneyScreen.kt` - Jornada de nível

### Statistics (3 telas)
- [x] `StatisticsScreen.kt` - Estatísticas
- [x] `RankingScreen.kt` - Ranking
- [x] `EvolutionScreen.kt` - Evolução

### League (1 tela)
- [x] `LeagueScreen.kt` - Liga/Temporada

### Locations (4 telas)
- [x] `LocationsMapScreen.kt` - Mapa de locais
- [x] `LocationDetailScreen.kt` - Detalhe do local
- [x] `ManageLocationsScreen.kt` - Gerenciar locais
- [x] `FieldOwnerDashboardScreen.kt` - Dashboard do dono

### Schedules (1 tela)
- [x] `SchedulesScreen.kt` - Agendamentos

### Notifications (1 tela)
- [x] `NotificationsScreen.kt` - Notificações

### Badges (1 tela)
- [x] `BadgesScreen.kt` - Badges/Conquistas

### Tactical (1 tela)
- [x] `TacticalBoardScreen.kt` - Quadro tático

### Settings (3 telas)
- [x] `PreferencesScreen.kt` - Preferências
- [x] `ThemeSettingsScreen.kt` - Configurações de tema
- [x] `GamificationSettingsScreen.kt` - Config. gamificação

### Admin (1 tela)
- [x] `UserManagementScreen.kt` - Gerenciar usuários

### Developer (2 telas)
- [x] `DeveloperScreen.kt` - Tela de desenvolvedor
- [x] `DevToolsScreen.kt` - Ferramentas de dev

### About (1 tela)
- [x] `AboutScreen.kt` - Sobre o app

### Splash (1 tela)
- [x] `SplashScreen.kt` - Splash screen

## Layouts XML Auxiliares

| Arquivo | Uso |
|---------|-----|
| `layout_empty_state.xml` | Estado vazio para listas |
| `layout_share_card.xml` | Card para compartilhamento |
| `skeleton_profile.xml` | Skeleton loading do perfil |

## Checklist de Validação Material 3

### Padrões Obrigatórios

- [ ] Uso de `MaterialTheme.colorScheme.*` (nunca cores hardcoded)
- [ ] TopAppBar com `AppTopBar.*Colors()` padronizado
- [ ] Ícones com tint de `MaterialTheme.colorScheme.*`
- [ ] Botões usando Material 3 (Button, OutlinedButton, etc.)
- [ ] Cards com `CardDefaults.cardColors()`
- [ ] Dividers usando `HorizontalDivider` (não `Divider`)
- [ ] Pull-to-refresh usando `PullToRefreshBox`
- [ ] Ícones direcionais usando `Icons.AutoMirrored.*`

### Cores de Gamificação (exceções permitidas)

```kotlin
// Cores que podem ser hardcoded (gamificação):
GamificationColors.Gold     // #FFD700
GamificationColors.Silver   // #E0E0E0
GamificationColors.Bronze   // #CD7F32
GamificationColors.Diamond  // #B9F2FF
GamificationColors.XpGreen  // #00C853
```

## Status de Validação

| Tela | Material 3 | TopBar | Cores | Contraste |
|------|-----------|--------|-------|-----------|
| LoginScreen | ⏳ | ⏳ | ⏳ | ⏳ |
| RegisterScreen | ⏳ | ⏳ | ⏳ | ⏳ |
| HomeScreen | ⏳ | ⏳ | ⏳ | ⏳ |
| ... | ... | ... | ... | ... |

**Legenda:** ✅ OK | ⚠️ Ajustes | ❌ Problemas | ⏳ Pendente
