import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {mirrorBadgeToRoot} from "./user-badge-docs";

const db = () => admin.firestore();

interface AmbassadorThreshold {
  badgeId: string;
  name: string;
  icon: string;
  level: "BRONZE" | "PRATA" | "OURO" | "LENDA";
  minInvites: number;
}

const AMBASSADOR_THRESHOLDS: AmbassadorThreshold[] = [
  {badgeId: "ambassador_bronze", name: "Embaixador Bronze", icon: "🥉", level: "BRONZE", minInvites: 3},
  {badgeId: "ambassador_prata", name: "Embaixador Prata", icon: "🥈", level: "PRATA", minInvites: 10},
  {badgeId: "ambassador_ouro", name: "Embaixador Ouro", icon: "🥇", level: "OURO", minInvites: 30},
  {badgeId: "ambassador_lenda", name: "Embaixador Lenda", icon: "👑", level: "LENDA", minInvites: 100},
];

/**
 * Verifica os thresholds de badges Embaixador e concede badges
 * que ainda nao foram ganhos pelo usuario.
 * @param {string} userId - UID do usuario
 * @param {number} inviteCount - Numero atual de convites convertidos
 */
async function awardAmbassadorBadge(userId: string, inviteCount: number) {
  const badgesRef = db().collection("users").doc(userId).collection("badges");

  for (const threshold of AMBASSADOR_THRESHOLDS) {
    if (inviteCount < threshold.minInvites) continue;

    const badgeDoc = await badgesRef.doc(threshold.badgeId).get();
    if (badgeDoc.exists) continue;

    await badgesRef.doc(threshold.badgeId).set({
      badge_id: threshold.badgeId,
      name: threshold.name,
      icon: threshold.icon,
      type: "AMBASSADOR",
      rarity: threshold.level === "LENDA" ? "LENDARIO" : threshold.level === "OURO" ? "EPICO" : threshold.level === "PRATA" ? "RARO" : "COMUM",
      level: threshold.level,
      earned_at: FieldValue.serverTimestamp(),
      earned: true,
    });

    // FIX #4138: espelha para user_badges raiz — as telas (web/Android)
    // leem só a raiz; antes o badge ficava invisível para sempre.
    await mirrorBadgeToRoot(userId, {
      badgeId: threshold.badgeId,
      name: threshold.name,
      icon: threshold.icon,
      type: "AMBASSADOR",
      earnedAt: FieldValue.serverTimestamp(),
      earned: true,
      count: 1,
    });

    logger.info("Awarded ambassador badge", {
      userId,
      badgeId: threshold.badgeId,
      inviteCount,
    });
  }
}

/**
 * Firestore trigger: quando invite_count de um usuario muda,
 * verifica se thresholds de badges Embaixador foram atingidos.
 */
export const onUserInviteCountChanged = onDocumentWritten(
  {
    document: "users/{userId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    const beforeCount = (beforeData?.invite_count as number) || 0;
    const afterCount = (afterData?.invite_count as number) || 0;

    if (afterCount <= beforeCount) return;

    const userId = event.params.userId;
    await awardAmbassadorBadge(userId, afterCount);

    logger.info("Checked ambassador badges", {userId, inviteCount: afterCount});
  }
);
