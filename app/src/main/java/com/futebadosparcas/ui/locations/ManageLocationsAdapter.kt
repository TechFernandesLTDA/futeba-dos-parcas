package com.futebadosparcas.ui.locations

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.databinding.ItemManageLocationBinding

class ManageLocationsAdapter(
    private val onEditClick: (LocationWithFieldsData) -> Unit,
    private val onDeleteLocationClick: (LocationWithFieldsData) -> Unit,
    private val onDeleteFieldClick: (Field) -> Unit
) : ListAdapter<LocationWithFieldsData, ManageLocationsAdapter.LocationViewHolder>(LocationDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LocationViewHolder {
        val binding = ItemManageLocationBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return LocationViewHolder(binding, onEditClick, onDeleteLocationClick, onDeleteFieldClick)
    }

    override fun onBindViewHolder(holder: LocationViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class LocationViewHolder(
        private val binding: ItemManageLocationBinding,
        private val onEditClick: (LocationWithFieldsData) -> Unit,
        private val onDeleteLocationClick: (LocationWithFieldsData) -> Unit,
        private val onDeleteFieldClick: (Field) -> Unit
    ) : RecyclerView.ViewHolder(binding.root) {

        private var isExpanded = false
        private val fieldsAdapter = ManageFieldsAdapter(onDeleteFieldClick)

        init {
            binding.rvFields.apply {
                layoutManager = LinearLayoutManager(context)
                adapter = fieldsAdapter
            }
        }

        fun bind(data: LocationWithFieldsData) {
            val location = data.location
            val fields = data.fields

            // Nome e endereço
            binding.tvLocationName.text = location.name
            binding.tvLocationNeighborhood.text = buildString {
                append(location.neighborhood)
                if (location.region.isNotEmpty()) {
                    append(" • ")
                    append(location.region)
                }
            }
            binding.tvLocationAddress.text = location.address

            // Chips
            binding.chipFieldCount.text = "${fields.size} quadra${if (fields.size != 1) "s" else ""}"
            
            if (!location.phone.isNullOrEmpty()) {
                binding.chipPhone.visibility = View.VISIBLE
                binding.chipPhone.text = location.phone
            } else {
                binding.chipPhone.visibility = View.GONE
            }

            // Botões
            binding.btnEditLocation.setOnClickListener {
                onEditClick(data)
            }

            binding.btnDeleteLocation.setOnClickListener {
                onDeleteLocationClick(data)
            }

            // Toggle quadras
            binding.btnToggleFields.setOnClickListener {
                isExpanded = !isExpanded
                updateExpansion()
            }

            // Configurar lista de quadras
            fieldsAdapter.submitList(fields)
            
            // Estado inicial
            isExpanded = false
            updateExpansion()
        }

        private fun updateExpansion() {
            if (isExpanded) {
                binding.rvFields.visibility = View.VISIBLE
                binding.divider.visibility = View.VISIBLE
                binding.btnToggleFields.text = "Ocultar quadras"
                binding.btnToggleFields.setIconResource(R.drawable.ic_expand_less)
            } else {
                binding.rvFields.visibility = View.GONE
                binding.divider.visibility = View.GONE
                binding.btnToggleFields.text = "Ver quadras"
                binding.btnToggleFields.setIconResource(R.drawable.ic_expand_more)
            }
        }
    }

    private class LocationDiffCallback : DiffUtil.ItemCallback<LocationWithFieldsData>() {
        override fun areItemsTheSame(
            oldItem: LocationWithFieldsData,
            newItem: LocationWithFieldsData
        ): Boolean {
            return oldItem.location.id == newItem.location.id
        }

        override fun areContentsTheSame(
            oldItem: LocationWithFieldsData,
            newItem: LocationWithFieldsData
        ): Boolean {
            return oldItem == newItem
        }
    }
}
