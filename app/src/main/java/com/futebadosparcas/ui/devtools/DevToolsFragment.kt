package com.futebadosparcas.ui.devtools

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.databinding.FragmentDevToolsBinding
import com.futebadosparcas.ui.auth.LoginActivity
import com.futebadosparcas.util.PreferencesManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class DevToolsFragment : Fragment() {

    private var _binding: FragmentDevToolsBinding? = null
    private val binding get() = _binding!!

    @Inject
    lateinit var preferencesManager: PreferencesManager

    @Inject
    lateinit var gameDao: GameDao

    @Inject
    lateinit var locationRepository: com.futebadosparcas.data.repository.LocationRepository

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDevToolsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        (activity as? AppCompatActivity)?.supportActionBar?.apply {
            title = "Ferramentas de Desenvolvedor"
            setDisplayHomeAsUpEnabled(true)
        }

        setupViews()
        setupClickListeners()
    }

    private fun setupViews() {
        val isMockMode = preferencesManager.isMockModeEnabled()
        binding.switchMockData.isChecked = isMockMode
        binding.tvCurrentMode.text = if (isMockMode) {
            "Modo atual: Dados Mockados (FakeRepository)"
        } else {
            "Modo atual: Firebase Real"
        }
    }

    private fun setupClickListeners() {
        binding.switchMockData.setOnCheckedChangeListener { _, isChecked ->
            preferencesManager.setMockModeEnabled(isChecked)
            binding.tvCurrentMode.text = if (isChecked) {
                "Modo atual: Dados Mockados (FakeRepository)"
            } else {
                "Modo atual: Firebase Real"
            }
            Toast.makeText(
                requireContext(),
                "Modo alterado. Reinicie o app para aplicar.",
                Toast.LENGTH_LONG
            ).show()
        }

        binding.btnClearLocalCache.setOnClickListener {
            viewLifecycleOwner.lifecycleScope.launch {
                try {
                    gameDao.clearAll()
                    Toast.makeText(requireContext(), "Cache local limpo!", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    Toast.makeText(requireContext(), "Erro: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
        
        // Hooking into a "secret" long click on "Restart App" or similar to seed if I don't want to edit XML?
        // Or just straightforwardly add a button if I edit XML.
        // Let's Edit XML first to be clean.
        // But for now, I'll add the logic waiting for the ID `btnSeedLocations`. 
        // If I don't add the button in XML, this won't compile if Binding doesn't see it.
        // So I'll add the button in XML in the next step.
        
        binding.btnRestartApp.setOnClickListener {
            restartApp()
        }
        
        binding.btnSeedLocations.setOnClickListener {
            binding.btnSeedLocations.isEnabled = false
            binding.btnSeedLocations.text = "Populando..."
            
            viewLifecycleOwner.lifecycleScope.launch {
                Toast.makeText(requireContext(), "Iniciando seed de locais...", Toast.LENGTH_SHORT).show()
                val result = locationRepository.seedCuritibaLocations()
                
                binding.btnSeedLocations.isEnabled = true
                binding.btnSeedLocations.text = "Popular 50 Locais (Curitiba/PR)"
                
                result.fold(
                    onSuccess = { count ->
                        val message = if (count > 0) "Sucesso! $count novos locais adicionados." else "Nenhum novo local. Todos já existem."
                        Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
                    },
                    onFailure = { e ->
                        Toast.makeText(requireContext(), "Erro: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                )
            }
        }

        binding.btnClearPreferences.setOnClickListener {
            preferencesManager.clearAll()
            setupViews() // Atualiza a UI
            Toast.makeText(requireContext(), "Preferencias resetadas!", Toast.LENGTH_SHORT).show()
        }
    }

    private fun restartApp() {
        val intent = Intent(requireContext(), LoginActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        startActivity(intent)
        activity?.finish()
        // Forca reinicio do processo para Hilt reinjetar os repositorios
        Runtime.getRuntime().exit(0)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
