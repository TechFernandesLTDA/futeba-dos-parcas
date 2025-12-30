# Quick Reference - Navegação Rápida do Projeto

Este arquivo fornece um índice rápido para localizar componentes específicos sem necessidade de busca extensa.

## 📁 Estrutura de Arquivos por Feature

### 🔐 Autenticação

**Status**: ✅ 100% Completo

```
data/repository/AuthRepository.kt              # Interface + implementação Firebase Auth
ui/auth/
├── LoginActivity.kt                           # Tela de login
├── LoginViewModel.kt                          # Lógica de login
├── RegisterActivity.kt                        # Tela de registro
└── RegisterViewModel.kt                       # Lógica de registro
res/layout/
├── activity_login.xml                         # Layout de login
└── activity_register.xml                      # Layout de registro
```

**Principais Métodos:**

- `AuthRepository.login(email, password): Result<User>`
- `AuthRepository.register(email, password, name): Result<User>`
- `AuthRepository.getCurrentUser(): User?`
- `AuthRepository.logout()`

---

### ⚽ Jogos

**Status**: ✅ 95% Completo

```
data/model/Game.kt                             # Game, GameConfirmation, Team, GameStatus, Position
data/repository/
├── GameRepository.kt                          # Interface
├── GameRepositoryImpl.kt                      # Implementação Firestore (PRIMARY)
└── FakeGameRepository.kt                      # Mock para testes

ui/games/
├── GamesFragment.kt                           # Lista de jogos com filtros
├── GamesViewModel.kt                          # Lógica da lista
├── GamesAdapter.kt                            # RecyclerView adapter
├── GameDetailFragment.kt                      # Detalhes do jogo + confirmações
├── GameDetailViewModel.kt                     # Lógica de detalhes
├── CreateGameFragment.kt                      # Criação de jogos
├── CreateGameViewModel.kt                     # Lógica de criação
├── ConfirmationsAdapter.kt                    # Adapter de confirmações
├── TeamsAdapter.kt                            # Adapter de times
├── SelectLocationDialog.kt                    # Dialog Google Places
├── SelectFieldDialog.kt                       # Dialog seleção de quadra
└── SelectPositionDialog.kt                    # Dialog goleiro/linha

res/layout/
├── fragment_games.xml                         # Lista de jogos
├── fragment_game_detail.xml                   # Detalhes
├── fragment_create_game.xml                   # Criação
├── item_game.xml                              # Item da lista
├── item_confirmation.xml                      # Item de confirmação
└── item_team_player.xml                       # Item de jogador no time
```

**Collections Firestore:**

- `games` - Documento principal do jogo
- `games/{gameId}/confirmations` - Subcollection de confirmações
- `teams` - Times formados

**Principais Métodos:**

- `GameRepository.getGames(): Flow<Result<List<Game>>>`
- `GameRepository.getGameById(id): Flow<Result<Game>>`
- `GameRepository.createGame(game): Result<String>`
- `GameRepository.confirmGame(gameId, userId, position): Result<Unit>`
- `GameRepository.cancelConfirmation(gameId, userId): Result<Unit>`

---

### 🏟️ Locais e Quadras

**Status**: ✅ 90% Completo

```
data/model/Location.kt                         # Location, Field, FieldType
data/repository/LocationRepository.kt          # CRUD de locais e quadras

ui/locations/
├── LocationDetailFragment.kt                  # Detalhes do local
├── LocationDetailViewModel.kt
├── FieldOwnerDashboardFragment.kt            # Dashboard para donos
├── FieldOwnerDashboardViewModel.kt
├── LocationDashboardAdapter.kt
├── FieldAdapter.kt                           # Adapter de quadras
└── FieldEditDialog.kt                        # Dialog de edição

ui/games/
├── SelectLocationDialog.kt                   # Google Places integration
└── SelectFieldDialog.kt                      # Seleção de quadra

res/layout/
├── fragment_location_detail.xml
├── fragment_field_owner_dashboard.xml
├── item_location_dashboard.xml
└── item_field.xml
```

**Collections Firestore:**

- `locations` - Locais
- `locations/{locationId}/fields` - Quadras do local

**Principais Métodos:**

- `LocationRepository.getLocations(): Flow<List<Location>>`
- `LocationRepository.createLocation(location): Result<String>`
- `LocationRepository.getFields(locationId): Flow<List<Field>>`
- `LocationRepository.createField(locationId, field): Result<String>`

---

### 📊 Estatísticas

**Status**: ✅ 85% Completo

```
data/model/Statistics.kt                       # UserStatistics, PlayerStats
data/repository/
├── StatisticsRepository.kt                    # Interface + implementação
└── FakeStatisticsRepository.kt               # Mock data

ui/statistics/
├── StatisticsFragment.kt                      # Tela Compose
├── StatisticsViewModel.kt
├── StatisticsScreenState.kt
└── RankingAdapter.kt

res/layout/
└── fragment_statistics.xml                    # Host para Compose
```

**Collections Firestore:**

- `statistics` - Stats agregadas por usuário
- `player_stats` - Stats por jogo individual

**Principais Métodos:**

- `StatisticsRepository.getUserStatistics(userId): Flow<UserStatistics?>`
- `StatisticsRepository.updateStatistics(userId, stats): Result<Unit>`

---

### 🎮 Jogo ao Vivo

**Status**: ✅ 80% Completo

```
data/model/LiveGame.kt                         # LiveEvent, LiveEventType
data/repository/LiveGameRepository.kt          # CRUD de eventos ao vivo

ui/livegame/
├── LiveGameFragment.kt                        # Container com tabs
├── LiveGameViewModel.kt
├── LiveStatsFragment.kt                       # Tab de estatísticas
├── LiveStatsViewModel.kt
├── LiveStatsAdapter.kt
├── LiveEventsFragment.kt                      # Tab de eventos/timeline
├── LiveEventsViewModel.kt
├── LiveEventsAdapter.kt
└── AddEventDialog.kt                          # Dialog adicionar evento

res/layout/
├── fragment_live_game.xml                     # Tabs
├── fragment_live_stats.xml
├── fragment_live_events.xml
├── item_live_stat.xml
└── item_live_event.xml
```

**Collections Firestore:**

- `live_games` - Eventos de jogo ao vivo

**Event Types:**

- GOAL, YELLOW_CARD, RED_CARD, SUBSTITUTION

---

### 🏆 Gamificação (Liga/Badges)

**Status**: 🔶 80% Completo

```
data/model/Gamification.kt                     # Season, Badge, Streak, PlayerCard, etc.
data/repository/GamificationRepository.kt      # ✅ 340 linhas completas

ui/league/
├── LeagueFragment.kt                          # ✅ Implementado
├── LeagueViewModel.kt                         # ✅ Implementado
└── adapter/RankingAdapter.kt

res/layout/
├── fragment_league.xml                        # ✅ Layout completo
└── item_ranking.xml                           # ✅ Layout completo
```

**TO DO (20% restante):**

- [ ] Auto-award badges após jogos
- [ ] UI de desbloqueio de badges
- [ ] Tela de conquistas no perfil

**Principais Métodos (Repository):**

- `updateStreak(userId, gameDate): Result<UserStreak>`
- `awardBadge(userId, badgeType): Result<Unit>`
- `getUserBadges(userId): Flow<List<UserBadge>>`
- `getActiveSeason(): Flow<Season?>`
- `getSeasonRanking(seasonId): Flow<List<SeasonParticipation>>`
- `updateSeasonParticipation(userId, seasonId, points): Result<Unit>`

**Badge Types:**

- HAT_TRICK, PAREDAO, ARTILHEIRO_MES
- FOMINHA, STREAK_7, STREAK_30
- ORGANIZADOR_MASTER, INFLUENCER
- LENDA, FAIXA_PRETA, MITO

**Raridades:**

- COMUM, RARO, ÉPICO, LENDÁRIO

---

### 💰 Pagamentos

**Status**: 🔶 90% Completo

```
data/model/Payment.kt                          # ✅ Payment, Crowdfunding, CrowdfundingContribution
data/repository/PaymentRepository.kt           # ✅ Implementado (PIX simulado)
ui/payments/
├── PaymentViewModel.kt                        # ✅ Implementado
└── PaymentBottomSheetFragment.kt              # ✅ QR Code + Copia/Cola
```

**TO DO (10% restante):**

- [ ] Integração com gateway real (Asaas/MercadoPago)
- [ ] Webhooks de validação automática
- [ ] Vaquinha (Crowdfunding UI)

---

### 👥 Perfil

**Status**: ✅ 90% Completo

```
data/repository/UserRepository.kt              # CRUD de usuários

ui/profile/
├── ProfileFragment.kt                         # Visualização de perfil
├── ProfileViewModel.kt
└── EditProfileFragment.kt                     # Edição de perfil

res/layout/
├── fragment_profile.xml
└── fragment_edit_profile.xml
```

**Principais Métodos:**

- `UserRepository.getUserById(id): Flow<User?>`
- `UserRepository.updateUser(user): Result<Unit>`
- `UserRepository.updateProfilePicture(userId, uri): Result<String>`

---

### 🛠️ Developer Tools

**Status**: ✅ 100% Completo

```
ui/developer/DeveloperFragment.kt              # Mock data generator
util/MockDataHelper.kt                         # Helpers para criar mocks

res/layout/fragment_developer.xml
```

**Funcionalidades:**

- Criar usuários mock
- Criar jogos mock com confirmações
- Seed de locais (Ginásio Apollo)
- Reset de dados

---

### 🔧 Admin

**Status**: ✅ 85% Completo

```
ui/admin/
├── UserManagementFragment.kt                  # Gerenciamento de usuários
├── UserManagementViewModel.kt
└── UserManagementAdapter.kt

res/layout/
├── fragment_user_management.xml
└── item_user_management.xml
```

---

## 🗂️ Diretórios Core

### Data Layer

```
data/
├── model/                                     # Domain models
│   ├── User.kt                               # User, UserRole, PreferredPosition
│   ├── Game.kt                               # Game, GameConfirmation, Team, GameStatus
│   ├── Location.kt                           # Location, Field, FieldType
│   ├── Schedule.kt                           # Schedule (recurring games)
│   ├── Statistics.kt                         # UserStatistics, PlayerStats
│   ├── Enums.kt                              # Enums gerais
│   ├── Gamification.kt                       # Season, Badge, Streak, PlayerCard
│   ├── Payment.kt                            # Payment, Crowdfunding
│   ├── GameExperience.kt                     # MVPVote, LiveScore, TacticalBoard
│   └── LiveGame.kt                           # LiveEvent
│
├── repository/                               # Repositories
│   ├── AuthRepository.kt
│   ├── UserRepository.kt
│   ├── GameRepository.kt
│   ├── GameRepositoryImpl.kt                 # ⭐ Implementação principal
│   ├── FakeGameRepository.kt
│   ├── LocationRepository.kt
│   ├── StatisticsRepository.kt
│   ├── FakeStatisticsRepository.kt
│   ├── GamificationRepository.kt             # ⭐ 340 linhas
│   └── LiveGameRepository.kt
│
└── local/                                    # Room Database (cache local)
    ├── AppDatabase.kt
    ├── Converters.kt
    ├── dao/Daos.kt
    └── entities/
```

### UI Layer

```
ui/
├── main/MainActivity.kt                       # Container principal
├── splash/SplashActivity.kt
├── auth/                                      # Login, Register
├── home/HomeFragment.kt                       # Tela inicial
├── games/                                     # ⭐ Feature principal
├── livegame/                                  # Jogo ao vivo
├── locations/                                 # Locais e quadras
├── profile/                                   # Perfil
├── statistics/                                # Estatísticas (Compose)
├── league/                                    # Liga/Ranking (30% completo)
├── players/PlayersFragment.kt                # Busca de jogadores
├── admin/                                     # Admin tools
├── developer/                                 # Dev tools
├── preferences/PreferencesFragment.kt
├── theme/Color.kt                            # Compose theme
└── components/                               # Componentes reutilizáveis
```

### DI (Hilt)

```
di/
├── AppModule.kt                              # Módulo principal, Repositories
├── FirebaseModule.kt                         # Firebase instances
└── DatabaseModule.kt                         # Room Database
```

### Utilities

```
util/
├── PreferencesManager.kt                     # Encrypted SharedPreferences
├── ThemeHelper.kt                            # Tema claro/escuro
├── Extensions.kt                             # Extension functions
├── AppLogger.kt                              # Logger customizado
└── MockDataHelper.kt                         # Mock data generator
```

### Services

```
service/
└── FcmService.kt                             # Firebase Cloud Messaging
```

---

## 🔥 Firebase Collections Schema

### `users`

```kotlin
{
  id: String,
  name: String,
  email: String,
  phoneNumber: String?,
  profilePictureUrl: String?,
  role: "Player" | "FieldOwner" | "Admin",
  preferredPositions: List<"GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD">,
  ratingGoalkeeper: Int,
  ratingDefender: Int,
  ratingMidfielder: Int,
  ratingForward: Int,
  isMock: Boolean,  // Para testes
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `games`

```kotlin
{
  id: String,
  locationId: String,
  locationName: String,
  address: String,
  fieldId: String?,
  fieldName: String?,
  fieldType: "SOCIETY" | "FUTSAL" | "FIELD" | "BEACH" | "SYNTHETIC_GRASS",
  dateTime: Timestamp,
  maxPlayers: Int,
  maxGoalkeepers: Int,
  status: "SCHEDULED" | "CONFIRMED" | "LIVE" | "FINISHED" | "CANCELLED",
  confirmationCount: Int,
  goalkeeperCount: Int,
  pixKey: String?,
  createdBy: String,  // userId
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### `games/{gameId}/confirmations` (subcollection)

```kotlin
{
  userId: String,
  userName: String,
  userPhotoUrl: String?,
  position: "GOALKEEPER" | "LINE_PLAYER",
  confirmedAt: Timestamp
}
```

### `teams`

```kotlin
{
  id: String,
  gameId: String,
  teamNumber: 1 | 2,
  players: List<{
    userId: String,
    name: String,
    photoUrl: String?,
    position: String
  }>,
  createdAt: Timestamp
}
```

### `statistics`

```kotlin
{
  userId: String,
  totalGames: Int,
  wins: Int,
  draws: Int,
  losses: Int,
  goals: Int,
  assists: Int,
  yellowCards: Int,
  redCards: Int,
  cleanSheets: Int,  // Para goleiros
  updatedAt: Timestamp
}
```

### `live_games`

```kotlin
{
  id: String,
  gameId: String,
  type: "GOAL" | "YELLOW_CARD" | "RED_CARD" | "SUBSTITUTION",
  playerId: String,
  playerName: String,
  teamNumber: 1 | 2,
  minute: Int,
  details: String?,
  timestamp: Timestamp
}
```

---

## 🎨 Resources

### Layouts

**Naming Convention:**

- `activity_*.xml` - Activities
- `fragment_*.xml` - Fragments
- `item_*.xml` - RecyclerView items
- `dialog_*.xml` - Dialogs

**Principais:**

- `activity_main.xml` - MainActivity com BottomNavigationView
- `fragment_games.xml` - Lista de jogos com filtros
- `fragment_game_detail.xml` - Detalhes do jogo
- `fragment_create_game.xml` - Criação de jogo
- `fragment_league.xml` - Liga/Ranking
- `item_game.xml` - Item de jogo na lista
- `item_confirmation.xml` - Item de confirmação

### Colors (`res/values/colors.xml`)

```xml
<color name="primary">#58CC02</color>          <!-- Verde vibrante -->
<color name="accent">#FF9600</color>            <!-- Laranja -->
<color name="background">#FFFFFF</color>
<color name="surface">#F5F5F5</color>
<color name="error">#D32F2F</color>
```

### Strings (`res/values/strings.xml`)

Todas as strings de UI estão em português (PT-BR).

---

## 🔍 Como Encontrar Rapidamente

### "Preciso adicionar um novo campo ao User"

1. `data/model/User.kt` - Adicionar propriedade
2. `data/repository/UserRepository.kt` - Adicionar método se necessário
3. Firestore rules (`firestore.rules`) - Validar campo se necessário

### "Preciso modificar a lista de jogos"

1. `ui/games/GamesFragment.kt` - UI
2. `ui/games/GamesViewModel.kt` - Lógica
3. `ui/games/GamesAdapter.kt` - RecyclerView
4. `res/layout/fragment_games.xml` - Layout
5. `res/layout/item_game.xml` - Item do RecyclerView

### "Preciso adicionar um novo tipo de evento ao jogo ao vivo"

1. `data/model/LiveGame.kt` - Adicionar a `LiveEventType`
2. `data/repository/LiveGameRepository.kt` - Verificar métodos
3. `ui/livegame/AddEventDialog.kt` - Adicionar opção no dialog

### "Preciso completar a gamificação"

1. **Usar** `data/repository/GamificationRepository.kt` (já existe, 340 linhas)
2. **Usar** `ui/league/LeagueViewModel.kt` (já existe)
3. **Completar** `ui/league/LeagueFragment.kt` (conectar ViewModel)
4. **Layouts já existem**: `fragment_league.xml`, `item_ranking.xml`
5. **Próximo passo**: Implementar auto-award badges ao finalizar jogo

### "Preciso adicionar uma nova collection no Firestore"

1. Adicionar regras em `firestore.rules`
2. Adicionar índices em `firestore.indexes.json` se necessário
3. Criar model em `data/model/`
4. Criar/atualizar repository em `data/repository/`

---

## 📊 Status Resumido por Feature

| Feature | Status | Arquivos Principais | Faltando |
|---------|--------|---------------------|----------|
| Autenticação | ✅ 100% | AuthRepository, Login/RegisterActivity | - |
| Developer Tools | ✅ 100% | DeveloperFragment, MockDataHelper | - |
| Jogos | ✅ 95% | GameRepository, GamesFragment | Push notifications |
| Locais/Quadras | ✅ 95% | LocationRepository, FieldOwnerDashboard | Google Maps rotas |
| Pagamentos | 🔶 90% | PaymentRepository, PaymentBottomSheet | Webhooks reais |
| Perfil | 🔶 90% | ProfileFragment, EditProfileFragment | Histórico de jogos |
| Estatísticas | ✅ 85% | StatisticsRepository, StatisticsFragment | Detalhamento |
| Admin | ✅ 85% | UserManagementFragment | Bulk actions |
| Jogo ao Vivo | 🔶 80% | LiveGameRepository, LiveGameFragment | Cronômetro |
| Gamificação | 🔶 80% | GamificationRepository, LeagueFragment | Auto-award badges |
| Exp. de Jogo | 🔶 80% | GameExperience, TacticalBoardFragment | Votação MVP UI |

---

## 🚀 Quick Commands

```bash
# Build
./gradlew build

# Instalar
./gradlew installDebug

# Limpar build
./gradlew clean

# Testes
./gradlew test

# Ver tasks disponíveis
./gradlew tasks
```

---

**Última atualização**: 27/12/2024 13:00
