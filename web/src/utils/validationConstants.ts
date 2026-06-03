// Paridade cross-platform: estes ranges espelham
// `shared/src/commonMain/kotlin/com/futebadosparcas/domain/validation/GameValidation.kt`
// (fonte canônica para Android/iOS). O Web não consegue importar Kotlin, então mantenha
// os valores de goleiros (0..4) e times (2..4) sincronizados manualmente. Spec #2400.
export const GAME_VALIDATION = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 50,
  MIN_GOALKEEPERS: 0,
  MAX_GOALKEEPERS: 4,
  MIN_TEAMS: 2,
  MAX_TEAMS: 4,
  MIN_PRICE: 0,
  MAX_PRICE: 500,
} as const;
