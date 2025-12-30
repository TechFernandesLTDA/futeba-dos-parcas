package com.futebadosparcas.ui.payments

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import coil.load
import com.futebadosparcas.databinding.FragmentPaymentBottomSheetBinding
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

@AndroidEntryPoint
class PaymentBottomSheetFragment : BottomSheetDialogFragment() {

    private var _binding: FragmentPaymentBottomSheetBinding? = null
    private val binding get() = _binding!!

    private val viewModel: PaymentViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentPaymentBottomSheetBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val gameId = arguments?.getString("gameId") ?: return dismiss()
        val amount = arguments?.getDouble("amount") ?: 0.0

        binding.tvAmount.text = java.text.NumberFormat.getCurrencyInstance(java.util.Locale("pt", "BR")).format(amount)
        
        // Start payment generation immediately
        viewModel.startPayment(gameId, amount)

        setupListeners()
        observeViewModel()
    }
    
    private fun setupListeners() {
        binding.btnCopy.setOnClickListener {
            val pixCode = binding.etPixCode.text.toString()
            if (pixCode.isNotEmpty()) {
                val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("Pix Code", pixCode)
                clipboard.setPrimaryClip(clip)
                Toast.makeText(context, "Código Pix copiado!", Toast.LENGTH_SHORT).show()
                binding.btnConfirm.isEnabled = true
            }
        }

        binding.btnConfirm.setOnClickListener {
            val state = viewModel.uiState.value
            if (state is PaymentUiState.PixGenerated) {
                viewModel.confirmPayment(state.paymentId)
            }
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collectLatest { state ->
                when (state) {
                    is PaymentUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.btnConfirm.isEnabled = false
                    }
                    is PaymentUiState.PixGenerated -> {
                        binding.progressBar.visibility = View.GONE
                        binding.etPixCode.setText(state.pixCode)
                        binding.btnConfirm.isEnabled = true
                        
                        // Load QR Code
                        val qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${state.pixCode}"
                        binding.ivQrCode.load(qrUrl) {
                            crossfade(true)
                            placeholder(com.futebadosparcas.R.drawable.ic_launcher_foreground) // Using generic placeholder if id not found, but R is imported as futebadosparcas below
                            error(com.futebadosparcas.R.drawable.ic_launcher_foreground)
                        }
                    }
                    is PaymentUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        Toast.makeText(context, "Pagamento confirmado!", Toast.LENGTH_LONG).show()
                        dismiss()
                    }
                    is PaymentUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        Toast.makeText(context, state.message, Toast.LENGTH_LONG).show()
                        dismiss()
                    }
                    else -> {}
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        const val TAG = "PaymentBottomSheet"
        
        fun newInstance(gameId: String, amount: Double): PaymentBottomSheetFragment {
            val fragment = PaymentBottomSheetFragment()
            val args = Bundle()
            args.putString("gameId", gameId)
            args.putDouble("amount", amount)
            fragment.arguments = args
            return fragment
        }
    }
}
