/**
 * Utilitários de validação de formulários.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Valida formato de e-mail */
export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) {
    return { valid: false, error: 'E-mail é obrigatório' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'E-mail inválido' };
  }
  return { valid: true };
}

/** Valida senha (mínimo 6 caracteres) */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Senha é obrigatória' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Senha deve ter pelo menos 6 caracteres' };
  }
  return { valid: true };
}

/** Valida nome (mínimo 2 caracteres, máximo 50) */
export function validateName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Nome é obrigatório' };
  }
  if (trimmed.length < 2) {
    return { valid: false, error: 'Nome deve ter pelo menos 2 caracteres' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Nome deve ter no máximo 50 caracteres' };
  }
  return { valid: true };
}

/** Valida confirmação de senha */
export function validatePasswordMatch(password: string, confirmPassword: string): ValidationResult {
  if (password !== confirmPassword) {
    return { valid: false, error: 'As senhas não coincidem' };
  }
  return { valid: true };
}

/** Valida campo obrigatório genérico */
export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value.trim()) {
    return { valid: false, error: `${fieldName} é obrigatório` };
  }
  return { valid: true };
}

/** Valida número dentro de um range */
export function validateNumberRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationResult {
  if (value < min || value > max) {
    return { valid: false, error: `${fieldName} deve estar entre ${min} e ${max}` };
  }
  return { valid: true };
}

export function validateMinLength(value: string, min: number, fieldName: string): string | undefined {
  if (value.trim().length < min) return `${fieldName} deve ter pelo menos ${min} caracteres.`;
  return undefined;
}

export function validateUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  if (!/^https?:\/\/.+/.test(value)) return 'URL inválida.';
  return undefined;
}

export function validatePositiveNumber(value: number | undefined | null, fieldName: string): string | undefined {
  if (value === undefined || value === null || value <= 0) return `${fieldName} deve ser maior que zero.`;
  return undefined;
}

export function validateGeoCoord(value: number | undefined | null, min: number, max: number, fieldName: string): string | undefined {
  if (value !== undefined && value !== null && (value < min || value > max)) {
    return `${fieldName} deve estar entre ${min} e ${max}.`;
  }
  return undefined;
}
