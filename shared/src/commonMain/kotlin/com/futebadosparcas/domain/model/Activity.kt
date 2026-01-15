package com.futebadosparcas.domain.model

import kotlinx.datetime.Clock

/**
 * Representa uma atividade no feed de atividades do usuario.
 * Colecao: activities
 *
 * @property id ID unico da atividade
 * @property userId ID do usuario que gerou a atividade
 * @property userName Nome do usuario
 * @property userPhoto URL da foto do usuario (opcional)
 * @property type Tipo da atividade (veja ActivityType)
 * @property title Titulo da atividade
 * @property description Descricao detalhada da atividade
 * @property referenceId ID do documento relacionado (gameId, badgeId, etc)
 * @property referenceType Tipo do documento referenciado ("game", "badge", "milestone")
 * @property metadata Dados adicionais especificos do tipo de atividade
 * @property createdAt Timestamp de criacao da atividade
 * @property visibility Visibilidade da atividade (veja ActivityVisibility)
 */
data class Activity(
    val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val userPhoto: String? = null,
    val type: ActivityType = ActivityType.GAME_FINISHED,
    val title: String = "",
    val description: String = "",
    val referenceId: String? = null,
    val referenceType: String? = null,
    val metadata: Map<String, String> = emptyMap(),
    val createdAt: Long? = null,
    val visibility: ActivityVisibility = ActivityVisibility.PUBLIC
) {
    companion object {
        /**
         * Cria atividade de jogo finalizado.
         */
        fun createGameFinished(
            userId: String,
            userName: String,
            userPhoto: String? = null,
            gameId: String,
            gameName: String,
            score: String? = null
        ): Activity {
            return Activity(
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                type = ActivityType.GAME_FINISHED,
                title = "Jogo finalizado",
                description = "Participou do jogo $gameName${score?.let { " - Resultado: $it" } ?: ""}",
                referenceId = gameId,
                referenceType = "game",
                createdAt = Clock.System.now().toEpochMilliseconds(),
                visibility = ActivityVisibility.PUBLIC
            )
        }

        /**
         * Cria atividade de conquista de badge.
         */
        fun createBadgeEarned(
            userId: String,
            userName: String,
            userPhoto: String? = null,
            badgeId: String,
            badgeName: String,
            badgeDescription: String
        ): Activity {
            return Activity(
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                type = ActivityType.BADGE_EARNED,
                title = "Nova conquista",
                description = "Desbloqueou o badge: $badgeName",
                referenceId = badgeId,
                referenceType = "badge",
                metadata = mapOf("badge_name" to badgeName, "badge_description" to badgeDescription),
                createdAt = Clock.System.now().toEpochMilliseconds(),
                visibility = ActivityVisibility.PUBLIC
            )
        }

        /**
         * Cria atividade de milestone alcancado.
         */
        fun createMilestoneReached(
            userId: String,
            userName: String,
            userPhoto: String? = null,
            milestoneId: String,
            milestoneName: String
        ): Activity {
            return Activity(
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                type = ActivityType.MILESTONE_REACHED,
                title = "Marco alcancado",
                description = "Completou o desafio: $milestoneName",
                referenceId = milestoneId,
                referenceType = "milestone",
                metadata = mapOf("milestone_name" to milestoneName),
                createdAt = Clock.System.now().toEpochMilliseconds(),
                visibility = ActivityVisibility.PUBLIC
            )
        }

        /**
         * Cria atividade de nivel alcançado.
         */
        fun createLevelUp(
            userId: String,
            userName: String,
            userPhoto: String? = null,
            newLevel: Int,
            levelName: String
        ): Activity {
            return Activity(
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                type = ActivityType.LEVEL_UP,
                title = "Subiu de nivel!",
                description = "Alcançou o nivel $newLevel - $levelName",
                referenceId = newLevel.toString(),
                referenceType = "level",
                metadata = mapOf("level" to newLevel.toString(), "level_name" to levelName),
                createdAt = Clock.System.now().toEpochMilliseconds(),
                visibility = ActivityVisibility.PUBLIC
            )
        }

        /**
         * Cria atividade de milestone de sequencia.
         */
        fun createStreakMilestone(
            userId: String,
            userName: String,
            userPhoto: String? = null,
            streakCount: Int
        ): Activity {
            return Activity(
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                type = ActivityType.STREAK_MILESTONE,
                title = "Sequencia impressionante!",
                description = "Alcançou uma sequencia de $streakCount jogos",
                referenceId = streakCount.toString(),
                referenceType = "streak",
                metadata = mapOf("streak_count" to streakCount.toString()),
                createdAt = Clock.System.now().toEpochMilliseconds(),
                visibility = ActivityVisibility.PUBLIC
            )
        }

        /**
         * Cria atividade de desafio semanal completado.
         */
        fun createChallengeCompleted(
            userId: String,
            userName: String,
            userPhoto: String? = null,
            challengeId: String,
            challengeName: String
        ): Activity {
            return Activity(
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                type = ActivityType.CHALLENGE_COMPLETED,
                title = "Desafio completado",
                description = "Completou o desafio semanal: $challengeName",
                referenceId = challengeId,
                referenceType = "challenge",
                metadata = mapOf("challenge_name" to challengeName),
                createdAt = Clock.System.now().toEpochMilliseconds(),
                visibility = ActivityVisibility.PUBLIC
            )
        }

        /**
         * Cria atividade de MVP em jogo.
         */
        fun createMVPEarned(
            userId: String,
            userName: String,
            userPhoto: String? = null,
            gameId: String,
            gameName: String
        ): Activity {
            return Activity(
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                type = ActivityType.MVP_EARNED,
                title = "Melhor em campo!",
                description = "Foi o MVP do jogo $gameName",
                referenceId = gameId,
                referenceType = "game",
                metadata = mapOf("game_name" to gameName),
                createdAt = Clock.System.now().toEpochMilliseconds(),
                visibility = ActivityVisibility.PUBLIC
            )
        }

        /**
         * Cria atividade de hat-trick.
         */
        fun createHatTrick(
            userId: String,
            userName: String,
            userPhoto: String? = null,
            gameId: String,
            gameName: String,
            goalCount: Int = 3
        ): Activity {
            return Activity(
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                type = ActivityType.HAT_TRICK,
                title = "Hat-trick!",
                description = "Marcou $goalCount gols no jogo $gameName",
                referenceId = gameId,
                referenceType = "game",
                metadata = mapOf("goal_count" to goalCount.toString(), "game_name" to gameName),
                createdAt = Clock.System.now().toEpochMilliseconds(),
                visibility = ActivityVisibility.PUBLIC
            )
        }

        /**
         * Cria atividade de clean sheet (goleiro nao sofreu gols).
         */
        fun createCleanSheet(
            userId: String,
            userName: String,
            userPhoto: String? = null,
            gameId: String,
            gameName: String
        ): Activity {
            return Activity(
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                type = ActivityType.CLEAN_SHEET,
                title = "Bola murcha!",
                description = "Não sofreu gols no jogo $gameName",
                referenceId = gameId,
                referenceType = "game",
                metadata = mapOf("game_name" to gameName),
                createdAt = Clock.System.now().toEpochMilliseconds(),
                visibility = ActivityVisibility.PUBLIC
            )
        }
    }
}

/**
 * Tipos de atividades disponiveis no sistema.
 */
enum class ActivityType(val displayName: String) {
    GAME_FINISHED("Jogo Finalizado"),
    BADGE_EARNED("Badge Conquistado"),
    MILESTONE_REACHED("Marco Alcançado"),
    LEVEL_UP("Subiu de Nivel"),
    STREAK_MILESTONE("Sequencia"),
    CHALLENGE_COMPLETED("Desafio Completado"),
    MVP_EARNED("MVP"),
    HAT_TRICK("Hat-Trick"),
    CLEAN_SHEET("Bola Murcha");

    companion object {
        fun fromString(value: String?): ActivityType {
            return entries.find { it.name == value } ?: GAME_FINISHED
        }
    }
}

/**
 * Niveis de visibilidade das atividades.
 */
enum class ActivityVisibility(val displayName: String) {
    PRIVATE("Privado"),
    FRIENDS("Amigos"),
    PUBLIC("Publico");

    companion object {
        fun fromString(value: String?): ActivityVisibility {
            return entries.find { it.name == value } ?: PUBLIC
        }
    }
}
