import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {logger} from "firebase-functions/v2";
import {FieldValue} from "firebase-admin/firestore";
import {FUNCTION_REGION} from "../constants";
import {db} from "../_db";

const MAX_GOALS_PER_GAME = 1.5;
const MAX_ASSISTS_PER_GAME = 1.2;
const MAX_SAVES_PER_GAME = 4.0;

interface AutoRatings {
  striker: number;
  mid: number;
  defender: number;
  gk: number;
  sampleSize: number;
}

function num(
  data: FirebaseFirestore.DocumentData,
  camelKey: string,
  snakeKey: string
): number {
  const value = data[camelKey] ?? data[snakeKey] ?? 0;
  return typeof value === "number" ? value : 0;
}

function scale(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(Math.max((value / max) * 5.0, 0), 5.0);
}

export function calculateAutoRatingsFromStats(
  data: FirebaseFirestore.DocumentData
): AutoRatings {
  const totalGames = num(data, "totalGames", "total_games");
  const totalGoals = num(data, "totalGoals", "total_goals");
  const totalAssists = num(data, "totalAssists", "total_assists");
  const totalSaves = num(data, "totalSaves", "total_saves");
  const wins = num(data, "gamesWon", "total_wins") ||
    num(data, "totalWins", "total_wins");
  const yellowCards = num(data, "totalYellowCards", "yellow_cards");
  const redCards = num(data, "totalRedCards", "red_cards");

  const avgGoals = totalGames > 0 ? totalGoals / totalGames : 0;
  const avgAssists = totalGames > 0 ? totalAssists / totalGames : 0;
  const avgSaves = totalGames > 0 ? totalSaves / totalGames : 0;
  const winRate = totalGames > 0 ? wins / totalGames : 0;
  const weightedCards = yellowCards + redCards * 3;
  const avgCards = totalGames > 0 ? weightedCards / totalGames : 0;

  const discipline = Math.min(Math.max(1.0 - avgCards / 2.0, 0), 1);
  const defenderScore = winRate * 0.6 + discipline * 0.4;

  return {
    striker: scale(avgGoals, MAX_GOALS_PER_GAME),
    mid: scale(avgAssists, MAX_ASSISTS_PER_GAME),
    defender: Math.min(Math.max(defenderScore * 5.0, 0), 5.0),
    gk: scale(avgSaves, MAX_SAVES_PER_GAME),
    sampleSize: totalGames,
  };
}

export const onStatisticsWrittenForAutoRatings = onDocumentWritten(
  {
    document: "statistics/{userId}",
    region: FUNCTION_REGION,
  },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const data = after.data();
    if (!data) return;

    const userId = event.params.userId;
    const ratings = calculateAutoRatingsFromStats(data);
    if (ratings.sampleSize < 1) return;

    await db().collection("users").doc(userId).update({
      auto_striker_rating: ratings.striker,
      auto_mid_rating: ratings.mid,
      auto_defender_rating: ratings.defender,
      auto_gk_rating: ratings.gk,
      auto_rating_samples: ratings.sampleSize,
      auto_rating_updated_at: FieldValue.serverTimestamp(),
    });

    logger.info("Auto-ratings updated from statistics", {
      userId,
      sampleSize: ratings.sampleSize,
    });
  }
);
