/**
 * Testes do modulo de validacao para Cloud Functions
 */

import {
  VALIDATION_CONSTANTS,
  ValidationErrorCode,
  validateStringLength,
  validateEmail,
  sanitizeText,
  validateRange,
  validateRating,
  validateLeagueRating,
  normalizeLeagueRating,
  validateLevel,
  validatePositiveNumber,
  validateNonNegative,
  validateGameStats,
  validateXPGain,
  capXP,
  validateMinPlayersForXP,
  combineValidationResults,
  hasValidationErrors,
  formatValidationErrors,
} from "../src/validation";

describe("Validation Module", () => {
  // ==========================================
  // STRING VALIDATIONS
  // ==========================================

  describe("validateStringLength", () => {
    test("returns error for null when min > 0", () => {
      const result = validateStringLength(null, "name", 2, 100);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.REQUIRED_FIELD);
    });

    test("returns error for undefined when min > 0", () => {
      const result = validateStringLength(undefined, "name", 2, 100);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.REQUIRED_FIELD);
    });

    test("returns null for null when min is 0", () => {
      const result = validateStringLength(null, "name", 0, 100);
      expect(result).toBeNull();
    });

    test("returns error for too short string", () => {
      const result = validateStringLength("a", "name", 2, 100);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.INVALID_LENGTH);
    });

    test("returns error for too long string", () => {
      const result = validateStringLength("a".repeat(101), "name", 2, 100);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.INVALID_LENGTH);
    });

    test("returns null for valid string", () => {
      const result = validateStringLength("Valid Name", "name", 2, 100);
      expect(result).toBeNull();
    });

    test("accepts string at exact min length", () => {
      const result = validateStringLength("ab", "name", 2, 100);
      expect(result).toBeNull();
    });

    test("accepts string at exact max length", () => {
      const result = validateStringLength("a".repeat(100), "name", 2, 100);
      expect(result).toBeNull();
    });
  });

  describe("validateEmail", () => {
    test("returns null for null email (optional)", () => {
      expect(validateEmail(null)).toBeNull();
    });

    test("returns null for undefined email (optional)", () => {
      expect(validateEmail(undefined)).toBeNull();
    });

    test("returns null for empty string", () => {
      expect(validateEmail("")).toBeNull();
    });

    test("returns null for valid email", () => {
      expect(validateEmail("user@example.com")).toBeNull();
    });

    test("returns error for invalid email", () => {
      const result = validateEmail("not-an-email");
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.INVALID_EMAIL);
    });

    test("returns error for email without domain", () => {
      const result = validateEmail("user@");
      expect(result).not.toBeNull();
    });

    test("returns error for email without @", () => {
      const result = validateEmail("userexample.com");
      expect(result).not.toBeNull();
    });

    test("uses custom field name", () => {
      const result = validateEmail("bad", "contact_email");
      expect(result!.field).toBe("contact_email");
    });
  });

  describe("sanitizeText", () => {
    test("returns empty string for null", () => {
      expect(sanitizeText(null)).toBe("");
    });

    test("returns empty string for undefined", () => {
      expect(sanitizeText(undefined)).toBe("");
    });

    test("removes HTML tags", () => {
      expect(sanitizeText("<script>alert('xss')</script>")).toBe("alert('xss')");
    });

    test("removes HTML entities", () => {
      expect(sanitizeText("Hello&nbsp;World")).toBe("HelloWorld");
    });

    test("trims whitespace", () => {
      expect(sanitizeText("  Hello World  ")).toBe("Hello World");
    });

    test("keeps normal text unchanged", () => {
      expect(sanitizeText("Normal text here")).toBe("Normal text here");
    });
  });

  // ==========================================
  // NUMERIC VALIDATIONS
  // ==========================================

  describe("validateRange", () => {
    test("returns null for null value", () => {
      expect(validateRange(null, "field", 0, 10)).toBeNull();
    });

    test("returns null for value in range", () => {
      expect(validateRange(5, "field", 0, 10)).toBeNull();
    });

    test("returns error for value below min", () => {
      const result = validateRange(-1, "field", 0, 10);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.OUT_OF_RANGE);
    });

    test("returns error for value above max", () => {
      const result = validateRange(11, "field", 0, 10);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.OUT_OF_RANGE);
    });

    test("accepts value at exact min", () => {
      expect(validateRange(0, "field", 0, 10)).toBeNull();
    });

    test("accepts value at exact max", () => {
      expect(validateRange(10, "field", 0, 10)).toBeNull();
    });
  });

  describe("validateRating", () => {
    test("valid rating 3.5", () => {
      expect(validateRating(3.5)).toBeNull();
    });

    test("invalid rating 5.1", () => {
      expect(validateRating(5.1)).not.toBeNull();
    });

    test("invalid negative rating", () => {
      expect(validateRating(-0.1)).not.toBeNull();
    });

    test("boundary 0.0", () => {
      expect(validateRating(0.0)).toBeNull();
    });

    test("boundary 5.0", () => {
      expect(validateRating(5.0)).toBeNull();
    });
  });

  describe("validateLeagueRating", () => {
    test("valid rating 50", () => {
      expect(validateLeagueRating(50)).toBeNull();
    });

    test("invalid rating 101", () => {
      expect(validateLeagueRating(101)).not.toBeNull();
    });

    test("invalid negative", () => {
      expect(validateLeagueRating(-1)).not.toBeNull();
    });

    test("boundary 0", () => {
      expect(validateLeagueRating(0)).toBeNull();
    });

    test("boundary 100", () => {
      expect(validateLeagueRating(100)).toBeNull();
    });
  });

  describe("normalizeLeagueRating", () => {
    test("clamps to 0 when negative", () => {
      expect(normalizeLeagueRating(-10)).toBe(0);
    });

    test("clamps to 100 when above max", () => {
      expect(normalizeLeagueRating(150)).toBe(100);
    });

    test("keeps valid value unchanged", () => {
      expect(normalizeLeagueRating(55.5)).toBe(55.5);
    });
  });

  describe("validateLevel", () => {
    test("valid level 5", () => {
      expect(validateLevel(5)).toBeNull();
    });

    test("invalid level 11", () => {
      expect(validateLevel(11)).not.toBeNull();
    });

    test("invalid negative level", () => {
      expect(validateLevel(-1)).not.toBeNull();
    });

    test("boundary 0", () => {
      expect(validateLevel(0)).toBeNull();
    });

    test("boundary 10", () => {
      expect(validateLevel(10)).toBeNull();
    });
  });

  describe("validatePositiveNumber", () => {
    test("returns error for null", () => {
      const result = validatePositiveNumber(null, "amount");
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.REQUIRED_FIELD);
    });

    test("returns error for 0", () => {
      const result = validatePositiveNumber(0, "amount");
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.NEGATIVE_VALUE);
    });

    test("returns error for negative", () => {
      const result = validatePositiveNumber(-5, "amount");
      expect(result).not.toBeNull();
    });

    test("returns null for positive", () => {
      expect(validatePositiveNumber(1, "amount")).toBeNull();
    });
  });

  describe("validateNonNegative", () => {
    test("returns null for null", () => {
      expect(validateNonNegative(null, "count")).toBeNull();
    });

    test("returns null for 0", () => {
      expect(validateNonNegative(0, "count")).toBeNull();
    });

    test("returns error for negative", () => {
      const result = validateNonNegative(-1, "count");
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.NEGATIVE_VALUE);
    });

    test("returns null for positive", () => {
      expect(validateNonNegative(10, "count")).toBeNull();
    });
  });

  // ==========================================
  // ANTI-CHEAT
  // ==========================================

  describe("validateGameStats", () => {
    test("valid stats return no errors", () => {
      const errors = validateGameStats(5, 3, 10);
      expect(errors).toHaveLength(0);
    });

    test("negative goals return error", () => {
      const errors = validateGameStats(-1, 0, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(ValidationErrorCode.NEGATIVE_VALUE);
    });

    test("excessive goals return anti-cheat error", () => {
      const errors = validateGameStats(16, 0, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(ValidationErrorCode.ANTI_CHEAT_VIOLATION);
    });

    test("excessive assists return anti-cheat error", () => {
      const errors = validateGameStats(0, 11, 0);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(ValidationErrorCode.ANTI_CHEAT_VIOLATION);
    });

    test("excessive saves return anti-cheat error", () => {
      const errors = validateGameStats(0, 0, 31);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(ValidationErrorCode.ANTI_CHEAT_VIOLATION);
    });

    test("multiple violations return multiple errors", () => {
      const errors = validateGameStats(-1, -1, -1);
      expect(errors).toHaveLength(3);
    });

    test("boundary: max goals (15) is valid", () => {
      const errors = validateGameStats(15, 0, 0);
      expect(errors).toHaveLength(0);
    });

    test("boundary: max assists (10) is valid", () => {
      const errors = validateGameStats(0, 10, 0);
      expect(errors).toHaveLength(0);
    });

    test("boundary: max saves (30) is valid", () => {
      const errors = validateGameStats(0, 0, 30);
      expect(errors).toHaveLength(0);
    });
  });

  describe("validateXPGain", () => {
    test("valid XP returns null", () => {
      expect(validateXPGain(100)).toBeNull();
    });

    test("negative XP returns error", () => {
      const result = validateXPGain(-10);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.NEGATIVE_VALUE);
    });

    test("excessive XP returns anti-cheat error", () => {
      const result = validateXPGain(501);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.ANTI_CHEAT_VIOLATION);
    });

    test("boundary: 500 XP is valid", () => {
      expect(validateXPGain(500)).toBeNull();
    });

    test("boundary: 0 XP is valid", () => {
      expect(validateXPGain(0)).toBeNull();
    });
  });

  describe("capXP", () => {
    test("caps at 500", () => {
      expect(capXP(600)).toBe(500);
    });

    test("floors at 0", () => {
      expect(capXP(-10)).toBe(0);
    });

    test("keeps valid value", () => {
      expect(capXP(250)).toBe(250);
    });
  });

  // ==========================================
  // BUSINESS VALIDATIONS
  // ==========================================

  describe("validateMinPlayersForXP", () => {
    test("6 players is valid", () => {
      expect(validateMinPlayersForXP(6)).toBeNull();
    });

    test("5 players is not enough", () => {
      const result = validateMinPlayersForXP(5);
      expect(result).not.toBeNull();
      expect(result!.code).toBe(ValidationErrorCode.OUT_OF_RANGE);
    });

    test("20 players is valid", () => {
      expect(validateMinPlayersForXP(20)).toBeNull();
    });
  });

  // ==========================================
  // UTILITIES
  // ==========================================

  describe("combineValidationResults", () => {
    test("returns empty array for all null", () => {
      const result = combineValidationResults(null, null, null);
      expect(result).toHaveLength(0);
    });

    test("collects single errors", () => {
      const error = {
        field: "name",
        message: "Too short",
        code: ValidationErrorCode.INVALID_LENGTH,
      };
      const result = combineValidationResults(error, null);
      expect(result).toHaveLength(1);
    });

    test("collects array errors", () => {
      const errors = [
        { field: "goals", message: "Negative", code: ValidationErrorCode.NEGATIVE_VALUE },
        { field: "assists", message: "Negative", code: ValidationErrorCode.NEGATIVE_VALUE },
      ];
      const result = combineValidationResults(errors);
      expect(result).toHaveLength(2);
    });

    test("combines mixed results", () => {
      const singleError = {
        field: "name",
        message: "Required",
        code: ValidationErrorCode.REQUIRED_FIELD,
      };
      const arrayErrors = [
        { field: "goals", message: "Negative", code: ValidationErrorCode.NEGATIVE_VALUE },
      ];
      const result = combineValidationResults(null, singleError, arrayErrors);
      expect(result).toHaveLength(2);
    });
  });

  describe("hasValidationErrors", () => {
    test("returns false for empty array", () => {
      expect(hasValidationErrors([])).toBe(false);
    });

    test("returns true for non-empty array", () => {
      const errors = [
        { field: "x", message: "y", code: ValidationErrorCode.GENERIC },
      ];
      expect(hasValidationErrors(errors)).toBe(true);
    });
  });

  describe("formatValidationErrors", () => {
    test("formats single error", () => {
      const errors = [
        { field: "name", message: "Required", code: ValidationErrorCode.REQUIRED_FIELD },
      ];
      const formatted = formatValidationErrors(errors);
      expect(formatted).toContain("name");
      expect(formatted).toContain("Required");
      expect(formatted).toContain("REQUIRED_FIELD");
    });

    test("joins multiple errors with semicolons", () => {
      const errors = [
        { field: "a", message: "err1", code: ValidationErrorCode.GENERIC },
        { field: "b", message: "err2", code: ValidationErrorCode.GENERIC },
      ];
      const formatted = formatValidationErrors(errors);
      expect(formatted).toContain(";");
    });
  });

  // ==========================================
  // CONSTANTS CHECK
  // ==========================================

  describe("VALIDATION_CONSTANTS", () => {
    test("NAME_MIN_LENGTH is 2", () => {
      expect(VALIDATION_CONSTANTS.NAME_MIN_LENGTH).toBe(2);
    });

    test("NAME_MAX_LENGTH is 100", () => {
      expect(VALIDATION_CONSTANTS.NAME_MAX_LENGTH).toBe(100);
    });

    test("MAX_GOALS_PER_GAME is 15", () => {
      expect(VALIDATION_CONSTANTS.MAX_GOALS_PER_GAME).toBe(15);
    });

    test("MAX_ASSISTS_PER_GAME is 10", () => {
      expect(VALIDATION_CONSTANTS.MAX_ASSISTS_PER_GAME).toBe(10);
    });

    test("MAX_SAVES_PER_GAME is 30", () => {
      expect(VALIDATION_CONSTANTS.MAX_SAVES_PER_GAME).toBe(30);
    });

    test("MAX_XP_PER_GAME is 500", () => {
      expect(VALIDATION_CONSTANTS.MAX_XP_PER_GAME).toBe(500);
    });

    test("MIN_PLAYERS_FOR_XP is 6", () => {
      expect(VALIDATION_CONSTANTS.MIN_PLAYERS_FOR_XP).toBe(6);
    });
  });
});
