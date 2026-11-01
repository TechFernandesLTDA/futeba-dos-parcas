/**
 * TESTES DOS ALERTAS DO CRASHLYTICS (#4417)
 *
 * O contrato com o Cloud Monitoring é o campo `jsonPayload.metric_type`: a
 * política monitoring/crashlytics-alert.json filtra exatamente esse valor.
 */

import * as fs from "fs";
import * as path from "path";

jest.mock("firebase-functions/v2/alerts/crashlytics", () => ({
  onRegressionAlertPublished: jest.fn((_o: unknown, h: unknown) => h),
  onNewFatalIssuePublished: jest.fn((_o: unknown, h: unknown) => h),
  onVelocityAlertPublished: jest.fn((_o: unknown, h: unknown) => h),
}));

import {logger} from "firebase-functions";
import {
  buildCrashlyticsAlertLog,
  CRASHLYTICS_ALERT_METRIC_TYPE,
  onCrashlyticsRegressionAlert,
  onCrashlyticsVelocityAlert,
} from "../../src/monitoring/crashlytics-alerts";

const issue = {
  id: "abc123",
  title: "NullPointerException em GameDetailViewModel",
  subtitle: "GameDetailViewModel.kt line 42",
  appVersion: "1.41.0 (82)",
};

describe("monitoring/crashlytics-alerts", () => {
  beforeEach(() => jest.restoreAllMocks());

  it("monta o log de regressão com o marcador da política", () => {
    const entry = buildCrashlyticsAlertLog("regression", {
      appId: "1:123:android:abc",
      data: {payload: {issue, resolveTime: "2026-10-20T00:00:00Z"}},
    });
    expect(entry).toEqual({
      metric_type: CRASHLYTICS_ALERT_METRIC_TYPE,
      alert_kind: "regression",
      app_id: "1:123:android:abc",
      issue_id: "abc123",
      issue_title: issue.title,
      issue_subtitle: issue.subtitle,
      app_version: "1.41.0 (82)",
      resolve_time: "2026-10-20T00:00:00Z",
    });
  });

  it("inclui contagem e percentual no alerta de pico", () => {
    const entry = buildCrashlyticsAlertLog("velocity", {
      appId: "1:123:ios:def",
      data: {payload: {issue, crashCount: 37, crashPercentage: 2.5}},
    });
    expect(entry).toMatchObject({alert_kind: "velocity", crash_count: 37, crash_percentage: 2.5});
  });

  it("não quebra com evento sem payload", () => {
    expect(buildCrashlyticsAlertLog("new_fatal", {})).toMatchObject({
      metric_type: CRASHLYTICS_ALERT_METRIC_TYPE,
      app_id: "desconhecido",
      issue_title: "",
    });
  });

  it("os handlers gravam warn (não error) com o payload estruturado", async () => {
    const warn = jest.spyOn(logger, "warn").mockImplementation(() => undefined);
    const error = jest.spyOn(logger, "error").mockImplementation(() => undefined);

    await (onCrashlyticsRegressionAlert as unknown as (e: unknown) => Promise<void>)({
      appId: "app-1",
      data: {payload: {issue}},
    });
    await (onCrashlyticsVelocityAlert as unknown as (e: unknown) => Promise<void>)({
      appId: "app-2",
      data: {payload: {issue, crashCount: 5, crashPercentage: 1}},
    });

    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][1]).toMatchObject({metric_type: "crashlytics_alert", alert_kind: "regression"});
    expect(warn.mock.calls[1][1]).toMatchObject({metric_type: "crashlytics_alert", alert_kind: "velocity"});
  });

  it("a política versionada filtra o mesmo metric_type", () => {
    const policyPath = path.resolve(__dirname, "../../../monitoring/crashlytics-alert.json");
    const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
    const filter: string = policy.conditions[0].conditionMatchedLog.filter;
    expect(filter).toContain(`jsonPayload.metric_type="${CRASHLYTICS_ALERT_METRIC_TYPE}"`);
  });
});
