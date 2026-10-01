package com.futebadosparcas.data.model

/**
 * FIX #4138: catálogo local de badges alinhado aos IDs que as Cloud
 * Functions realmente gravam em `user_badges` (raiz) — badge-helper.ts,
 * game-badges.ts, milestones UPPERCASE de xp/pipeline.ts, ambassador_*,
 * mito_rodada_* e mvp_liga_*.
 *
 * Antes a tela lia a coleção raiz `badges` (nunca escrita por functions)
 * e caía em Empty para 100% dos usuários, mesmo com 17+ badges em prod.
 *
 * Badge.type é o enum mais próximo que mapeia para a categoria correta
 * (ver BadgesViewModel.getCategoryForBadgeType); Badge.id preserva o
 * badge_id real do Firestore.
 */
object BadgeCatalog {

    private data class Entry(
        val name: String,
        val description: String,
        val icon: String,
        val xpReward: Long,
        val rarity: BadgeRarity,
        val type: BadgeType,
    )

    private val entries: Map<String, Entry> = mapOf(
        // ===== participation / presença =====
        "first_game" to Entry("Primeira Pelada", "Participe do seu primeiro jogo", "⚽", 50, BadgeRarity.COMUM, BadgeType.FIRST_GAME),
        "games_100" to Entry("Veterano", "Participe de 100 jogos", "🎖️", 500, BadgeRarity.EPICO, BadgeType.GAMES_100),
        "games_500" to Entry("Lenda Viva", "Participe de 500 jogos", "🏟️", 2000, BadgeRarity.LENDARIO, BadgeType.GAMES_500),
        "veteran_50" to Entry("Veterano (50)", "Participe de 50 jogos", "📌", 300, BadgeRarity.RARO, BadgeType.GAMES_100),
        "veteran_100" to Entry("Veterano (100)", "Participe de 100 jogos", "🏅", 450, BadgeRarity.EPICO, BadgeType.GAMES_100),
        "onipresente" to Entry("Onipresente", "Presença em praticamente todos os jogos", "👁️", 350, BadgeRarity.EPICO, BadgeType.FOMINHA),
        "rei_das_quartas" to Entry("Rei das Quartas", "Presença consistente às quartas", "👑", 200, BadgeRarity.RARO, BadgeType.FOMINHA),
        // ===== streak =====
        "streak_3" to Entry("Sequência Iniciante", "Jogue 3 partidas seguidas", "🔥", 30, BadgeRarity.COMUM, BadgeType.STREAK_3),
        "streak_7" to Entry("Semana Perfeita", "Jogue 7 partidas seguidas", "💪", 100, BadgeRarity.RARO, BadgeType.STREAK_7),
        "streak_30" to Entry("Mês Imbatível", "Jogue 30 partidas seguidas", "🏆", 500, BadgeRarity.LENDARIO, BadgeType.STREAK_30),
        "iron_man" to Entry("Homem de Ferro", "Sequência longa de jogos sem faltar", "⚙️", 400, BadgeRarity.EPICO, BadgeType.STREAK_30),
        // ===== mvp =====
        "mvp_1" to Entry("Estreante MVP", "Seja eleito MVP pela primeira vez", "⭐", 100, BadgeRarity.COMUM, BadgeType.MVP_1),
        "mvp_10" to Entry("Estrela em Ascensão", "Seja eleito MVP 10 vezes", "🌟", 300, BadgeRarity.RARO, BadgeType.MVP_10),
        "mvp_50" to Entry("Lenda do MVP", "Seja eleito MVP 50 vezes", "👑", 1000, BadgeRarity.LENDARIO, BadgeType.MVP_50),
        "mvp_streak_3" to Entry("MVP 3x Seguidas", "Seja eleito MVP 3 partidas seguidas", "✨", 250, BadgeRarity.EPICO, BadgeType.MVP_10),
        // ===== gols =====
        "goals_10" to Entry("Goleador", "Marque 10 gols", "🥅", 50, BadgeRarity.COMUM, BadgeType.GOALS_10),
        "goals_100" to Entry("Artilheiro", "Marque 100 gols", "⚽", 200, BadgeRarity.RARO, BadgeType.GOALS_100),
        "goals_500" to Entry("Máquina de Gols", "Marque 500 gols", "🎯", 1000, BadgeRarity.LENDARIO, BadgeType.GOALS_500),
        "hat_trick" to Entry("Hat-Trick", "Marque 3+ gols em uma partida", "⚽", 150, BadgeRarity.RARO, BadgeType.HAT_TRICK),
        "poker" to Entry("Poker de Gols", "Marque 4+ gols em uma partida", "♠️", 200, BadgeRarity.EPICO, BadgeType.HAT_TRICK),
        "manita" to Entry("Manita", "Marque 5+ gols em uma partida", "🖐️", 300, BadgeRarity.LENDARIO, BadgeType.HAT_TRICK),
        // ===== assistências =====
        "assists_50" to Entry("Garçom", "Dê 50 assistências", "👟", 50, BadgeRarity.COMUM, BadgeType.ASSISTS_50),
        "assists_200" to Entry("Mestre das Assistências", "Dê 200 assistências", "🎭", 300, BadgeRarity.RARO, BadgeType.ASSISTS_200),
        "playmaker" to Entry("Maestro", "Dê 3+ assistências em uma partida", "🎩", 150, BadgeRarity.RARO, BadgeType.ASSISTS_50),
        "balanced_player" to Entry("Jogador Completo", "Gol e assistência na mesma partida", "⚖️", 100, BadgeRarity.COMUM, BadgeType.ASSISTS_50),
        // ===== vitórias =====
        "wins_10" to Entry("Vencedor", "Vença 10 jogos", "🏅", 100, BadgeRarity.COMUM, BadgeType.WINS_10),
        "wins_50" to Entry("Campeão", "Vença 50 jogos", "🏆", 400, BadgeRarity.RARO, BadgeType.WINS_50),
        "winner_25" to Entry("Conquistador", "Vença 25 jogos", "🎖️", 300, BadgeRarity.RARO, BadgeType.WINS_10),
        "winner_50" to Entry("Tetacampeão", "Vença 50 jogos", "🥇", 450, BadgeRarity.EPICO, BadgeType.WINS_50),
        "carrasco" to Entry("Carrasco", "Decida jogos com gols no fim", "🗡️", 200, BadgeRarity.RARO, BadgeType.WINS_10),
        // ===== defesas / goleiro =====
        "saves_10" to Entry("Muralha", "Faça 10 defesas", "🧤", 100, BadgeRarity.COMUM, BadgeType.PAREDAO),
        "saves_50" to Entry("Paredão", "Faça 50 defesas", "🛡️", 300, BadgeRarity.RARO, BadgeType.PAREDAO),
        "paredao" to Entry("Paredão", "Muitas defesas em uma partida", "🧱", 150, BadgeRarity.RARO, BadgeType.PAREDAO),
        "clean_sheet" to Entry("Clean Sheet", "Não sofra gols como goleiro", "🥚", 100, BadgeRarity.COMUM, BadgeType.PAREDAO),
        "defensive_wall" to Entry("Muralha Defensiva", "Performance defensiva excepcional", "🛡️", 200, BadgeRarity.EPICO, BadgeType.PAREDAO),
        // ===== comunidade =====
        "organizador_master" to Entry("Organizador Master", "Organize 10 jogos", "📋", 200, BadgeRarity.RARO, BadgeType.ORGANIZADOR_MASTER),
        "influencer" to Entry("Influencer", "Convide 5 novos jogadores", "✨", 200, BadgeRarity.RARO, BadgeType.INFLUENCER),
        "mesa_oficial_10" to Entry("Mesa Oficial (10)", "Anote a súmula de 10 jogos", "📝", 100, BadgeRarity.COMUM, BadgeType.ORGANIZADOR_MASTER),
        "mesa_oficial_25" to Entry("Mesa Oficial (25)", "Anote a súmula de 25 jogos", "📋", 250, BadgeRarity.RARO, BadgeType.ORGANIZADOR_MASTER),
        "mesa_oficial_50" to Entry("Mesa Oficial (50)", "Anote a súmula de 50 jogos", "📚", 400, BadgeRarity.EPICO, BadgeType.ORGANIZADOR_MASTER),
        "ambassador_bronze" to Entry("Embaixador Bronze", "Convide 3 jogadores que entraram", "🥉", 100, BadgeRarity.COMUM, BadgeType.INFLUENCER),
        "ambassador_prata" to Entry("Embaixador Prata", "Convide 10 jogadores que entraram", "🥈", 200, BadgeRarity.RARO, BadgeType.INFLUENCER),
        "ambassador_ouro" to Entry("Embaixador Ouro", "Convide 30 jogadores que entraram", "🥇", 350, BadgeRarity.EPICO, BadgeType.INFLUENCER),
        "ambassador_lenda" to Entry("Embaixador Lenda", "Convide 100 jogadores que entraram", "👑", 600, BadgeRarity.LENDARIO, BadgeType.INFLUENCER),
        // ===== nível =====
        "level_5" to Entry("Nível 5", "Alcance o nível 5", "5️⃣", 100, BadgeRarity.COMUM, BadgeType.LENDA),
        "level_10" to Entry("Nível 10", "Alcance o nível 10", "🔟", 300, BadgeRarity.RARO, BadgeType.LENDA),
        "lenda" to Entry("Lenda", "Alcance o nível máximo", "🏆", 1000, BadgeRarity.LENDARIO, BadgeType.LENDA),
        "faixa_preta" to Entry("Faixa Preta", "Participe de 200 jogos", "🥋", 800, BadgeRarity.EPICO, BadgeType.FAIXA_PRETA),
        "mito" to Entry("Mito", "Seja eleito MVP 20 vezes", "💎", 1000, BadgeRarity.LENDARIO, BadgeType.MITO),
        // ===== performance extra =====
        "artilheiro_mes" to Entry("Artilheiro do Mês", "Maior goleador do mês", "👑", 300, BadgeRarity.EPICO, BadgeType.ARTILHEIRO_MES),
        "fominha" to Entry("Fominha", "3 jogos na mesma semana", "🔥", 50, BadgeRarity.COMUM, BadgeType.FOMINHA),
    )

    /**
     * Milestones UPPERCASE gravados por xp/pipeline.ts:
     * GAMES_10/25/50/100/250/500, GOALS_*, ASSISTS_*, SAVES_*, MVP_*, WINS_*.
     */
    private val milestoneCategoryLabels = mapOf(
        "GAMES" to Triple("Jogos", "participação", BadgeType.GAMES_100),
        "GOALS" to Triple("Gols", "gols", BadgeType.GOALS_10),
        "ASSISTS" to Triple("Assistências", "assistências", BadgeType.ASSISTS_50),
        "SAVES" to Triple("Defesas", "defesas", BadgeType.PAREDAO),
        "MVP" to Triple("MVPs", "MVPs", BadgeType.MVP_1),
        "WINS" to Triple("Vitórias", "vitórias", BadgeType.WINS_10),
    )

    private val milestoneRarity = mapOf(
        10L to BadgeRarity.COMUM, 25L to BadgeRarity.COMUM, 5L to BadgeRarity.COMUM,
        50L to BadgeRarity.RARO, 100L to BadgeRarity.RARO,
        250L to BadgeRarity.EPICO,
        500L to BadgeRarity.LENDARIO,
    )

    /**
     * Resolve a definição de um badge_id real gravado pelas functions.
     * Fallback gracioso para ids desconhecidos (badge nunca fica invisível).
     */
    fun definitionFor(badgeId: String): Badge? {
        entries[badgeId.lowercase()]?.let { entry ->
            return entry.toBadge(badgeId)
        }

        if (badgeId.startsWith("mito_rodada_")) {
            return Badge(
                id = badgeId,
                type = BadgeType.ARTILHEIRO_MES,
                name = "Mito da Rodada",
                description = "Melhor pontuação da rodada no ranking semanal",
                xpReward = 0,
                rarity = BadgeRarity.EPICO,
            )
        }
        if (badgeId.startsWith("mvp_liga_")) {
            return Badge(
                id = badgeId,
                type = BadgeType.MVP_10,
                name = "MVP da Liga",
                description = "MVP do mês na temporada da liga",
                xpReward = 0,
                rarity = BadgeRarity.LENDARIO,
            )
        }

        // Milestones UPPERCASE: {CATEGORIA}_{N}
        val milestone = milestoneCategoryLabels[badgeId.substringBefore('_')]
        if (milestone != null && badgeId.substringAfter('_').toLongOrNull() != null) {
            val (label, plural, type) = milestone
            val threshold = badgeId.substringAfter('_').toLong()
            return Badge(
                id = badgeId,
                type = type,
                name = "Meta $label $threshold",
                description = "Alcançou $threshold $plural",
                xpReward = 0,
                rarity = milestoneRarity[threshold] ?: BadgeRarity.COMUM,
            )
        }

        // Fallback: badge desconhecida não pode ficar invisível.
        return Badge(
            id = badgeId,
            type = BadgeType.FIRST_GAME,
            name = badgeId.replace('_', ' ').replaceFirstChar { it.uppercase() },
            description = "Conquista desbloqueada",
            xpReward = 0,
            rarity = BadgeRarity.COMUM,
        )
    }

    private fun Entry.toBadge(id: String): Badge = Badge(
        id = id,
        type = type,
        name = name,
        description = description,
        xpReward = xpReward,
        rarity = rarity,
    )
}