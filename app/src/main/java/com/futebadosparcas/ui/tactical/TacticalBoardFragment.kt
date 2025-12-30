package com.futebadosparcas.ui.tactical

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.content.FileProvider
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.databinding.FragmentTacticalBoardBinding
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class TacticalBoardFragment : Fragment() {

    private var _binding: FragmentTacticalBoardBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTacticalBoardBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupListeners()
    }

    private fun setupListeners() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }

        binding.btnColorRed.setOnClickListener {
            binding.tacticalBoardView.setColor(Color.RED)
        }

        binding.btnColorBlue.setOnClickListener {
            binding.tacticalBoardView.setColor(Color.BLUE)
        }

        binding.btnColorBlack.setOnClickListener {
            binding.tacticalBoardView.setColor(Color.BLACK)
        }

        binding.btnClear.setOnClickListener {
            binding.tacticalBoardView.clear()
        }

        binding.btnShare.setOnClickListener {
            shareBoard()
        }
    }

    private fun shareBoard() {
        val file = binding.tacticalBoardView.saveBoard()
        if (file != null) {
            try {
                val uri = FileProvider.getUriForFile(
                    requireContext(),
                    "${requireContext().packageName}.fileprovider",
                    file
                )

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/jpeg"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                startActivity(Intent.createChooser(intent, "Compartilhar Tática"))
            } catch (e: Exception) {
                Toast.makeText(requireContext(), "Erro ao compartilhar: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(requireContext(), "Erro ao salvar imagem", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
