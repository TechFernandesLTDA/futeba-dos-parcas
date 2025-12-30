# 📋 Business Rules & Functional Logic

## 🏆 Gamification System

The core engagement engine of **Futeba dos Parças**.

### XP (Experience Points)

Players earn XP based on their performance in matches.

- **Participation**: Fixed amount for showing up? (See `MatchFinalizationService`).
- **Performance**:
  - **Victory**: +3 Points (Standard soccer rules).
  - **Draw**: +1 Point.
  - **Defeat**: 0 Points.
- **Roles/Achievements**:
  - **MVP (Craque da Partida)**: Bonus XP (e.g., +10 XP).
  - **Best Goalkeeper (Melhor Goleiro)**: Bonus XP (e.g., +8 XP).
  - **Golden Boot**: Awarded for top scorer?

### Rankings

- **Global Ranking**: All-time XP accumulation.
- **Season/Monthly Ranking**: Resets periodically to keep competition fresh.
- **Calculation**: Triggered via `MatchFinalizationService` using Batch writes to ensure atomicity.

## ⚽ Game Management

### Match Lifecycle

1. **Creation**: Admin/Owner creates a game, sets location, time, and type (Futsal, Society, Field).
2. **Lobby/Check-in**: Players confirm presence.
3. **Team Generation**: App balances teams based on player stats (`nivel_tecnico`).
4. **Live Game**: Score tracking, events (goals, cards).
5. **Finalization**: Match ends, stats are frozen, voting begins.
6. **Voting**: Players vote for MVP, Best Keeper, etc.
7. **Processing**: XP distributed, stats updated.

### Roles & Permissions

- **Admin/Owner**: Can create games, edit results, ban players from groups.
- **Player**: Can join games, vote, view stats.
- **Guest**: Limited access (if applicable).

## 👥 Group Dynamics

- **Groups**: Players form groups (peladas) to organize recurring games.
- **Invites**: System allows inviting users via email/link.
- **Management**: Owners control the roster.

## ⚠️ Critical Constraints

- **Data Integrity**: Match results are final once processed.
- **Offline First**: (If applicable) Partial support, but finalization requires sync.
- **Validation**: Cannot finalize a game without a score? (To be verified).
