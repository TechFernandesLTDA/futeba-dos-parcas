import {onSchedule} from "firebase-functions/v2/scheduler";
import {logger} from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";

const db = () => admin.firestore();

/**
 * Retorna o nome do mes em portugues
 * @param {string} monthKey - Chave no formato YYYY-MM
 * @return {string} Nome do mes
 */
function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const names = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const m = parseInt(month, 10) - 1;
  return `${names[m]} de ${year}`;
}

export const startNewSeason = onSchedule(
  {
    schedule: "0 1 1 * *",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
  },
  async () => {
    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    const [yearStr, monthStr] = todayStr.split("-");
    const monthKey = `${yearStr}-${monthStr}`;
    // FIX #2199: removida a variável prevMonth não utilizada (+ void prevMonth).

    logger.info("Starting new season", {monthKey});

    const groupsSnap = await db().collection("official-groups").get();

    for (const groupDoc of groupsSnap.docs) {
      const groupId = groupDoc.id;

      try {
        const seasonRef = db()
          .collection("groups")
          .doc(groupId)
          .collection("league_seasons")
          .doc(monthKey);

        const exists = await seasonRef.get();
        if (exists.exists) {
          logger.info("Season already exists", {groupId, monthKey});
          continue;
        }

        await seasonRef.set({
          name: `Temporada ${getMonthName(monthKey)}`,
          is_active: true,
          start_date: FieldValue.serverTimestamp(),
          created_at: FieldValue.serverTimestamp(),
        });

        logger.info("Created season", {groupId, monthKey});
      } catch (err) {
        logger.error("Error creating season", {groupId, monthKey, err});
      }
    }

    logger.info("New seasons started", {monthKey, groups: groupsSnap.size});
  }
);

export const archiveSeason = onSchedule(
  {
    schedule: "59 23 * * *",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
  },
  async () => {
    const todayStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Sao_Paulo",
    });
    const [yearStr, monthStr, dayStr] = todayStr.split("-");
    const lastDayOfMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
    if (Number(dayStr) !== lastDayOfMonth) return;

    const monthKey = `${yearStr}-${monthStr}`;
    logger.info("Archiving season", {monthKey});

    const groupsSnap = await db().collection("official-groups").get();

    for (const groupDoc of groupsSnap.docs) {
      const groupId = groupDoc.id;

      try {
        const seasonRef = db()
          .collection("groups")
          .doc(groupId)
          .collection("league_seasons")
          .doc(monthKey);

        const seasonDoc = await seasonRef.get();
        if (!seasonDoc.exists) continue;
        if (!seasonDoc.data()?.is_active) continue;

        const standingsSnap = await db()
          .collection("groups")
          .doc(groupId)
          .collection("league_standings")
          .orderBy("points", "desc")
          .get();

        const standings = standingsSnap.docs.map((d) => d.data());
        const mvp = standings[0];
        const lanterninha = standings[standings.length - 1];

        const archiveRef = db()
          .collection("season-archive")
          .doc(groupId)
          .collection("seasons")
          .doc(monthKey);

        await archiveRef.set({
          month_key: monthKey,
          name: `Temporada ${getMonthName(monthKey)}`,
          standings,
          mvp_user_id: mvp?.user_id,
          mvp_user_name: mvp?.user_name,
          mvp_points: mvp?.points,
          lanterninha_user_id: lanterninha?.user_id,
          lanterninha_user_name: lanterninha?.user_name,
          archived_at: FieldValue.serverTimestamp(),
        });

        await seasonRef.update({
          is_active: false,
          end_date: FieldValue.serverTimestamp(),
        });

        if (mvp) {
          const badgesRef = db()
            .collection("users")
            .doc(mvp.user_id)
            .collection("badges");
          await badgesRef.doc(`mvp_liga_${monthKey}`).set({
            badge_id: `mvp_liga_${monthKey}`,
            name: `MVP da Liga - ${getMonthName(monthKey)}`,
            icon: "🏆",
            type: "MVP_LIGA",
            earned_at: FieldValue.serverTimestamp(),
            earned: true,
          });
        }

        logger.info("Archived season", {
          groupId,
          monthKey,
          mvp: mvp?.user_name,
          players: standings.length,
        });
      } catch (err) {
        logger.error("Error archiving season", {groupId, monthKey, err});
      }
    }
  }
);
