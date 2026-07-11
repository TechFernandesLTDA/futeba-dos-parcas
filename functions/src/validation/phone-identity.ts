import * as crypto from "crypto";
import {HttpsError} from "firebase-functions/v2/https";
import {isValidPhoneBR} from "./phone-br";

/**
 * Normaliza telefone brasileiro para E.164 sem formatos ambíguos.
 * @param {string} phone Telefone brasileiro informado.
 * @return {string} Telefone canônico em E.164.
 */
export function normalizePhoneE164(phone: string): string {
  if (!isValidPhoneBR(phone)) {
    throw new HttpsError("invalid-argument", "Telefone inválido");
  }

  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("55") && digits.length > 11 ?
    digits.slice(2) :
    digits;
  return `+55${national}`;
}

/**
 * Identificador não reversível para phone_index.
 * HMAC impede enumeração offline mesmo se o Firestore for exportado.
 * @param {string} phone Telefone brasileiro informado.
 * @param {string} secret Segredo gerenciado do projeto.
 * @return {string} HMAC-SHA-256 hexadecimal.
 */
export function hashPhoneIdentity(phone: string, secret: string): string {
  if (!secret || secret.length < 16) {
    throw new HttpsError(
      "failed-precondition",
      "Identity secret not configured",
    );
  }

  const normalized = normalizePhoneE164(phone);
  return crypto
    .createHmac("sha256", secret)
    .update(`phone:${normalized}`)
    .digest("hex");
}
