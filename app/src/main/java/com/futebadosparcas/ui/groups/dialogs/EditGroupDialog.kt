package com.futebadosparcas.ui.groups.dialogs

import android.net.Uri
import android.os.Bundle
import android.app.Dialog
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.DialogFragment
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.databinding.DialogEditGroupBinding
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import java.io.File

/**
 * Bottom sheet dialog para editar informações do grupo
 */
class EditGroupDialog : BottomSheetDialogFragment() {

    private var _binding: DialogEditGroupBinding? = null
    private val binding get() = _binding!!

    private var group: Group? = null
    private var selectedPhotoUri: Uri? = null
    private var tempCameraUri: Uri? = null
    private var onSaveListener: ((name: String, description: String, photoUri: Uri?) -> Unit)? = null

    companion object {
        private const val ARG_GROUP_NAME = "group_name"
        private const val ARG_GROUP_DESCRIPTION = "group_description"
        private const val ARG_GROUP_PHOTO_URL = "group_photo_url"

        fun newInstance(group: Group): EditGroupDialog {
            return EditGroupDialog().apply {
                arguments = Bundle().apply {
                    putString(ARG_GROUP_NAME, group.name)
                    putString(ARG_GROUP_DESCRIPTION, group.description)
                    putString(ARG_GROUP_PHOTO_URL, group.photoUrl)
                }
            }
        }
    }

    // Launcher para galeria
    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            selectedPhotoUri = it
            updatePhotoPreview()
            updateSaveButtonState()
        }
    }

    // Launcher para camera
    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            selectedPhotoUri = tempCameraUri
            updatePhotoPreview()
            updateSaveButtonState()
        }
    }

    fun setOnSaveListener(listener: (name: String, description: String, photoUri: Uri?) -> Unit) {
        onSaveListener = listener
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setStyle(DialogFragment.STYLE_NORMAL, R.style.Theme_FutebaDosParças_BottomSheetDialog)
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = DialogEditGroupBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val dialog = super.onCreateDialog(savedInstanceState) as BottomSheetDialog
        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<FrameLayout>(com.google.android.material.R.id.design_bottom_sheet)
            bottomSheet?.let {
                val behavior = BottomSheetBehavior.from(it)
                behavior.state = BottomSheetBehavior.STATE_EXPANDED
                behavior.skipCollapsed = true
            }
        }
        return dialog
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Preencher campos com dados existentes
        val name = arguments?.getString(ARG_GROUP_NAME) ?: ""
        val description = arguments?.getString(ARG_GROUP_DESCRIPTION) ?: ""
        val photoUrl = arguments?.getString(ARG_GROUP_PHOTO_URL)

        binding.etGroupName.setText(name)
        binding.etGroupDescription.setText(description)

        if (!photoUrl.isNullOrEmpty()) {
            binding.ivGroupPhoto.load(photoUrl) {
                crossfade(true)
                placeholder(R.drawable.ic_groups)
                error(R.drawable.ic_groups)
                transformations(CircleCropTransformation())
            }
        }

        setupListeners()
        updateSaveButtonState()
    }

    private fun setupListeners() {
        binding.btnClose.setOnClickListener {
            dismiss()
        }

        binding.etGroupName.doAfterTextChanged {
            validateName()
            updateSaveButtonState()
        }

        binding.etGroupDescription.doAfterTextChanged {
            binding.tilGroupDescription.error = null
            updateSaveButtonState()
        }

        binding.btnAddPhoto.setOnClickListener {
            showPhotoOptionsDialog()
        }

        binding.ivGroupPhoto.setOnClickListener {
            showPhotoOptionsDialog()
        }

        binding.btnSave.setOnClickListener {
            if (validateInput()) {
                val name = binding.etGroupName.text.toString().trim()
                val description = binding.etGroupDescription.text.toString().trim()
                onSaveListener?.invoke(name, description, selectedPhotoUri)
                dismiss()
            }
        }
    }

    private fun showPhotoOptionsDialog() {
        val options = arrayOf("Tirar foto", "Escolher da galeria")

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Foto do grupo")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> openCamera()
                    1 -> openGallery()
                }
            }
            .show()
    }

    private fun openCamera() {
        try {
            val photoFile = File.createTempFile(
                "group_photo_edit_",
                ".jpg",
                requireContext().cacheDir
            )
            tempCameraUri = FileProvider.getUriForFile(
                requireContext(),
                "${requireContext().packageName}.provider",
                photoFile
            )
            takePictureLauncher.launch(tempCameraUri)
        } catch (e: Exception) {
            Snackbar.make(binding.root, "Erro ao abrir camera", Snackbar.LENGTH_SHORT).show()
        }
    }

    private fun openGallery() {
        pickImageLauncher.launch("image/*")
    }

    private fun updatePhotoPreview() {
        selectedPhotoUri?.let { uri ->
            binding.ivGroupPhoto.load(uri) {
                crossfade(true)
                placeholder(R.drawable.ic_groups)
                error(R.drawable.ic_groups)
                transformations(CircleCropTransformation())
            }
            binding.btnAddPhoto.text = "Alterar foto"
        }
    }

    private fun validateName(): Boolean {
        val name = binding.etGroupName.text.toString().trim()

        return when {
            name.isEmpty() -> {
                binding.tilGroupName.error = "Nome é obrigatório"
                false
            }
            name.length < 3 -> {
                binding.tilGroupName.error = "Nome deve ter pelo menos 3 caracteres"
                false
            }
            name.length > 50 -> {
                binding.tilGroupName.error = "Nome deve ter no máximo 50 caracteres"
                false
            }
            !name.matches(Regex("^[\\p{L}\\p{N}\\s\\-_']+$")) -> {
                binding.tilGroupName.error = "Nome contém caracteres inválidos"
                false
            }
            else -> {
                binding.tilGroupName.error = null
                true
            }
        }
    }

    private fun validateDescription(): Boolean {
        val description = binding.etGroupDescription.text.toString().trim()
        return when {
            description.length > 200 -> {
                binding.tilGroupDescription.error = "Descrição deve ter no máximo 200 caracteres"
                false
            }
            else -> {
                binding.tilGroupDescription.error = null
                true
            }
        }
    }

    private fun validateInput(): Boolean {
        val isNameValid = validateName()
        val isDescriptionValid = validateDescription()
        return isNameValid && isDescriptionValid
    }

    private fun updateSaveButtonState() {
        val name = binding.etGroupName.text.toString().trim()
        val originalName = arguments?.getString(ARG_GROUP_NAME) ?: ""
        val originalDescription = arguments?.getString(ARG_GROUP_DESCRIPTION) ?: ""
        val description = binding.etGroupDescription.text.toString().trim()

        // Habilitar botão apenas se houve mudança e o nome é válido
        val hasChanges = name != originalName || description != originalDescription || selectedPhotoUri != null
        val isValid = name.length >= 3 && name.length <= 50

        binding.btnSave.isEnabled = hasChanges && isValid
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
