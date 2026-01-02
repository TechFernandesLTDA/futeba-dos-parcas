package com.futebadosparcas.ui.groups.dialogs

import android.app.Dialog
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.widget.AdapterView
import android.widget.ArrayAdapter
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.DialogFragment
import com.futebadosparcas.data.model.CashboxCategory
import com.futebadosparcas.data.model.CashboxEntryType
import com.futebadosparcas.databinding.DialogAddCashboxEntryBinding
import com.google.android.material.dialog.MaterialAlertDialogBuilder

class AddCashboxEntryDialogFragment : DialogFragment() {

    private var _binding: DialogAddCashboxEntryBinding? = null
    private val binding get() = _binding!!

    private var type: CashboxEntryType = CashboxEntryType.INCOME
    private var onSaveListener: ((description: String, amount: Double, category: CashboxCategory, receiptUri: Uri?) -> Unit)? = null
    private var selectedReceiptUri: Uri? = null

    private val selectImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let {
            selectedReceiptUri = it
            updateReceiptUi()
        }
    }

    companion object {
        private const val ARG_TYPE = "arg_type"

        fun newInstance(type: CashboxEntryType): AddCashboxEntryDialogFragment {
            return AddCashboxEntryDialogFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_TYPE, type.name)
                }
            }
        }
    }

    fun setOnSaveListener(listener: (description: String, amount: Double, category: CashboxCategory, receiptUri: Uri?) -> Unit) {
        onSaveListener = listener
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        val typeName = arguments?.getString(ARG_TYPE)
        type = CashboxEntryType.fromString(typeName)

        _binding = DialogAddCashboxEntryBinding.inflate(LayoutInflater.from(context))

        setupSpinner()
        setupValidation()
        setupReceiptListeners()

        return MaterialAlertDialogBuilder(requireContext())
            .setTitle("Adicionar ${type.displayName}")
            .setView(binding.root)
            .setPositiveButton("Salvar", null)
            .setNegativeButton("Cancelar", null)
            .create()
            .apply {
                setOnShowListener { dialog ->
                    val button = (dialog as androidx.appcompat.app.AlertDialog).getButton(androidx.appcompat.app.AlertDialog.BUTTON_POSITIVE)
                    button.setOnClickListener {
                        if (validateAndSave()) {
                            dialog.dismiss()
                        }
                    }
                }
            }
    }

    private fun setupSpinner() {
        val categories = if (type == CashboxEntryType.INCOME) {
            CashboxCategory.getIncomeCategories()
        } else {
            CashboxCategory.getExpenseCategories()
        }

        val adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_item,
            categories.map { it.displayName }
        )
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        binding.spinnerCategory.adapter = adapter
    }

    private fun setupValidation() {
        binding.etDescription.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                binding.tilDescription.error = null
            }
            override fun afterTextChanged(s: Editable?) {}
        })

        binding.etAmount.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                binding.tilAmount.error = null
            }
            override fun afterTextChanged(s: Editable?) {}
        })
    }

    private fun setupReceiptListeners() {
        binding.cardReceipt.setOnClickListener {
            selectImageLauncher.launch("image/*")
        }

        binding.btnRemoveReceipt.setOnClickListener {
            selectedReceiptUri = null
            updateReceiptUi()
        }
    }

    private fun updateReceiptUi() {
        if (selectedReceiptUri != null) {
            binding.layoutAddReceipt.visibility = View.GONE
            binding.ivReceiptPreview.visibility = View.VISIBLE
            binding.btnRemoveReceipt.visibility = View.VISIBLE
            binding.ivReceiptPreview.setImageURI(selectedReceiptUri)
        } else {
            binding.layoutAddReceipt.visibility = View.VISIBLE
            binding.ivReceiptPreview.visibility = View.GONE
            binding.btnRemoveReceipt.visibility = View.GONE
        }
    }

    private fun validateAndSave(): Boolean {
        val description = binding.etDescription.text.toString().trim()
        val amountRaw = binding.etAmount.text.toString().trim()
        
        binding.tilDescription.error = null
        binding.tilAmount.error = null
        
        val amountStr = amountRaw.replace(",", ".")
        val amount = amountStr.toDoubleOrNull()
        
        val categories = if (type == CashboxEntryType.INCOME) {
            CashboxCategory.getIncomeCategories()
        } else {
            CashboxCategory.getExpenseCategories()
        }
        val selectedCategory = categories.getOrNull(binding.spinnerCategory.selectedItemPosition) ?: CashboxCategory.OTHER

        var isValid = true

        if (amountRaw.isEmpty()) {
            binding.tilAmount.error = "Campo obrigatório"
            isValid = false
        } else if (amount == null || amount <= 0) {
            binding.tilAmount.error = "Valor inválido"
            isValid = false
        }

        if (selectedCategory == CashboxCategory.OTHER && description.isEmpty()) {
            binding.tilDescription.error = "Descrição obrigatória para 'Outros'"
            isValid = false
        }

        if (isValid && amount != null) {
            onSaveListener?.invoke(description, amount, selectedCategory, selectedReceiptUri)
            return true
        }
        return false
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
