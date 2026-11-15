package com.futebadosparcas.ui.core

import com.futebadosparcas.domain.gamification.BadgeDefinitions
import com.futebadosparcas.domain.model.BadgeCategory
import com.futebadosparcas.domain.model.BadgeDefinition
import com.futebadosparcas.domain.model.BadgeRarity
import com.futebadosparcas.domain.model.UserBadge

/**
 * Conquista desbloqueada pelo jogador, com a definição usada para exibir.
 */
data class EarnedBadge(
    val definition: BadgeDefinition,
    val count: Int
)

/**
 * Coleção mostrada na tela de Conquistas: o que o jogador já tem e o que falta.
 */
data class BadgeCollection(
    val earned: List<EarnedBadge>,
    val locked: List<BadgeDefinition>
)

/**
 * Monta a coleção a partir dos documentos de `user_badges` do jogador e do catálogo local.
 *
 * Antes a tela do iOS lia a coleção raiz `badges`, que as Cloud Functions nunca escrevem
 * (0 documentos em produção), e mostrava só o cabeçalho. As definições vêm do catálogo
 * compartilhado (`BadgeDefinitions`); um `badge_id` fora do catálogo ainda aparece,
 * com nome derivado do próprio id, para a conquista nunca sumir.
 */
fun buildBadgeCollection(
    userBadges: List<UserBadge>,
    catalog: List<BadgeDefinition> = BadgeDefinitions.allBadges
): BadgeCollection {
    val byId = catalog.associateBy { it.id.lowercase() }
    val earned = userBadges
        .filter { it.badgeId.isNotBlank() }
        .groupBy { it.badgeId.lowercase() }
        .map { (id, docs) ->
            EarnedBadge(
                definition = byId[id] ?: fallbackDefinition(docs.first().badgeId),
                count = docs.sumOf { it.unlockCount.coerceAtLeast(1) }
            )
        }
        .sortedWith(compareByDescending<EarnedBadge> { it.definition.rarity.ordinal }.thenBy { it.definition.name })
    val earnedIds = earned.map { it.definition.id.lowercase() }.toSet()
    val locked = catalog
        .filter { !it.isHidden && it.id.lowercase() !in earnedIds }
        .sortedWith(compareBy<BadgeDefinition> { it.rarity.ordinal }.thenBy { it.name })
    return BadgeCollection(earned = earned, locked = locked)
}

private fun fallbackDefinition(badgeId: String): BadgeDefinition {
    val name = badgeId.split('_', '-')
        .filter { it.isNotBlank() }
        .joinToString(" ") { part -> part.lowercase().replaceFirstChar { it.uppercase() } }
        .ifBlank { badgeId }
    return BadgeDefinition(
        id = badgeId,
        name = name,
        description = "",
        emoji = "🏅",
        category = BadgeCategory.SPECIAL,
        rarity = BadgeRarity.COMMON
    )
}
