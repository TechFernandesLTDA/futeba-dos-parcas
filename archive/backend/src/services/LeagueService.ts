import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { GameStats } from '../entities/GameStats';
import { logger } from '../utils/logger';

export interface LeagueState {
    division: string;
    promotion_progress: number;
    relegation_progress: number;
    protection_games: number;
}

export class LeagueService {
    private userRepository = AppDataSource.getRepository(User);
    private gameStatsRepository = AppDataSource.getRepository(GameStats);

    private readonly PROMOTION_GAMES_REQUIRED = 3;
    private readonly RELEGATION_GAMES_REQUIRED = 3;
    private readonly PROTECTION_GAMES = 5;

    async updatePlayerLeague(userId: string): Promise<void> {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) return;

        // 1. Calcular novo Rating baseado nos últimos 5 jogos
        const recentStats = await this.gameStatsRepository.find({
            where: { user_id: userId },
            relations: ['game', 'team'],
            order: { game: { date: 'DESC' } },
            take: 10
        });

        if (recentStats.length === 0) return;

        const newRating = this.calculateLeagueRating(recentStats);
        user.league_rating = newRating;

        // 2. Processar Promoção/Rebaixamento
        const newState = this.calculateLeaguePromotion(
            {
                division: user.division,
                promotion_progress: user.promotion_progress,
                relegation_progress: user.relegation_progress,
                protection_games: user.protection_games
            },
            newRating
        );

        user.division = newState.division;
        user.promotion_progress = newState.promotion_progress;
        user.relegation_progress = newState.relegation_progress;
        user.protection_games = newState.protection_games;

        await this.userRepository.save(user);
    }

    private calculateLeagueRating(recentStats: any[]): number {
        const count = recentStats.length;

        // XP Score (max 250 avg XP = 100 points)
        const avgXp = 0; // No backend we don't store xp_earned in GameStats yet, should we?
        // Let's use goals and assists for now as proxy or update GameStats

        const winRate = (recentStats.filter(s => {
            const game = s.game;
            const myScore = s.team ? s.team.score : 0;
            const otherScore = (game.team1_score + game.team2_score) - myScore; // Simplified
            return myScore > otherScore;
        }).length / count) * 100;

        const avgGoals = recentStats.reduce((sum, s) => sum + s.goals, 0) / count;
        const goalScore = Math.min(avgGoals / 3.0, 1.0) * 100;

        const mvpRate = recentStats.filter(s => s.is_best_player).length / count;
        const mvpScore = Math.min(mvpRate / 0.4, 1.0) * 100;

        // Formula: 40% WR + 40% Goals + 20% MVP
        return (winRate * 0.4) + (goalScore * 0.4) + (mvpScore * 0.2);
    }

    private calculateLeaguePromotion(state: LeagueState, rating: number): LeagueState {
        const nextThreshold = this.getNextThreshold(state.division);
        const prevThreshold = this.getPrevThreshold(state.division);

        if (state.protection_games > 0) {
            return { ...state, protection_games: state.protection_games - 1 };
        }

        let { division, promotion_progress, relegation_progress } = state;

        if (rating >= nextThreshold && division !== 'DIAMANTE') {
            promotion_progress++;
            relegation_progress = 0;
            if (promotion_progress >= this.PROMOTION_GAMES_REQUIRED) {
                division = this.getNextDivision(division);
                return { division, promotion_progress: 0, relegation_progress: 0, protection_games: this.PROTECTION_GAMES };
            }
        } else if (rating < prevThreshold && division !== 'BRONZE') {
            relegation_progress++;
            promotion_progress = 0;
            if (relegation_progress >= this.RELEGATION_GAMES_REQUIRED) {
                division = this.getPrevDivision(division);
                return { division, promotion_progress: 0, relegation_progress: 0, protection_games: this.PROTECTION_GAMES };
            }
        } else {
            promotion_progress = 0;
            relegation_progress = 0;
        }

        return { division, promotion_progress, relegation_progress, protection_games: 0 };
    }

    private getNextThreshold(div: string) {
        if (div === 'BRONZE') return 30;
        if (div === 'PRATA') return 50;
        if (div === 'OURO') return 70;
        return 100;
    }

    private getPrevThreshold(div: string) {
        if (div === 'PRATA') return 30;
        if (div === 'OURO') return 50;
        if (div === 'DIAMANTE') return 70;
        return 0;
    }

    private getNextDivision(div: string) {
        if (div === 'BRONZE') return 'PRATA';
        if (div === 'PRATA') return 'OURO';
        if (div === 'OURO') return 'DIAMANTE';
        return div;
    }

    private getPrevDivision(div: string) {
        if (div === 'DIAMANTE') return 'OURO';
        if (div === 'OURO') return 'PRATA';
        if (div === 'PRATA') return 'BRONZE';
        return div;
    }
}
