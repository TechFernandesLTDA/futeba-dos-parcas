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
import {FieldValue, Timestamp} from "firebase-admin/firestore";
import {createHash} from "crypto";
import {db} from "../_db";
import {
  checkRateLimit,
  checkRateLimitByIp,
  type RateLimitConfig,
  type RateLimitResult,
} from "../middleware/rate-limiter";
import {FUNCTION_REGION} from "../constants";
import {getAuth} from "../utils/firebase-lazy";

/**
 * FIX #2650: Hash phone number with SHA-256 for rate_limits doc-ID.
 * Prevents storing plaintext E.164 phone numbers as Firestore document IDs.
 * @param {string} phone - E.164 phone number
 * @return {string} Hashed phone (first 32 chars of SHA-256 hex)
 */
function hashPhone(phone: string): string {
  return createHash("sha256").update(phone).digest("hex").substring(0, 32);
}

const SMS_RATE_LIMIT_PER_PHONE_HOUR = 6;
const SMS_RATE_LIMIT_PER_CALLER_HOUR = 12;
const SMS_RATE_LIMIT_PER_IP_HOUR = 30;
const VERIFY_FAIL_AUDIT_THRESHOLD = 5;
// FIX #1310-L8: limite generoso (log legítimo de falha de verificação é
// esperado), mas barra spam que infla verification_failures/audit_logs.
const LOG_FAIL_RATE_LIMIT_PER_HOUR = 20;

type AuthUserLookupError = {
  code?: string;
};

/**
 * Tipo minimo de requisicao para extrair IP / identidade de rate limit.
 * Mantido intencionalmente restrito para nao acoplar o helper ao
 * CallableRequest completo e facilitar testes unitarios.
 */
export interface RateLimitRequest {
  rawRequest?: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
  };
  auth?: {uid?: string};
  app?: {appId?: string};
}

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
// IPv6 frouxo (hex groups + "::"), suficiente para sanitização de log.
const IPV6 = /^(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

/**
 * Normaliza e valida um candidato a IP (IPv4 ou IPv6).
 *
 * FIX #3939 — antes `isValidIp` rejeitava IPv4-mapped IPv6 (`::ffff:1.2.3.4`),
 * formato dominante em sockets IPv6 dual-stack do GCP/GFE. A rejeicao
 * degradava `clientIp` para o sentinel "unknown" na maioria das chamadas
 * reais, colapsando o rate limit num bucket global.
 *
 * @param {string} value - Candidato a IP.
 * @return {string | null} IP normalizado (IPv4 when mapeado-IPv6), ou null se invalido.
 */
function normalizeIp(value: string): string | null {
  const trimmed = value.trim();
  if (IPV4.test(trimmed)) return trimmed;

  const mapped = trimmed.match(
    /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i,
  );
  if (mapped && IPV4.test(mapped[1])) return mapped[1];

  if (IPV6.test(trimmed)) return trimmed;

  return null;
}

/**
 * Número de hops de proxy confiáveis que a infra GCP/GFE acrescenta ao
 * X-Forwarded-For APÓS o IP real do cliente.
 *
 * Em deployments GCP padrão (Firebase Hosting → LB → Cloud Functions), a
 * cadeia normalmente chega como "<forjado opcional>, <cliente>, <lb>".
 * O 1º hop pode ser controlado pelo cliente e o último tende a ser o LB; por
 * isso usamos o penúltimo IP válido quando a cadeia tem 2+ hops válidos.
 *
 * Fallback: se nenhum IP válido na cadeia, usa rawRequest.ip (IP da conexão
 * direta, normalmente o LB — não ideal para rate-limit mas não-spoofable).
 *
 * FIX #3939: retorna null (em vez do sentinel "unknown") quando nenhum IP
 * confiavel é resolvível, forcando consumidores a escolher um bucket
 * isolado por uid/appcheck em vez de um bucket global compartilhado.
 *
 * @param {RateLimitRequest} request - Requisição callable.
 * @return {string | null} IP confiável do cliente normalizado, ou null.
 */
export function clientIp(request: RateLimitRequest): string | null {
  const xffRaw = request.rawRequest?.headers?.["x-forwarded-for"];
  const xff = typeof xffRaw === "string" ? xffRaw : "";
  const hops = xff
    .split(",")
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  const validHops = hops
    .map(normalizeIp)
    .filter((ip): ip is string => ip !== null);

  if (validHops.length >= 2) {
    return validHops[validHops.length - 2];
  }
  if (validHops.length === 1) {
    return validHops[0];
  }

  const fallback = request.rawRequest?.ip;
  if (fallback) {
    const normalizedFallback = normalizeIp(fallback);
    if (normalizedFallback) return normalizedFallback;
  }

  return null;
}

/**
 * Aplica rate limit escolhendo o bucket mais isolado disponivel na request.
 *
 * Cadeia de fallback (do mais isolado/preciso ao mais generico):
 *  1. IP confiavel do cliente  -> bucket por hash de IP (checkRateLimitByIp)
 *  2. UID autenticado          -> bucket `unknown_${uid}` (callables authed)
 *  3. App Check appId          -> bucket `unknown_appcheck_${appId}`
 *                                 (callables publicos com enforceAppCheck)
 *  4. Ultimo recurso           -> bucket `unknown` (so alcancavel em dev/
 *                                 emulator, onde App Check nao e enforce).
 *
 * Isto substitui o anti-pattern onde IP ausente virava um bucket global
 * `validate_invite_code:unknown`, permitindo que poucos chamadores
 * anonimos negassem o servico para todos os demais (DoS de onboarding).
 *
 * @param {RateLimitRequest} request - Requisição callable.
 * @param {RateLimitConfig} config - Configuração de rate limit.
 * @return {Promise<RateLimitResult>} Resultado da verificação.
 */
export async function rateLimitForRequest(
  request: RateLimitRequest,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const ip = clientIp(request);
  if (ip) {
    return checkRateLimitByIp(ip, config);
  }
  const uid = request.auth?.uid;
  if (uid) {
    return checkRateLimit(`unknown_${uid}`, config);
  }
  const appId = request.app?.appId;
  if (appId) {
    return checkRateLimit(`unknown_appcheck_${appId}`, config);
  }
  return checkRateLimit("unknown", config);
}

/**
 * Consulta o dono atual do telefone no Firebase Auth.
 *
 * @param {string} phone - Telefone em E.164.
 * @return {Promise<string | null>} UID do dono atual, ou null se livre.
 */
async function getExistingPhoneOwnerUid(phone: string): Promise<string | null> {
  try {
    const existingUser = await getAuth().getUserByPhoneNumber(phone);
    return existingUser.uid;
  } catch (error) {
    if ((error as AuthUserLookupError)?.code === "auth/user-not-found") {
      return null;
    }
    throw error;
  }
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
    // Esta callable é um preflight consultivo antes do Firebase Phone Auth.
    // Não consome token para não invalidar/reusar o App Check imediatamente
    // antes do envio do SMS em Safari/Android.
    consumeAppCheckToken: false,
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

      // Se o telefone já pertence ao próprio usuário, o onboarding pode seguir.
      const existingPhoneOwnerUid = await getExistingPhoneOwnerUid(phone);
      if (existingPhoneOwnerUid === request.auth.uid) {
        return {
          allowed: true,
          alreadyLinked: true,
        };
      }

      // Se pertence a outra conta, NÃO revelamos isso antes do OTP. O usuário
      // que realmente controla o número vai receber o SMS; só depois do código
      // o cliente consegue oferecer reivindicação/unificação com segurança.

      const callerCheck = await checkRateLimit(request.auth!.uid, {
        maxRequests: SMS_RATE_LIMIT_PER_CALLER_HOUR,
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

      // FIX #2650: usar hash do phone em vez de plaintext E.164 como doc-ID
      // no rate_limits. Previne vazamento de telefones via ids de documentos.
      const phoneHash = hashPhone(phone);
      const phoneCheck = await checkRateLimit(phoneHash, {
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

      const ipLimit = {
        maxRequests: SMS_RATE_LIMIT_PER_IP_HOUR,
        windowMs: 60 * 60 * 1000,
        keyPrefix: "sms_ip",
      };
      // Sem IP confiável, isola o fallback por UID/App Check. Um bucket global
      // "unknown" permitia que poucos usuários bloqueassem todos os demais.
      const ipCheck = await rateLimitForRequest(request, ipLimit);
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
      const now = FieldValue.serverTimestamp();

      await db().collection("verification_failures").add({
        uid,
        ip,
        stage,
        reason,
        timestamp: now,
      });

      // Verifica se user tem muitas falhas recentes (>= threshold)
      // e loga alert pra investigacao
      const oneHourAgo = Timestamp.fromMillis(
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
