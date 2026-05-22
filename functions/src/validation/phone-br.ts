/**
 * Valida telefone brasileiro com DDD.
 * Aceita formatos com pontuacao e prefixo +55.
 *
 * @param {string | null | undefined} phone Telefone a validar.
 * @return {boolean} true se telefone brasileiro valido.
 */
export function isValidPhoneBR(
  phone: string | null | undefined
): boolean {
  if (!phone || typeof phone !== "string") return false;

  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("55") && digits.length > 11 ?
    digits.slice(2) :
    digits;

  if (national.length !== 10 && national.length !== 11) {
    return false;
  }

  const ddd = Number.parseInt(national.slice(0, 2), 10);
  if (ddd < 11 || ddd > 99) return false;

  return national.length !== 11 || national[2] === "9";
}
