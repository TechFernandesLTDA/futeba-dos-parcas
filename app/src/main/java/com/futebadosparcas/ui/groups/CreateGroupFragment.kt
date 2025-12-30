package com.futebadosparcas.ui.groups

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.R
import com.futebadosparcas.databinding.FragmentCreateGroupBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.io.File

@AndroidEntryPoint
class CreateGroupFragment : Fragment() {

    private var _binding: FragmentCreateGroupBinding? = null
    private val binding get() = _binding!!

    private val viewModel: GroupsViewModel by viewModels()

    private var selectedPhotoUri: Uri? = null
    private var tempCameraUri: Uri? = null

    // Launcher para galeria
    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            selectedPhotoUri = it
            updatePhotoPreview()
        }
    }

    // Launcher para camera
    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            selectedPhotoUri = tempCameraUri
            updatePhotoPreview()
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCreateGroupBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupToolbar()
        setupListeners()
        setupValidation()
        observeViewModel()
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }
    }

    private fun setupListeners() {
        binding.btnCreateGroup.setOnClickListener {
            val name = binding.etGroupName.text.toString().trim()
            val description = binding.etGroupDescription.text.toString().trim()

            if (validateInput(name)) {
                viewModel.createGroup(name, description, selectedPhotoUri)
            }
        }

        binding.ivGroupPhoto.setOnClickListener {
            showPhotoOptionsDialog()
        }

        binding.btnAddPhoto.setOnClickListener {
            showPhotoOptionsDialog()
        }
    }

    private fun setupValidation() {
        binding.etGroupName.doAfterTextChanged { text ->
            val name = text?.toString()?.trim() ?: ""
            when {
                name.isEmpty() -> {
                    binding.tilGroupName.error = null
                }
                name.length < 3 -> {
                    binding.tilGroupName.error = "Nome deve ter pelo menos 3 caracteres"
                }
                name.length > 50 -> {
                    binding.tilGroupName.error = "Nome deve ter no maximo 50 caracteres"
                }
                !name.matches(Regex("^[\\p{L}\\p{N}\\s\\-_']+$")) -> {
                    binding.tilGroupName.error = "Nome contem caracteres invalidos"
                }
                else -> {
                    binding.tilGroupName.error = null
                }
            }
            updateCreateButtonState()
        }

        binding.etGroupDescription.doAfterTextChanged {
            updateCreateButtonState()
        }
    }

    private fun updateCreateButtonState() {
        val name = binding.etGroupName.text.toString().trim()
        val isValid = name.length >= 3 && name.length <= 50 && binding.tilGroupName.error == null
        binding.btnCreateGroup.isEnabled = isValid
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
                "group_photo_",
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

    private fun validateInput(name: String): Boolean {
        var isValid = true

        if (name.isEmpty()) {
            binding.tilGroupName.error = "Nome e obrigatorio"
            isValid = false
        } else if (name.length < 3) {
            binding.tilGroupName.error = "Nome deve ter pelo menos 3 caracteres"
            isValid = false
        } else if (name.length > 50) {
            binding.tilGroupName.error = "Nome deve ter no maximo 50 caracteres"
            isValid = false
        } else if (!name.matches(Regex("^[\\p{L}\\p{N}\\s\\-_']+$"))) {
            binding.tilGroupName.error = "Nome contem caracteres invalidos"
            isValid = false
        } else {
            binding.tilGroupName.error = null
        }

        return isValid
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.createGroupState.collect { state ->
                when (state) {
                    is CreateGroupUiState.Idle -> {
                        binding.progressBar.visibility = View.GONE
                        updateCreateButtonState()
                    }
                    is CreateGroupUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.btnCreateGroup.isEnabled = false
                    }
                    is CreateGroupUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        Snackbar.make(binding.root, "Grupo criado com sucesso!", Snackbar.LENGTH_SHORT).show()
                        viewModel.resetCreateGroupState()

                        // Navigate to group detail
                        val action = CreateGroupFragmentDirections
                            .actionCreateGroupFragmentToGroupDetailFragment(state.group.id)
                        findNavController().navigate(action)
                    }
                    is CreateGroupUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        updateCreateButtonState()
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_LONG).show()
                        viewModel.resetCreateGroupState()
                    }
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
