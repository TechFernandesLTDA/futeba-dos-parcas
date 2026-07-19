/* eslint-disable require-jsdoc */
import * as admin from "firebase-admin";
import {Timestamp} from "firebase-admin/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import {
  FUNCTION_REGION,
  FIRESTORE_PAGINATION_LIMIT,
} from "./constants";
import {
  GAMIFICATION_NUDGES,
} from "./notifications/notification-messages";
import {
  NotificationType,
  sendAndSaveNotification,
} from "./notifications/helpers";
import {
  claimNotificationEventOnce,
  completeNotificationEvent,
  releaseNotificationEvent,
} from "./notifications/dedup";
import {LEVELS} from "./xp/pipeline";
import {db} from "./_db";

type AlmostBadgeHint = {
  badgeName: string;
  remaining: number;
  unit: string;
};

const MAX_LEVEL_DISTANCE_XP = 100;
const BADGE_PROGRESS_THRESHOLD = 0.8;
const BRT_TIMEZONE = "America/Sao_Paulo";
const GAME_QUERY_BATCH_SIZE = 5;
const ACTIVE_GAME_STATUSES = ["SCHEDULED", "CONFIRMED"] as const;

const BADGE_HINTS = [
  {
    badgeName: "Goleador",
    unit: "gols",
    field: "totalGoals",
    thresholds: [10, 25, 50, 100, 250],
  },
  {
    badgeName: "Garçom",
    unit: "assistências",
    field: "totalAssists",
    thresholds: [10, 25, 50, 100],
  },
  {
    badgeName: "Muralha",
    unit: "defesas",
    field: "totalSaves",
    thresholds: [25, 50, 100, 250],
  },
  {
    badgeName: "Vencedor",
    unit: "vitórias",
    field: "gamesWon",
    thresholds: [10, 25, 50, 100],
  },
] as const;

function todayKey(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: BRT_TIMEZONE,
  });
}

function notificationDocId(
  type: string,
  userId: string,
): string {
  return `gamification_nudge_${type}_${userId}_${todayKey()}`;
}

function getAlmostLevelHint(
  currentXp: number,
): {xpLeft: number; levelName: string} | null {
  const nextLevel = LEVELS.find((level) => level.xpRequired > currentXp);
  if (!nextLevel) return null;
  const xpLeft = nextLevel.xpRequired - currentXp;
  if (xpLeft >= MAX_LEVEL_DISTANCE_XP) return null;
  return {
    xpLeft,
    levelName: nextLevel.name,
  };
}

function getAlmostBadgeHint(
  stats: Record<string, unknown>,
): AlmostBadgeHint | null {
  for (const hint of BADGE_HINTS) {
    const current = Number(stats[hint.field] ?? 0);
    if (!Number.isFinite(current)) continue;
    const nextThreshold = hint.thresholds.find((threshold) => threshold > current);
    if (!nextThreshold) continue;
    if (current / nextThreshold < BADGE_PROGRESS_THRESHOLD) continue;
    return {
      badgeName: hint.badgeName,
      remaining: nextThreshold - current,
      unit: hint.unit,
    };
  }
  return null;
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function sendGamificationNotificationOnce(
  userId: string,
  payload: Parameters<typeof sendAndSaveNotification>[1],
  docId: string,
): Promise<void> {
  const claimed = await claimNotificationEventOnce(docId);
  if (!claimed) return;

  try {
    await sendAndSaveNotification(userId, payload, docId);
  } catch (error) {
    await releaseNotificationEvent(docId);
    throw error;
  }

  try {
    await completeNotificationEvent(docId);
  } catch (error) {
    logger.error(
      "[GAMIFICATION_NUDGES] failed to complete dedup claim",
      {docId, userId, error},
    );
    throw error;
  }
}

async function maybeSendAlmostLevel(
  userId: string,
  userData: Record<string, unknown>,
): Promise<void> {
  const currentXp = Number(userData.experience_points ?? 0);
  if (!Number.isFinite(currentXp)) return;
  const hint = getAlmostLevelHint(currentXp);
  if (!hint) return;

  const docId = notificationDocId("almost_level", userId);
  await sendGamificationNotificationOnce(userId, {
    userId,
    title: GAMIFICATION_NUDGES.ALMOST_LEVEL.title["pt-BR"](),
    body: GAMIFICATION_NUDGES.ALMOST_LEVEL.body["pt-BR"]({
      xpLeft: String(hint.xpLeft),
      levelName: hint.levelName,
    }),
    type: NotificationType.ACHIEVEMENT,
    action: "achievements",
  }, docId);
}

async function maybeSendAlmostBadge(
  userId: string,
  statsData: Record<string, unknown>,
): Promise<void> {
  const hint = getAlmostBadgeHint(statsData);
  if (!hint) return;

  const docId = notificationDocId("almost_badge", userId);
  await sendGamificationNotificationOnce(userId, {
    userId,
    title: GAMIFICATION_NUDGES.ALMOST_BADGE.title["pt-BR"](),
    body: GAMIFICATION_NUDGES.ALMOST_BADGE.body["pt-BR"]({
      remaining: String(hint.remaining),
      unit: hint.unit,
      badgeName: hint.badgeName,
    }),
    type: NotificationType.ACHIEVEMENT,
    action: "badges",
  }, docId);
}

async function findUpcomingOpenGameForUser(
  userId: string,
): Promise<string | null> {
  const memberships = await db()
    .collectionGroup("members")
    .where("user_id", "==", userId)
    .limit(20)
    .get();

  const groupIds = Array.from(new Set(
    memberships.docs.flatMap((membership) => {
      const data = membership.data() ?? {};
      if (data.status !== "ACTIVE") return [];
      const groupId = membership.ref.parent.parent?.id;
      return groupId ? [groupId] : [];
    }),
  ));

  if (groupIds.length === 0) return null;

  const nowTs = Timestamp.fromDate(new Date());

  for (const groupBatch of chunk(groupIds, GAME_QUERY_BATCH_SIZE)) {
    const batchResults = await Promise.all(
      groupBatch.map(async (groupId) => {
        const gamesSnap = await db()
          .collection("games")
          .where("group_id", "==", groupId)
          .where("status", "in", ACTIVE_GAME_STATUSES)
          .where("dateTime", ">", nowTs)
          .orderBy("dateTime", "asc")
          .get();

        if (gamesSnap.empty) return null;

        const confirmationSnaps = await Promise.all(
          gamesSnap.docs.map((gameDoc) =>
            db()
              .collection("confirmations")
              .doc(`${gameDoc.id}_${userId}`)
              .get(),
          ),
        );

        for (let index = 0; index < gamesSnap.docs.length; index++) {
          const confirmationStatus =
            confirmationSnaps[index].data()?.status;
          if (confirmationStatus !== "CONFIRMED") {
            return gamesSnap.docs[index].id;
          }
        }

        return null;
      }),
    );

    const foundGameId = batchResults.find((gameId) => gameId !== null);
    if (foundGameId) return foundGameId;
  }

  return null;
}

async function maybeSendStreakAtRisk(
  userId: string,
  streak: number,
): Promise<void> {
  if (streak < 3) return;
  const gameId = await findUpcomingOpenGameForUser(userId);
  if (!gameId) return;

  const docId = notificationDocId("streak_at_risk", userId);
  await sendGamificationNotificationOnce(userId, {
    userId,
    title: GAMIFICATION_NUDGES.STREAK_AT_RISK.title["pt-BR"](),
    body: GAMIFICATION_NUDGES.STREAK_AT_RISK.body["pt-BR"]({
      streak: String(streak),
    }),
    type: NotificationType.ACHIEVEMENT,
    gameId,
    action: "games",
  }, docId);
}

export const sendGamificationNudgesDaily = onSchedule(
  {
    region: FUNCTION_REGION,
    schedule: "0 10 * * *",
    timeZone: BRT_TIMEZONE,
    memory: "512MiB",
    timeoutSeconds: 180,
  },
  async () => {
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    while (true) {
      let usersQuery = db()
        .collection("users")
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(FIRESTORE_PAGINATION_LIMIT);
      if (cursor) {
        usersQuery = usersQuery.startAfter(cursor);
      }
      const usersSnap = await usersQuery.get();
      if (usersSnap.empty) break;

      for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data() ?? {};
        await maybeSendAlmostLevel(userId, userData);

        const statsSnap = await db()
          .collection("statistics")
          .doc(userId)
          .get();
        if (statsSnap.exists) {
          await maybeSendAlmostBadge(
            userId,
            statsSnap.data() ?? {},
          );
        }

        const streakSnap = await db()
          .collection("user_streaks")
          .doc(userId)
          .get();
        if (streakSnap.exists) {
          const streak = Number(
            streakSnap.data()?.current_streak ?? 0,
          );
          if (Number.isFinite(streak)) {
            await maybeSendStreakAtRisk(
              userId,
              streak,
            );
          }
        }
      }

      cursor = usersSnap.docs[usersSnap.docs.length - 1] ?? null;
      if (usersSnap.size < FIRESTORE_PAGINATION_LIMIT) {
        break;
      }
    }

    logger.info("[GAMIFICATION_NUDGES] daily run complete");
  },
);
