import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserBadge } from '../entities/UserBadge';
import { Badge, BadgeType } from '../entities/Badge';
import { UserStreak } from '../entities/UserStreak';
import { logger } from '../utils/logger';

interface XpParams {
    goals?: number;
    assists?: number;
    saves?: number;
    won?: boolean;
    drew?: boolean;
    isMvp?: boolean;
    isWorstPlayer?: boolean;
    streak?: number;
}

export class GamificationService {
    private userRepository = AppDataSource.getRepository(User);
    private badgeRepository = AppDataSource.getRepository(Badge);
    private userBadgeRepository = AppDataSource.getRepository(UserBadge);
    private streakRepository = AppDataSource.getRepository(UserStreak);

    // Valores canônicos de XP — source of truth: shared/xp-constants.json (#800)
    // Sincronizado com xpActions: GOAL:10, ASSIST:7, SAVE:8, WIN:20, DRAW:10, MVP:30, WORST_PLAYER:-10
    // Nota: STREAK_BONUS_BASE usa tiering (STREAK_3:20, STREAK_5:35...) — mantido simplificado por ora
    private readonly XP_VALUES = {
        GOAL: 10,
        ASSIST: 7,
        SAVE: 8,
        WIN: 20,
        DRAW: 10,
        MVP: 30,
        WORST_PLAYER: -10,
        STREAK_BONUS_BASE: 20,
    };

    calculateGameXp(params: XpParams): number {
        let xp = 0;
        xp += (params.goals || 0) * this.XP_VALUES.GOAL;
        xp += (params.assists || 0) * this.XP_VALUES.ASSIST;
        xp += (params.saves || 0) * this.XP_VALUES.SAVE;

        if (params.won) xp += this.XP_VALUES.WIN;
        else if (params.drew) xp += this.XP_VALUES.DRAW;

        if (params.isMvp) xp += this.XP_VALUES.MVP;
        if (params.isWorstPlayer) xp += this.XP_VALUES.WORST_PLAYER;

        if (params.streak && params.streak > 1) {
            xp += params.streak * this.XP_VALUES.STREAK_BONUS_BASE;
        }

        return Math.max(0, xp);
    }

    async addExperience(userId: string, xp: number): Promise<void> {
        // Wrap em transaction com pessimistic lock para evitar race condition em XP concorrente.
        await AppDataSource.transaction(async (txManager) => {
            const user = await txManager.findOne(User, {
                where: { id: userId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!user) return;

            user.experience_points = Number(user.experience_points) + xp;

            // Nivel = floor(sqrt(xp / 100)) + 1
            const newLevel = Math.floor(Math.sqrt(user.experience_points / 100)) + 1;

            if (newLevel > user.level) {
                logger.info(`User ${userId} leveled up to ${newLevel}`);
                user.level = newLevel;
            }

            await txManager.save(user);
        });
    }

    async awardBadge(userId: string, badgeType: BadgeType): Promise<void> {
        const badge = await this.badgeRepository.findOneBy({ type: badgeType });
        if (!badge) return;

        let userBadge = await this.userBadgeRepository.findOne({
            where: { user_id: userId, badge_id: badge.id }
        });

        if (userBadge) {
            userBadge.count += 1;
            userBadge.last_earned_at = new Date();
        } else {
            userBadge = this.userBadgeRepository.create({
                user_id: userId,
                badge_id: badge.id,
                count: 1,
                unlocked_at: new Date(),
                last_earned_at: new Date()
            });
        }

        await this.userBadgeRepository.save(userBadge);

        if (badge.xp_reward > 0) {
            await this.addExperience(userId, badge.xp_reward);
        }
    }

    /**
     * Processa toda a gamificação de um jogador em uma partida
     */
    async processGameParticipation(userId: string, scheduleId: string, stats: any, matchResult: { won: boolean, drew: boolean, isMvp: boolean, isWorstPlayer: boolean }): Promise<number> {
        // 1. Atualizar Streak
        let streak = await this.streakRepository.findOneBy({ user_id: userId, schedule_id: scheduleId });
        if (!streak) {
            streak = this.streakRepository.create({ user_id: userId, schedule_id: scheduleId });
        }

        if (matchResult.won) {
            streak.current_streak += 1;
            if (streak.current_streak > streak.longest_streak) streak.longest_streak = streak.current_streak;
        } else if (!matchResult.drew) {
            streak.current_streak = 0;
        }
        await this.streakRepository.save(streak);

        // 2. Calcular e Adicionar XP
        const xpEarned = this.calculateGameXp({
            goals: stats.goals,
            assists: stats.assists,
            saves: stats.saves,
            won: matchResult.won,
            drew: matchResult.drew,
            isMvp: matchResult.isMvp,
            isWorstPlayer: matchResult.isWorstPlayer,
            streak: streak.current_streak
        });

        await this.addExperience(userId, xpEarned);

        // 3. Conquistar Badges de Performance
        if (stats.goals >= 3) await this.awardBadge(userId, BadgeType.HAT_TRICK);
        if (stats.assists >= 3) await this.awardBadge(userId, BadgeType.ARTILHEIRO_MES); // Placeholder
        if (matchResult.isMvp && streak.current_streak >= 3) await this.awardBadge(userId, BadgeType.FAIXA_PRETA); // Placeholder

        return xpEarned;
    }
}
