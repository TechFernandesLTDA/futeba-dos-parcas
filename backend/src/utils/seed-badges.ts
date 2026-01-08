import { AppDataSource } from '../config/database';
import { Badge, BadgeType } from '../entities/Badge';
import { logger } from './logger';

export async function seedBadges() {
    try {
        const badgeRepository = AppDataSource.getRepository(Badge);

        const badgesData = [
            {
                type: BadgeType.HAT_TRICK,
                name: 'Hat Trick',
                description: 'Marque 3 gols em um jogo',
                icon_url: '⚽⚽⚽',
                xp_reward: 100,
                rarity: 'raro',
            },
            {
                type: BadgeType.PAREDAO,
                name: 'Paredão',
                description: 'Não sofra gols como goleiro',
                icon_url: '🧤',
                xp_reward: 150,
                rarity: 'raro',
            },
            {
                type: BadgeType.ARTILHEIRO_MES,
                name: 'Artilheiro do Mês',
                description: 'Foi o maior marcador de gols do mês',
                icon_url: '🥇',
                xp_reward: 300,
                rarity: 'epico',
            },
            {
                type: BadgeType.FOMINHA,
                name: 'Fominha',
                description: '100% de presença no mês',
                icon_url: '🦾',
                xp_reward: 200,
                rarity: 'comum',
            },
            {
                type: BadgeType.LENDA,
                name: 'Lenda',
                description: 'Completou 500 jogos',
                icon_url: '🏆',
                xp_reward: 1000,
                rarity: 'lendario',
            },
            {
                type: BadgeType.FAIXA_PRETA,
                name: 'Faixa Preta',
                description: 'MVP 100 vezes',
                icon_url: '🥋',
                xp_reward: 500,
                rarity: 'epico',
            }
        ];

        for (const badgeData of badgesData) {
            const existingBadge = await badgeRepository.findOneBy({ type: badgeData.type });
            if (!existingBadge) {
                const badge = badgeRepository.create(badgeData);
                await badgeRepository.save(badge);
                logger.info(`Badge ${badgeData.name} seeded`);
            }
        }

        logger.info('Badges seeding completed');
    } catch (error) {
        logger.error('Error seeding badges:', error);
    }
}
