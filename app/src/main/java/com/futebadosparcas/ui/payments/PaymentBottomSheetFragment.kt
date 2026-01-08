package com.futebadosparcas.ui.payments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.fragment.app.viewModels
import com.futebadosparcas.ui.theme.FutebaTheme
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import dagger.hilt.android.AndroidEntryPoint

/**
 * PaymentBottomSheetFragment - Wrapper para PaymentBottomSheet Compose
 * Mantido para compatibilidade com navegação XML
 */
@AndroidEntryPoint
class PaymentBottomSheetFragment : BottomSheetDialogFragment() {

    private val viewModel: PaymentViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        val gameId = arguments?.getString("gameId") ?: ""
        val amount = arguments?.getDouble("amount") ?: 0.0

        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    PaymentBottomSheet(
                        viewModel = viewModel,
                        gameId = gameId,
                        amount = amount,
                        onDismiss = { dismiss() }
                    )
                }
            }
        }
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
