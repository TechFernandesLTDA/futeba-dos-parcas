/**
 * Módulo de Validação para Cloud Functions
 * Futeba dos Parças - v1.4.0
 *
 * Este módulo fornece funções de validação reutilizáveis para
 * todas as Cloud Functions do projeto.
 */

import * as admin from "firebase-admin";

// ============================================
// TIPOS E INTERFACES
// ============================================

export interface ValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode;
}

export enum ValidationErrorCode {
  GENERIC = "GENERIC",
  REQUIRED_FIELD = "REQUIRED_FIELD",
  INVALID_FORMAT = "INVALID_FORMAT",
  INVALID_LENGTH = "INVALID_LENGTH",
  OUT_OF_RANGE = "OUT_OF_RANGE",
  INVALID_EMAIL = "INVALID_EMAIL",
  NEGATIVE_VALUE = "NEGATIVE_VALUE",
  INVALID_TIMESTAMP = "INVALID_TIMESTAMP",
  FOREIGN_KEY_NOT_FOUND = "FOREIGN_KEY_NOT_FOUND",
  DUPLICATE_ENTRY = "DUPLICATE_ENTRY",
  CONCURRENT_MODIFICATION = "CONCURRENT_MODIFICATION",
  ANTI_CHEAT_VIOLATION = "ANTI_CHEAT_VIOLATION",
}

export type ValidationResult = ValidationError | null;

// ============================================
// CONSTANTES
// ============================================

export const VALIDATION_CONSTANTS = {
  // Limites de string
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,

  // Limites de rating
  RATING_MIN: 0.0,
  RATING_MAX: 5.0,
  LEAGUE_RATING_MIN: 0.0,
  LEAGUE_RATING_MAX: 100.0,

  // Limites de nível
  LEVEL_MIN: 0,
  LEVEL_MAX: 10,

  // Anti-cheat limits
  MAX_GOALS_PER_GAME: 15,
  MAX_ASSISTS_PER_GAME: 10,
  MAX_SAVES_PER_GAME: 30,
  MAX_XP_PER_GAME: 500,

  // Limites de jogo
  MIN_PLAYERS_FOR_XP: 6,
  MIN_TEAMS: 2,
};

// ============================================
// VALIDAÇÕES DE STRING
// ============================================

/**
 * Valida o tamanho de uma string.
 */
export function validateStringLength(
  value: string | undefined | null,
  field: string,
  min: number,
  max: number
): ValidationResult {
  if (value === undefined || value === null) {
    if (min > 0) {
      return {
        field,
        message: `${field} é obrigatório`,
        code: ValidationErrorCode.REQUIRED_FIELD,
      };
    }
    return null;
  }

  if (value.length < min) {
    return {
      field,
      message: `${field} deve ter pelo menos ${min} caracteres`,
      code: ValidationErrorCode.INVALID_LENGTH,
    };
  }

  if (value.length > max) {
    return {
      field,
      message: `${field} deve ter no máximo ${max} caracteres`,
      code: ValidationErrorCode.INVALID_LENGTH,
    };
  }

  return null;
}

/**
 * Valida formato de email.
 */
export function validateEmail(
  email: string | undefined | null,
  field: string = "email"
): ValidationResult {
  if (!email) return null; // Email opcional

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return {
      field,
      message: "Formato de email inválido",
      code: ValidationErrorCode.INVALID_EMAIL,
    };
  }

  return null;
}

/**
 * Sanitiza texto removendo tags HTML.
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return "";
  return text.replace(/<[^>]*>|&[a-zA-Z]+;/gi, "").trim();
}

// ============================================
// VALIDAÇÕES NUMÉRICAS
// ============================================

/**
 * Valida se um número está em um range.
 */
export function validateRange(
  value: number | undefined | null,
  field: string,
  min: number,
  max: number
): ValidationResult {
  if (value === undefined || value === null) return null;

  if (value < min || value > max) {
    return {
      field,
      message: `${field} deve estar entre ${min} e ${max}`,
      code: ValidationErrorCode.OUT_OF_RANGE,
    };
  }

  return null;
}

/**
 * Valida rating (0.0 - 5.0).
 */
export function validateRating(
  rating: number | undefined | null,
  field: string = "rating"
): ValidationResult {
  return validateRange(
    rating,
    field,
    VALIDATION_CONSTANTS.RATING_MIN,
    VALIDATION_CONSTANTS.RATING_MAX
  );
}

/**
 * Valida league rating (0.0 - 100.0).
 */
export function validateLeagueRating(
  rating: number | undefined | null,
  field: string = "league_rating"
): ValidationResult {
  return validateRange(
    rating,
    field,
    VALIDATION_CONSTANTS.LEAGUE_RATING_MIN,
    VALIDATION_CONSTANTS.LEAGUE_RATING_MAX
  );
}

/**
 * Normaliza league rating para o range válido.
 */
export function normalizeLeagueRating(rating: number): number {
  return Math.max(
    VALIDATION_CONSTANTS.LEAGUE_RATING_MIN,
    Math.min(VALIDATION_CONSTANTS.LEAGUE_RATING_MAX, rating)
  );
}

/**
 * Valida level (0 - 10).
 */
export function validateLevel(
  level: number | undefined | null,
  field: string = "level"
): ValidationResult {
  return validateRange(
    level,
    field,
    VALIDATION_CONSTANTS.LEVEL_MIN,
    VALIDATION_CONSTANTS.LEVEL_MAX
  );
}

/**
 * Valida se um número é positivo (> 0).
 */
export function validatePositiveNumber(
  value: number | undefined | null,
  field: string
): ValidationResult {
  if (value === undefined || value === null) {
    return {
      field,
      message: `${field} é obrigatório`,
      code: ValidationErrorCode.REQUIRED_FIELD,
    };
  }

  if (value <= 0) {
    return {
      field,
      message: `${field} deve ser maior que zero`,
      code: ValidationErrorCode.NEGATIVE_VALUE,
    };
  }

  return null;
}

/**
 * Valida se um número é não-negativo (>= 0).
 */
export function validateNonNegative(
  value: number | undefined | null,
  field: string
): ValidationResult {
  if (value === undefined || value === null) return null;

  if (value < 0) {
    return {
      field,
      message: `${field} não pode ser negativo`,
      code: ValidationErrorCode.NEGATIVE_VALUE,
    };
  }

  return null;
}

// ============================================
// VALIDAÇÕES ANTI-CHEAT
// ============================================

/**
 * Valida estatísticas de jogo contra limites anti-cheat.
 */
export function validateGameStats(
  goals: number,
  assists: number,
  saves: number
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (goals < 0) {
    errors.push({
      field: "goals",
      message: "Gols não pode ser negativo",
      code: ValidationErrorCode.NEGATIVE_VALUE,
    });
  } else if (goals > VALIDATION_CONSTANTS.MAX_GOALS_PER_GAME) {
    errors.push({
      field: "goals",
      message: `Máximo de ${VALIDATION_CONSTANTS.MAX_GOALS_PER_GAME} gols por jogo`,
      code: ValidationErrorCode.ANTI_CHEAT_VIOLATION,
    });
  }

  if (assists < 0) {
    errors.push({
      field: "assists",
      message: "Assistências não pode ser negativo",
      code: ValidationErrorCode.NEGATIVE_VALUE,
    });
  } else if (assists > VALIDATION_CONSTANTS.MAX_ASSISTS_PER_GAME) {
    errors.push({
      field: "assists",
      message: `Máximo de ${VALIDATION_CONSTANTS.MAX_ASSISTS_PER_GAME} assistências por jogo`,
      code: ValidationErrorCode.ANTI_CHEAT_VIOLATION,
    });
  }

  if (saves < 0) {
    errors.push({
      field: "saves",
      message: "Defesas não pode ser negativo",
      code: ValidationErrorCode.NEGATIVE_VALUE,
    });
  } else if (saves > VALIDATION_CONSTANTS.MAX_SAVES_PER_GAME) {
    errors.push({
      field: "saves",
      message: `Máximo de ${VALIDATION_CONSTANTS.MAX_SAVES_PER_GAME} defesas por jogo`,
      code: ValidationErrorCode.ANTI_CHEAT_VIOLATION,
    });
  }

  return errors;
}

/**
 * Valida XP ganho contra limite anti-cheat.
 */
export function validateXPGain(xp: number): ValidationResult {
  if (xp < 0) {
    return {
      field: "xp",
      message: "XP não pode ser negativo",
      code: ValidationErrorCode.NEGATIVE_VALUE,
    };
  }

  if (xp > VALIDATION_CONSTANTS.MAX_XP_PER_GAME) {
    return {
      field: "xp",
      message: `Máximo de ${VALIDATION_CONSTANTS.MAX_XP_PER_GAME} XP por jogo`,
      code: ValidationErrorCode.ANTI_CHEAT_VIOLATION,
    };
  }

  return null;
}

/**
 * Limita XP ao máximo permitido.
 */
export function capXP(xp: number): number {
  return Math.min(Math.max(0, xp), VALIDATION_CONSTANTS.MAX_XP_PER_GAME);
}

// ============================================
// VALIDAÇÕES DE NEGÓCIO
// ============================================

/**
 * Valida se um jogo tem jogadores suficientes para processar XP.
 */
export function validateMinPlayersForXP(
  playerCount: number
): ValidationResult {
  if (playerCount < VALIDATION_CONSTANTS.MIN_PLAYERS_FOR_XP) {
    return {
      field: "player_count",
      message: `Mínimo de ${VALIDATION_CONSTANTS.MIN_PLAYERS_FOR_XP} jogadores para processar XP`,
      code: ValidationErrorCode.OUT_OF_RANGE,
    };
  }
  return null;
}

/**
 * Valida se um usuário existe no Firestore.
 */
export async function validateUserExists(
  db: admin.firestore.Firestore,
  userId: string
): Promise<ValidationResult> {
  if (!userId || userId.trim() === "") {
    return {
      field: "user_id",
      message: "ID do usuário é obrigatório",
      code: ValidationErrorCode.REQUIRED_FIELD,
    };
  }

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    return {
      field: "user_id",
      message: "Usuário não encontrado",
      code: ValidationErrorCode.FOREIGN_KEY_NOT_FOUND,
    };
  }

  return null;
}

/**
 * Valida se um jogo existe no Firestore.
 */
export async function validateGameExists(
  db: admin.firestore.Firestore,
  gameId: string
): Promise<ValidationResult> {
  if (!gameId || gameId.trim() === "") {
    return {
      field: "game_id",
      message: "ID do jogo é obrigatório",
      code: ValidationErrorCode.REQUIRED_FIELD,
    };
  }

  const gameDoc = await db.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    return {
      field: "game_id",
      message: "Jogo não encontrado",
      code: ValidationErrorCode.FOREIGN_KEY_NOT_FOUND,
    };
  }

  return null;
}

/**
 * Valida se um grupo existe no Firestore.
 */
export async function validateGroupExists(
  db: admin.firestore.Firestore,
  groupId: string
): Promise<ValidationResult> {
  if (!groupId || groupId.trim() === "") {
    return {
      field: "group_id",
      message: "ID do grupo é obrigatório",
      code: ValidationErrorCode.REQUIRED_FIELD,
    };
  }

  const groupDoc = await db.collection("groups").doc(groupId).get();
  if (!groupDoc.exists) {
    return {
      field: "group_id",
      message: "Grupo não encontrado",
      code: ValidationErrorCode.FOREIGN_KEY_NOT_FOUND,
    };
  }

  return null;
}

// ============================================
// OPTIMISTIC LOCKING
// ============================================

/**
 * Atualiza documento com optimistic locking.
 * Previne race conditions verificando a versão antes de atualizar.
 */
export async function updateWithOptimisticLock<T extends { version?: number }>(
  db: admin.firestore.Firestore,
  docRef: admin.firestore.DocumentReference,
  expectedVersion: number,
  updates: Partial<T>
): Promise<{ success: boolean; error?: ValidationError }> {
  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        throw new Error("DOCUMENT_NOT_FOUND");
      }

      const currentVersion = doc.data()?.version || 0;

      if (currentVersion !== expectedVersion) {
        throw new Error("CONCURRENT_MODIFICATION");
      }

      transaction.update(docRef, {
        ...updates,
        version: currentVersion + 1,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return true;
    });

    return { success: result };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage === "CONCURRENT_MODIFICATION") {
      return {
        success: false,
        error: {
          field: "version",
          message: "Documento foi modificado por outro processo",
          code: ValidationErrorCode.CONCURRENT_MODIFICATION,
        },
      };
    }

    if (errorMessage === "DOCUMENT_NOT_FOUND") {
      return {
        success: false,
        error: {
          field: "document",
          message: "Documento não encontrado",
          code: ValidationErrorCode.FOREIGN_KEY_NOT_FOUND,
        },
      };
    }

    throw error;
  }
}

// ============================================
// UTILITÁRIOS
// ============================================

/**
 * Combina múltiplos resultados de validação.
 * Retorna array com todos os erros encontrados.
 */
export function combineValidationResults(
  ...results: (ValidationResult | ValidationError[])[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const result of results) {
    if (Array.isArray(result)) {
      errors.push(...result);
    } else if (result !== null) {
      errors.push(result);
    }
  }

  return errors;
}

/**
 * Verifica se há erros de validação.
 */
export function hasValidationErrors(errors: ValidationError[]): boolean {
  return errors.length > 0;
}

/**
 * Formata erros de validação para log.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors
    .map((e) => `[${e.code}] ${e.field}: ${e.message}`)
    .join("; ");
}

/**
 * Loga erros de validação.
 */
export function logValidationErrors(
  context: string,
  errors: ValidationError[]
): void {
  if (errors.length > 0) {
    console.warn(
      `[VALIDATION] ${context}: ${formatValidationErrors(errors)}`
    );
  }
}
