package com.futebadosparcas.ui.profile

import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import coil.load
import com.futebadosparcas.R
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.databinding.FragmentEditProfileBinding
import com.futebadosparcas.util.PreferencesManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class EditProfileFragment : Fragment() {

    private var _binding: FragmentEditProfileBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ProfileViewModel by viewModels()

    private var selectedImageUri: Uri? = null

    @Inject
    lateinit var preferencesManager: PreferencesManager

    private var devModeClickCount = 0
    private var firstPhotoClickTime = 0L
    private var isUploadingPhoto = false

    private val selectImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            // Validar tamanho da imagem
            if (isImageSizeValid(it)) {
                selectedImageUri = it
                binding.ivProfile.setImageURI(it)
                Toast.makeText(
                    requireContext(),
                    "Imagem selecionada com sucesso",
                    Toast.LENGTH_SHORT
                ).show()
            } else {
                Toast.makeText(
                    requireContext(),
                    "Imagem muito grande. Tamanho máximo: 10 MB",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentEditProfileBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupClickListeners()
        observeViewModel()
        viewModel.loadProfile()
    }

    private fun setupClickListeners() {
        // Toolbar voltar
        binding.toolbar.setNavigationOnClickListener {
            findNavController().navigateUp()
        }

        // Card de foto clicável - abre seletor de imagens
        // E mantém o easter egg de dev mode (5 cliques em 2 segundos)
        binding.cardPhotoContainer.setOnClickListener {
            val currentTime = System.currentTimeMillis()

            // Reset se passou mais de 2 segundos desde o primeiro clique da sequência
            if (currentTime - firstPhotoClickTime > 2000) {
                devModeClickCount = 0
            }

            // Se é o primeiro clique da sequência, anota o tempo
            if (devModeClickCount == 0) {
                firstPhotoClickTime = currentTime
            }

            devModeClickCount++

            // Se atingiu 5 cliques em menos de 2 segundos, ativa dev mode
            if (devModeClickCount >= 5) {
                preferencesManager.setDevModeEnabled(true)
                Toast.makeText(requireContext(), "Opções de desenvolvedor ativadas", Toast.LENGTH_SHORT).show()
                devModeClickCount = 0
                firstPhotoClickTime = 0
            } else {
                // Caso contrário, abre seletor de foto
                selectImageLauncher.launch("image/*")
            }
        }

        // Botão Salvar (agora no final do formulário)
        binding.btnConfirm.setOnClickListener {
            confirmProfileChanges()
        }
    }

    private fun isImageSizeValid(uri: Uri): Boolean {
        return try {
            val cursor = requireContext().contentResolver.query(uri, null, null, null, null)
            cursor?.use {
                val sizeIndex = it.getColumnIndex(android.provider.OpenableColumns.SIZE)
                it.moveToFirst()
                val sizeInBytes = it.getLong(sizeIndex)
                val sizeInMB = sizeInBytes / (1024 * 1024)
                sizeInMB <= 10 // Máximo de 10 MB
            } ?: false
        } catch (e: Exception) {
            true // Se não conseguir obter tamanho, permite o upload
        }
    }

    private fun confirmProfileChanges() {
        val name = binding.etName.text.toString()
        val nickname = binding.etNickname.text.toString()
        val preferredFieldTypes = mutableListOf<FieldType>()
        if (binding.cbSociety.isChecked) preferredFieldTypes.add(FieldType.SOCIETY)
        if (binding.cbFutsal.isChecked) preferredFieldTypes.add(FieldType.FUTSAL)
        if (binding.cbField.isChecked) preferredFieldTypes.add(FieldType.CAMPO)

        if (name.isNotBlank() && preferredFieldTypes.isNotEmpty()) {
            if (selectedImageUri != null) {
                isUploadingPhoto = true
            }

            val striker = binding.sliderStriker.value.toDouble()
            val mid = binding.sliderMid.value.toDouble()
            val def = binding.sliderDefender.value.toDouble()
            val gk = binding.sliderGk.value.toDouble()

            viewModel.updateProfile(name, nickname, preferredFieldTypes, selectedImageUri, striker, mid, def, gk)
        } else {
            Toast.makeText(requireContext(), "Preencha o nome e selecione ao menos um tipo de campo", Toast.LENGTH_SHORT).show()
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is ProfileUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        // Animar card durante upload
                        if (isUploadingPhoto) {
                            animatePhotoUpload()
                            binding.uploadProgress.visibility = View.VISIBLE
                        }
                    }
                    is ProfileUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        isUploadingPhoto = false
                        binding.cardPhotoContainer.alpha = 1.0f
                        binding.uploadProgress.visibility = View.GONE
                        binding.etName.setText(state.user.name)
                        binding.etNickname.setText(state.user.nickname)
                        state.user.photoUrl?.let {
                            binding.ivProfile.load(it) {
                                crossfade(true)
                                placeholder(R.drawable.ic_launcher_foreground)
                            }
                        }

                        binding.sliderStriker.value = kotlin.math.round(state.user.strikerRating).toFloat()
                        binding.sliderMid.value = kotlin.math.round(state.user.midRating).toFloat()
                        binding.sliderDefender.value = kotlin.math.round(state.user.defenderRating).toFloat()
                        binding.sliderGk.value = kotlin.math.round(state.user.gkRating).toFloat()

                        binding.cbSociety.isChecked = false
                        binding.cbFutsal.isChecked = false
                        binding.cbField.isChecked = false

                        state.user.preferredFieldTypes.forEach { fieldType ->
                            when (fieldType) {
                                FieldType.SOCIETY -> binding.cbSociety.isChecked = true
                                FieldType.FUTSAL -> binding.cbFutsal.isChecked = true
                                FieldType.CAMPO -> binding.cbField.isChecked = true
                                else -> {}
                            }
                        }
                    }
                    is ProfileUiState.ProfileUpdateSuccess -> {
                        binding.progressBar.visibility = View.GONE
                        isUploadingPhoto = false
                        binding.cardPhotoContainer.alpha = 1.0f
                        binding.uploadProgress.visibility = View.GONE

                        // Recarregar a foto atualizada - adiciona timestamp para forçar novo fetch
                        state.user.photoUrl?.let { url ->
                            // Adiciona timestamp à URL para evitar cache em cloudflare/cdn
                            val urlWithTimestamp = if (url.contains("?")) {
                                "$url&ts=${System.currentTimeMillis()}"
                            } else {
                                "$url?ts=${System.currentTimeMillis()}"
                            }
                            binding.ivProfile.load(urlWithTimestamp) {
                                crossfade(true)
                                placeholder(R.drawable.ic_launcher_foreground)
                            }
                        }

                        Toast.makeText(requireContext(), "Perfil atualizado com sucesso!", Toast.LENGTH_SHORT).show()
                        findNavController().popBackStack()
                    }
                    is ProfileUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        isUploadingPhoto = false
                        binding.cardPhotoContainer.alpha = 1.0f
                        binding.uploadProgress.visibility = View.GONE
                        Toast.makeText(requireContext(), state.message, Toast.LENGTH_SHORT).show()
                    }
                    else -> {}
                }
            }
        }
    }

    private fun animatePhotoUpload() {
        val animation = android.animation.ObjectAnimator.ofFloat(
            binding.cardPhotoContainer,
            "alpha",
            1.0f,
            0.6f,
            1.0f
        ).apply {
            duration = 600
            repeatCount = android.animation.ValueAnimator.INFINITE
            repeatMode = android.animation.ValueAnimator.RESTART
        }
        animation.start()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
