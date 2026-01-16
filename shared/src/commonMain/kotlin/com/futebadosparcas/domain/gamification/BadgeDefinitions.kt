package com.futebadosparcas.domain.gamification

import com.futebadosparcas.domain.model.BadgeCategory
import com.futebadosparcas.domain.model.BadgeDefinition
import com.futebadosparcas.domain.model.BadgeRarity

/**
 * Definicoes de todas as badges do sistema.
 * Compartilhavel entre plataformas.
 */
object BadgeDefinitions {

    val allBadges: List<BadgeDefinition> = listOf(
        // Performance - Gols
        BadgeDefinition(
            id = "hat_trick",
            name = "Hat Trick",
            description = "Marque 3 gols em um jogo",
            emoji = "⚽⚽⚽",
            category = BadgeCategory.PERFORMANCE,
            rarity = BadgeRarity.RARE
        ),
        BadgeDefinition(
            id = "poker",
            name = "Poker",
            description = "Marque 4 gols em um jogo",
            emoji = "🃏",
            category = BadgeCategory.PERFORMANCE,
            rarity = BadgeRarity.EPIC
        ),
        BadgeDefinition(
            id = "manita",
            name = "Manita",
            description = "Marque 5+ gols em um jogo",
            emoji = "🖐️",
            category = BadgeCategory.PERFORMANCE,
            rarity = BadgeRarity.LEGENDARY
        ),

        // Performance - Assistencias
        BadgeDefinition(
            id = "playmaker",
            name = "Armador",
            description = "Faca 3+ assistencias em um jogo",
            emoji = "🎯",
            category = BadgeCategory.PERFORMANCE,
            rarity = BadgeRarity.RARE
        ),

        // Performance - Jogador Completo
        BadgeDefinition(
            id = "balanced_player",
            name = "Jogador Completo",
            description = "Marque 2+ gols E 2+ assists no mesmo jogo",
            emoji = "⚖️",
            category = BadgeCategory.PERFORMANCE,
            rarity = BadgeRarity.RARE
        ),

        // Performance - Goleiro
        BadgeDefinition(
            id = "clean_sheet",
            name = "Clean Sheet",
            description = "Nao sofra gols como goleiro",
            emoji = "🧤",
            category = BadgeCategory.PERFORMANCE,
            rarity = BadgeRarity.RARE
        ),
        BadgeDefinition(
            id = "paredao",
            name = "Paredao",
            description = "Nao sofra gols como goleiro",
            emoji = "🧱",
            category = BadgeCategory.PERFORMANCE,
            rarity = BadgeRarity.RARE
        ),
        BadgeDefinition(
            id = "defensive_wall",
            name = "Muralha",
            description = "Faca 10+ defesas em um jogo",
            emoji = "🛡️",
            category = BadgeCategory.PERFORMANCE,
            rarity = BadgeRarity.RARE,
            requiredValue = 10
        ),
        BadgeDefinition(
            id = "penalty_saver",
            name = "Pegador de Penalti",
            description = "Defenda um penalti",
            emoji = "✋",
            category = BadgeCategory.PERFORMANCE,
            rarity = BadgeRarity.EPIC
        ),

        // Presenca - Streaks
        BadgeDefinition(
            id = "streak_7",
            name = "Sequencia 7",
            description = "Jogue 7 jogos consecutivos",
            emoji = "🔥",
            category = BadgeCategory.PRESENCE,
            rarity = BadgeRarity.RARE,
            requiredValue = 7
        ),
        BadgeDefinition(
            id = "iron_man",
            name = "Homem de Ferro",
            description = "Jogue 10 jogos consecutivos",
            emoji = "🦾",
            category = BadgeCategory.PRESENCE,
            rarity = BadgeRarity.EPIC,
            requiredValue = 10
        ),
        BadgeDefinition(
            id = "streak_30",
            name = "Invencivel",
            description = "Jogue 30 jogos consecutivos",
            emoji = "💪",
            category = BadgeCategory.PRESENCE,
            rarity = BadgeRarity.LEGENDARY,
            requiredValue = 30
        ),

        // Presenca - Veteranos
        BadgeDefinition(
            id = "veteran_50",
            name = "Veterano 50",
            description = "Complete 50 jogos",
            emoji = "🏅",
            category = BadgeCategory.PRESENCE,
            rarity = BadgeRarity.EPIC,
            requiredValue = 50
        ),
        BadgeDefinition(
            id = "veteran_100",
            name = "Veterano 100",
            description = "Complete 100 jogos",
            emoji = "🎖️",
            category = BadgeCategory.PRESENCE,
            rarity = BadgeRarity.LEGENDARY,
            requiredValue = 100
        ),

        // Presenca - Vitorias
        BadgeDefinition(
            id = "winner_25",
            name = "Vencedor 25",
            description = "Venca 25 jogos",
            emoji = "🏆",
            category = BadgeCategory.PRESENCE,
            rarity = BadgeRarity.RARE,
            requiredValue = 25
        ),
        BadgeDefinition(
            id = "winner_50",
            name = "Campeao",
            description = "Venca 50 jogos",
            emoji = "🥇",
            category = BadgeCategory.PRESENCE,
            rarity = BadgeRarity.EPIC,
            requiredValue = 50
        ),

        // Comunidade
        BadgeDefinition(
            id = "team_player",
            name = "Jogador de Equipe",
            description = "Participe de 10 jogos no mesmo grupo",
            emoji = "🤝",
            category = BadgeCategory.COMMUNITY,
            rarity = BadgeRarity.COMMON,
            requiredValue = 10
        ),
        BadgeDefinition(
            id = "recruiter",
            name = "Recrutador",
            description = "Convide 5 novos jogadores",
            emoji = "📣",
            category = BadgeCategory.COMMUNITY,
            rarity = BadgeRarity.RARE,
            requiredValue = 5
        ),

        // Nivel
        BadgeDefinition(
            id = "level_5",
            name = "Nivel 5",
            description = "Alcance o nivel 5",
            emoji = "⭐",
            category = BadgeCategory.LEVEL,
            rarity = BadgeRarity.COMMON,
            requiredValue = 5
        ),
        BadgeDefinition(
            id = "level_10",
            name = "Nivel Maximo",
            description = "Alcance o nivel 10",
            emoji = "👑",
            category = BadgeCategory.LEVEL,
            rarity = BadgeRarity.LEGENDARY,
            requiredValue = 10
        ),

        // Especiais
        BadgeDefinition(
            id = "mvp_streak_3",
            name = "MVP Triplo",
            description = "Seja MVP 3 jogos consecutivos",
            emoji = "🌟🌟🌟",
            category = BadgeCategory.SPECIAL,
            rarity = BadgeRarity.LEGENDARY,
            requiredValue = 3
        ),
        BadgeDefinition(
            id = "perfect_week",
            name = "Semana Perfeita",
            description = "Venca todos os jogos da semana",
            emoji = "💯",
            category = BadgeCategory.SPECIAL,
            rarity = BadgeRarity.EPIC
        ),
        BadgeDefinition(
            id = "comeback_king",
            name = "Rei da Virada",
            description = "Vire um jogo perdendo por 2+ gols",
            emoji = "👑",
            category = BadgeCategory.SPECIAL,
            rarity = BadgeRarity.EPIC
        ),
        BadgeDefinition(
            id = "first_blood",
            name = "Primeiro Sangue",
            description = "Marque o primeiro gol do jogo",
            emoji = "🥇",
            category = BadgeCategory.SPECIAL,
            rarity = BadgeRarity.COMMON
        )
    )

    /**
     * Busca badge por ID.
     */
    fun getBadgeById(id: String): BadgeDefinition? {
        return allBadges.find { it.id == id }
    }

    /**
     * Retorna badges por categoria.
     */
    fun getBadgesByCategory(category: BadgeCategory): List<BadgeDefinition> {
        return allBadges.filter { it.category == category }
    }

    /**
     * Retorna badges por raridade.
     */
    fun getBadgesByRarity(rarity: BadgeRarity): List<BadgeDefinition> {
        return allBadges.filter { it.rarity == rarity }
    }
}
