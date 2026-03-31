# Auditoria de Migração Global (APP_MIGRATION_AUDIT.md)

Este documento lista todos os componentes legados (ViewBinding, RecyclerView, DialogFragment) identificados no projeto fora do módulo `ui/games`, organizados por prioridade de migração/limpeza.

## 📊 Resumo Global

O projeto está em um estado **Híbrido**. Muitos módulos possuem telas Compose (`Screen.kt`) coexistindo com implementações antigas (`Fragment.kt` + `Adapter.kt`). Isso sugere que a migração foi iniciada mas a limpeza não foi concluída.

- **Módulos Críticos (Híbridos)**: Groups, Home, Locations, LiveGame, Statistics
- **Módulos 100% Compose**: Games, Auth (Parcial/Híbrido)
- **Módulos Legados**: Admin, DevTools, alguns Dialogs isolados

---

## 🛠️ Detalhamento por Módulo

### 1. Groups (`ui/groups`)

**Status**: ✅ 100% Compose
Todos os componentes legados foram migrados ou deletados.

- **Adapters (RecyclerView)**:
  - ~~`GroupsAdapter.kt`~~ (Deletado)
  - ~~`GroupMembersAdapter.kt`~~ (Deletado)
  - ~~`InvitePlayersAdapter.kt`~~ (Deletado)
  - ~~`CashboxEntriesAdapter.kt`~~ (Deletado)
  - ~~`TransferOwnershipAdapter.kt`~~ (Deletado)
- **Fragments/Dialogs**:
  - `CreateGroupFragment.kt` (Wrapper para `ComposeView`)
  - `GroupDetailFragment.kt` (Wrapper para `ComposeView`)
  - `CashboxFragment.kt` (Wrapper para `ComposeView`)
  - `GroupsFragment.kt` (Wrapper para `ComposeView`)
  - ~~`EditGroupDialog.kt`~~ (Deletado - Migrado para `ComposeGroupDialogs.kt`)
  - ~~`TransferOwnershipDialog.kt`~~ (Deletado - Migrado para `ComposeGroupDialogs.kt`)
  - ~~`AddCashboxEntryDialogFragment.kt`~~ (Deletado - Migrado para `ComposeGroupDialogs.kt`)

### 2. Home (`ui/home`)

**Status**: ✅ 100% Compose
Todos os componentes legados foram migrados ou deletados.

- **Adapters**:
  - ~~`UpcomingGamesAdapter.kt`~~ (Deletado)
- **Fragments**:
  - `HomeFragment.kt` (Wrapper para `ComposeView`)

### 3. Live Game (`ui/livegame`)

**Status**: ✅ 100% Compose
Módulo migrado com sucesso. `LiveGameFragment.kt` atua como wrapper simples.

- **Adapters**:
  - ~~`LiveEventsAdapter.kt`~~ (Deletado - Substituído por `LiveEventsScreen`)
  - ~~`LiveStatsAdapter.kt`~~ (Deletado - Substituído por `LiveStatsScreen`)
- **Fragments/Dialogs**:
  - ~~`AddEventDialog.kt`~~ (Deletado - Migrado para `AddEventBottomSheet` em `LiveGameScreen`)

### 4. Locations (`ui/locations`)

**Status**: ✅ 90% Compose
A maioria das telas foi migrada. `LocationsMapFragment` ainda usa XML/GoogleMapsView.

- **Adapters**:
  - ~~`ManageLocationsAdapter.kt`~~ (Deletado)
  - ~~`ManageFieldsAdapter.kt`~~ (Deletado)
  - ~~`LocationDashboardAdapter.kt`~~ (Deletado)
  - ~~`FieldAdapter.kt`~~ (Deletado)
  - ~~`ReviewsAdapter.kt`~~ (Deletado)
- **Dialogs**:
  - ~~`FieldEditDialog.kt`~~ (Deletado - Migrado internamente em `LocationDetailScreen`)

### 5. Statistics & Rankings (`ui/statistics` & `ui/league`)

**Status**: ✅ 100% Compose
Todas as telas principais (Statistics, Ranking, Evolution) são wrappers Compose.

- **Adapters**:
  - ~~`RankingAdapter.kt`~~ (Deletado)
- **Fragments**:
  - `EvolutionFragment.kt` (Wrapper para `ComposeView`)
  - `RankingFragment.kt` (Wrapper para `ComposeView`)
  - `StatisticsFragment.kt` (Wrapper para `ComposeView`)
  - `PostGameDialogFragment.kt` (Wrapper para `ComposeView`)

### 6. Players (`ui/players`)

**Status**: ✅ 100% Compose
Módulo migrado. `PlayersFragment` é wrapper. `PlayerCardDialog` migrado para Compose (wrapper).

- **Adapters**:
  - ~~`PlayersAdapter.kt`~~ (Deletado - Substituído por `PlayersScreen`)
- **Fragments/Dialogs**:
  - ~~`ComparePlayersDialogFragment.kt`~~ (Deletado - Substituído por `ComparePlayersUiDialog`)
  - `PlayerCardDialog.kt` (Wrapper Compose)

### 7. Outros Módulos

Componentes espalhados que precisam de atenção pontual.

- **Profile**: `UserBadgesAdapter.kt`, `EditProfileFragment.kt`
- **Schedules**: `SchedulesAdapter.kt`, `SchedulesFragment.kt`, `EditScheduleDialogFragment.kt`
- **Notifications**: `NotificationsAdapter.kt`
- **Game Experience**: `VoteCandidatesAdapter.kt`, `MVPVoteFragment.kt`
- **Tactical**: `TacticalBoardFragment.kt`
- **Badges**: `BadgesAdapter.kt`, `BadgeUnlockDialog.kt`

---

## 🚀 Plano de Ação Recomendado

### FASE 1: Limpeza de "Mortos" (Dead Code Elimination)

Verificar módulos onde a versão Compose já está 100% funcional (`Screens`) e apenas deletar os arquivos antigos.

- **Alvos**: `Groups`, `Home`.
- **Ação**: Confirmar que `Fragment` usa `ComposeView` e deletar Adapters/XMLs.

### FASE 2: Migração de Telas Menores

Converter Dialogs e Telas simples que ainda estão em ViewBinding.

- **Alvos**: `AddEventDialog`, `FieldEditDialog`, `EditGroupDialog`.

### FASE 3: Migração de Listas Complexas

Reescrever as telas que dependem pesadamente de RecyclerViews complexos.

- **Alvos**: `Statistics` (Rankings), `Locations` (Dashboard).

### Ação Imediata

Qual módulo você gostaria de atacar agora? Recomendo **Groups** ou **Home** para reduzir rapidamente a contagem de arquivos legados.
