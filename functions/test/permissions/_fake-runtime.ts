/**
 * MOCKS DO RUNTIME FIREBASE PARA OS TESTES DE PERMISSÕES
 *
 * Usado via jest.mock(..., () => require("./_fake-runtime").xxx) nos arquivos
 * de teste. onCall/onDocument* devolvem o handler cru, para que o teste o
 * invoque com um request fake (auth, data).
 */

/** Mesmo contrato de HttpsError do firebase-functions: propriedade `code`. */
export class HttpsError extends Error {
  readonly code: string;
  readonly details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpsError";
    this.code = code;
    this.details = details;
  }
}

export const httpsModule = {
  onCall: (_config: unknown, handler?: unknown) => {
    if (typeof _config === "function" && handler === undefined) return _config;
    return handler;
  },
  HttpsError,
};

export const loggerModule = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

/** Substitui `firebase-functions/v2` (usado com `functions.https.onCall`). */
export const functionsV2Module = {
  logger: loggerModule,
  https: httpsModule,
};

/** Triggers de documento: também devolvem o handler cru. */
export const triggersModule = {
  onDocumentCreated: (_config: unknown, handler: unknown) => handler,
  onDocumentUpdated: (_config: unknown, handler: unknown) => handler,
  onDocumentWritten: (_config: unknown, handler: unknown) => handler,
  onDocumentDeleted: (_config: unknown, handler: unknown) => handler,
};

/** Substitui `firebase-admin/firestore`. */
export const {
  FieldValue,
  Timestamp,
  FieldPath,
} = require("./_fake-firestore");

/** Substitui `firebase-admin` no que os módulos usam (apps, firestore()). */
export function adminModule(dbFactory: () => unknown) {
  const firestore = Object.assign(dbFactory, {FieldValue, Timestamp, FieldPath});
  return {
    apps: [{name: "[DEFAULT]"}],
    initializeApp: () => undefined,
    firestore,
  };
}
