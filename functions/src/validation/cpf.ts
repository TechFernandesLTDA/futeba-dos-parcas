import * as crypto from "crypto";

/**
 * Valida CPF brasileiro pelo algoritmo de dígito verificador (mod 11).
 *
 * Aceita CPF com ou sem máscara. Rejeita sequências de dígitos iguais.
 */
export function isValidCpf(cpf: string | null | undefined): boolean {
  if (!cpf || typeof cpf !== "string") return false;

  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  // 1º dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number.parseInt(digits[i], 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number.parseInt(digits[9], 10)) return false;

  // 2º dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number.parseInt(digits[i], 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number.parseInt(digits[10], 10);
}

/**
 * Strip não-dígitos.
 */
export function stripCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

/**
 * Hash determinístico do CPF (SHA-256 com salt fixo do projeto).
 * Salt deve estar em Firebase Functions config (firebase functions:config:set cpf.salt=...).
 *
 * NUNCA armazenar CPF em plaintext no Firestore. Usar este hash como key
 * em cpf_index/{cpfHash} para detectar duplicatas sem expor o CPF.
 */
export function hashCpf(cpf: string, salt: string): string {
  const digits = stripCpf(cpf);
  return crypto
    .createHash("sha256")
    .update(`${digits}${salt}`)
    .digest("hex");
}

/**
 * Mascara CPF para logs (NUNCA logar CPF puro).
 */
export function maskCpf(cpf: string): string {
  const digits = stripCpf(cpf);
  if (digits.length !== 11) return "***";
  return `***.${digits.substring(3, 6)}.${digits.substring(6, 9)}-**`;
}
