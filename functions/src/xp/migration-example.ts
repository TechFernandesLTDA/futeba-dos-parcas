/**
 * EXEMPLO DE MIGRAÇÃO PARA XP IDEMPOTENTE
 *
 * Este arquivo demonstra como integrar o novo sistema de XP Processing
 * com o código existente em index.ts, mantendo backward compatibility.
 *
 * ESTRATÉGIA DE MIGRAÇÃO:
 * 1. Manter código antigo funcionando (feature flag)
 * 2. Adicionar novo sistema em paralelo
 * 3. Gradualmente migrar para novo sistema
 * 4. Remover código antigo após validação
 */

import * as admin from "firebase-admin";
import {
  processXpIdempotent,
  processXpBatch,
  XpTransactionData,
  XpBreakdown,
  XpMetadata,
} from "./processing";

const db = admin.firestore();

/** Configurações de XP do grupo (legado) */
interface XpSettings {
  xp_presence?: number;
  xp_per_goal?: number;
  xp_per_assist?: number;
  xp_per_save?: number;
  xp_win?: number;
  xp_draw?: number;
  xp_mvp?: number;
  [key: string]: number | undefined;
}

/** Confirmação/stats de um jogador (legado) */
interface PlayerConf {
  goals: number;
  assists: number;
  saves: number;
  is_worst_player?: boolean;
  [key: string]: number | boolean | undefined;
}

// ==========================================
// FEATURE FLAG
// ==========================================

/**
 * Feature flag para controlar rollout do novo sistema.
 * Armazenado em app_settings/xp_processing
 */
export async function isIdempotentXpEnabled(): Promise<boolean> {
  try {
    const settingsDoc = await db
      .collection("app_settings")
      .doc("xp_processing")
      .get();

    const settings = settingsDoc.data();
    return settings?.enable_idempotent_processing === true;
  } catch (error) {
    console.error("[XP_MIGRATION] Erro ao verificar feature flag:", error);
    // Default: usar sistema antigo em caso de erro
    return false;
  }
}

// ==========================================
// ADAPTADOR PARA CÓDIGO LEGADO
// ==========================================

/**
 * Converte dados do formato antigo para o novo
 * formato de XpTransactionData. Usado para manter
 * compatibilidade durante migração.
 *
 * @param {object} params - Dados do formato legado
 * @return {XpTransactionData} Dados convertidos
 */
export function buildXpTransactionData(params: {
  gameId: string;
  userId: string;
  currentXp: number;
  finalXp: number;
  currentLevel: number;
  newLevel: number;
  settings: XpSettings;
  conf: PlayerConf;
  result: string;
  isMvp: boolean;
  cleanSheetXp: number;
  streakXp: number;
  milesXp: number;
  penaltyXp: number;
  newMilestones: string[];
}): XpTransactionData {
  const {
    gameId,
    userId,
    currentXp,
    finalXp,
    currentLevel,
    newLevel,
    settings,
    conf,
    result,
    isMvp,
    cleanSheetXp,
    streakXp,
    milesXp,
    penaltyXp,
    newMilestones,
  } = params;

  // Calcular breakdown de XP
  const breakdown: XpBreakdown = {
    participation: settings.xp_presence || 10,
    goals: conf.goals * (settings.xp_per_goal || 10),
    assists: conf.assists * (settings.xp_per_assist || 7),
    saves: conf.saves * (settings.xp_per_save || 8),
    result:
      result === "WIN" ?
        settings.xp_win || 20 :
        result === "DRAW" ?
          settings.xp_draw || 10 :
          0,
    mvp: isMvp ? settings.xp_mvp || 30 : 0,
    cleanSheet: cleanSheetXp,
    milestones: milesXp,
    streak: streakXp,
    penalty: penaltyXp,
  };

  // Construir metadata
  const metadata: XpMetadata = {
    goals: conf.goals || 0,
    assists: conf.assists || 0,
    saves: conf.saves || 0,
    wasMvp: isMvp,
    wasCleanSheet: cleanSheetXp > 0,
    wasWorstPlayer: conf.is_worst_player === true,
    gameResult: result,
    milestonesUnlocked: newMilestones,
  };

  // Calcular XP total
  const xpEarned = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

  return {
    gameId,
    userId,
    xpEarned,
    xpBefore: currentXp,
    xpAfter: finalXp,
    levelBefore: currentLevel,
    levelAfter: newLevel,
    breakdown,
    metadata,
  };
}

// ==========================================
// PROCESSAMENTO HÍBRIDO (ANTIGO + NOVO)
// ==========================================

/**
 * Processa XP de um jogador usando sistema
 * antigo OU novo baseado em feature flag.
 * Permite rollout gradual sem downtime.
 *
 * @param {object} params - Parâmetros de XP
 * @param {admin.firestore.WriteBatch}
 *   legacyBatch - Batch legado (opcional)
 * @return {Promise<void>}
 *
 * EXEMPLO DE USO NO index.ts:
 * ```typescript
 * // Substituir:
 * // batch.update(userRef, userUpdate);
 * // batch.set(logRef, log);
 *
 * // Por:
 * await processXpHybrid({
 *   gameId,
 *   userId: uid,
 *   currentXp,
 *   finalXp,
 *   // ... outros parâmetros
 * }, batch);
 * ```
 */
export async function processXpHybrid(
  params: {
    gameId: string;
    userId: string;
    currentXp: number;
    finalXp: number;
    currentLevel: number;
    newLevel: number;
    settings: XpSettings;
    conf: PlayerConf;
    result: string;
    isMvp: boolean;
    cleanSheetXp: number;
    streakXp: number;
    milesXp: number;
    penaltyXp: number;
    newMilestones: string[];
  },
  legacyBatch?: admin.firestore.WriteBatch
): Promise<void> {
  const useNewSystem = await isIdempotentXpEnabled();

  if (useNewSystem) {
    // NOVO SISTEMA: Processamento idempotente
    console.log(
      "[XP_HYBRID] Usando sistema " +
      "IDEMPOTENTE para " +
      `${params.userId} em ` +
      `${params.gameId}`
    );

    const txData = buildXpTransactionData(params);
    const result = await processXpIdempotent(txData);

    if (!result.success) {
      throw new Error(
        `Falha ao processar XP idempotente: ${result.error || "unknown"}`
      );
    }

    if (result.alreadyProcessed) {
      console.log(
        `[XP_HYBRID] Transação ${result.transactionId} já processada. Pulando.`
      );
    }
  } else {
    // SISTEMA ANTIGO: Usar batch fornecido
    console.log(
      "[XP_HYBRID] Usando sistema LEGADO " +
      `para ${params.userId} em ` +
      `${params.gameId}`
    );

    if (!legacyBatch) {
      throw new Error(
        "Legacy batch required when idempotent processing is disabled"
      );
    }

    // Processar usando código antigo (batch writes)
    const userRef = db.collection("users").doc(params.userId);
    const userUpdate: Record<string, unknown> = {
      experience_points: params.finalXp,
      level: params.newLevel,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (params.newMilestones.length > 0) {
      userUpdate.milestones_achieved =
        admin.firestore.FieldValue.arrayUnion(...params.newMilestones);
    }

    legacyBatch.update(userRef, userUpdate);

    // Criar log (sem transaction_id - código antigo)
    const logRef = db.collection("xp_logs").doc();
    const log = {
      user_id: params.userId,
      game_id: params.gameId,
      xp_earned: params.finalXp - params.currentXp,
      xp_before: params.currentXp,
      xp_after: params.finalXp,
      level_before: params.currentLevel,
      level_after: params.newLevel,
      xp_participation: params.settings.xp_presence || 10,
      xp_goals: params.conf.goals * (params.settings.xp_per_goal || 10),
      xp_assists: params.conf.assists * (params.settings.xp_per_assist || 7),
      xp_saves: params.conf.saves * (params.settings.xp_per_save || 8),
      xp_result:
        params.result === "WIN" ?
          params.settings.xp_win || 20 :
          params.result === "DRAW" ?
            params.settings.xp_draw || 10 :
            0,
      xp_mvp: params.isMvp ? params.settings.xp_mvp || 30 : 0,
      xp_clean_sheet: params.cleanSheetXp,
      xp_milestones: params.milesXp,
      xp_streak: params.streakXp,
      xp_penalty: params.penaltyXp,
      goals: params.conf.goals || 0,
      assists: params.conf.assists || 0,
      saves: params.conf.saves || 0,
      was_mvp: params.isMvp,
      was_clean_sheet: params.cleanSheetXp > 0,
      was_worst_player: params.conf.is_worst_player === true,
      game_result: params.result,
      milestones_unlocked: params.newMilestones,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    legacyBatch.set(logRef, log);
  }
}

// ==========================================
// BATCH PROCESSING HÍBRIDO
// ==========================================

/**
 * Processa múltiplos jogadores em batch
 * com suporte a ambos sistemas.
 *
 * @param {Array} players - Lista de jogadores
 *   para processar XP
 * @return {Promise<void>}
 */
export async function processGameXpBatch(
  players: Array<{
    gameId: string;
    userId: string;
    currentXp: number;
    finalXp: number;
    currentLevel: number;
    newLevel: number;
    settings: XpSettings;
    conf: PlayerConf;
    result: string;
    isMvp: boolean;
    cleanSheetXp: number;
    streakXp: number;
    milesXp: number;
    penaltyXp: number;
    newMilestones: string[];
  }>
): Promise<void> {
  const useNewSystem = await isIdempotentXpEnabled();

  if (useNewSystem) {
    // NOVO SISTEMA: Batch idempotente
    console.log(
      "[XP_BATCH] Processando " +
      `${players.length} jogadores ` +
      "com sistema IDEMPOTENTE"
    );

    const transactions = players.map((p) => buildXpTransactionData(p));
    const results = await processXpBatch(transactions);

    const failures = results.filter((r) => !r.success);
    if (failures.length > 0) {
      console.error(
        `[XP_BATCH] ${failures.length}/${players.length} transações falharam`
      );
      throw new Error(
        `Batch processing failed: ${failures[0].error || "unknown"}`
      );
    }

    const skipped = results.filter((r) => r.alreadyProcessed).length;
    console.log(
      "[XP_BATCH] Concluído: " +
      `${results.length - skipped} ` +
      `processados, ${skipped} já existiam`
    );
  } else {
    // SISTEMA ANTIGO: Batch writes tradicionais
    console.log(
      "[XP_BATCH] Processando " +
      `${players.length} jogadores ` +
      "com sistema LEGADO"
    );

    const batch = db.batch();

    for (const player of players) {
      await processXpHybrid(player, batch);
    }

    await batch.commit();
    console.log("[XP_BATCH] Batch legado commitado com sucesso");
  }
}

// ==========================================
// MIGRAÇÃO DE DADOS ANTIGOS
// ==========================================

/**
 * Script para adicionar transaction_id
 * em xp_logs existentes. Executar ANTES
 * de ativar feature flag.
 *
 * @param {object} options - Opções de execução
 * @return {Promise<object>} Contagem de
 *   atualizados e erros
 *
 * COMO USAR:
 * ```bash
 * # No Firebase Console > Shell
 * backfillTransactionIds({ dryRun: true })
 * backfillTransactionIds({ dryRun: false })
 * ```
 */
export async function backfillTransactionIds(
  options: {
    dryRun?: boolean;
    batchSize?: number;
  }
): Promise<{updated: number; errors: number}> {
  const {dryRun = true, batchSize = 500} = options;

  console.log(
    "[BACKFILL] Iniciando backfill de " +
    "transaction_ids " +
    `(dryRun: ${dryRun})...`
  );

  let updated = 0;
  let errors = 0;

  try {
    // Buscar logs sem transaction_id
    const logsSnap = await db
      .collection("xp_logs")
      .where("transaction_id", "==", null)
      .limit(batchSize)
      .get();

    if (logsSnap.empty) {
      console.log(
        "[BACKFILL] Nenhum log sem " +
        "transaction_id encontrado"
      );
      return {updated: 0, errors: 0};
    }

    console.log(
      "[BACKFILL] Encontrados " +
      `${logsSnap.size} logs para atualizar`
    );

    if (!dryRun) {
      const batch = db.batch();

      logsSnap.docs.forEach((doc) => {
        const data = doc.data();
        const gameId = data.game_id;
        const userId = data.user_id;

        if (gameId && userId) {
          const transactionId = `game_${gameId}_user_${userId}`;
          batch.update(doc.ref, {transaction_id: transactionId});
          updated++;
        } else {
          console.warn(
            "[BACKFILL] Log " +
            `${doc.id} sem game_id ` +
            "ou user_id"
          );
          errors++;
        }
      });

      await batch.commit();
      console.log(`[BACKFILL] Batch commitado: ${updated} atualizados`);
    } else {
      console.log(
        "[BACKFILL] DRY RUN: " +
        `${logsSnap.size} logs ` +
        "seriam atualizados"
      );
      updated = logsSnap.size;
    }

    return {updated, errors};
  } catch (error) {
    console.error("[BACKFILL] Erro ao executar backfill:", error);
    throw error;
  }
}
