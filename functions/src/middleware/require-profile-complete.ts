import {
  CallableRequest,
  HttpsError,
} from "firebase-functions/v2/https";

/**
 * Exige cadastro completo no token autenticado.
 *
 * @param {CallableRequest} request Requisicao callable.
 */
export function requireProfileComplete(
  request: CallableRequest
): void {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "auth required"
    );
  }

  if (request.auth.token.profileComplete !== true) {
    throw new HttpsError(
      "failed-precondition",
      "profile.incomplete"
    );
  }
}
