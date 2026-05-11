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

const SMS_RATE_LIMIT_PER_PHONE_HOUR = 3;
const SMS_RATE_LIMIT_PER_IP_HOUR = 10;
const VERIFY_FAIL_AUDIT_THRESHOLD = 5;

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
    region: "us-central1",
    enforceAppCheck: process.env.NODE_ENV === "production",
    consumeAppCheckToken: true,
  },
  async (request) => {
    const phone: unknown = request.data?.phone;
    if (typeof phone !== "string" || !/^\+\d{10,15}$/.test(phone)) {
      throw new HttpsError(
        "invalid-argument",
        "Phone E.164 invalido",
      );
    }

    const ip = request.rawRequest?.ip || "unknown";

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
    region: "us-central1",
    enforceAppCheck: process.env.NODE_ENV === "production",
    consumeAppCheckToken: true,
  },
  async (request) => {
    const {auth} = request;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Login obrigatorio");
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

    const ip = request.rawRequest?.ip || "unknown";
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
