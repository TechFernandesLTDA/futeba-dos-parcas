/**
 * ALERTAS DO CRASHLYTICS NO CANAL DE E-MAIL (#4417)
 *
 * O Firebase publica alertas do Crashlytics (regressão de issue resolvida,
 * novo crash fatal e pico de crashes) como eventos do Firebase Alerts. Estas
 * functions recebem esses eventos e gravam um log estruturado com
 * `metric_type = "crashlytics_alert"`. A política
 * `monitoring/crashlytics-alert.json` filtra esse log e manda e-mail pelo
 * mesmo canal das demais políticas do projeto.
 *
 * Valem para Android e iOS: sem `appId`, o gatilho recebe os alertas de todos
 * os apps do projeto.
 *
 * Usa `logger.warn` (e não `error`) para não contar na política genérica
 * "Cloud Functions com erros": o problema está no app, não na function.
 */

import {logger} from "firebase-functions";
import {
  onNewFatalIssuePublished,
  onRegressionAlertPublished,
  onVelocityAlertPublished,
} from "firebase-functions/v2/alerts/crashlytics";
import {FUNCTION_REGION} from "../constants";

/** Marcador lido pela política de alerta (jsonPayload.metric_type). */
export const CRASHLYTICS_ALERT_METRIC_TYPE = "crashlytics_alert";

/** Tipos de alerta do Crashlytics encaminhados ao canal. */
export type CrashlyticsAlertKind = "regression" | "new_fatal" | "velocity";

/** Campos mínimos do evento que o log usa. */
interface CrashlyticsAlertEventLike {
  appId?: string;
  data?: {
    payload?: {
      issue?: {
        id?: string;
        title?: string;
        subtitle?: string;
        appVersion?: string;
      };
      crashCount?: number;
      crashPercentage?: number;
      resolveTime?: string;
    };
  };
}

/**
 * Monta o payload do log estruturado de um alerta do Crashlytics (função pura).
 *
 * @param {CrashlyticsAlertKind} kind tipo do alerta
 * @param {CrashlyticsAlertEventLike} event evento recebido do Firebase Alerts
 * @return {Record<string, unknown>} payload para `logger.warn`
 */
export function buildCrashlyticsAlertLog(
  kind: CrashlyticsAlertKind,
  event: CrashlyticsAlertEventLike
): Record<string, unknown> {
  const payload = event.data?.payload ?? {};
  const issue = payload.issue ?? {};
  const entry: Record<string, unknown> = {
    metric_type: CRASHLYTICS_ALERT_METRIC_TYPE,
    alert_kind: kind,
    app_id: event.appId ?? "desconhecido",
    issue_id: issue.id ?? "",
    issue_title: issue.title ?? "",
    issue_subtitle: issue.subtitle ?? "",
    app_version: issue.appVersion ?? "",
  };
  if (kind === "velocity") {
    entry.crash_count = payload.crashCount ?? 0;
    entry.crash_percentage = payload.crashPercentage ?? 0;
  }
  if (kind === "regression" && payload.resolveTime) {
    entry.resolve_time = payload.resolveTime;
  }
  return entry;
}

const KIND_LABEL: Record<CrashlyticsAlertKind, string> = {
  regression: "regressão de issue resolvida",
  new_fatal: "novo crash fatal",
  velocity: "pico de crashes",
};

/**
 * Grava o log estruturado de um alerta do Crashlytics.
 *
 * @param {CrashlyticsAlertKind} kind tipo do alerta
 * @param {CrashlyticsAlertEventLike} event evento recebido
 */
function logCrashlyticsAlert(
  kind: CrashlyticsAlertKind,
  event: CrashlyticsAlertEventLike
): void {
  const entry = buildCrashlyticsAlertLog(kind, event);
  logger.warn(
    `[CRASHLYTICS] ${KIND_LABEL[kind]}: ${entry.issue_title || "(sem título)"}`,
    entry
  );
}

const ALERT_OPTIONS = {
  region: FUNCTION_REGION,
  memory: "256MiB" as const,
  timeoutSeconds: 60,
  maxInstances: 2,
};

/** Issue que estava resolvida voltou a acontecer (regressão). */
export const onCrashlyticsRegressionAlert = onRegressionAlertPublished(
  ALERT_OPTIONS,
  async (event) => {
    logCrashlyticsAlert("regression", event);
  }
);

/** Primeiro crash fatal de uma issue nova. */
export const onCrashlyticsNewFatalIssueAlert = onNewFatalIssuePublished(
  ALERT_OPTIONS,
  async (event) => {
    logCrashlyticsAlert("new_fatal", event);
  }
);

/** Uma issue passou do limite de velocidade de crashes. */
export const onCrashlyticsVelocityAlert = onVelocityAlertPublished(
  ALERT_OPTIONS,
  async (event) => {
    logCrashlyticsAlert("velocity", event);
  }
);
