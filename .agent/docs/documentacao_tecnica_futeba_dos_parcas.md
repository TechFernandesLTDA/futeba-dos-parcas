# Futeba dos Parças - Documentacao Tecnica

Aplicativo Android para gestao de peladas (futebol recreativo).

## Stack

| Camada | Tecnologia |
|--------|------------|
| Mobile | Kotlin, Jetpack Compose, Hilt, Room |
| Backend | Firebase (Auth, Firestore, Storage, FCM) |
| Maps | Google Maps & Places API |
| Analytics | Firebase Analytics, Crashlytics, Performance |

**Android**: SDK 35 (target), SDK 24 (min) | Kotlin 2.0 | Java 17

## Arquitetura

```
Android App (MVVM + Clean Architecture)
    |
    v
Firebase Services
    - Authentication (email/senha, Google)
    - Firestore (banco NoSQL)
    - Storage (fotos)
    - Cloud Messaging (push)
```

## Estrutura do Projeto

```
app/src/main/java/com/futebadosparcas/
├── data/
│   ├── model/          # Data classes (User, Game, Schedule, etc)
│   ├── local/          # Room Database + DAOs
│   └── repository/     # Repositories (Auth, Game, Statistics, etc)
├── di/                 # Hilt modules (App, Database, Firebase)
├── domain/usecase/     # Use cases por feature
├── service/            # FCM Service
├── ui/                 # Telas organizadas por feature
│   ├── auth/           # Login, Register
│   ├── home/           # Dashboard
│   ├── games/          # Lista e detalhes de jogos
│   ├── schedule/       # Gerenciar horarios
│   ├── livegame/       # Placar ao vivo
│   ├── statistics/     # Rankings e stats
│   ├── league/         # Ligas e temporadas
│   ├── badges/         # Conquistas
│   ├── payments/       # Pagamentos e vaquinhas
│   ├── profile/        # Perfil do usuario
│   ├── locations/      # Mapa de locais
│   ├── tactical/       # Quadro tatico
│   └── components/     # Componentes reutilizaveis
└── util/               # Extensions, helpers
```

## Modelos de Dados (Firestore)

### Core

**users**
- id, email, name, phone, photoUrl
- preferredPosition (GOALKEEPER, FIELD)
- isSearchable, fcmToken
- createdAt, updatedAt

**locations**
- id, name, address, city, state
- latitude, longitude, photoUrl
- createdBy

**schedules** (horarios recorrentes)
- id, name, locationId, ownerId
- dayOfWeek (0-6), time, duration
- maxPlayers, dailyPrice, monthlyPrice
- isPublic

**games** (jogos especificos)
- id, scheduleId, date, time
- status (SCHEDULED, CONFIRMED, IN_PROGRESS, FINISHED, CANCELLED)
- maxPlayers, confirmedPlayers[]
- teams[], dailyPrice

**game_confirmations**
- id, gameId, oderId
- status (CONFIRMED, CANCELLED, WAITING_LIST)
- isCasual, confirmedAt

### Gamificacao

**seasons** (temporadas/ligas)
- id, name, startDate, endDate
- isActive, scheduleId

**season_participations**
- userId, seasonId, division (BRONZE, PRATA, OURO, DIAMANTE)
- points, wins, draws, losses
- goalsScored, goalsConceded, mvpCount

**badges** (conquistas)
- id, type, name, description
- iconUrl, xpReward
- rarity (COMUM, RARO, EPICO, LENDARIO)

Tipos: HAT_TRICK, PAREDAO, ARTILHEIRO_MES, FOMINHA, STREAK_7, STREAK_30, ORGANIZADOR_MASTER, INFLUENCER, LENDA, FAIXA_PRETA, MITO

**user_badges**
- userId, badgeId, count
- unlockedAt, lastEarnedAt

**user_streaks**
- userId, scheduleId
- currentStreak, longestStreak
- lastGameDate

**weekly_challenges**
- id, name, description, type
- targetValue, xpReward
- startDate, endDate, isActive

Tipos: SCORE_GOALS, WIN_GAMES, ASSISTS, CLEAN_SHEETS, PLAY_GAMES, INVITE_PLAYERS

**player_cards** (album de figurinhas)
- userId, season
- attackRating, defenseRating, physicalRating, techniqueRating
- overallRating, rarity, level
- specialTrait

**head_to_head** (confronto direto)
- player1Id, player2Id
- player1Wins, player2Wins, draws
- player1Goals, player2Goals, totalGames

### Pagamentos

**payments**
- id, gameId, userId
- amount, type (DAILY, MONTHLY)
- method (PIX, CASH, CARD, TRANSFER)
- status (PENDING, PAID, OVERDUE, CANCELLED)
- paidAt

**crowdfundings** (vaquinhas)
- id, scheduleId, creatorId
- title, description, targetAmount
- currentAmount, deadline
- status (ACTIVE, COMPLETED, CANCELLED)

### Experiencia de Jogo

**game_stats**
- gameId, oderId, teamId
- goals, saves
- isBestPlayer, isWorstPlayer, bestGoal

**mvp_votes**
- gameId, oderId, odedPlayerId
- category (MVP, CRAQUE, PIOR)

**live_scores**
- gameId, oderId, odedAt
- eventType (GOAL, SAVE, YELLOW_CARD, etc)
- teamId

## Features Principais

1. **Autenticacao** - Email/senha e Google Sign-In
2. **Horarios** - Criar peladas recorrentes (ex: toda terca 20h)
3. **Confirmacao** - Confirmar presenca com lista em tempo real
4. **Times** - Formacao automatica ou manual
5. **Estatisticas** - Gols, defesas, rankings, graficos
6. **Gamificacao** - Badges, streaks, desafios semanais, ligas
7. **Pagamentos** - Controle de quem pagou, vaquinhas
8. **Notificacoes** - Push para lembretes e convites
9. **Mapa** - Localizar quadras proximas
10. **Placar ao Vivo** - Acompanhar jogo em tempo real
11. **Quadro Tatico** - Montar escalacao visual
12. **Sistema de XP e Niveis** - Evolucao do jogador (nivel 0-10)
13. **Rankings por Periodo** - Semana, mes, ano, historico
14. **Sistema de Ligas** - Bronze, Prata, Ouro, Diamante

## Sistema de Ranking e Evolucao

### Niveis (0-10)

| Nivel | Nome | XP Acumulado |
|-------|------|--------------|
| 0 | Novato | 0 |
| 1 | Iniciante | 100 |
| 2 | Amador | 350 |
| 3 | Regular | 850 |
| 4 | Experiente | 1.850 |
| 5 | Habilidoso | 3.850 |
| 6 | Profissional | 7.350 |
| 7 | Expert | 12.850 |
| 8 | Mestre | 20.850 |
| 9 | Lenda | 32.850 |
| 10 | Imortal | 52.850 |

### XP por Partida

| Evento | XP | Limite |
|--------|----| ------|
| Participacao | 25 | - |
| Gol | 15 | Max 5/jogo |
| Assistencia | 10 | Max 5/jogo |
| Defesa (goleiro) | 8 | Max 10/jogo |
| Clean Sheet | 30 | - |
| Vitoria | 15 | - |
| Empate | 5 | - |
| MVP | 50 | - |

### Ligas

| Divisao | Rating |
|---------|--------|
| Bronze | 0-29 |
| Prata | 30-49 |
| Ouro | 50-69 |
| Diamante | 70-100 |

**Promocao**: Rating acima do limite por 3 jogos consecutivos
**Rebaixamento**: Rating abaixo do limite por 3 jogos consecutivos
**Protecao**: 5 jogos de imunidade apos promocao

### Colecoes de Ranking

```
/statistics/{userId}         # Estatisticas agregadas
/xp_logs/{logId}            # Historico de XP por jogo
/ranking_deltas/{deltaId}   # Incrementos por periodo
/rankings/{rankingId}       # Rankings consolidados
/season_participation/{id}  # Participacao em ligas
```

### Fluxo de Finalizacao

```
Game FINISHED
    |
    v
MatchFinalizationService.processGame()
    |
    +---> Calcular XP (XPCalculator)
    +---> Atualizar statistics
    +---> Verificar milestones (MilestoneChecker)
    +---> Atualizar user.experiencePoints
    +---> Recalcular user.level
    +---> Criar xp_log
    +---> Atualizar ranking_deltas
    +---> Atualizar season_participation
    |
    v
BadgeAwarder.checkAndAwardBadges()
```

## Colecoes Firestore

```
/users/{userId}
/locations/{locationId}
/schedules/{scheduleId}
/schedules/{scheduleId}/members/{oderId}
/games/{gameId}
/games/{gameId}/confirmations/{oderId}
/games/{gameId}/stats/{oderId}
/games/{gameId}/teams/{teamId}
/seasons/{seasonId}
/seasons/{seasonId}/participations/{oderId}
/badges/{badgeId}
/user_badges/{oderId}/{badgeId}
/user_streaks/{oderId}
/weekly_challenges/{challengeId}
/crowdfundings/{crowdfundingId}
/payments/{paymentId}
/notifications/{oderId}/{notificationId}
```

## Dependencias Principais

```kotlin
// Firebase
firebase-auth, firebase-firestore, firebase-storage, firebase-messaging

// DI
hilt-android 2.51.1

// UI
jetpack-compose, material3, navigation, coil, lottie, MPAndroidChart

// Local
room 2.6.1

// Maps
play-services-maps, play-services-location, places

// Async
kotlinx-coroutines
```

## Scripts Uteis

```bash
# Build debug
./gradlew assembleDebug

# Instalar no device
./gradlew installDebug

# Limpar
./gradlew clean
```
