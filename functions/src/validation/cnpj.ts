import * as crypto from "crypto";

/**
 * Pesos do 1o digito verificador do CNPJ (mod 11).
 */
const CNPJ_WEIGHTS_FIRST = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Pesos do 2o digito verificador do CNPJ (mod 11).
 */
const CNPJ_WEIGHTS_SECOND = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/**
 * Calcula digito verificador do CNPJ (mod 11 com pesos).
 *
 * @param {string} digits Digitos do CNPJ.
 * @param {number[]} weights Pesos aplicados posicao a posicao.
 * @return {number} Digito verificador esperado.
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
 * Valida CNPJ brasileiro pelo algoritmo de digito verificador (mod 11).
 * Aceita CNPJ com ou sem mascara. Rejeita sequencias iguais.
 *
 * @param {string | null | undefined} cnpj CNPJ a validar.
 * @return {boolean} true se valido, false caso contrario.
 */
export function isValidCnpj(cnpj: string | null | undefined): boolean {
  if (!cnpj || typeof cnpj !== "string") return false;

  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  // 1o digito verificador
  if (cnpjCheckDigit(digits, CNPJ_WEIGHTS_FIRST) !==
    Number.parseInt(digits[12], 10)) {
    return false;
  }

  // 2o digito verificador
  return cnpjCheckDigit(digits, CNPJ_WEIGHTS_SECOND) ===
    Number.parseInt(digits[13], 10);
}

/**
 * Remove caracteres nao-digito (canonicaliza CNPJ para storage).
 *
 * @param {string} cnpj CNPJ com ou sem mascara.
 * @return {string} Apenas digitos do CNPJ.
 */
export function stripCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/**
 * Hash deterministico do CNPJ (SHA-256 com salt do projeto).
 * Reusa o secret CPF_SALT (decisao #1311). O prefixo de dominio "cnpj:"
 * impede colisao cross-domain com hashes de CPF gerados com o mesmo salt.
 * NUNCA armazenar CNPJ em plaintext no Firestore. Usar este hash
 * como key em cnpj_index/{cnpjHash}.
 *
 * @param {string} cnpj CNPJ puro ou com mascara.
 * @param {string} salt Salt secreto do projeto (CPF_SALT).
 * @return {string} Hash SHA-256 hexadecimal (64 chars).
 */
export function hashCnpj(cnpj: string, salt: string): string {
  const digits = stripCnpj(cnpj);
  return crypto
    .createHash("sha256")
    .update(`cnpj:${digits}${salt}`)
    .digest("hex");
}

/**
 * Mascara CNPJ para logs (NUNCA logar CNPJ puro).
 * Mostra apenas os 4 digitos da filial: **.***.***\/0001-**.
 *
 * @param {string} cnpj CNPJ a mascarar.
 * @return {string} CNPJ mascarado.
 */
export function maskCnpj(cnpj: string): string {
  const digits = stripCnpj(cnpj);
  if (digits.length !== 14) return "***";
  return `**.***.***/${digits.substring(8, 12)}-**`;
}
