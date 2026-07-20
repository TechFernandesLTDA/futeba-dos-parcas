/**
 * MODELOS E INTERFACES - Futeba dos Parças
 *
 * Interfaces compartilhadas usadas por múltiplos
 * módulos das Cloud Functions.
 */

import {FieldValue, Timestamp} from "firebase-admin/firestore";

// ==========================================
// MODELS & INTERFACES
// ==========================================

export interface Game {
    id: string;
    team1_score?: number;
    team2_score?: number;
    xp_processed?: boolean;
    xp_processing?: boolean;
    xp_processing_at?: Timestamp;
    xp_processing_error?: string;
    xp_reward_status?: string;
    xp_reward_held_at?: Timestamp;
    xp_reward_hold_reasons?: string[];
    xp_reward_review_decision?: string;
    xp_reward_reviewed_at?: Timestamp;
    xp_reward_reviewed_by?: string;
    xp_reward_review_reason?: string;
    xp_reward_review_previous_status?: string;
    xp_reward_review_new_status?: string;
    status: string; // "FINISHED"
    mvp_id?: string;
    // Auditoria 2026-05-30 #1: vencedores de votacao gravados no game doc
    // (owner-gated nas rules) — usados para revalidar flags na confirmation
    // e impedir griefing de XP (-10 Bola Murcha) cross-user.
    worst_player_id?: string;
    best_gk_id?: string;
    owner_id: string;
    group_id?: string;
    date?: string;
    dateTime?: Timestamp;
    // Fase 4 (gênero): categoria do jogo MALE/FEMALE/MIXED.
    // Ausente em jogos legados → tratado como MIXED na leitura.
    gender?: string;
}

export interface GameConfirmation {
    userId: string;
    status: string; // "CONFIRMED"
    position: string;
    goals: number;
    assists: number;
    saves: number;
    yellowCards: number;
    redCards: number;
    hasExplicitYellowCards?: boolean;
    hasExplicitRedCards?: boolean;
    game_id: string;
    // "Bola Murcha" - penalidade de -10 XP
    is_worst_player?: boolean;
    // SECFIX #430 / FIX #2797: flag de overlap temporal detectado pelo
    // trigger onConfirmationCreated (temporal-overlap.ts). Quando true,
    // o jogador não recebe XP, estatísticas ou participação na season.
    suspiciousOverlap?: boolean;
    checkedIn?: boolean;
    wasPresent?: boolean;
    hasPresenceSignal?: boolean;
    confirmedAt?: Timestamp | Date | null;
    checkedInAt?: Timestamp | Date | null;
    lastMinuteSaverEligible?: boolean;
    wasWaitlistPromoted?: boolean;
    waitlistPromotedAt?: Timestamp | Date | null;
}

export interface Team {
    id: string;
    playerIds: string[];
    score: number;
}

export interface LiveGameScore {
    gameId: string;
    team1Id: string;
    team2Id: string;
    team1Score: number;
    team2Score: number;
}

export interface UserStatistics {
    totalGames: number;
    totalGoals: number;
    totalAssists: number;
    totalSaves: number;
    totalYellowCards: number;
    totalRedCards: number;
    gamesWon: number;
    gamesLost: number;
    gamesDraw: number;
    bestPlayerCount: number;
    worstPlayerCount: number;
    recordedEventsGames?: number;
    // Sequencia atual de jogos como MVP
    currentMvpStreak: number;
    // Melhor sequencia historica de MVPs consecutivos
    bestMvpStreak: number;
}

export interface XpLog {
    user_id: string;
    game_id: string;
    transaction_id?: string;
    source?: string;
    source_collection?: string;
    source_event_id?: string;
    source_confirmation_id?: string;
    xp_earned: number;
    xp_before: number;
    xp_after: number;
    level_before: number;
    level_after: number;
    xp_participation: number;
    xp_goals: number;
    xp_assists: number;
    xp_saves: number;
    xp_result: number;
    xp_mvp: number;
    // NOVO: XP por clean sheet (goleiro)
    xp_clean_sheet: number;
    xp_milestones: number;
    xp_streak: number;
    xp_penalty: number; // Penalidade "Bola Murcha"
    xp_top_scorer?: number;
    xp_hat_trick?: number;
    xp_first_goal?: number;
    xp_goalkeeper_goal?: number;
    xp_fair_play?: number;
    xp_recorder?: number;
    xp_early_confirmation?: number;
    xp_on_time_checkin?: number;
    xp_last_minute_saver?: number;
    xp_waitlist_promoted?: number;
    xp_comeback?: number;
    xp_first_game_month?: number;
    xp_monthly_streak?: number;
    // Aliases legados aceitos apenas em leitura.
    xp_event_recorder?: number;
    xp_first_game_of_month?: number;
    goals: number;
    assists: number;
    saves: number;
    was_mvp: boolean;
    was_clean_sheet: boolean; // NOVO: Flag clean sheet
    // Flag "Bola Murcha"
    was_worst_player: boolean;
    was_top_scorer?: boolean;
    was_hat_trick?: boolean;
    was_first_goal?: boolean;
    was_goalkeeper_goal?: boolean;
    was_fair_play?: boolean;
    recorded_events_count?: number;
    comeback_type?: string | null;
    monthly_streak?: number;
    monthly_streak_tier?: number | null;
    game_result: string;
    /** Status do jogo no momento do processamento — sempre "FINISHED" (#954) */
    game_status: string;
    /** FIX #1576: placar do time do jogador */
    my_team_score: number;
    /** FIX #1576: placar do adversário */
    opponent_score: number;
    milestones_unlocked: string[];
    created_at: FieldValue;
}

export interface GamificationSettings {
    xp_presence: number;
    xp_per_goal: number;
    xp_per_assist: number;
    xp_per_save: number;
    xp_win: number;
    xp_draw: number;
    xp_mvp: number;
    xp_streak_3: number;
    // NOVO: Bonus streak 5 jogos
    xp_streak_5: number;
    xp_streak_7: number;
    xp_streak_10: number;
    // NOVO: Bonus goleiro sem sofrer gols
    xp_clean_sheet: number;
    xp_top_scorer: number;
    xp_hat_trick: number;
    xp_first_goal: number;
    xp_goalkeeper_goal: number;
    xp_fair_play: number;
    xp_event_recorder_per_event: number;
    xp_event_recorder_min_events: number;
    xp_event_recorder_max_xp: number;
    xp_early_confirmation: number;
    xp_on_time_checkin: number;
    xp_last_minute_saver: number;
    xp_waitlist_promoted: number;
    xp_comeback_14d: number;
    xp_comeback_30d: number;
    comeback_14d_threshold_days: number;
    comeback_30d_threshold_days: number;
    comeback_max_per_month: number;
    xp_first_game_of_month: number;
    xp_monthly_streak_3: number;
    xp_monthly_streak_6: number;
    xp_monthly_streak_12: number;
    xpActions?: Record<string, unknown>;
    performanceBonuses?: Record<string, unknown>;
    behaviorBonuses?: Record<string, unknown>;
    retentionBonuses?: Record<string, unknown>;
}
