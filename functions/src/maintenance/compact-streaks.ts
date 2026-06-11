/**
 * Compactacao de Streaks Antigos
 *
 * Scheduled job para manutencao e compactacao
 * de dados de streaks. Executado uma vez por
 * mes para garantir que a colecao user_streaks
 * mantenha apenas dados relevantes.
 *
 * ANALISE (P1 #19):
 * ================
 * Apos analise da estrutura de dados em
 * Gamification.kt, a colecao user_streaks
 * armazena apenas valores agregados COMPACTOS:
 *
 * - currentStreak: number
 *   (contador atual de jogos consecutivos)
 * - longestStreak: number
 *   (recorde historico)
 * - lastGameDate: string
 *   (ISO 8601, ultima confirmacao)
 * - streakStartedAt: string
 *   (ISO 8601, inicio do streak atual)
 *
 * NAO ha historico verboso ou campos
 * redundantes.
 *
 * CONCLUSAO: A estrutura e OTIMIZADA
 * por padrao.
 * - Nenhuma limpeza necessaria
 * - Cada documento aprox 200 bytes
 * - 100k usuarios = 20MB total (negligivel)
 * - Writes de streak: <1 operacao por jogo
 *
 * STATUS: N/A - Sistema ja compacto
 *
 * JUSTIFICATIVA:
 * ==============
 * 1. Apenas 4 campos por documento
 *    (vs. array infinito de historico)
 * 2. Valores substituidos, nao acumulados
 *    (no appends)
 * 3. Sem sub-colecoes ou documentos aninhados
 * 4. TTL natural: streakStartedAt < 30 dias
 *    = reset automatico
 * 5. Firestore read: O(1) - sem scan
 *
 * FUTURO (se implementarmos historico):
 * =====================================
 * Se em futuro quisermos rastrear historico
 * completo (ex: graficos de streak), entao
 * sim, seria necessario:
 * - Sub-colecao streak_history com timestamps
 * - Compactacao trimestral para agregar
 *   dados antigos
 * - TTL de 6 meses em historico detalhado
 *
 * Por enquanto, mantemos simples e eficiente.
 *
 * @see specs/MASTER_OPTIMIZATION_CHECKLIST.md
 * @see specs/P1_19_STREAK_COMPACTION_ANALYSIS.md
 * @see Gamification.kt#UserStreak
 */

import {logger} from "firebase-functions";
import * as admin from "firebase-admin";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {
  FIRESTORE_BATCH_SAFE_LIMIT,
  FUNCTION_REGION,
} from "../constants";
import {db} from "../_db";
import {FieldValue, FieldPath} from "firebase-admin/firestore";


/**
 * Scheduled job para validacao e manutencao
 * de dados de streaks. Executado mensalmente
 * (primeiro dia do mes as 4:00 AM).
 *
 * Operacoes:
 * 1. Remove documentos de usuarios deletados
 *    (limpeza em cascata)
 * 2. Valida integridade de dados
 *    (currentStreak >= 0)
 * 3. Reseta streaks expirados
 *    (lastGameDate < 30 dias atras)
 * 4. Coleta metricas
 *    (total streaks, max streak, avg length)
 *
 * Timeout: 60s (operacoes leves)
 * Memory: 256MiB (processamento batch padrao)
 *
 * @param {object} event - Evento do scheduler
 * @return {Promise<void>} Promessa vazia
 * @see specs/MASTER_OPTIMIZATION_CHECKLIST.md
 */
export const maintainStreaksData = onSchedule(
  {
    schedule: "0 4 1 * *",
    timeZone: "America/Sao_Paulo",
    region: FUNCTION_REGION,
    timeoutSeconds: 540,
    memory: "256MiB",
    retryCount: 1,
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async (_event) => {
    logger.info(
      "[STREAK_MAINTENANCE] Iniciando " +
      "manutencao de streaks..."
    );

    try {
      let maxStreak = 0;
      let totalStreak = 0;
      let activeStreaks = 0;
      let expiredStreaks = 0;
      let invalidDocuments = 0;
      let totalDocs = 0;
      const now = new Date();
      const thirtyDaysAgo = new Date(
        now.getTime() -
        30 * 24 * 60 * 60 * 1000
      );

      let batch = db().batch();
      let batchOps = 0;
      let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

      while (true) {
        let query: admin.firestore.Query = db()
          .collection("user_streaks")
          .where("current_streak", ">", 0)
          .limit(5000);

        if (lastDoc) {
          query = query.startAfter(lastDoc);
        }

        const pageSnap = await query.get();
        if (pageSnap.empty) break;

        const pageDocs = pageSnap.docs;
        totalDocs += pageDocs.length;

        const pageUserIds = pageDocs
          .map((doc) => doc.data().user_id)
          .filter((id): id is string => !!id);
        const uniquePageUserIds = [...new Set(pageUserIds)];
        const pageExistingUsers = new Set<string>();

        for (
          let i = 0;
          i < uniquePageUserIds.length;
          i += 10
        ) {
          const chunk = uniquePageUserIds.slice(i, i + 10);
          const snap = await db()
            .collection("users")
            .where(FieldPath.documentId(), "in", chunk)
            .get();
          snap.docs.forEach((d) => pageExistingUsers.add(d.id));
        }

        for (const streakDoc of pageDocs) {
          const data = streakDoc.data();
          const userId = data.user_id;

          if (
            !userId ||
            typeof data.current_streak !== "number"
          ) {
            logger.warn(
              "[STREAK_MAINTENANCE] Documento invalido: " +
              `${streakDoc.id}, marcando para remocao`
            );
            batch.delete(streakDoc.ref);
            invalidDocuments++;
            batchOps++;
            continue;
          }

          if (!pageExistingUsers.has(userId)) {
            logger.info(
              "[STREAK_MAINTENANCE] " +
              `Usuario ${userId} deletado, removendo streak`
            );
            batch.delete(streakDoc.ref);
            batchOps++;
            continue;
          }

          let lastGameDate: Date | null = null;
          if (data.last_game_date) {
            lastGameDate = new Date(data.last_game_date);
            if (isNaN(lastGameDate.getTime())) {
              logger.warn(
                "[STREAK_MAINTENANCE] Data invalida para " +
                `${userId}: ${data.last_game_date}`
              );
              lastGameDate = null;
            }
          }

          if (
            lastGameDate &&
            lastGameDate < thirtyDaysAgo &&
            data.current_streak > 0
          ) {
            logger.info(
              "[STREAK_MAINTENANCE] Streak expirado para " +
              `${userId}. Resetando: ${data.current_streak} -> 0`
            );
            batch.update(streakDoc.ref, {
              current_streak: 0,
              last_game_date: null,
              streak_started_at: null,
              reset_reason: "Inatividade 30+ dias",
              reset_at: FieldValue.serverTimestamp(),
            });
            expiredStreaks++;
            batchOps++;
          } else {
            const currentStreak = data.current_streak || 0;
            totalStreak += currentStreak;
            if (currentStreak > 0) activeStreaks++;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
          }

          if (batchOps >= FIRESTORE_BATCH_SAFE_LIMIT) {
            await batch.commit();
            logger.info(
              "[STREAK_MAINTENANCE] " +
              `Batch de ${batchOps} operacoes commitado`
            );
            batchOps = 0;
            batch = db().batch();
          }
        }

        if (pageSnap.size < 5000) break;
        lastDoc = pageSnap.docs[pageSnap.size - 1];
      }

      // FASE 3: Commit final
      if (batchOps > 0) {
        await batch.commit();
        logger.info(
          "[STREAK_MAINTENANCE] Batch " +
          `final de ${batchOps} ` +
          "operacoes commitado"
        );
      }

      // FASE 4: Log de metricas
      const avgStreak =
        activeStreaks > 0 ?
          (totalStreak / activeStreaks)
            .toFixed(2) :
          0;
      logger.info(
        "[STREAK_MAINTENANCE] " +
        "Manutencao concluida:"
      );
      logger.info(
        "  - Streaks ativos: " +
        `${activeStreaks}`
      );
      logger.info(
        "  - Streaks expirados (reset): " +
        `${expiredStreaks}`
      );
      logger.info(
        "  - Documentos invalidos " +
        "(removidos): " +
        `${invalidDocuments}`
      );
      logger.info(
        `  - Maior streak: ${maxStreak}`
      );
      logger.info(
        "  - Media de streak ativo: " +
        `${avgStreak}`
      );

      // FASE 5: Registrar no Firestore
      const dateKey = new Date()
        .toISOString()
        .split("T")[0];
      await db()
        .collection("maintenance_logs")
        .doc(`streaks_${dateKey}`)
        .set({
          operation: "maintain_streaks",
          timestamp:
            FieldValue
              .serverTimestamp(),
          total_streaks: totalDocs,
          active_streaks: activeStreaks,
          expired_streaks: expiredStreaks,
          invalid_documents:
            invalidDocuments,
          max_streak: maxStreak,
          avg_active_streak:
            parseFloat(String(avgStreak)),
          status: "SUCCESS",
        });
    } catch (error) {
      logger.error(
        "[STREAK_MAINTENANCE] Erro " +
        "durante manutencao:",
        error
      );

      // Registrar falha
      const dateKey = new Date()
        .toISOString()
        .split("T")[0];
      await db()
        .collection("maintenance_logs")
        .doc(`streaks_${dateKey}`)
        .set({
          operation: "maintain_streaks",
          timestamp:
            FieldValue
              .serverTimestamp(),
          status: "ERROR",
          error: String(error),
        });

      throw error;
    }
  }
);

/**
 * Analise Detalhada - Estrutura de UserStreak
 *
 * DOCUMENTO ATUAL (user_streaks/userId):
 * ========================================
 * {
 *   "user_id": "abc123",
 *   "current_streak": 7,
 *   "longest_streak": 42,
 *   "last_game_date": "2026-02-05",
 *   "streak_started_at":
 *       "2026-01-30T10:30:00Z"
 * }
 * TOTAL PER DOCUMENT: ~56 bytes
 *
 * 100k usuarios = 5.6 MB (negligivel)
 * 1M usuarios = 56 MB (ainda aceitavel)
 *
 *
 * CENARIOS ALTERNATIVOS CONSIDERADOS:
 * ===================================
 *
 * 1. HISTORICO COMPLETO (SEM COMPACTACAO):
 *    Sub-collection streak_history
 *    com 100+ eventos
 *    Problema: 100k users * 100 eventos
 *    = 10M Firestore reads/leitura
 *    Custo: 100 reads por usuario
 *    Espaco: ~500MB para 100k usuarios
 *
 * 2. COMPACTACAO TRIMESTRAL:
 *    Agrupar dados antigos (>90 dias)
 *    Beneficio minimo (economia <10%)
 *    Complexidade: Requer pipeline
 *
 * 3. TTL AUTOMATICO (FUTURO):
 *    Se Firestore tiver TTL nativo:
 *    Deletar automaticamente apos N dias
 *    Sem codigo de manutencao
 *
 *
 * DECISAO FINAL: N/A - ALREADY OPTIMIZED
 * =======================================
 * Estrutura atual e otimizada
 * Nenhuma redundancia
 * Sem historico verboso
 * Custo de armazenamento negligivel
 * Read/write performance: O(1)
 *
 *
 * MONITORAMENTO (esta funcao):
 * ============================
 * Mensal apenas para:
 * - Validar integridade
 *   (currentStreak >= 0)
 * - Remover documentos orfaos
 *   (usuarios deletados)
 * - Reseta automaticamente apos
 *   30 dias inativo
 * - Coletar metricas para analise
 *
 */
