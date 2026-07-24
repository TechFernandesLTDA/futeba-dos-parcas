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

type SeasonStanding = admin.firestore.DocumentData;

/**
 * FIX #3882: calcula a chave YYYY-MM do mês seguinte.
 * Usada para criar/ativar a próxima temporada NO MESMO batch que
 * desativa a atual, eliminando a janela de ~61min sem temporada ativa
 * entre o archiveSeason (23:59 do último dia) e o startNewSeason
 * (01:00 do dia 1º).
 *
 * @param {string} monthKey - Chave YYYY-MM do mês atual.
 * @return {string} Chave YYYY-MM do mês seguinte.
 */
export function getNextMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${nextMonth.toString().padStart(2, "0")}`;
}

/**
 * Monta o payload arquivado sem campos undefined. Firestore rejeita undefined,
 * então temporadas sem standings precisam ser arquiváveis mesmo vazias.
 *
 * @param {string} monthKey - Chave YYYY-MM da temporada.
 * @param {SeasonStanding[]} standings - Ranking final da temporada.
 * @param {unknown} archivedAt - Timestamp ou sentinel de archive.
 * @return {Record<string, unknown>} Payload seguro para Firestore.
 */
export function buildSeasonArchivePayload(
  monthKey: string,
  standings: SeasonStanding[],
  archivedAt: unknown
): Record<string, unknown> {
  const mvp = standings[0] ?? null;
  const lanterninha = standings.length > 1 ?
    standings[standings.length - 1] :
    null;

  return {
    month_key: monthKey,
    name: `Temporada ${getMonthName(monthKey)}`,
    standings,
    mvp_user_id: mvp?.user_id ?? null,
    mvp_user_name: mvp?.user_name ?? null,
    mvp_points: mvp?.points ?? null,
    lanterninha_user_id: lanterninha?.user_id ?? null,
    lanterninha_user_name: lanterninha?.user_name ?? null,
    archived_at: archivedAt,
  };
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
        const seasonsRef = db()
          .collection("groups")
          .doc(groupId)
          .collection("league_seasons");
        const seasonRef = db()
          .collection("groups")
          .doc(groupId)
          .collection("league_seasons")
          .doc(monthKey);

        const [exists, activeSeasonsSnap] = await Promise.all([
          seasonRef.get(),
          seasonsRef.where("is_active", "==", true).get(),
        ]);

        const batch = db().batch();
        let repairedActiveSeasons = 0;

        for (const activeSeasonDoc of activeSeasonsSnap.docs) {
          if (activeSeasonDoc.id === monthKey) continue;
          batch.update(activeSeasonDoc.ref, {
            is_active: false,
            end_date: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });
          repairedActiveSeasons += 1;
        }

        if (exists.exists) {
          const currentSeasonData = exists.data() || {};
          const shouldReactivate =
            currentSeasonData.is_active !== true;

          if (shouldReactivate) {
            batch.set(seasonRef, {
              is_active: true,
              updated_at: FieldValue.serverTimestamp(),
            }, {merge: true});
          }

          if (repairedActiveSeasons > 0 || shouldReactivate) {
            await batch.commit();
          }

          logger.info("Season already exists", {
            groupId,
            monthKey,
            repairedActiveSeasons,
            activatedExistingSeason: shouldReactivate,
          });
          continue;
        }

        batch.set(seasonRef, {
          name: `Temporada ${getMonthName(monthKey)}`,
          is_active: true,
          start_date: FieldValue.serverTimestamp(),
          created_at: FieldValue.serverTimestamp(),
        });
        await batch.commit();

        logger.info("Created season", {
          groupId,
          monthKey,
          repairedActiveSeasons,
        });
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

        // FIX #2770: filtrar por season_id antes de ordenar,
        // pois league_standings acumula histórico de todas as temporadas
        // (doc id = `${seasonId}_${userId}`, campo season_id).
        // Sem o filtro, MVP/lanterninha misturavam temporadas anteriores.
        const standingsSnap = await db()
          .collection("groups")
          .doc(groupId)
          .collection("league_standings")
          .where("season_id", "==", monthKey)
          .orderBy("points", "desc")
          .get();

        const standings = standingsSnap.docs.map((d) => d.data());
        const mvp = standings[0] ?? null;

        const archiveRef = db()
          .collection("season-archive")
          .doc(groupId)
          .collection("seasons")
          .doc(monthKey);

        await archiveRef.set(buildSeasonArchivePayload(
          monthKey,
          standings,
          FieldValue.serverTimestamp()
        ));

        // FIX #3882: virada atômica — cria/ativa a próxima temporada NO
        // MESMO batch que desativa a atual. Antes, a desativação às 23:59
        // do último dia deixava ~61min sem nenhuma season is_active==true
        // até o startNewSeason (01:00 do dia 1º), e partidas de liga
        // finalizadas nessa janela eram descartadas permanentemente pelo
        // onGameFinishedGroupLeague. O startNewSeason vira um repair
        // idempotente (já trata "season already exists" + ativa).
        const nextMonthKey = getNextMonthKey(monthKey);
        const nextSeasonRef = db()
          .collection("groups")
          .doc(groupId)
          .collection("league_seasons")
          .doc(nextMonthKey);
        const nextSeasonDoc = await nextSeasonRef.get();

        const turnoverBatch = db().batch();
        turnoverBatch.update(seasonRef, {
          is_active: false,
          end_date: FieldValue.serverTimestamp(),
        });
        if (nextSeasonDoc.exists) {
          // Já existe (criada manualmente ou por run anterior): só ativa.
          turnoverBatch.set(nextSeasonRef, {
            is_active: true,
            updated_at: FieldValue.serverTimestamp(),
          }, {merge: true});
        } else {
          turnoverBatch.set(nextSeasonRef, {
            name: `Temporada ${getMonthName(nextMonthKey)}`,
            is_active: true,
            start_date: FieldValue.serverTimestamp(),
            created_at: FieldValue.serverTimestamp(),
          });
        }
        await turnoverBatch.commit();

        if (mvp?.user_id) {
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
        } else if (mvp) {
          logger.warn("Season archived without MVP badge due to missing user_id", {
            groupId,
            monthKey,
            mvp,
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
