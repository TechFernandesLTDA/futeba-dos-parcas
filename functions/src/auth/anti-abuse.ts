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
 * Extrai o IP real do cliente em GCF v2 atrás de Load Balancer.
 *
 * FIX #1309-M4: rawRequest.ip retorna o IP do LB (constante) — inútil para
 * rate limit por IP. O 1º hop de x-forwarded-for é o IP do cliente.
 *
 * @param {CallableRequest} request - Requisição callable.
 * @return {string} IP do cliente, ou "unknown".
 */
function clientIp(request: {rawRequest?: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}}): string {
  const xff = request.rawRequest?.headers?.["x-forwarded-for"];
  const firstHop =
    typeof xff === "string" ? xff.split(",")[0]?.trim() : "";
  return firstHop || request.rawRequest?.ip || "unknown";
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
    // #1034: Defense in depth — auth guard antes de qualquer
    // processamento de dados para evitar consumo de rate limit por anônimos
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Login obrigatorio",
      );
    }

    const phone: unknown = request.data?.phone;
    if (typeof phone !== "string" || !/^\+\d{10,15}$/.test(phone)) {
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
    const {auth} = request;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Login obrigatorio");
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
  },
);
