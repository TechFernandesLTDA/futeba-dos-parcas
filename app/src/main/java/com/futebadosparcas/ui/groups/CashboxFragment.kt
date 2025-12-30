package com.futebadosparcas.ui.groups

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.R
import com.futebadosparcas.data.model.CashboxEntry
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.databinding.FragmentCashboxBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.util.Locale

/**
 * Fragment para gerenciar o caixa do grupo (receitas e despesas)
 */
@AndroidEntryPoint
class CashboxFragment : Fragment() {

    private var _binding: FragmentCashboxBinding? = null
    private val binding get() = _binding!!

    private val viewModel: CashboxViewModel by viewModels()
    private val args: CashboxFragmentArgs by navArgs()
    private lateinit var adapter: CashboxEntriesAdapter

    private val currencyFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCashboxBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupToolbar()
        setupRecyclerView()
        setupListeners()
        observeViewModel()

        // Carrega dados do caixa
        viewModel.loadCashbox(args.groupId)
    }

    private fun setupToolbar() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }

        binding.toolbar.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                R.id.action_filter -> {
                    // TODO: Mostrar opções de filtro
                    Toast.makeText(requireContext(), "Filtros - Em breve", Toast.LENGTH_SHORT).show()
                    true
                }
                R.id.action_recalculate -> {
                    showRecalculateDialog()
                    true
                }
                R.id.action_report -> {
                    // TODO: Implementar relatório
                    Toast.makeText(requireContext(), "Relatório - Em breve", Toast.LENGTH_SHORT).show()
                    true
                }
                else -> false
            }
        }
    }

    private fun setupRecyclerView() {
        adapter = CashboxEntriesAdapter(
            onEntryClick = { entry ->
                showEntryDetails(entry)
            },
            onEntryLongClick = { entry ->
                showDeleteEntryDialog(entry)
            }
        )

        binding.rvHistory.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = this@CashboxFragment.adapter
        }
    }

    private fun setupListeners() {
        // Botão adicionar entrada
        binding.btnAddIncome.setOnClickListener {
            showAddEntryDialog(CashboxEntryType.INCOME)
        }

        // Botão adicionar saída
        binding.btnAddExpense.setOnClickListener {
            showAddEntryDialog(CashboxEntryType.EXPENSE)
        }

        // Filtros
        binding.chipAll.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                viewModel.clearFilter()
            }
        }

        binding.chipIncome.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                viewModel.filterByType(CashboxEntryType.INCOME)
            }
        }

        binding.chipExpense.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                viewModel.filterByType(CashboxEntryType.EXPENSE)
            }
        }
    }

    private fun observeViewModel() {
        // Observa resumo do caixa (saldo, total entradas, total saídas)
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.summaryState.collect { state ->
                when (state) {
                    is CashboxSummaryState.Loading -> {
                        // Pode mostrar shimmer no card de saldo
                    }
                    is CashboxSummaryState.Success -> {
                        val summary = state.summary
                        binding.tvBalance.text = summary.getFormattedBalance()
                        binding.tvTotalIncome.text = "+ ${currencyFormat.format(summary.totalIncome)}"
                        binding.tvTotalExpense.text = "- ${currencyFormat.format(summary.totalExpense)}"
                    }
                    is CashboxSummaryState.Error -> {
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_LONG).show()
                    }
                }
            }
        }

        // Observa histórico de entradas
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.historyState.collect { state ->
                binding.progressBar.visibility = View.GONE

                when (state) {
                    is CashboxHistoryState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.tvEmptyHistory.visibility = View.GONE
                        binding.rvHistory.visibility = View.GONE
                    }
                    is CashboxHistoryState.Empty -> {
                        binding.tvEmptyHistory.visibility = View.VISIBLE
                        binding.rvHistory.visibility = View.GONE
                    }
                    is CashboxHistoryState.Success -> {
                        binding.tvEmptyHistory.visibility = View.GONE
                        binding.rvHistory.visibility = View.VISIBLE
                        adapter.submitList(state.entries)
                    }
                    is CashboxHistoryState.Error -> {
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_LONG).show()
                    }
                }
            }
        }

        // Observa ações (adicionar, remover, etc)
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.actionState.collect { state ->
                when (state) {
                    is CashboxActionState.Loading -> {
                        // Mostrar loading
                    }
                    is CashboxActionState.Success -> {
                        showSnackbar(state.message)
                        viewModel.resetActionState()
                    }
                    is CashboxActionState.Error -> {
                        Snackbar.make(binding.root, state.message, Snackbar.LENGTH_LONG).show()
                        viewModel.resetActionState()
                    }
                    is CashboxActionState.TotalsByCategory -> {
                        // Pode mostrar dialog com totais por categoria
                    }
                    is CashboxActionState.TotalsByPlayer -> {
                        // Pode mostrar dialog com totais por jogador
                    }
                    is CashboxActionState.Idle -> {}
                }
            }
        }

        // Observa papel do usuário para ajustar UI
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.userRole.collect { role ->
                val canManage = role == com.futebadosparcas.data.model.GroupMemberRole.ADMIN || 
                                role == com.futebadosparcas.data.model.GroupMemberRole.OWNER
                
                binding.btnAddIncome.visibility = if (canManage) View.VISIBLE else View.GONE
                binding.btnAddExpense.visibility = if (canManage) View.VISIBLE else View.GONE
                
                // Opções de menu (como recalcular) também podem ser restritas
                binding.toolbar.menu.findItem(R.id.action_recalculate)?.isVisible = canManage
            }
        }
    }

    private fun showSnackbar(message: String) {
        Snackbar.make(binding.root, message, Snackbar.LENGTH_SHORT).show()
    }

    private fun showAddEntryDialog(type: CashboxEntryType) {
        val dialog = com.futebadosparcas.ui.groups.dialogs.AddCashboxEntryDialogFragment.newInstance(type)
        dialog.setOnSaveListener { description, amount, category ->
            if (type == CashboxEntryType.INCOME) {
                viewModel.addIncome(category, amount, description)
            } else {
                viewModel.addExpense(category, amount, description)
            }
        }
        dialog.show(childFragmentManager, "AddCashboxEntryDialog")
    }

    private fun showEntryDetails(entry: CashboxEntry) {
        val message = buildString {
            append("Descrição: ${entry.description}\n")
            append("Categoria: ${entry.getCategoryEnum().displayName}\n")
            append("Valor: ${currencyFormat.format(entry.amount)}\n")
            if (!entry.playerName.isNullOrEmpty()) {
                append("Jogador: ${entry.playerName}\n")
            }
            if (entry.status == "VOIDED") {
                 append("\n[ESTORNADO/CANCELADO]")
            }
        }

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Detalhes da Entrada")
            .setMessage(message)
            .setPositiveButton("OK", null)
            .show()
    }

    private fun showDeleteEntryDialog(entry: CashboxEntry) {
        if (viewModel.userRole.value != com.futebadosparcas.data.model.GroupMemberRole.OWNER) {
            showSnackbar("Apenas o dono do grupo pode estornar entradas")
            return
        }

        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Estornar Entrada")
            .setMessage("Deseja realmente estornar esta entrada? Esta ação não pode ser desfeita.")
            .setPositiveButton("Estornar") { _, _ ->
                viewModel.deleteEntry(entry.id)
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun showRecalculateDialog() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Recalcular Saldo")
            .setMessage("Isso irá recalcular o saldo com base em todas as entradas e saídas. Continuar?")
            .setPositiveButton("Recalcular") { _, _ ->
                viewModel.recalculateBalance()
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
