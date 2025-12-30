package com.futebadosparcas.ui.locations

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.Window
import androidx.fragment.app.DialogFragment
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.databinding.DialogFieldEditBinding

import android.net.Uri
import androidx.activity.result.contract.ActivityResultContracts
import coil.load

class FieldEditDialog(
    private val field: Field? = null,
    private val defaultType: FieldType = FieldType.SOCIETY,
    private val onSave: (String, FieldType, Double, Boolean, Uri?, String?, Boolean, String?) -> Unit
) : DialogFragment() {

    private var _binding: DialogFieldEditBinding? = null
    private val binding get() = _binding!!
    
    private var selectedImageUri: Uri? = null

    private val pickImage = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            selectedImageUri = uri
            binding.ivFieldPhoto.load(uri) {
                 crossfade(true)
            }
            binding.ivFieldPhoto.setColorFilter(null) // Remove tint
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogFieldEditBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupUi()
        setupListeners()
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        return dialog
    }

    override fun onStart() {
        super.onStart()
        dialog?.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
    }

    private fun setupUi() {
        if (field != null) {
            binding.tvTitle.text = "Editar Quadra"
            binding.etName.setText(field.name)
            binding.actvType.setText(field.getTypeEnum().displayName, false)
            binding.actvSurface.setText(field.surface ?: "", false)
            binding.etPrice.setText(field.hourlyPrice.toString())
            binding.etDimensions.setText(field.dimensions ?: "")
            binding.switchCovered.isChecked = field.isCovered
            binding.switchActive.isChecked = field.isActive
            
            // Load existing photo
            if (!field.photos.isNullOrEmpty()) {
                val photoUrl = field.photos[0]
                binding.ivFieldPhoto.load(photoUrl) {
                    crossfade(true)
                    placeholder(android.R.drawable.ic_menu_gallery)
                    error(android.R.drawable.ic_menu_gallery)
                }
                binding.ivFieldPhoto.setColorFilter(null)
            }
        } else {
            binding.tvTitle.text = "Nova Quadra"
            binding.actvType.setText(defaultType.displayName, false)
        }
    }

    private fun setupListeners() {
        binding.btnAddPhoto.setOnClickListener {
             pickImage.launch("image/*")
        }

        binding.btnCancel.setOnClickListener {
            dismiss()
        }

        binding.btnSave.setOnClickListener {
            val name = binding.etName.text.toString()
            val priceStr = binding.etPrice.text.toString()
            val price = priceStr.toDoubleOrNull() ?: 0.0
            
            val typeStr = binding.actvType.text.toString()
            val type = FieldType.values().find { it.displayName.equals(typeStr, true) } ?: FieldType.SOCIETY
            
            val surface = binding.actvSurface.text.toString().takeIf { it.isNotBlank() }
            val dimensions = binding.etDimensions.text.toString().takeIf { it.isNotBlank() }
            val isCovered = binding.switchCovered.isChecked
            val isActive = binding.switchActive.isChecked

            if (name.isBlank()) {
                binding.tilName.error = "Nome obrigatório"
                return@setOnClickListener
            }

            onSave(name, type, price, isActive, selectedImageUri, surface, isCovered, dimensions)
            dismiss()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "FieldEditDialog"
    }
}
