package com.futebadosparcas.domain.gamification

import com.futebadosparcas.domain.model.Statistics

/**
 * Definicao de um milestone.
 */
data class MilestoneDefinition(
    val id: String,
    val name: String,
    val description: String,
    val emoji: String,
    val xpReward: Int,
    val category: MilestoneCategory,
    val checkCondition: (Statistics) -> Boolean
)

/**
 * Categoria de milestones.
 */
enum class MilestoneCategory {
    GOALS,
    ASSISTS,
    GAMES,
    WINS,
    MVP,
    SAVES,
    STREAK
}

/**
 * Resultado da verificacao de milestone.
 */
data class MilestoneCheckResult(
    val milestone: MilestoneDefinition,
    val unlocked: Boolean,
    val previouslyUnlocked: Boolean
) {
    val isNewUnlock: Boolean get() = unlocked && !previouslyUnlocked
}

/**
 * Verificador de milestones.
 * Logica pura compartilhavel entre plataformas.
 */
object MilestoneChecker {

    /**
     * Todos os milestones disponiveis.
     */
    val allMilestones: List<MilestoneDefinition> = listOf(
        // Gols
        MilestoneDefinition(
            id = "first_goal",
            name = "Primeiro Gol",
            description = "Marque seu primeiro gol",
            emoji = "⚽",
            xpReward = 50,
            category = MilestoneCategory.GOALS,
            checkCondition = { it.totalGoals >= 1 }
        ),
        MilestoneDefinition(
            id = "goals_10",
            name = "Artilheiro Iniciante",
            description = "Marque 10 gols",
            emoji = "🎯",
            xpReward = 100,
            category = MilestoneCategory.GOALS,
            checkCondition = { it.totalGoals >= 10 }
        ),
        MilestoneDefinition(
            id = "goals_50",
            name = "Artilheiro",
            description = "Marque 50 gols",
            emoji = "🔥",
            xpReward = 250,
            category = MilestoneCategory.GOALS,
            checkCondition = { it.totalGoals >= 50 }
        ),
        MilestoneDefinition(
            id = "goals_100",
            name = "Lenda do Gol",
            description = "Marque 100 gols",
            emoji = "👑",
            xpReward = 500,
            category = MilestoneCategory.GOALS,
            checkCondition = { it.totalGoals >= 100 }
        ),

        // Assistencias
        MilestoneDefinition(
            id = "first_assist",
            name = "Primeira Assistencia",
            description = "Faca sua primeira assistencia",
            emoji = "🤝",
            xpReward = 50,
            category = MilestoneCategory.ASSISTS,
            checkCondition = { it.totalAssists >= 1 }
        ),
        MilestoneDefinition(
            id = "assists_10",
            name = "Armador Iniciante",
            description = "Faca 10 assistencias",
            emoji = "📍",
            xpReward = 100,
            category = MilestoneCategory.ASSISTS,
            checkCondition = { it.totalAssists >= 10 }
        ),
        MilestoneDefinition(
            id = "assists_50",
            name = "Armador",
            description = "Faca 50 assistencias",
            emoji = "🎯",
            xpReward = 250,
            category = MilestoneCategory.ASSISTS,
            checkCondition = { it.totalAssists >= 50 }
        ),

        // Jogos
        MilestoneDefinition(
            id = "games_1",
            name = "Primeiro Jogo",
            description = "Participe do seu primeiro jogo",
            emoji = "🏃",
            xpReward = 25,
            category = MilestoneCategory.GAMES,
            checkCondition = { it.totalGames >= 1 }
        ),
        MilestoneDefinition(
            id = "games_10",
            name = "Jogador Regular",
            description = "Participe de 10 jogos",
            emoji = "📅",
            xpReward = 100,
            category = MilestoneCategory.GAMES,
            checkCondition = { it.totalGames >= 10 }
        ),
        MilestoneDefinition(
            id = "games_50",
            name = "Veterano",
            description = "Participe de 50 jogos",
            emoji = "🏆",
            xpReward = 300,
            category = MilestoneCategory.GAMES,
            checkCondition = { it.totalGames >= 50 }
        ),
        MilestoneDefinition(
            id = "games_100",
            name = "Lenda do Campo",
            description = "Participe de 100 jogos",
            emoji = "⭐",
            xpReward = 500,
            category = MilestoneCategory.GAMES,
            checkCondition = { it.totalGames >= 100 }
        ),

        // Vitorias
        MilestoneDefinition(
            id = "wins_1",
            name = "Primeira Vitoria",
            description = "Venca seu primeiro jogo",
            emoji = "✌️",
            xpReward = 50,
            category = MilestoneCategory.WINS,
            checkCondition = { it.totalWins >= 1 }
        ),
        MilestoneDefinition(
            id = "wins_10",
            name = "Vencedor",
            description = "Venca 10 jogos",
            emoji = "🏅",
            xpReward = 150,
            category = MilestoneCategory.WINS,
            checkCondition = { it.totalWins >= 10 }
        ),
        MilestoneDefinition(
            id = "wins_50",
            name = "Campeao",
            description = "Venca 50 jogos",
            emoji = "🏆",
            xpReward = 400,
            category = MilestoneCategory.WINS,
            checkCondition = { it.totalWins >= 50 }
        ),

        // MVP
        MilestoneDefinition(
            id = "mvp_1",
            name = "Primeiro MVP",
            description = "Seja eleito MVP pela primeira vez",
            emoji = "⭐",
            xpReward = 75,
            category = MilestoneCategory.MVP,
            checkCondition = { it.mvpCount >= 1 }
        ),
        MilestoneDefinition(
            id = "mvp_5",
            name = "Craque",
            description = "Seja eleito MVP 5 vezes",
            emoji = "🌟",
            xpReward = 200,
            category = MilestoneCategory.MVP,
            checkCondition = { it.mvpCount >= 5 }
        ),
        MilestoneDefinition(
            id = "mvp_10",
            name = "Lenda MVP",
            description = "Seja eleito MVP 10 vezes",
            emoji = "👑",
            xpReward = 400,
            category = MilestoneCategory.MVP,
            checkCondition = { it.mvpCount >= 10 }
        ),

        // Defesas (Goleiro)
        MilestoneDefinition(
            id = "saves_10",
            name = "Muralha",
            description = "Faca 10 defesas",
            emoji = "🧤",
            xpReward = 100,
            category = MilestoneCategory.SAVES,
            checkCondition = { it.totalSaves >= 10 }
        ),
        MilestoneDefinition(
            id = "saves_50",
            name = "Paredao",
            description = "Faca 50 defesas",
            emoji = "🛡️",
            xpReward = 300,
            category = MilestoneCategory.SAVES,
            checkCondition = { it.totalSaves >= 50 }
        ),

        // Sequencia
        MilestoneDefinition(
            id = "streak_3",
            name = "Sequencia de 3",
            description = "Jogue 3 jogos consecutivos",
            emoji = "🔥",
            xpReward = 50,
            category = MilestoneCategory.STREAK,
            checkCondition = { it.bestStreak >= 3 }
        ),
        MilestoneDefinition(
            id = "streak_7",
            name = "Sequencia de 7",
            description = "Jogue 7 jogos consecutivos",
            emoji = "💪",
            xpReward = 150,
            category = MilestoneCategory.STREAK,
            checkCondition = { it.bestStreak >= 7 }
        ),
        MilestoneDefinition(
            id = "streak_10",
            name = "Maquina de Jogar",
            description = "Jogue 10 jogos consecutivos",
            emoji = "🤖",
            xpReward = 300,
            category = MilestoneCategory.STREAK,
            checkCondition = { it.bestStreak >= 10 }
        )
    )

    /**
     * Verifica todos os milestones para um usuario.
     */
    fun checkAll(
        statistics: Statistics,
        achievedMilestones: List<String>
    ): List<MilestoneCheckResult> {
        return allMilestones.map { milestone ->
            MilestoneCheckResult(
                milestone = milestone,
                unlocked = milestone.checkCondition(statistics),
                previouslyUnlocked = achievedMilestones.contains(milestone.id)
            )
        }
    }

    /**
     * Retorna apenas os novos milestones desbloqueados.
     */
    fun getNewUnlocks(
        statistics: Statistics,
        achievedMilestones: List<String>
    ): List<MilestoneDefinition> {
        return checkAll(statistics, achievedMilestones)
            .filter { it.isNewUnlock }
            .map { it.milestone }
    }

    /**
     * Calcula XP total de novos milestones.
     */
    fun calculateNewMilestonesXp(
        statistics: Statistics,
        achievedMilestones: List<String>
    ): Int {
        return getNewUnlocks(statistics, achievedMilestones)
            .sumOf { it.xpReward }
    }

    /**
     * Busca milestone por ID.
     */
    fun getMilestoneById(id: String): MilestoneDefinition? {
        return allMilestones.find { it.id == id }
    }

    /**
     * Retorna milestones por categoria.
     */
    fun getMilestonesByCategory(category: MilestoneCategory): List<MilestoneDefinition> {
        return allMilestones.filter { it.category == category }
    }
}
