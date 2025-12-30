package com.futebadosparcas.ui.badges.dialog

import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import androidx.fragment.app.DialogFragment
import coil.load
import com.futebadosparcas.data.model.Badge
import com.futebadosparcas.databinding.DialogBadgeUnlockBinding
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.runBlocking

class BadgeUnlockDialog(
    private val badgeId: String,
    private val firestore: FirebaseFirestore // Passando dependência diretamente ou poderia injetar se fosse Fragment normal
) : DialogFragment() {

    private var _binding: DialogBadgeUnlockBinding? = null
    private val binding get() = _binding!!

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
            dismiss()
        }
    }

    private fun loadBadgeData() {
        // Simplesmente rodando em IO ou similar seria melhor, mas aqui é rápido
        // Idealmente isso viria já pronto, mas vamos buscar rapidinho
        // Em produção: Usar ViewModel ou passar o objeto Badge pronto
        
        // Hack rápido para buscar o nome do badge sem arquitetura complexa para um dialog simples
        // Em um app real, passaria o Objeto Badge Serializable/Parcelable
        firestore.collection("badges").document(badgeId).get()
            .addOnSuccessListener { doc ->
                val badge = doc.toObject(Badge::class.java)
                badge?.let { updateUI(it) }
            }
    }

    private fun updateUI(badge: Badge) {
        binding.tvBadgeName.text = badge.name
        binding.tvBadgeDescription.text = badge.description
        
        // Se tiver URL de ícone, carregar. Senão usar placeholder ou logic based on type.
        if (badge.iconUrl.isNotEmpty()) {
            binding.ivBadgeIcon.load(badge.iconUrl)
        } else {
            // Fallback to resource based on type if needed, or keeping placeholder
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
