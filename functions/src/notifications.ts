/**
 * SISTEMA DE NOTIFICAÇÕES FCM - Barrel Re-export
 * Futeba dos Parças
 *
 * Este arquivo re-exporta tudo de ./notifications/
 * para manter compatibilidade com imports existentes.
 *
 * Módulos:
 * - helpers.ts: tipos, enums, funções de envio FCM
 * - game-notifications.ts: triggers de jogos
 * - presence-notifications.ts: confirmações, convites, membros
 * - achievement-notifications.ts: level up, badges, MVP, streaks
 * - callable.ts: funções callable (teste/debug)
 * - batch-sender.ts: envio em batch (já existia)
 */

export * from "./notifications/index";
