# XP_CODE_SEARCH_MAP.md - Localização da lógica de XP

## 1. Onde o jogo é finalizado?

* **Arquivo:** `app/src/main/java/com/futebadosparcas/domain/ranking/MatchFinalizationService.kt`
* **Método:** `processGame(gameId: String)`
* **Gatilho:** Chama `batch.update(gameRef, mapOf("xp_processed" to true))` garantindo a transição de estado.

## 2. Onde o XP é calculado?

* **Arquivo:** `app/src/main/java/com/futebadosparcas/domain/ranking/XPCalculator.kt`
* **Método:** `calculate(playerData: PlayerGameData, opponentsGoals: Int)`
* **Observação:** Contém constantes de XP que divergem do contrato público. *(achado de auditoria — snapshot)*

## 3. Onde o XP é persistido?

* **Arquivo:** `app/src/main/java/com/futebadosparcas/domain/ranking/MatchFinalizationService.kt`
* **Linhas:** 356–360 (atualização do usuário), 366 (criação do XP log).
* **Mecanismo:** `firestore.batch()` garantindo atomicidade.

## 4. Onde o XP é lido para a UI?

* **Arquivo:** `app/src/main/java/com/futebadosparcas/ui/statistics/StatisticsScreenState.kt`
* **Data class:** `StatisticsScreenState` (campos `currentXp`, `xpHistory`).
* **ViewModel:** `RankingViewModel.kt` e `StatisticsViewModel.kt`.

## 5. Proteções contra duplicidade

* **Arquivo:** `MatchFinalizationService.kt`
* **Linha:** 80 (`if (game.xpProcessed) return`).
* **Mecanismo:** Checagem de flag booleana antes de iniciar a transação.
