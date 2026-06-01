/**
 * CALLABLE FUNCTIONS DE NOTIFICAÇÕES
 * Funções chamáveis para envio de notificações
 * de teste e debug.
 */

import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";
import {
  sanitizeText,
} from "../validation/index";
import {
  secureCallable,
} from "../middleware/secure-callable-wrapper";
import {
  NotificationType,
  sendNotificationToUser,
  saveNotificationToFirestore,
} from "./helpers";

// Lazy initialization para evitar erro de initializeApp
const getDb = () => admin.firestore();

// ==========================================
// SEND TEST NOTIFICATION
// ==========================================

/**
 * Envia uma notificação de teste para o próprio
 * usuário autenticado.
 *
 * @param {string} request.data.title - Título
 * @param {string} request.data.body - Corpo
 * @param {string} request.data.type - Tipo
 * @return {object} Resultado do envio
 */
export const sendTestNotification = secureCallable(
  {
    // GAP-2: callable de debug deve ficar atrás de App Check (default em prod)
    // e restrita a ADMIN. Antes: appCheck:false + sem requiredRole permitia
    // qualquer user autenticado disparar notif de teste em prod.
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {
      maxRequests: 10,
      windowMs: 60 * 1000,
      keyPrefix: "send_test_notif",
    },
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "sendTestNotification",
      userId: request.auth?.uid,
    }),
  },
  async (request) => {
    const userId = request.auth!.uid;

    const data =
      (request.data || {}) as Record<string, string>;
    const {title, body, type} = data;

    // Validação de entrada robusta
    if (!title || typeof title !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Título é obrigatório e deve ser string"
      );
    }
    if (!body || typeof body !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Corpo é obrigatório e deve ser string"
      );
    }
    if (title.length > 200) {
      throw new HttpsError(
        "invalid-argument",
        "Título não pode exceder 200 caracteres"
      );
    }
    if (body.length > 500) {
      throw new HttpsError(
        "invalid-argument",
        "Corpo não pode exceder 500 caracteres"
      );
    }
    if (
      type &&
      !Object.values(NotificationType)
        .includes(type as NotificationType)
    ) {
      const vals =
        Object.values(NotificationType).join(", ");
      throw new HttpsError(
        "invalid-argument",
        `Tipo invalido. Valores aceitos: ${vals}`
      );
    }

    // Sanitizar inputs contra XSS
    const safeTitle = sanitizeText(title);
    const safeBody = sanitizeText(body);

    const success = await sendNotificationToUser(
      userId,
      {
        title: safeTitle,
        body: safeBody,
        type: (type as NotificationType) || NotificationType.GAME_INVITE,
      }
    );

    return {
      success,
      message: success ?
        "Notificacao enviada!" :
        "Falha ao enviar",
    };
  }
);

// ==========================================
// CREATE FAKE GAME NOTIFICATIONS
// ==========================================

/**
 * Resultado de notificação fake criada.
 */
interface FakeNotificationResult {
  id: string;
  title: string;
  body: string;
}

/**
 * Cria notificações fake para testes de UI.
 * Apenas para desenvolvimento/debug.
 *
 * @param {number} request.data.count - Quantidade
 * @return {object} Resultado com notificações criadas
 */
export const createFakeGameNotifications = secureCallable(
  {
    // GAP-2: callable de debug deve ficar atrás de App Check (default em prod)
    // e restrita a ADMIN. Antes: appCheck:false + sem requiredRole permitia
    // qualquer user autenticado popular notif fake.
    requireAuth: true,
    requiredRole: "ADMIN",
    rateLimit: {
      maxRequests: 10,
      windowMs: 60 * 1000,
      keyPrefix: "fake_game_notif",
    },
    enableAuditLog: true,
    auditLogContext: async (request) => ({
      function: "createFakeGameNotifications",
      userId: request.auth?.uid,
    }),
  },
  async (request) => {
    const userId = request.auth!.uid;

    const reqData =
      (request.data || {}) as Record<string, unknown>;
    const rawCount = reqData.count;

    // Validação: count entre 1 e 5
    const count =
      typeof rawCount === "number" ?
        Math.max(
          1,
          Math.min(5, Math.round(rawCount))
        ) :
        3;

    const userDoc = await getDb()
      .collection("users")
      .doc(userId)
      .get();
    const userName = userDoc.exists ?
      (userDoc.data()?.name ||
        userDoc.data()?.nickname ||
        "Jogador") :
      "Jogador";

    const fakeGames = [
      {
        title: "Pelada de Sexta!",
        body: userName +
          ", voce foi convidado para" +
          " a pelada de sexta as 18h!",
        time: "Sexta, 18:00",
        location: "Campo do Clube",
      },
      {
        title: "Futebol no Sabado",
        body: "Vem jogar " + userName +
          "! Sabado as 10h no campo society.",
        time: "Sabado, 10:00",
        location: "Society Center",
      },
      {
        title: "Domingo de Bola",
        body: "Domingo tem jogo! " + userName +
          ", confirma ai?",
        time: "Domingo, 09:00",
        location: "Quadra do Parque",
      },
      {
        title: "Pelada Noturna",
        body: "Hoje a noite " + userName +
          "! 20h na quadra iluminada.",
        time: "Hoje, 20:00",
        location: "Quadra Iluminada",
      },
      {
        title: "Campeonato Interno",
        body: "Seu grupo esta organizando" +
          " um campeonato. Participe!",
        time: "Proximo sabado",
        location: "Centro Esportivo",
      },
    ];

    const created: FakeNotificationResult[] = [];

    for (
      let i = 0;
      i < Math.min(count, fakeGames.length);
      i++
    ) {
      const game = fakeGames[i];
      const notificationId =
        await saveNotificationToFirestore(userId, {
          userId,
          title: game.title,
          body: game.body,
          type: NotificationType.GAME_INVITE,
          action: "game_detail/fake",
          senderId: "system",
          senderName: "Sistema",
        });

      created.push({
        id: notificationId,
        title: game.title,
        body: game.body,
      });
    }

    if (created.length > 0) {
      await sendNotificationToUser(userId, {
        title: created[0].title,
        body: created[0].body,
        type: NotificationType.GAME_INVITE,
      });
    }

    return {
      success: true,
      created: created.length,
      notifications: created,
    };
  }
);
