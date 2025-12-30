package com.futebadosparcas.ui.groups.dialogs

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.fragment.app.DialogFragment
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.databinding.DialogTransferOwnershipBinding
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.bottomsheet.BottomSheetDialogFragment

/**
 * Bottom sheet dialog para selecionar novo dono do grupo
 */
class TransferOwnershipDialog : BottomSheetDialogFragment() {

    private var _binding: DialogTransferOwnershipBinding? = null
    private val binding get() = _binding!!

    private var members: List<GroupMember> = emptyList()
    private var onMemberSelected: ((GroupMember) -> Unit)? = null

    companion object {
        fun newInstance(): TransferOwnershipDialog {
            return TransferOwnershipDialog()
        }
    }

    fun setMembers(membersList: List<GroupMember>) {
        // Filtrar apenas membros que não são owners
        members = membersList.filter { it.getRoleEnum() != GroupMemberRole.OWNER }
    }

    fun setOnMemberSelectedListener(listener: (GroupMember) -> Unit) {
        onMemberSelected = listener
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
        _binding = DialogTransferOwnershipBinding.inflate(inflater, container, false)
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

        binding.btnClose.setOnClickListener {
            dismiss()
        }

        setupRecyclerView()
    }

    private fun setupRecyclerView() {
        val adapter = TransferOwnershipAdapter { member ->
            // Mostrar confirmação antes de transferir
            ConfirmationDialogs.showTransferOwnershipDialog(
                context = requireContext(),
                memberName = member.getDisplayName()
            ) {
                onMemberSelected?.invoke(member)
                dismiss()
            }
        }

        binding.rvMembers.layoutManager = LinearLayoutManager(requireContext())
        binding.rvMembers.adapter = adapter

        if (members.isEmpty()) {
            binding.tvEmptyMessage.visibility = View.VISIBLE
            binding.rvMembers.visibility = View.GONE
        } else {
            binding.tvEmptyMessage.visibility = View.GONE
            binding.rvMembers.visibility = View.VISIBLE
            adapter.submitList(members)
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
