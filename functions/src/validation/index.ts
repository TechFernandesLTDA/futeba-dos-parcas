/**
 * Módulo de Validação para Cloud Functions
 * Futeba dos Parças - v1.4.0
 *
 * Este módulo fornece funções de validação
 * reutilizáveis para todas as Cloud Functions
 * do projeto.
 */

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {
  MAX_XP_PER_GAME,
  MIN_XP_PER_GAME,
  MAX_GOALS_PER_GAME,
  MAX_ASSISTS_PER_GAME,
  MAX_SAVES_PER_GAME,
  LEVEL_TABLE,
} from "../constants";

// ============================================
// TIPOS E INTERFACES
// ============================================

/** Erro de validação */
export interface ValidationError {
  field: string;
  message: string;
  code: ValidationErrorCode;
}

/** Códigos de erro de validação */
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
  CONCURRENT_MODIFICATION =
    "CONCURRENT_MODIFICATION",
  ANTI_CHEAT_VIOLATION = "ANTI_CHEAT_VIOLATION",
}

/** Resultado de validação (null = válido) */
export type ValidationResult =
  ValidationError | null;

// ============================================
// CONSTANTES
// ============================================

/** Constantes de validação */
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
  // FIX #995: derivar de LEVEL_TABLE.maxLevel (xp-constants.json) em vez de
  // hardcoded 10. LEVEL_TABLE.maxLevel é 20 (níveis 0-20), antes LEVEL_MAX=10
  // rejeitava levels válidos 11-20 reportados pelo cliente.
  LEVEL_MIN: 0,
  LEVEL_MAX: LEVEL_TABLE.maxLevel,

  // Anti-cheat limits (importados de constants.ts)
  MAX_GOALS_PER_GAME,
  MAX_ASSISTS_PER_GAME,
  MAX_SAVES_PER_GAME,
  MAX_XP_PER_GAME,
  // FIX #2198: XP pode ser negativo (penalidade Bola Murcha = -10).
  MIN_XP_PER_GAME,

  // Limites de placar (P0 #30)
  MAX_SCORE: 100,

  // Limites de jogo
  MIN_PLAYERS_FOR_XP: 6,
  MIN_TEAMS: 2,
};

// ============================================
// VALIDAÇÕES DE STRING
// ============================================

/**
 * Valida o tamanho de uma string.
 *
 * @param {string|undefined|null} value - Valor
 * @param {string} field - Nome do campo
 * @param {number} min - Tamanho mínimo
 * @param {number} max - Tamanho máximo
 * @return {ValidationResult} Erro ou null
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
        code:
          ValidationErrorCode.REQUIRED_FIELD,
      };
    }
    return null;
  }

  if (value.length < min) {
    return {
      field,
      message:
        `${field} deve ter pelo menos ` +
        `${min} caracteres`,
      code: ValidationErrorCode.INVALID_LENGTH,
    };
  }

  if (value.length > max) {
    return {
      field,
      message:
        `${field} deve ter no máximo ` +
        `${max} caracteres`,
      code: ValidationErrorCode.INVALID_LENGTH,
    };
  }

  return null;
}

/**
 * Valida formato de email.
 *
 * @param {string|undefined|null} email - Email
 * @param {string} field - Nome do campo
 * @return {ValidationResult} Erro ou null
 */
export function validateEmail(
  email: string | undefined | null,
  field = "email"
): ValidationResult {
  if (!email) return null; // Email opcional

  const emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return {
      field,
      message: "Formato de email inválido",
      code: ValidationErrorCode.INVALID_EMAIL,
    };
  }

  return null;
}

const BLOCKED_TEXT_SCHEMES = new Set([
  "javascript",
  "data",
  "vbscript",
]);

/**
 * Identifica entidades HTML que devem virar separador de texto.
 * @param {string} body Conteudo entre & e ;.
 * @return {boolean} True para entidade nomeada ou numerica.
 */
function isHtmlEntityBody(body: string): boolean {
  return /^[a-zA-Z]+$/.test(body) ||
    /^#[0-9]+$/.test(body) ||
    /^#[xX][0-9a-fA-F]+$/.test(body);
}

/**
 * Identifica controles invisiveis usados para ofuscar payloads.
 * @param {number} codePoint Code point Unicode.
 * @return {boolean} True quando o caractere deve ser descartado.
 */
function isUnsafeTextControl(codePoint: number): boolean {
  return codePoint <= 0x0008 ||
    codePoint === 0x000B ||
    codePoint === 0x000C ||
    (codePoint >= 0x000E && codePoint <= 0x001F) ||
    (codePoint >= 0x007F && codePoint <= 0x009F) ||
    (codePoint >= 0x200B && codePoint <= 0x200F) ||
    (codePoint >= 0x2028 && codePoint <= 0x202F) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069) ||
    codePoint === 0xFEFF ||
    (codePoint >= 0xFFF9 && codePoint <= 0xFFFF);
}

/**
 * Converte markup em texto plano por parsing de delimitadores. Nao remove
 * sequencias via replace, portanto uma remocao nunca reintroduz outra tag.
 * @param {string} input Texto normalizado.
 * @return {string} Texto sem tags, entidades e controles invisiveis.
 */
function stripMarkupAndControls(input: string): string {
  let output = "";
  let insideTag = false;

  for (let index = 0; index < input.length;) {
    const codePoint = input.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);

    if (character === "<") {
      insideTag = true;
      index += character.length;
      continue;
    }
    if (character === ">" && insideTag) {
      insideTag = false;
      index += character.length;
      continue;
    }
    if (insideTag) {
      index += character.length;
      continue;
    }

    if (character === "&") {
      const semicolon = input.indexOf(";", index + 1);
      const entityLength = semicolon - index;
      if (semicolon > index && entityLength <= 34) {
        const entityBody = input.slice(index + 1, semicolon);
        if (isHtmlEntityBody(entityBody)) {
          output += " ";
          index = semicolon + 1;
          continue;
        }
      }
    }

    if (!isUnsafeTextControl(codePoint)) output += character;
    index += character.length;
  }

  return output;
}

/**
 * Remove schemes executaveis usando tokens ASCII completos.
 * @param {string} input Texto plano.
 * @return {string} Texto sem prefixos de schemes perigosos.
 */
function stripBlockedTextSchemes(input: string): string {
  let output = "";

  for (let index = 0; index < input.length;) {
    const isAsciiLetter = /[A-Za-z]/.test(input[index]);
    if (isAsciiLetter) {
      let wordEnd = index;
      while (wordEnd < input.length && /[A-Za-z]/.test(input[wordEnd])) {
        wordEnd++;
      }
      let colonIndex = wordEnd;
      while (colonIndex < input.length && /\s/u.test(input[colonIndex])) {
        colonIndex++;
      }
      const scheme = input.slice(index, wordEnd).toLowerCase();
      if (input[colonIndex] === ":" && BLOCKED_TEXT_SCHEMES.has(scheme)) {
        index = colonIndex + 1;
        continue;
      }
    }

    output += input[index];
    index++;
  }

  return output;
}

/**
 * Colapsa whitespace sem substituicao de sequencias.
 * @param {string} input Texto plano.
 * @return {string} Texto com um espaco entre tokens.
 */
function collapseTextWhitespace(input: string): string {
  let output = "";
  let pendingSpace = false;

  for (const character of input) {
    if (/\s/u.test(character)) {
      pendingSpace = output.length > 0;
      continue;
    }
    if (pendingSpace) output += " ";
    output += character;
    pendingSpace = false;
  }

  return output;
}

/**
 * Sanitiza texto removendo tags HTML e vetores
 * comuns de XSS.
 *
 * Proteções aplicadas:
 * 1. Remove todas as tags HTML
 * 2. Remove entidades HTML
 * 3. Remove caracteres de controle Unicode
 * 4. Remove protocolos perigosos
 * 5. Normaliza whitespace excessivo
 *
 * @param {string|undefined|null} text - Texto
 * @return {string} Texto sanitizado
 */
export function sanitizeText(
  text: string | undefined | null
): string {
  if (!text) return "";

  // NFKC canonicaliza formas full-width antes do parser (ex: ＜script＞).
  const canonical = text.normalize("NFKC");
  const plainText = stripMarkupAndControls(canonical);
  const withoutSchemes = stripBlockedTextSchemes(plainText);
  return collapseTextWhitespace(withoutSchemes);
}

/**
 * Codifica entidades HTML em input de usuário.
 * Lida com sequências multi-caractere corretamente
 * (ampersand primeiro para evitar double-encoding).
 *
 * Usar quando o texto sanitizado precisa preservar
 * tags visíveis (ex: "<script>" → "&lt;script&gt;").
 * Caso contrário, prefira sanitizeText() que remove
 * tags completamente.
 *
 * @param {string|undefined|null} input - Input
 * @return {string} Texto com entidades codificadas
 */
export function htmlEncode(
  input: string | undefined | null
): string {
  if (!input) return "";

  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Sanitiza E valida um campo de texto em uma
 * única operação. Combina sanitização XSS +
 * validação de tamanho.
 *
 * @param {string|undefined|null} text - Texto
 * @param {string} field - Nome do campo
 * @param {number} maxLength - Tamanho máximo
 * @return {object} Texto sanitizado e erro
 */
export function sanitizeAndValidateText(
  text: string | undefined | null,
  field: string,
  maxLength: number =
  VALIDATION_CONSTANTS.DESCRIPTION_MAX_LENGTH
): {sanitized: string; error: ValidationResult} {
  const sanitized = sanitizeText(text);

  if (sanitized.length > maxLength) {
    return {
      sanitized,
      error: {
        field,
        message:
          `${field} excede o tamanho máximo ` +
          `de ${maxLength} caracteres ` +
          "após sanitização",
        code:
          ValidationErrorCode.INVALID_LENGTH,
      },
    };
  }

  return {sanitized, error: null};
}

// ============================================
// VALIDAÇÕES NUMÉRICAS
// ============================================

/**
 * Valida se um número está em um range.
 *
 * @param {number|undefined|null} value - Valor
 * @param {string} field - Nome do campo
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @return {ValidationResult} Erro ou null
 */
export function validateRange(
  value: number | undefined | null,
  field: string,
  min: number,
  max: number
): ValidationResult {
  if (value === undefined || value === null) {
    return null;
  }

  if (value < min || value > max) {
    return {
      field,
      message:
        `${field} deve estar entre ` +
        `${min} e ${max}`,
      code: ValidationErrorCode.OUT_OF_RANGE,
    };
  }

  return null;
}

/**
 * Valida rating (0.0 - 5.0).
 *
 * @param {number|undefined|null} rating - Rating
 * @param {string} field - Nome do campo
 * @return {ValidationResult} Erro ou null
 */
export function validateRating(
  rating: number | undefined | null,
  field = "rating"
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
 *
 * @param {number|undefined|null} rating - Rating
 * @param {string} field - Nome do campo
 * @return {ValidationResult} Erro ou null
 */
export function validateLeagueRating(
  rating: number | undefined | null,
  field = "league_rating"
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
 *
 * @param {number} rating - Rating para normalizar
 * @return {number} Rating normalizado
 */
export function normalizeLeagueRating(
  rating: number
): number {
  return Math.max(
    VALIDATION_CONSTANTS.LEAGUE_RATING_MIN,
    Math.min(
      VALIDATION_CONSTANTS.LEAGUE_RATING_MAX,
      rating
    )
  );
}

/**
 * Valida level (0 - 20).
 *
 * @param {number|undefined|null} level - Nível
 * @param {string} field - Nome do campo
 * @return {ValidationResult} Erro ou null
 */
export function validateLevel(
  level: number | undefined | null,
  field = "level"
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
 *
 * @param {number|undefined|null} value - Valor
 * @param {string} field - Nome do campo
 * @return {ValidationResult} Erro ou null
 */
export function validatePositiveNumber(
  value: number | undefined | null,
  field: string
): ValidationResult {
  if (value === undefined || value === null) {
    return {
      field,
      message: `${field} é obrigatório`,
      code:
        ValidationErrorCode.REQUIRED_FIELD,
    };
  }

  if (value <= 0) {
    return {
      field,
      message:
        `${field} deve ser maior que zero`,
      code:
        ValidationErrorCode.NEGATIVE_VALUE,
    };
  }

  return null;
}

/**
 * Valida se um número é não-negativo (>= 0).
 *
 * @param {number|undefined|null} value - Valor
 * @param {string} field - Nome do campo
 * @return {ValidationResult} Erro ou null
 */
export function validateNonNegative(
  value: number | undefined | null,
  field: string
): ValidationResult {
  if (value === undefined || value === null) {
    return null;
  }

  if (value < 0) {
    return {
      field,
      message:
        `${field} não pode ser negativo`,
      code:
        ValidationErrorCode.NEGATIVE_VALUE,
    };
  }

  return null;
}

// ============================================
// VALIDAÇÕES DE PLACAR (P0 #30)
// ============================================

/**
 * Valida se um placar está dentro dos limites
 * aceitáveis (0-100).
 * P0 #30: Score bounds validation.
 *
 * @param {number|undefined|null} score - Placar
 * @param {string} field - Nome do campo
 * @return {ValidationResult} Erro ou null
 */
export function validateScore(
  score: number | undefined | null,
  field = "score"
): ValidationResult {
  if (score === undefined || score === null) {
    return null;
  }

  if (score < 0) {
    return {
      field,
      message: "Placar não pode ser negativo",
      code:
        ValidationErrorCode.NEGATIVE_VALUE,
    };
  }

  if (score > VALIDATION_CONSTANTS.MAX_SCORE) {
    return {
      field,
      message:
        "Placar máximo é " +
        `${VALIDATION_CONSTANTS.MAX_SCORE}`,
      code:
        ValidationErrorCode
          .ANTI_CHEAT_VIOLATION,
    };
  }

  return null;
}

/**
 * Normaliza placar para o range válido (0-100).
 * Garante que placares inválidos sejam corrigidos
 * silenciosamente.
 *
 * @param {number} score - Placar para normalizar
 * @return {number} Placar normalizado
 */
export function clampScore(
  score: number
): number {
  return Math.max(
    0,
    Math.min(
      VALIDATION_CONSTANTS.MAX_SCORE,
      Math.round(score)
    )
  );
}

// ============================================
// VALIDAÇÕES ANTI-CHEAT
// ============================================

/**
 * Valida estatísticas de jogo contra limites
 * anti-cheat.
 *
 * @param {number} goals - Gols
 * @param {number} assists - Assistências
 * @param {number} saves - Defesas
 * @return {ValidationError[]} Array de erros
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
      code:
        ValidationErrorCode.NEGATIVE_VALUE,
    });
  } else if (
    goals >
    VALIDATION_CONSTANTS.MAX_GOALS_PER_GAME
  ) {
    errors.push({
      field: "goals",
      message:
        "Máximo de " +
        VALIDATION_CONSTANTS
          .MAX_GOALS_PER_GAME +
        " gols por jogo",
      code:
        ValidationErrorCode
          .ANTI_CHEAT_VIOLATION,
    });
  }

  if (assists < 0) {
    errors.push({
      field: "assists",
      message:
        "Assistências não pode ser negativo",
      code:
        ValidationErrorCode.NEGATIVE_VALUE,
    });
  } else if (
    assists >
    VALIDATION_CONSTANTS.MAX_ASSISTS_PER_GAME
  ) {
    errors.push({
      field: "assists",
      message:
        "Máximo de " +
        VALIDATION_CONSTANTS
          .MAX_ASSISTS_PER_GAME +
        " assistências por jogo",
      code:
        ValidationErrorCode
          .ANTI_CHEAT_VIOLATION,
    });
  }

  if (saves < 0) {
    errors.push({
      field: "saves",
      message:
        "Defesas não pode ser negativo",
      code:
        ValidationErrorCode.NEGATIVE_VALUE,
    });
  } else if (
    saves >
    VALIDATION_CONSTANTS.MAX_SAVES_PER_GAME
  ) {
    errors.push({
      field: "saves",
      message:
        "Máximo de " +
        VALIDATION_CONSTANTS
          .MAX_SAVES_PER_GAME +
        " defesas por jogo",
      code:
        ValidationErrorCode
          .ANTI_CHEAT_VIOLATION,
    });
  }

  return errors;
}

/**
 * Valida XP ganho contra limite anti-cheat.
 *
 * @param {number} xp - XP ganho
 * @return {ValidationResult} Erro ou null
 */
export function validateXPGain(
  xp: number
): ValidationResult {
  // FIX #2198: XP negativo é VÁLIDO (penalidade Bola Murcha = -10). Só
  // rejeita se ultrapassar a magnitude permitida (MIN_XP_PER_GAME = -100).
  if (xp < VALIDATION_CONSTANTS.MIN_XP_PER_GAME) {
    return {
      field: "xp",
      message:
        "Mínimo de " +
        VALIDATION_CONSTANTS.MIN_XP_PER_GAME +
        " XP por jogo",
      code:
        ValidationErrorCode
          .ANTI_CHEAT_VIOLATION,
    };
  }

  if (xp > VALIDATION_CONSTANTS.MAX_XP_PER_GAME) {
    return {
      field: "xp",
      message:
        "Máximo de " +
        VALIDATION_CONSTANTS.MAX_XP_PER_GAME +
        " XP por jogo",
      code:
        ValidationErrorCode
          .ANTI_CHEAT_VIOLATION,
    };
  }

  return null;
}

/**
 * Limita XP à faixa permitida [MIN_XP_PER_GAME, MAX_XP_PER_GAME].
 *
 * FIX #2198: antes usava Math.max(0, xp) e zerava penalidades negativas
 * (Bola Murcha). Agora preserva valores negativos até o piso anti-cheat.
 *
 * @param {number} xp - XP para limitar
 * @return {number} XP limitado à faixa válida
 */
export function capXP(xp: number): number {
  return Math.min(
    Math.max(VALIDATION_CONSTANTS.MIN_XP_PER_GAME, xp),
    VALIDATION_CONSTANTS.MAX_XP_PER_GAME
  );
}

// ============================================
// VALIDAÇÕES DE NEGÓCIO
// ============================================

/**
 * Valida se um jogo tem jogadores suficientes
 * para processar XP.
 *
 * @param {number} playerCount - Total de jogadores
 * @return {ValidationResult} Erro ou null
 */
export function validateMinPlayersForXP(
  playerCount: number
): ValidationResult {
  if (
    playerCount <
    VALIDATION_CONSTANTS.MIN_PLAYERS_FOR_XP
  ) {
    return {
      field: "player_count",
      message:
        "Mínimo de " +
        VALIDATION_CONSTANTS
          .MIN_PLAYERS_FOR_XP +
        " jogadores para processar XP",
      code: ValidationErrorCode.OUT_OF_RANGE,
    };
  }
  return null;
}

/**
 * Valida se um usuário existe no Firestore.
 *
 * @param {admin.firestore.Firestore} db - DB
 * @param {string} userId - ID do usuário
 * @return {Promise<ValidationResult>} Erro ou null
 */
export async function validateUserExists(
  db: admin.firestore.Firestore,
  userId: string
): Promise<ValidationResult> {
  if (!userId || userId.trim() === "") {
    return {
      field: "user_id",
      message: "ID do usuário é obrigatório",
      code:
        ValidationErrorCode.REQUIRED_FIELD,
    };
  }

  const userDoc = await db
    .collection("users")
    .doc(userId)
    .get();
  if (!userDoc.exists) {
    return {
      field: "user_id",
      message: "Usuário não encontrado",
      code:
        ValidationErrorCode
          .FOREIGN_KEY_NOT_FOUND,
    };
  }

  return null;
}

/**
 * Valida se um jogo existe no Firestore.
 *
 * @param {admin.firestore.Firestore} db - DB
 * @param {string} gameId - ID do jogo
 * @return {Promise<ValidationResult>} Erro ou null
 */
export async function validateGameExists(
  db: admin.firestore.Firestore,
  gameId: string
): Promise<ValidationResult> {
  if (!gameId || gameId.trim() === "") {
    return {
      field: "game_id",
      message: "ID do jogo é obrigatório",
      code:
        ValidationErrorCode.REQUIRED_FIELD,
    };
  }

  const gameDoc = await db
    .collection("games")
    .doc(gameId)
    .get();
  if (!gameDoc.exists) {
    return {
      field: "game_id",
      message: "Jogo não encontrado",
      code:
        ValidationErrorCode
          .FOREIGN_KEY_NOT_FOUND,
    };
  }

  return null;
}

/**
 * Valida se um grupo existe no Firestore.
 *
 * @param {admin.firestore.Firestore} db - DB
 * @param {string} groupId - ID do grupo
 * @param {boolean} allowSoftDeleted - Permite
 *   grupos soft-deleted (padrão: false)
 * @return {Promise<ValidationResult>} Erro ou null
 */
export async function validateGroupExists(
  db: admin.firestore.Firestore,
  groupId: string,
  allowSoftDeleted = false
): Promise<ValidationResult> {
  if (!groupId || groupId.trim() === "") {
    return {
      field: "group_id",
      message: "ID do grupo é obrigatório",
      code:
        ValidationErrorCode.REQUIRED_FIELD,
    };
  }

  const groupDoc = await db
    .collection("groups")
    .doc(groupId)
    .get();
  if (!groupDoc.exists) {
    return {
      field: "group_id",
      message: "Grupo não encontrado",
      code:
        ValidationErrorCode
          .FOREIGN_KEY_NOT_FOUND,
    };
  }

  if (!allowSoftDeleted && groupDoc.data()?.deleted_at) {
    return {
      field: "group_id",
      message: "Grupo foi deletado",
      code:
        ValidationErrorCode
          .FOREIGN_KEY_NOT_FOUND,
    };
  }

  return null;
}

// ============================================
// OPTIMISTIC LOCKING
// ============================================

/**
 * Atualiza documento com optimistic locking.
 * Previne race conditions verificando a versão
 * antes de atualizar.
 *
 * @param {admin.firestore.Firestore} db - DB
 * @param {admin.firestore.DocumentReference}
 *   docRef - Referência do documento
 * @param {number} expectedVersion - Versão
 * @param {Partial<T>} updates - Atualizações
 * @return {Promise<object>} Resultado
 */
export async function updateWithOptimisticLock<
  T extends {version?: number}
>(
  db: admin.firestore.Firestore,
  docRef: admin.firestore.DocumentReference,
  expectedVersion: number,
  updates: Partial<T>
): Promise<{
  success: boolean;
  error?: ValidationError;
}> {
  try {
    const result = await db.runTransaction(
      async (transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          throw new Error("DOCUMENT_NOT_FOUND");
        }

        const currentVersion =
          doc.data()?.version || 0;

        if (currentVersion !== expectedVersion) {
          throw new Error(
            "CONCURRENT_MODIFICATION"
          );
        }

        transaction.update(docRef, {
          ...updates,
          version: currentVersion + 1,
          updated_at:
            FieldValue
              .serverTimestamp(),
        });

        return true;
      }
    );

    return {success: result};
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ?
        error.message :
        "Unknown error";

    if (
      errorMessage === "CONCURRENT_MODIFICATION"
    ) {
      return {
        success: false,
        error: {
          field: "version",
          message:
            "Documento foi modificado por " +
            "outro processo",
          code:
            ValidationErrorCode
              .CONCURRENT_MODIFICATION,
        },
      };
    }

    if (errorMessage === "DOCUMENT_NOT_FOUND") {
      return {
        success: false,
        error: {
          field: "document",
          message: "Documento não encontrado",
          code:
            ValidationErrorCode
              .FOREIGN_KEY_NOT_FOUND,
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
 *
 * @param {Array} results - Resultados
 * @return {ValidationError[]} Erros combinados
 */
export function combineValidationResults(
  ...results: (
    ValidationResult | ValidationError[]
  )[]
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
 *
 * @param {ValidationError[]} errors - Erros
 * @return {boolean} true se há erros
 */
export function hasValidationErrors(
  errors: ValidationError[]
): boolean {
  return errors.length > 0;
}

/**
 * Formata erros de validação para log.
 *
 * @param {ValidationError[]} errors - Erros
 * @return {string} Erros formatados
 */
export function formatValidationErrors(
  errors: ValidationError[]
): string {
  return errors
    .map(
      (e) =>
        `[${e.code}] ${e.field}: ${e.message}`
    )
    .join("; ");
}

/**
 * Loga erros de validação.
 *
 * @param {string} context - Contexto do log
 * @param {ValidationError[]} errors - Erros
 * @return {void}
 */
export function logValidationErrors(
  context: string,
  errors: ValidationError[]
): void {
  if (errors.length > 0) {
    logger.warn(
      `[VALIDATION] ${context}: ` +
      formatValidationErrors(errors)
    );
  }
}
