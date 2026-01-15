# Matriz de Paridade: Legado vs Modern UI (Compose)

**Data**: 2026-01-11
**Versao**: 1.0.0
**Status**: CMD-14 / CMD-15

---

## Resumo Executivo

| Categoria | Legado | Compose | Status |
|-----------|--------|---------|--------|
| Telas Principais | 10 | 10 | 100% |
| Navegacao | XML NavGraph | Compose NavHost | 100% |
| Gerenciamento de Locais | Fragment | Compose Screen | 100% |
| Perfis e Permissoes | Parcial | Completo | 100% |

---

## 1. Matriz de Paridade Detalhada

### 1.1 Bottom Navigation (Barra Inferior)

| Feature | Legado (XML) | Compose (Moderno) | Status |
|---------|--------------|-------------------|--------|
| Home | `HomeFragment` | `HomeScreen` | :white_check_mark: FEITO |
| Jogos | `GamesFragment` | `GamesScreen` | :white_check_mark: FEITO |
| Jogadores | `PlayersFragment` | `PlayersScreen` | :white_check_mark: FEITO |
| Liga/Ranking | `LeagueFragment` | `StatisticsScreen` | :white_check_mark: FEITO* |
| Perfil | `ProfileFragment` | `ProfileScreen` | :white_check_mark: FEITO |

*Observacao: Liga foi consolidada com Estatisticas no Bottom Nav.*

---

### 1.2 Tela de Home

| Feature | Legado | Compose | Status |
|---------|--------|---------|--------|
| Header com usuario | `HomeHeader` | `HomeHeader` | :white_check_mark: FEITO |
| Proximos jogos | `UpcomingGamesSection` | `UpcomingGamesSection` | :white_check_mark: FEITO |
| Confirmacao de presenca | `ConfirmationCard` | `ConfirmationCard` | :white_check_mark: FEITO |
| Challenges | `ChallengesSection` | `ChallengesSection` | :white_check_mark: FEITO |
| Badges recentes | `RecentBadgesCarousel` | `RecentBadgesCarousel` | :white_check_mark: FEITO |
| Streak widget | `StreakWidget` | `StreakWidget` | :white_check_mark: FEITO |
| Activity feed | `ActivityFeedSection` | `ActivityFeedSection` | :white_check_mark: FEITO |

---

### 1.3 Tela de Jogos (Games)

| Feature | Legado | Compose | Status |
|---------|--------|---------|--------|
| Lista de jogos | `GamesFragment` | `GamesScreen` | :white_check_mark: FEITO |
| Filtros (data, local) | `FilterDialog` | `FilterChip` | :white_check_mark: FEITO |
| Criar jogo | `CreateGameFragment` | `CreateGameScreen` | :white_check_mark: FEITO |
| Detalhes do jogo | `GameDetailFragment` | `GameDetailScreen` | :white_check_mark: FEITO |
| Live game | `LiveGameFragment` | `LiveGameScreen` | :white_check_mark: FEITO |
| Votacao MVP | `MVPVoteFragment` | `MVPVoteScreen` | :white_check_mark: FEITO |
| Tactical Board | `TacticalBoardFragment` | Placeholder | :yellow_circle: PARCIAL* |

*Observacao: Tactical Board existe mas esta como placeholder.*

---

### 1.4 Tela de Jogadores (Players)

| Feature | Legado | Compose | Status |
|---------|--------|---------|--------|
| Lista de jogadores | `PlayersFragment` | `PlayersScreen` | :white_check_mark: FEITO |
| Busca/Filtros | `SearchView` | `SearchBar` | :white_check_mark: FEITO |
| Card do jogador | `PlayerCardDialog` | `PlayerCardDialog` | :white_check_mark: FEITO |
| Estatisticas detalhadas | `StatsBottomSheet` | `StatsBottomSheet` | :white_check_mark: FEITO |

---

### 1.5 Tela de Estatisticas/Ranking

| Feature | Legado | Compose | Status |
|---------|--------|---------|--------|
| Tab Layout (Ranking/Evolution) | `StatisticsFragment` | `StatisticsScreen` | :white_check_mark: FEITO |
| Tabela de classificacao | `RankingFragment` | `RankingScreen` | :white_check_mark: FEITO |
| Grafico de evolucao | `EvolutionFragment` | `EvolutionScreen` | :white_check_mark: FEITO |
| Badges | `BadgesFragment` | `BadgesScreen` | :white_check_mark: FEITO |
| XP e nivel | `LevelBadgeHelper` | `LevelBadgeHelper` | :white_check_mark: FEITO |

---

### 1.6 Tela de Perfil

| Feature | Legado | Compose | Status |
|---------|--------|---------|--------|
| Cabecalho com avatar | `ProfileHeader` | `CompactProfileHeader` | :white_check_mark: FEITO |
| Estatisticas rapidas | `StatsCard` | `QuickStatsCard` | :white_check_mark: FEITO |
| Ratings por posicao | `RatingsCard` | `PerformanceCard` | :white_check_mark: FEITO |
| Preferencias de campo | `FieldPreferencesCard` | `PerformanceCard` | :white_check_mark: FEITO |
| Nivel e XP | `LevelCard` | `LevelCard` | :white_check_mark: FEITO |
| Badges recentes | `BadgesSection` | `BadgesSection` | :white_check_mark: FEITO |
| Menu de acoes | `SettingsSection` | `PrimaryActionsSection` | :white_check_mark: FEITO |
| Editar perfil | `EditProfileFragment` | `EditProfileScreen` | :white_check_mark: FEITO |
| Notificacoes | `NotificationsFragment` | `NotificationsScreen` | :white_check_mark: FEITO |
| Preferencias/Configuracoes | `PreferencesFragment` | `PreferencesScreen` | :white_check_mark: FEITO |
| Schedules | `SchedulesFragment` | `SchedulesScreen` | :white_check_mark: FEITO |
| Sobre | `AboutFragment` | Placeholder | :yellow_circle: PARCIAL |
| **Menu Administrativo** | |||
| - Gerenciar usuarios | `UserManagementFragment` | `UserManagementScreen` | :white_check_mark: FEITO |
| - Meus Locais | `FieldOwnerDashboardFragment` | `FieldOwnerDashboardScreen` | :white_check_mark: FEITO |
| - Gerenciar Locais (Admin) | `ManageLocationsFragment` | `ManageLocationsScreen` | :white_check_mark: FEITO |
| - Configuracoes de Liga | `GamificationSettingsFragment` | `GamificationSettingsScreen` | :white_check_mark: FEITO |
| - Menu Developer | `DevToolsFragment` | `DeveloperScreen` | :white_check_mark: FEITO |

---

### 1.7 Tela de Grupos

| Feature | Legado | Compose | Status |
|---------|--------|---------|--------|
| Lista de grupos | `GroupsFragment` | `GroupsScreen` | :white_check_mark: FEITO |
| Detalhes do grupo | `GroupDetailFragment` | `GroupDetailScreen` | :white_check_mark: FEITO |
| Criar grupo | `CreateGroupFragment` | `CreateGroupScreen` | :white_check_mark: FEITO |
| Convidar jogadores | `InvitePlayersFragment` | `InvitePlayersScreen` | :white_check_mark: FEITO |
| Caixinha (Cashbox) | `CashboxFragment` | `CashboxScreen` | :white_check_mark: FEITO |

---

### 1.8 Tela de Locais

| Feature | Legado | Compose | Status |
|---------|--------|---------|--------|
| Mapa de locais | `LocationsMapFragment` | `LocationsMapScreen` | :white_check_mark: FEITO |
| Dashboard dono de quadra | `FieldOwnerDashboardFragment` | `FieldOwnerDashboardScreen` | :white_check_mark: FEITO |
| Gerenciar locais (Admin) | `ManageLocationsFragment` | `ManageLocationsScreen` | :white_check_mark: FEITO |
| Detalhes do local | `LocationDetailFragment` | `LocationDetailScreen` | :white_check_mark: FEITO |
| Criar/Editar local | `LocationDetailFragment` | `LocationDetailScreen` | :white_check_mark: FEITO |
| Adicionar/Editar quadra | `FieldDialog` | `FieldDialog` | :white_check_mark: FEITO |
| Busca de CEP | Via CEP API | Via CEP API | :white_check_mark: FEITO |
| Geocoding | Maps API | Maps API | :white_check_mark: FEITO |
| Seed de locais | `LocationsSeed` | `LocationsSeed` | :white_check_mark: FEITO |
| **Owner + Managers** | `ownerId` apenas | `ownerId + managers` | :white_check_mark: FEITO** |
| **Auditoria** | `createdAt` | `createdAt + updatedAt` | :white_check_mark: FEITO** |

**Novo**: Implementado em CMD-13.

---

## 2. Itens Faltantes e Priorizacao (CMD-15)

### 2.1 Itens Marcados como Descartavel

| Item | Justificativa |
|------|---------------|
| `TacticalBoard` completo | Uso baixo, pode ser implementado sob demanda |
| `AboutScreen` conteudo | Informacao estatica, placeholder suficiente |
| Fragmentos XML obsoletos | Serao removidos na migracao completa |

---

### 2.2 Itens Desejaveis (Backlog)

| Item | Prioridade | Estimativa | Justificativa |
|------|------------|------------|---------------|
| Tactical Board completo | P2 (Baixa) | 4h | Funcional extra, nao critico |
| Dark Mode persistente | P2 (Baixa) | 2h | Ja existe, so persistir |
| Animacoes de transicao | P3 (Muito Baixa) | 3h | Nice to have |
| Offline indicator | P2 (Baixa) | 2h | Melhora UX |

---

### 2.3 Itens Essenciais (Próximos Sprints)

| Item | Prioridade | Estimativa | Justificativa |
|------|------------|------------|---------------|
| **NENHUM** | - | - | Tudo essencial ja foi migrado! |

---

## 3. Aproveitamento por Categoria

```
Bottom Navigation    ████████████████████ 100%
Home                 ████████████████████ 100%
Games                ███████████████████░  95% (Tactical Board)
Players              ████████████████████ 100%
Statistics/Ranking   ████████████████████ 100%
Profile              ███████████████████░  95% (About)
Groups               ████████████████████ 100%
Locations            ████████████████████ 100%
```

**Total Geral: 98% de paridade funcional**

---

## 4. Próximos Passos

1. **Curto Prazo (1 semana)**
   - [ ] Completar `TacticalBoardScreen` (P2)
   - [ ] Adicionar conteudo ao `AboutScreen` (P3)

2. **Medio Prazo (2-4 semanas)**
   - [ ] Remover Fragments XML obsoletos
   - [ ] Clean up de resources nao utilizados

3. **Longo Prazo**
   - [ ] Migracao 100% para Compose
   - [ ] Remover dependencias de XML antigas

---

## 5. Legenda

- :white_check_mark: **FEITO** - Feature completamente implementada em Compose
- :yellow_circle: **PARCIAL** - Feature parcialmente implementada ou placeholder
- :red_circle: **FALTANDO** - Feature nao implementada
- **P1** - Alta prioridade
- **P2** - Media prioridade
- **P3** - Baixa prioridade
