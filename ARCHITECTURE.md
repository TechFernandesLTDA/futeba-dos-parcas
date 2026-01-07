# ARQUITETURA - FUTEBA DOS PARCAS
**Versao**: 1.4.2  
**Ultima Atualizacao**: 2026-01-06

## VISAO GERAL

```
Presentation Layer (UI)
    ↓
Domain Layer (Business Logic)
    ↓
Data Layer (Repositories)
    ↓
Firebase Backend
```

## PADROES

### MVVM
- View: Fragments + Composables
- ViewModel: StateFlow<UiState>
- Model: Data classes + Repositories

### Clean Architecture (3 Layers)
- UI Layer: Apresentacao
- Domain Layer: Regras de negocio
- Data Layer: Acesso a dados

### Dependency Injection (Hilt)
- 8 modulos
- Scopes: Singleton, ViewModelScoped

## FIREBASE

### Collections (11)
- users, games, confirmations, teams
- mvp_votes, statistics, xp_logs
- season_participation, groups, locations
- live_games

### Functions (2)
1. onGameStatusUpdate (XP processing)
2. recalculateLeagueRating (Liga)

## GAMIFICATION

### XP Formula
totalXp = presence + goals + assists + saves + result + mvp + milestones + streak

### League Rating
LR = (PPJ * 0.4) + (WR * 0.3) + (GD * 0.2) + (MVPRate * 0.1)

Divisoes: Bronze (0-29), Prata (30-49), Ouro (50-69), Diamante (70-100)

## SECURITY

- Auth: Firebase Auth + Custom Claims
- Rules: Firestore + Storage
- Encryption: AES256_GCM (local)

## PERFORMANCE

- Cache: LRU (200 entries, 5min TTL)
- Pagination: 50 items/page
- Images: Coil + compression

---

Ver documentacao completa em /docs
