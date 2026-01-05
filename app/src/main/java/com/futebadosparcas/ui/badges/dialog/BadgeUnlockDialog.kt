package com.futebadosparcas.ui.badges.dialog

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import androidx.core.content.FileProvider
import androidx.fragment.app.DialogFragment
import coil.load
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Badge
import com.futebadosparcas.data.model.BadgeRarity
import com.futebadosparcas.data.model.BadgeType
import com.futebadosparcas.databinding.DialogBadgeUnlockBinding
import com.futebadosparcas.util.SeenBadgesManager
import com.google.firebase.firestore.FirebaseFirestore
import java.io.File
import java.io.FileOutputStream

class BadgeUnlockDialog(
    private val badgeId: String,
    private val firestore: FirebaseFirestore
) : DialogFragment() {

    private var _binding: DialogBadgeUnlockBinding? = null
    private val binding get() = _binding!!

    private var currentBadge: Badge? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogBadgeUnlockBinding.inflate(inflater, container, false)
        dialog?.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialog?.window?.requestFeature(Window.FEATURE_NO_TITLE)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        loadBadgeData()

        binding.btnAwesome.setOnClickListener {
            // Marcar como visto antes de fechar
            markBadgeAsSeen()
            dismiss()
        }

        binding.btnShare?.setOnClickListener {
            currentBadge?.let { badge ->
                shareBadgeToWhatsApp(badge)
            }
        }
    }

    private fun loadBadgeData() {
        firestore.collection("badges").document(badgeId).get()
            .addOnSuccessListener { doc ->
                val badge = doc.toObject(Badge::class.java)
                badge?.let {
                    currentBadge = it
                    updateUI(it)
                }
            }
    }

    private fun updateUI(badge: Badge) {
        binding.tvBadgeName.text = badge.name
        binding.tvBadgeDescription.text = badge.description
        binding.tvXpReward?.text = badge.xpReward.toString()

        // Configurar chip de raridade
        setupRarityChip(badge.rarity)

        // Configurar icone
        setupBadgeIcon(badge)
    }

    private fun setupRarityChip(rarity: BadgeRarity) {
        val (text, colorRes) = when (rarity) {
            BadgeRarity.COMUM -> "COMUM" to R.color.rarity_comum
            BadgeRarity.RARO -> "RARO" to R.color.rarity_raro
            BadgeRarity.EPICO -> "ÉPICO" to R.color.rarity_epico
            BadgeRarity.LENDARIO -> "LENDÁRIO" to R.color.rarity_lendario
        }

        binding.chipRarity?.text = text
        binding.chipRarity?.setChipBackgroundColorResource(colorRes)
    }

    private fun setupBadgeIcon(badge: Badge) {
        // Se tiver URL de icone, carregar. Senao usar emoji baseado no tipo
        if (badge.iconUrl.isNotEmpty()) {
            binding.ivBadgeIcon.load(badge.iconUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_star)
                error(R.drawable.ic_star)
            }
        } else {
            // Usar drawable baseado no tipo
            val iconRes = getBadgeIconResource(badge.type)
            binding.ivBadgeIcon.setImageResource(iconRes)
        }
    }

    private fun getBadgeIconResource(type: BadgeType): Int {
        return when (type) {
            BadgeType.HAT_TRICK -> R.drawable.ic_football
            BadgeType.PAREDAO -> R.drawable.ic_shield
            BadgeType.ARTILHEIRO_MES -> R.drawable.ic_star
            BadgeType.FOMINHA -> R.drawable.ic_calendar
            BadgeType.STREAK_7, BadgeType.STREAK_30 -> R.drawable.ic_fire
            BadgeType.ORGANIZADOR_MASTER -> R.drawable.ic_clipboard
            BadgeType.INFLUENCER -> R.drawable.ic_megaphone
            BadgeType.LENDA, BadgeType.FAIXA_PRETA, BadgeType.MITO -> R.drawable.ic_star
        }
    }

    private fun markBadgeAsSeen() {
        context?.let { ctx ->
            SeenBadgesManager.markAsSeen(ctx, badgeId)
        }
    }

    private fun shareBadgeToWhatsApp(badge: Badge) {
        try {
            // Capturar imagem do card
            val bitmap = captureCardAsBitmap()

            // Salvar em cache
            val file = saveBitmapToCache(bitmap)

            // Criar URI usando FileProvider
            val uri = FileProvider.getUriForFile(
                requireContext(),
                "${requireContext().packageName}.fileprovider",
                file
            )

            // Criar intent de compartilhamento
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "image/*"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_TEXT, getString(R.string.share_badge_text, badge.name))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                setPackage("com.whatsapp")
            }

            // Verificar se WhatsApp esta instalado
            if (shareIntent.resolveActivity(requireContext().packageManager) != null) {
                startActivity(shareIntent)
            } else {
                // Fallback para compartilhamento geral
                val fallbackIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/*"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_TEXT, getString(R.string.share_badge_text, badge.name))
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(Intent.createChooser(fallbackIntent, getString(R.string.share)))
            }
        } catch (e: Exception) {
            // Se falhar a captura de imagem, compartilhar apenas texto
            shareTextOnly(badge)
        }
    }

    private fun captureCardAsBitmap(): Bitmap {
        val card = binding.cardBadge ?: throw IllegalStateException("Card not found")
        val bitmap = Bitmap.createBitmap(card.width, card.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        card.draw(canvas)
        return bitmap
    }

    private fun saveBitmapToCache(bitmap: Bitmap): File {
        val cacheDir = File(requireContext().cacheDir, "shared_badges")
        if (!cacheDir.exists()) {
            cacheDir.mkdirs()
        }

        val file = File(cacheDir, "badge_${System.currentTimeMillis()}.png")
        FileOutputStream(file).use { out ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
        }

        return file
    }

    private fun shareTextOnly(badge: Badge) {
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, getString(R.string.share_badge_text, badge.name))
            setPackage("com.whatsapp")
        }

        if (shareIntent.resolveActivity(requireContext().packageManager) != null) {
            startActivity(shareIntent)
        } else {
            val fallbackIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, getString(R.string.share_badge_text, badge.name))
            }
            startActivity(Intent.createChooser(fallbackIntent, getString(R.string.share)))
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "BadgeUnlockDialog"

        fun newInstance(badgeId: String, firestore: FirebaseFirestore): BadgeUnlockDialog {
            return BadgeUnlockDialog(badgeId, firestore)
        }
    }
}
