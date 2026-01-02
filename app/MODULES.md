# 📦 Android Modules & Features - Futeba dos Parças

## Índice
- [Visão Geral](#visão-geral)
- [Home Module](#home-module)
- [Games Module](#games-module)
- [Players Module](#players-module)
- [League Module](#league-module)
- [Statistics Module](#statistics-module)
- [Locations Module](#locations-module)
- [Other Modules](#other-modules)

---

## Visão Geral

App organizado em módulos/features independentes, cada com:
- **Fragment** - UI/Navigation
- **ViewModel** - State management
- **UseCase** - Business logic
- **Repository** - Data access

```
home/
├── HomeFragment.kt
├── HomeViewModel.kt
├── HomeAdapter.kt
├── HomeRepository.kt
└── HomeUseCase.kt
```

---

## Home Module

**Propósito:** Hub central - próximos jogos, notificações rápidas, atalhos

**Path:** `ui/home/`

### Screens

```
HomeFragment (Tab 0)
├── [Header] Bem-vindo, João!
├── [Section] Próximos Jogos
│   └── UpcomingGamesAdapter (RecyclerView)
│       └── GameCard (Compose)
│           - Local: Parque da Mooca
│           - Horário: 19h
│           - Confirmados: 11/12
│           - [Confirmar] button
├── [Section] Notificações
│   └── NotificationsAdapter
│       └── Badge, game invite, etc
└── [FAB] Criar Jogo
```

### State Management

```kotlin
sealed class HomeUiState {
    object Loading
    data class Success(
        val upcomingGames: List<Game>,
        val notifications: List<Notification>,
        val userLevel: Int
    )
    data class Error(val message: String)
}
```

### Navigation

```
home → game_detail
home → create_game
home → notifications
home → groups
```

---

## Games Module

**Propósito:** Listar, criar, e gerenciar jogos

**Path:** `ui/games/`

### Screens

```
GamesFragment (Tab 1)
├── [Filter] Próximos 7 dias, Status
├── GamesAdapter (RecyclerView)
│   └── GameCard
│       - Location
│       - Time
│       - Confirmations: 11/12
│       - Status badge (SCHEDULED, CONFIRMED, etc)
└── [FAB] Criar Jogo

GameDetailFragment
├── [Header] Parque da Mooca
├── [Info]
│   - Data: 15/01/2024
│   - Hora: 19:00-20:00
│   - Quadra: Society #3
│   - Confirmações: 11/12
├── [Section] Confirmações
│   └── ConfirmationsAdapter
│       - Jogador 1: FIELD
│       - Jogador 2: GOALKEEPER
│       - ...
├── [Buttons]
│   - [Confirmar] (if not confirmed)
│   - [Gerar Times] (if organizer)
│   - [Finalizar] (if organizer)
└── [Teams] (after generated)
    - Team A (5 players)
    - Team B (5 players)

CreateGameFragment
├── [Input] Data (date picker)
├── [Input] Hora (time picker)
├── [Input] Local (dropdown)
├── [Input] Quadra (dropdown)
├── [Input] Max Players (spinner)
├── [Input] Preço (EditText)
├── [Button] Criar
└── [Validation] Conflitos de horário
```

### Key Features

- **Time Conflict Detection** - Verifica se horário já tem game
- **Team Generation** - AI-based balancing
- **Live Stats** - Registrar gols, cards, assists
- **Game Status Flow** - SCHEDULED → CONFIRMED → FINISHED

### Navigation

```
games_fragment
├── → game_detail
├── → create_game
├── → create_game_from_template
└── → live_game (when LIVE)

game_detail
├── → teams (generate)
├── → confirm (if not confirmed)
└── → live_game (when LIVE)
```

---

## Players Module

**Propósito:** Diretório de jogadores, busca, perfis

**Path:** `ui/players/`

### Screens

```
PlayersFragment (Tab 2) - "Mercado da Bola"
├── [Search] Buscar jogador
├── PlayersAdapter (RecyclerView)
│   └── PlayerCard
│       - Foto
│       - Nome: João Silva
│       - Level: 8 ⭐
│       - XP: 5200
│       - Games: 42
│       - Goals: 15
│       - [Ver Perfil] button
└── [Filter] Por nível, quadra preferida

PlayerProfileFragment
├── [Header]
│   - Foto
│   - Nome: João Silva
│   - Level 8 (5200/6000 XP)
├── [Stats]
│   - Jogos: 42
│   - Gols: 15
│   - Assists: 8
│   - Taxa de presença: 85%
├── [Badges]
│   └── Badge icons (HAT_TRICK, FOMINHA, etc)
├── [Schedule Stats]
│   - Futsal Segunda: 18 games
│   - Futsal Quarta: 24 games
└── [Buttons]
│   - [Convidar] (invite to game)
│   - [Enviar Mensagem] (blocked for now)
```

### Navigation

```
players_fragment
└── → player_profile

player_profile
└── → invite_to_game
```

---

## League Module

**Propósito:** Rankings por schedule, divisões, temporadas

**Path:** `ui/league/`

### Screens

```
LeagueFragment (Tab 3)
├── [TabLayout]
│   - Futsal Segunda
│   - Futsal Quarta
│   - Global
├── [Filter]
│   - Mês atual
│   - Últimas 4 semanas
├── RankingAdapter (RecyclerView)
│   └── RankingCard
│       Position: 1
│       - Player: João Silva
│       - Level: 8
│       - XP: 5200
│       - Games: 18
│       - Goals: 12
│       - Attendance: 100%
└── [Info]
    - Season: Janeiro 2024
    - Tempo restante: 15 dias

SeasonDetailsFragment
├── [Header] Season Jan 2024
├── [Info]
│   - Início: 01/01
│   - Fim: 31/01
│   - Total players: 24
│   - Total games: 12
├── [Top 10]
│   - Prêmios
│   - Current standings
└── [Past Seasons]
    - Season Dec 2023
    - Season Nov 2023
```

### Key Features

- **Multi-schedule Ranking** - Diferentes rankings por schedule
- **Seasonal Division** - Ligas por temporada
- **XP-based Progression** - Ranking calculado por XP

---

## Statistics Module

**Propósito:** Dashboard de estatísticas pessoais

**Path:** `ui/statistics/`

### Screens

```
StatisticsFragment (Tab 4)
├── [Header] Minhas Estatísticas
├── [XP Bar]
│   - Level: 5
│   - 2500/3000 XP
│   - [Progress bar]
├── [Stats Cards]
│   - Jogos: 42
│   - Gols: 15
│   - Assists: 8
│   - Taxa: 85%
├── [Charts]
│   - Goals por mês (MPAndroidChart)
│   - Attendance rate
│   - Best position (Field/Goalkeeper)
└── [Badges]
    - Coleção desbloqueada (com animação ao unlock)

StatsDetailFragment
├── [Schedule] Futsal Segunda
├── [Stats]
│   - Games: 18
│   - Goals: 12
│   - Assists: 4
├── [Games History]
    └── GameCard (cada jogo)
        - Data
        - Gols/Assists/Saves
        - MVP? (⭐)
```

### Charts

- **Goals Trend** - Gols por mês (line chart)
- **Attendance** - Taxa de presença (pie chart)
- **Performance** - Stats por tipo de jogo (bar chart)

---

## Locations Module

**Propósito:** Gerenciar e descobrir campos/locais

**Path:** `ui/locations/`

### Screens

```
LocationsFragment
├── [Map] GoogleMap (centered on current location)
│   └── Markers para cada field
│       - Tap → LocationDetail
├── [List] Locais próximos
│   └── LocationCard
│       - Nome: Parque da Mooca
│       - Endereco: Rua X, 123
│       - Quadras: 3
│       - Distância: 2.5 km
│       - [Abrir] button

LocationDetailFragment
├── [Header] Parque da Mooca
├── [Photo] Gallery (swipe)
├── [Info]
│   - Endereço: Rua X, 123
│   - Coordenadas: -23.55, -46.63
│   - Tipo: SOCIETY
├── [Fields]
│   └── FieldCard
│       - Quadra 1 (SOCIETY)
│       - Quadra 2 (SOCIETY)
│       - [Ver Horários] button
├── [Reviews/Ratings] (future)
└── [Share] Location

ScheduleListFragment
├── [Header] Horários - Parque da Mooca
├── ScheduleAdapter (RecyclerView)
│   └── ScheduleCard
│       - Futsal Segunda 19h
│       - 12 participantes
│       - Preço: R$ 15/dia
│       - [Participar] / [Já participo]
```

### Key Features

- **Map Integration** - GoogleMaps com markers
- **Offline Locations** - Cache local de campos
- **Geolocation** - Ordenar por distância
- **Address Standardization** - ViaCEP integration

---

## Other Modules

### Groups Module (`ui/groups/`)

```
GroupsFragment
├── [List] Seus grupos
│   └── GroupCard
│       - Nome
│       - Members: 8
│       - Próximo jogo: Segunda 19h
├── [Create Group] FAB
└── [Group Settings]

GroupDetailFragment
├── [Header] Nome do grupo
├── [Members]
│   - Lista de membros
│   - Admin badge
├── [Cashbox]
│   - Saldo: R$ 250
│   - [Extrato] button
├── [Schedules]
│   - Horários do grupo
└── [Settings] (admin only)
```

### Badges Module (`ui/badges/`)

```
BadgesFragment
├── [Badges Obtidas] (locked)
│   └── BadgeCard (com animação unlock)
│       - Icon
│       - Nome
│       - Data desbloqueio
│       - XP reward
└── [Badges Disponíveis] (locked)
    └── BadgeCard (desativado)
        - Icon (grayed out)
        - Como desbloquear
```

### Live Game Module (`ui/livegame/`)

```
LiveGameFragment
├── [Header] Jogo ao vivo
├── [Score Board]
│   - Time A: 3 gols
│   - Time B: 2 gols
│   - Tempo: 35 minutos
├── [Events]
│   - 12' - Gol (João Silva)
│   - 18' - Card vermelho (Pedro)
│   - 25' - Gol (Maria Silva)
├── [Players on Field]
│   - Team A lineup
│   - Team B lineup
└── [Buttons]
    - [Registrar Gol]
    - [Registrar Card]
    - [Finalizar] (organizer)

RecordStatsFragment
├── [Player Selection] Dialog
├── [Stat Type] Gol / Assist / Save / Card
├── [Record]
    - [Confirmar] button
```

### Notifications Module (`ui/notifications/`)

```
NotificationsFragment
├── [Tabs]
│   - All
│   - Games
│   - Badges
│   - Groups
├── NotificationAdapter (RecyclerView)
│   └── NotificationCard
│       - Icon
│       - Title: "Novo jogo criado"
│       - Message: "João criou jogo..."
│       - Timestamp
│       - [Mark as read]
└── [Mark all as read]
```

### Profile Module (`ui/profile/`)

```
ProfileFragment
├── [Header]
│   - Photo
│   - Name
│   - Level 8
│   - XP progress
├── [Quick Stats]
│   - Games: 42
│   - Goals: 15
│   - Badges: 8
├── [Settings]
│   - Theme (Light/Dark/System)
│   - Notifications ON/OFF
│   - Privacy settings
├── [Account]
│   - Email
│   - Phone
│   - Change password
│   - [Logout]
└── [About]
    - Version 1.1.3
    - [Report Bug]
```

---

## Navigation Graph

```
nav_graph.xml
├── homeFragment (start)
│   ├── → gameDetailFragment
│   ├── → createGameFragment
│   └── → notificationsFragment
├── gamesFragment
│   ├── → gameDetailFragment
│   └── → createGameFragment
├── playersFragment
│   └── → playerProfileFragment
├── leagueFragment
│   └── → seasonDetailsFragment
├── statisticsFragment
│   └── → statsDetailFragment
├── locationFragment
│   ├── → locationDetailFragment
│   └── → scheduleListFragment
├── groupsFragment
│   └── → groupDetailFragment
├── badgesFragment
├── profileFragment
│   ├── → preferencesFragment
│   └── → accountSettingsFragment
└── Global actions
    ├── → liveGameFragment
    ├── → notificationsFragment
    └── → invitesFragment
```

---

## Dependency Diagram

```
⬇️ Depends on

Home
└── GameRepository, NotificationRepository, UserRepository

Games
└── GameRepository, LocationRepository, TeamBalancerService

Players
└── UserRepository, StatsRepository

League
└── StatsRepository, SeasonRepository

Statistics
└── StatsRepository, BadgeRepository

Locations
└── LocationRepository, ScheduleRepository

All
└── AuthRepository (for user context)
```

---

## Veja Também

- [README.md](./README.md) - Android app overview
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Clean Architecture, MVVM
- [../DEVELOPMENT_GUIDE.md](../DEVELOPMENT_GUIDE.md) - Padrões de código

---

**Última atualização:** Dezembro 2025
