package com.futebadosparcas.ui.games

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.databinding.ItemLocationBinding

class LocationAdapter(
    private val onLocationClick: (Location) -> Unit
) : ListAdapter<Location, LocationAdapter.ViewHolder>(LocationDiffCallback()) {

    private var selectedLocationId: String? = null

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemLocationBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    fun setSelectedLocation(locationId: String?) {
        val previousSelected = selectedLocationId
        selectedLocationId = locationId

        // Notify changes for the previously selected item and the new one
        // Using distinct loop to avoid issues
        val positionsToUpdate = mutableListOf<Int>()
        currentList.forEachIndexed { index, location ->
            // Validar que IDs não sejam vazios antes de comparar
            if (!location.id.isNullOrEmpty() && 
                (location.id == previousSelected || location.id == locationId)) {
                positionsToUpdate.add(index)
            }
        }
        positionsToUpdate.forEach { notifyItemChanged(it) }
    }

    inner class ViewHolder(
        private val binding: ItemLocationBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(location: Location) {
            binding.tvLocationName.text = location.name
            binding.tvLocationAddress.text = location.getFullAddress()

            // Mostrar badge verificado
            binding.ivVerified.visibility = if (location.isVerified) View.VISIBLE else View.GONE

            // Destacar se selecionado
            val isSelected = location.id == selectedLocationId

            // Importante: setar isChecked DEPOIS de configurar os listeners
            // para evitar trigger de checked state em todos os items
            binding.cardLocation.strokeWidth = if (isSelected) 4 else 1
            binding.cardLocation.strokeColor = if (isSelected) {
                binding.root.context.getColor(R.color.primary)
            } else {
                binding.root.context.getColor(R.color.divider)
            }

            // Background color apenas para o selecionado
            if (isSelected) {
                binding.cardLocation.setCardBackgroundColor(
                    binding.root.context.getColor(R.color.primary_container)
                )
            } else {
                binding.cardLocation.setCardBackgroundColor(
                    binding.root.context.getColor(android.R.color.transparent)
                )
            }

            // Click listener no card para melhor feedback
            binding.cardLocation.setOnClickListener {
                android.util.Log.d("LocationAdapter", "Clicou em: ${location.name} (${location.id})")
                onLocationClick(location)
            }
        }
    }
}

class LocationDiffCallback : DiffUtil.ItemCallback<Location>() {
    override fun areItemsTheSame(oldItem: Location, newItem: Location): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: Location, newItem: Location): Boolean {
        return oldItem == newItem
    }
}
