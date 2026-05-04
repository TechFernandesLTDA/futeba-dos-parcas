/**
 * Valida CPF brasileiro pelo algoritmo de dígito verificador (mod 11).
 *
 * Aceita CPF com ou sem máscara (999.999.999-99 ou 99999999999).
 * Rejeita sequências (00000000000, 11111111111, ..., 99999999999).
 *
 * @returns true se CPF válido, false caso contrário.
 */
export function isValidCpf(cpf: string): boolean {
  if (!cpf) return false;

  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;

  // Sequências (todos dígitos iguais) são tecnicamente válidas pelo mod 11
  // mas universalmente rejeitadas como CPFs reais.
  if (/^(\d)\1+$/.test(digits)) return false;

  // 1º dígito verificador: soma ponderada de pos 0..8 com pesos 10..2
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number.parseInt(digits[i], 10) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  if (remainder !== Number.parseInt(digits[9], 10)) return false;

  // 2º dígito verificador: soma ponderada de pos 0..9 com pesos 11..2
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += Number.parseInt(digits[i], 10) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10) remainder = 0;
  return remainder === Number.parseInt(digits[10], 10);
}

/**
 * Mascara CPF para exibição: ***.456.789-** (mostra apenas 6 dígitos centrais).
 */
export function maskCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `***.${digits.substring(3, 6)}.${digits.substring(6, 9)}-**`;
}

/**
 * Formata CPF para exibição completa: 999.999.999-99.
 * Use APENAS no próprio perfil do usuário (LGPD: não exibir CPF de terceiros).
 */
export function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.substring(0, 3)}.${digits.substring(3, 6)}.${digits.substring(6, 9)}-${digits.substring(9, 11)}`;
}

/**
 * Strip não-dígitos (canonicaliza CPF para storage).
 */
export function stripCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}
