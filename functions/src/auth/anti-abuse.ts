/**
 * Anti-abuse para Phone+CPF verification (Fase 6 #449).
 *
 * - Rate limit OTP send por numero/IP/hora
 * - Audit log de tentativas de verificacao falhadas
 * - VoIP detection placeholder (futura integracao
 *   com libphonenumber metadata-info)
 *
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md (Fase 6)
 */
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {db} from "../_db";
import {checkRateLimit} from "../middleware/rate-limiter";
import {FUNCTION_REGION} from "../constants";

const SMS_RATE_LIMIT_PER_PHONE_HOUR = 3;
const SMS_RATE_LIMIT_PER_IP_HOUR = 10;
const VERIFY_FAIL_AUDIT_THRESHOLD = 5;
// FIX #1310-L8: limite generoso (log legítimo de falha de verificação é
// esperado), mas barra spam que infla verification_failures/audit_logs.
const LOG_FAIL_RATE_LIMIT_PER_HOUR = 20;

/**
 * Valida formato de IP (IPv4 ou IPv6). Evita persistir lixo forjado nos
 * audit logs (FIX #2479 — poluição de forense por valores arbitrários de XFF).
 *
 * @param {string} value - Candidato a IP.
 * @return {boolean} true se IPv4/IPv6 bem-formado.
 */
function isValidIp(value: string): boolean {
  const ipv4 =
    /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
  // IPv6 frouxo (hex groups + "::"), suficiente para sanitização de log.
  const ipv6 = /^(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv4.test(value) || ipv6.test(value);
}

/**
 * Número de hops de proxy confiáveis que a infra GCP/GFE acrescenta ao
 * X-Forwarded-For APÓS o IP real do cliente.
 *
 * Topologia documentada pelo GCP Load Balancing (Cloud Run/GCF v2):
 *   X-Forwarded-For: <hops-do-cliente>, <ip-real>, <ip-do-lb/gfe>
 *
 * Ou seja, o GFE anexa:  1 IP do LB  (último)
 * Portanto o IP real do cliente é o PENÚLTIMO hop (offset = 1 a partir do fim).
 *
 * Ref: https://cloud.google.com/load-balancing/docs/https/custom-headers-global
 * ("The load balancer appends <client-ip>,<load-balancer-ip> to the existing
 * X-Forwarded-For value" — o LB não verifica IPs anteriores ao client-ip.)
 *
 * Se a topologia de deploy mudar (ex.: LB adicional na frente), ajuste aqui.
 */
const TRUSTED_PROXY_HOP_COUNT = 1;

/**
 * Extrai o IP confiável do cliente em GCF v2 atrás de Load Balancer/GFE.
 *
 * FIX #2479 (completo): o código anterior usava `split(",")[0]` — o 1º hop de
 * X-Forwarded-For é justamente a parte CONTROLÁVEL pelo cliente (anti-pattern
 * OWASP). O GCP Load Balancing documenta que acrescenta
 * `<ip-real-cliente>, <ip-do-lb>` ao final do XFF; portanto:
 *  - hops[last]        = IP do LB/GFE (constante, inútil para rate limit)
 *  - hops[last - 1]    = IP real do cliente (adicionado pela infra, confiável)
 *  - hops[0..last-2]   = hops controlados pelo cliente (não confiáveis)
 *
 * A extração usa `hops[length - 1 - TRUSTED_PROXY_HOP_COUNT]` para que o
 * número de proxies confiáveis seja explícito e ajustável.
 *
 * Adicionalmente, todos os IPs são validados por formato (IPv4/IPv6) antes de
 * serem aceitos — elimina poluição de audit logs por valores arbitrários.
 *
 * @param {object} request - Requisição callable.
 * @return {string} IP confiável do cliente, ou "unknown".
 */
function clientIp(request: {rawRequest?: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}}): string {
  const xffRaw = request.rawRequest?.headers?.["x-forwarded-for"];
  const xff = typeof xffRaw === "string" ? xffRaw : "";
  const hops = xff
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  if (hops.length > 0) {
    // Log da cadeia para diagnóstico de topologia (FIX #2479).
    logger.debug("[ANTI_ABUSE] XFF chain", {hops, count: hops.length});
  }

  // Índice do hop confiável: penúltimo quando há ≥2 hops
  // (último = LB/GFE, penúltimo = cliente real).
  if (hops.length >= TRUSTED_PROXY_HOP_COUNT + 1) {
    const trustedHop = hops[hops.length - 1 - TRUSTED_PROXY_HOP_COUNT];
    if (trustedHop && isValidIp(trustedHop)) return trustedHop;
  }

  // Cadeia curta (≤1 hop): sem LB na frente — aceita único hop se válido.
  // Cobre emulador local e deploys diretos sem GFE.
  if (hops.length === 1 && isValidIp(hops[0])) return hops[0];

  // Último recurso: rawRequest.ip (pode ser o IP do LB em prod, mas é melhor
  // que "unknown" e é o único dado disponível sem XFF).
  const fallback = request.rawRequest?.ip;
  if (fallback && isValidIp(fallback)) return fallback;

  return "unknown";
}

/**
 * Valida se phone E.164 pode receber SMS OTP agora.
 * Retorna {allowed, retryAfterSec} sem mandar SMS.
 *
 * Cliente chama ANTES de signInWithPhoneNumber para
 * detectar abuso preventivamente. Backend tambem
 * valida no fluxo final via Auth Triggers.
 *
 * FIX #940 — LIMITAÇÃO ARQUITETURAL (advisory):
 * Esta função é consultiva. Um cliente malicioso pode ignorá-la
 * e chamar Firebase Phone Auth (signInWithPhoneNumber /
 * PhoneAuthProvider.verifyPhoneNumber) diretamente, bypassando
 * este rate limit. A enforcement completa requer Auth Blocking
 * Functions (beforeSignIn trigger) — issue de follow-up para
 * avaliar custo/benefício (Blocking Functions não têm free tier).
 * Por ora, o cliente legítimo (Android/Web) DEVE chamar
 * canSendSmsOtp antes de iniciar o fluxo de Phone Auth.
 *
 * @return {Promise<object>} {allowed, retryAfterSec}
 */
export const canSendSmsOtp = onCall(
  {
    region: FUNCTION_REGION,
    // FIX #1307: usar FUNCTIONS_EMULATOR (NODE_ENV não confiável em GCF v2).
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    try {
    // #1034: Defense in depth — auth guard antes de qualquer
    // processamento de dados para evitar consumo de rate limit por anônimos
      if (!request.auth) {
        throw new HttpsError(
          "unauthenticated",
          "Login obrigatório",
        );
      }

      const phone: unknown = request.data?.phone;
      if (typeof phone !== "string" || !/^\+\d{10,15}$/.test(phone)) {
      // NOTE: regex is intentionally loose here (E.164 any country).
      // Actual BR mobile validation happens at Firebase Phone Auth layer
      // (signInWithPhoneNumber rejects landlines/non-mobile). Tightening
      // this regex would block future international expansion.
        throw new HttpsError(
          "invalid-argument",
          "Phone E.164 invalido",
        );
      }

      const ip = clientIp(request);

      const callerCheck = await checkRateLimit(request.auth!.uid, {
        maxRequests: SMS_RATE_LIMIT_PER_PHONE_HOUR * 3,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "sms_caller",
      });
      if (!callerCheck.allowed) {
        return {
          allowed: false,
          reason: "caller_rate_limit",
          retryAfterSec: Math.ceil(
            (callerCheck.resetAt.getTime() - Date.now()) / 1000,
          ),
        };
      }

      const phoneCheck = await checkRateLimit(phone, {
        maxRequests: SMS_RATE_LIMIT_PER_PHONE_HOUR,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "sms_phone",
      });
      if (!phoneCheck.allowed) {
        return {
          allowed: false,
          reason: "phone_rate_limit",
          retryAfterSec: Math.ceil(
            (phoneCheck.resetAt.getTime() - Date.now()) / 1000,
          ),
        };
      }

      const ipCheck = await checkRateLimit(ip, {
        maxRequests: SMS_RATE_LIMIT_PER_IP_HOUR,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "sms_ip",
      });
      if (!ipCheck.allowed) {
        return {
          allowed: false,
          reason: "ip_rate_limit",
          retryAfterSec: Math.ceil(
            (ipCheck.resetAt.getTime() - Date.now()) / 1000,
          ),
        };
      }

      return {allowed: true};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("canSendSmsOtp failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  },
);

/**
 * Audita tentativa de verificacao falhada (CPF invalido,
 * telefone duplicate, etc). Permite identificar contas
 * sob ataque ou bots tentando registrar.
 *
 * @return {Promise<object>} {logged: true}
 */
export const logVerificationFailure = onCall(
  {
    region: FUNCTION_REGION,
    // FIX #1307: usar FUNCTIONS_EMULATOR (NODE_ENV não confiável em GCF v2).
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== "true",
    consumeAppCheckToken: true,
  },
  async (request) => {
    try {
      const {auth} = request;
      if (!auth) {
        throw new HttpsError("unauthenticated", "Login obrigatório");
      }

      // FIX #1310-L8: rate limit por uid. Sem isto, um cliente pode chamar
      // logVerificationFailure em loop e inflar verification_failures/
      // audit_logs (custo de storage + ruído nos alerts).
      const logRl = await checkRateLimit(auth.uid, {
        maxRequests: LOG_FAIL_RATE_LIMIT_PER_HOUR,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "log_verif_fail",
      });
      if (!logRl.allowed) {
        const retryAfterSec = Math.ceil(
          (logRl.resetAt.getTime() - Date.now()) / 1000,
        );
        throw new HttpsError(
          "resource-exhausted",
          "Muitas tentativas. Tente novamente mais tarde.",
          {retryAfter: retryAfterSec},
        );
      }

      const reason: unknown = request.data?.reason;
      const stage: unknown = request.data?.stage;
      if (typeof reason !== "string" || typeof stage !== "string") {
        throw new HttpsError(
          "invalid-argument",
          "reason e stage devem ser string",
        );
      }

      const validStages = ["phone", "cpf"];
      const validReasons = [
        "invalid_format",
        "invalid_cpf",
        "duplicate_cpf",
        "duplicate_phone",
        "rate_limited",
        "code_expired",
        "code_incorrect",
      ];
      if (!validStages.includes(stage) || !validReasons.includes(reason)) {
        throw new HttpsError("invalid-argument", "Valores invalidos");
      }

      const ip = clientIp(request);
      const uid = auth.uid;
      const now = admin.firestore.FieldValue.serverTimestamp();

      await db().collection("verification_failures").add({
        uid,
        ip,
        stage,
        reason,
        timestamp: now,
      });

      // Verifica se user tem muitas falhas recentes (>= threshold)
      // e loga alert pra investigacao
      const oneHourAgo = admin.firestore.Timestamp.fromMillis(
        Date.now() - 60 * 60 * 1000,
      );
      const recentFails = await db()
        .collection("verification_failures")
        .where("uid", "==", uid)
        .where("timestamp", ">=", oneHourAgo)
        .count()
        .get();

      const count = recentFails.data().count;
      if (count >= VERIFY_FAIL_AUDIT_THRESHOLD) {
        logger.warn(
          "[ANTI_ABUSE] User com multiplas falhas verificacao",
          {uid, ip, count, stage, reason},
        );
        // Audit log critico
        await db().collection("audit_logs").add({
          type: "VERIFICATION_ABUSE_DETECTED",
          target_user_id: uid,
          ip,
          failure_count_1h: count,
          timestamp: now,
        });
      }

      return {logged: true};
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("logVerificationFailure failed", {error, uid: request.auth?.uid});
      throw new HttpsError("internal", "An unexpected error occurred");
    }
  },
);
