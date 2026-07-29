/**
 * FIX #3922: fonte única da data de fim do grace period de verificação.
 *
 * Antes desta mudança, a data estava hard-coded em 3 arquivos independentes
 * (firestore.rules, cashbox/callable.ts, games/join-public-game.ts) sem
 * constante compartilhada nem lever rápido. Cada extensão anterior
 * (#1018, #1571, #2122) mudava a data em um arquivo e esquecia outro.
 *
 * Este módulo é a fonte canônica para functions/. O firestore.rules mantém
 * o literal (linguagem diferente, sem import), mas
 * scripts/check-verification-grace-parity.js valida consistência entre os
 * dois no CI — é o gate que teria pego as extensões parciais anteriores.
 *
 * EXTENDIDA de 2026-08-03 para 2026-10-03 UTC (#3922).
 */

/** Data absoluta de fim do grace (UTC meia-noite). */
export const VERIFICATION_GRACE_END_DATE = new Date(Date.UTC(2026, 9, 3));

/** Timestamp em milissegundos — consumido por callable guards. */
export const VERIFICATION_GRACE_END_MS = VERIFICATION_GRACE_END_DATE.getTime();

/** Formato YYYY-M-D para validação cruzada com firestore.rules. */
export const VERIFICATION_GRACE_END_RULES_LITERAL = "2026, 10, 3";
