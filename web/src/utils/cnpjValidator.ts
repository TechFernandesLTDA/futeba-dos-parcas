/**
 * Pesos do 1º dígito verificador do CNPJ (mod 11).
 */
const CNPJ_WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Pesos do 2º dígito verificador do CNPJ (mod 11).
 */
const CNPJ_WEIGHTS_SECOND = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Calcula dígito verificador do CNPJ (mod 11 com pesos).
 */
function cnpjCheckDigit(digits: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += Number.parseInt(digits[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * Valida CNPJ brasileiro pelo algoritmo de dígito verificador (mod 11).
 *
 * Aceita CNPJ com ou sem máscara (99.999.999/9999-99 ou 99999999999999).
 * Rejeita sequências (00000000000000, ..., 99999999999999).
 *
 * @returns true se CNPJ válido, false caso contrário.
 */
export function isValidCnpj(cnpj: string): boolean {
  // Guard contra inputs non-string (paridade com cpfValidator #1310 L3)
  if (typeof cnpj !== 'string') return false;
  if (!cnpj) return false;

  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;

  // Sequências (todos dígitos iguais) são rejeitadas como CNPJs reais.
  if (/^(\d)\1+$/.test(digits)) return false;

  if (cnpjCheckDigit(digits, CNPJ_WEIGHTS_FIRST) !== Number.parseInt(digits[12], 10)) {
    return false;
  }
  return cnpjCheckDigit(digits, CNPJ_WEIGHTS_SECOND) === Number.parseInt(digits[13], 10);
}

/**
 * Mascara CNPJ para exibição (LGPD): **.***.***\/0001-**
 * (mostra apenas os 4 dígitos da filial).
 */
export function maskCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return '***';
  return `**.***.***/${digits.substring(8, 12)}-**`;
}

/**
 * Formata CNPJ progressivamente para exibição: 99.999.999/9999-99.
 * Aceita input parcial (máscara progressiva durante digitação).
 */
export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '').slice(0, 14);
  if (!digits) return '';
  let formatted = digits.substring(0, 2);
  if (digits.length > 2) formatted += `.${digits.substring(2, 5)}`;
  if (digits.length > 5) formatted += `.${digits.substring(5, 8)}`;
  if (digits.length > 8) formatted += `/${digits.substring(8, 12)}`;
  if (digits.length > 12) formatted += `-${digits.substring(12, 14)}`;
  return formatted;
}

/**
 * Strip não-dígitos (canonicaliza CNPJ para envio ao backend).
 */
export function stripCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}
