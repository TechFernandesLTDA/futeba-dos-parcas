package com.futebadosparcas.ui.statistics

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.DialogFragment
import com.futebadosparcas.ui.theme.FutebaTheme

/**
 * DialogFragment que exibe o resumo de XP pos-jogo usando Compose.
 */
class PostGameDialogFragment : DialogFragment() {

    private var summary: PostGameSummary? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NO_FRAME, android.R.style.Theme_Material_Light_Dialog_NoActionBar)

        arguments?.let { args ->
            @Suppress("UNCHECKED_CAST")
            val breakdown = (args.getSerializable(ARG_XP_BREAKDOWN) as? HashMap<String, Long>) ?: HashMap()
            
            summary = PostGameSummary(
                gameId = args.getString(ARG_GAME_ID, ""),
                xpEarned = args.getLong(ARG_XP_EARNED, 0L),
                xpBreakdown = breakdown,
                previousXp = args.getLong(ARG_PREVIOUS_XP, 0L),
                newXp = args.getLong(ARG_NEW_XP, 0L),
                previousLevel = args.getInt(ARG_PREVIOUS_LEVEL, 1),
                newLevel = args.getInt(ARG_NEW_LEVEL, 1),
                leveledUp = args.getBoolean(ARG_LEVELED_UP, false),
                newLevelName = args.getString(ARG_NEW_LEVEL_NAME, ""),
                milestonesUnlocked = emptyList(),
                gameResult = args.getString(ARG_GAME_RESULT, "DRAW")
            )
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    summary?.let { s ->
                        PostGameDialog(
                            summary = s,
                            onDismiss = { dismiss() }
                        )
                    }
                }
            }
        }
    }

    companion object {
        private const val ARG_GAME_ID = "game_id"
        private const val ARG_XP_EARNED = "xp_earned"
        private const val ARG_PREVIOUS_XP = "previous_xp"
        private const val ARG_NEW_XP = "new_xp"
        private const val ARG_PREVIOUS_LEVEL = "previous_level"
        private const val ARG_NEW_LEVEL = "new_level"
        private const val ARG_LEVELED_UP = "leveled_up"
        private const val ARG_NEW_LEVEL_NAME = "new_level_name"
        private const val ARG_GAME_RESULT = "game_result"
        private const val ARG_XP_BREAKDOWN = "xp_breakdown"

        fun newInstance(summary: PostGameSummary): PostGameDialogFragment {
            return PostGameDialogFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_GAME_ID, summary.gameId)
                    putLong(ARG_XP_EARNED, summary.xpEarned)
                    putSerializable(ARG_XP_BREAKDOWN, HashMap(summary.xpBreakdown))
                    putLong(ARG_PREVIOUS_XP, summary.previousXp)
                    putLong(ARG_NEW_XP, summary.newXp)
                    putInt(ARG_PREVIOUS_LEVEL, summary.previousLevel)
                    putInt(ARG_NEW_LEVEL, summary.newLevel)
                    putBoolean(ARG_LEVELED_UP, summary.leveledUp)
                    putString(ARG_NEW_LEVEL_NAME, summary.newLevelName)
                    putString(ARG_GAME_RESULT, summary.gameResult)
                }
            }
        }
    }
}
