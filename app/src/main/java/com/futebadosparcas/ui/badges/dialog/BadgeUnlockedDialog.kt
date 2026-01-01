package com.futebadosparcas.ui.badges.dialog

import android.app.Dialog
import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AnimationUtils
import androidx.fragment.app.DialogFragment
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Badge
import com.futebadosparcas.data.model.BadgeRarity
import com.futebadosparcas.data.model.BadgeType
import com.futebadosparcas.databinding.DialogBadgeUnlockedBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder

/**
 * Dialog exibido quando uma badge é desbloqueada
 */
class BadgeUnlockedDialog : DialogFragment() {

    private var _binding: DialogBadgeUnlockedBinding? = null
    private val binding get() = _binding!!

    private var badge: Badge? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(STYLE_NORMAL, R.style.Theme_FutebaDosParas_FullScreenDialog)
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        return MaterialAlertDialogBuilder(requireContext(), theme)
            .setView(onCreateView(layoutInflater, null, savedInstanceState))
            .create()
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogBadgeUnlockedBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Recuperar badge dos argumentos (em produção, passar via Bundle)
        // Por enquanto, vamos usar dados mock para demonstração
        setupMockBadge()

        setupViews()
        startAnimations()
    }

    private fun setupMockBadge() {
        badge = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            arguments?.getParcelable("badge", Badge::class.java)
        } else {
            @Suppress("DEPRECATION")
            arguments?.getParcelable("badge")
        }
    }

    private fun setupViews() {
        badge?.let { badge ->
            // Ícone
            binding.tvBadgeIcon.text = getBadgeIcon(badge.type)

            // Nome
            binding.tvBadgeName.text = badge.name

            // Descrição
            binding.tvBadgeDescription.text = badge.description

            // XP
            binding.tvXpReward.text = "+${badge.xpReward} XP"

            // Cor de fundo baseada na raridade
            val backgroundColor = getRarityColor(badge.rarity)
            binding.vBadgeBackground.setBackgroundColor(backgroundColor)

            // Botão fechar
            binding.btnClose.setOnClickListener {
                dismiss()
            }
        }
    }

    private fun startAnimations() {
        // Animar o ícone da badge
        val scaleAnimation = AnimationUtils.loadAnimation(requireContext(), R.anim.badge_unlock_scale)
        binding.flBadgeIcon.startAnimation(scaleAnimation)

        // Animar o pulso (loop infinito)
        scaleAnimation.setAnimationListener(object : android.view.animation.Animation.AnimationListener {
            override fun onAnimationStart(animation: android.view.animation.Animation?) {}

            override fun onAnimationEnd(animation: android.view.animation.Animation?) {
                // Iniciar animação de pulso
                val pulseAnimation = AnimationUtils.loadAnimation(
                    requireContext(),
                    R.anim.badge_unlock_pulse
                )
                binding.flBadgeIcon.startAnimation(pulseAnimation)
            }

            override fun onAnimationRepeat(animation: android.view.animation.Animation?) {}
        })
    }

    /**
     * Retorna ícone (emoji) para cada tipo de badge
     */
    private fun getBadgeIcon(type: BadgeType): String {
        return when (type) {
            BadgeType.HAT_TRICK -> "⚽"
            BadgeType.PAREDAO -> "🧤"
            BadgeType.ARTILHEIRO_MES -> "👑"
            BadgeType.FOMINHA -> "📅"
            BadgeType.STREAK_7 -> "🔥"
            BadgeType.STREAK_30 -> "🔥🔥"
            BadgeType.ORGANIZADOR_MASTER -> "📋"
            BadgeType.INFLUENCER -> "📢"
            BadgeType.LENDA -> "⭐"
            BadgeType.FAIXA_PRETA -> "🥋"
            BadgeType.MITO -> "💎"
        }
    }

    /**
     * Retorna cor baseada na raridade
     */
    private fun getRarityColor(rarity: BadgeRarity): Int {
        return when (rarity) {
            BadgeRarity.COMUM -> Color.parseColor("#9E9E9E")
            BadgeRarity.RARO -> Color.parseColor("#2196F3")
            BadgeRarity.EPICO -> Color.parseColor("#9C27B0")
            BadgeRarity.LENDARIO -> Color.parseColor("#FFD700")
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "BadgeUnlockedDialog"

        /**
         * Cria uma nova instância do dialog
         */
        fun newInstance(badge: Badge): BadgeUnlockedDialog {
            val dialog = BadgeUnlockedDialog()
            val args = Bundle().apply {
                putParcelable("badge", badge)
            }
            dialog.arguments = args
            return dialog
        }
    }
}
