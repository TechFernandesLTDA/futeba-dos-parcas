/**
 * MODELOS E INTERFACES - Futeba dos Parças
 *
 * Interfaces compartilhadas usadas por múltiplos
 * módulos das Cloud Functions.
 */

import * as admin from "firebase-admin";

// ==========================================
// MODELS & INTERFACES
// ==========================================

export interface Game {
    id: string;
    xp_processed?: boolean;
    xp_processing?: boolean;
    xp_processing_at?: admin.firestore.Timestamp;
    xp_processing_error?: string;
    status: string; // "FINISHED"
    mvp_id?: string;
    owner_id: string;
    group_id?: string;
    date?: string;
    dateTime?: admin.firestore.Timestamp;
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
    game_id: string;
    // "Bola Murcha" - penalidade de -10 XP
    is_worst_player?: boolean;
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
    // Sequencia atual de jogos como MVP
    currentMvpStreak: number;
}

export interface XpLog {
    user_id: string;
    game_id: string;
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
    goals: number;
    assists: number;
    saves: number;
    was_mvp: boolean;
    was_clean_sheet: boolean; // NOVO: Flag clean sheet
    // Flag "Bola Murcha"
    was_worst_player: boolean;
    game_result: string;
    /** Status do jogo no momento do processamento — sempre "FINISHED" (#954) */
    game_status: string;
    /** FIX #1576: placar do time do jogador */
    my_team_score: number;
    /** FIX #1576: placar do adversário */
    opponent_score: number;
    milestones_unlocked: string[];
    created_at: admin.firestore.FieldValue;
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
}
