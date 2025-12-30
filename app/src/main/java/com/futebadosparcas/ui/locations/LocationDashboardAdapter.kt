package com.futebadosparcas.ui.locations

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Location

class LocationDashboardAdapter(
    private val onLocationClick: (Location) -> Unit
) : ListAdapter<Location, LocationDashboardAdapter.LocationViewHolder>(LocationDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LocationViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_location_dashboard, parent, false)
        return LocationViewHolder(view, onLocationClick)
    }

    override fun onBindViewHolder(holder: LocationViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class LocationViewHolder(
        itemView: View,
        val onLocationClick: (Location) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {
        private val tvName: TextView = itemView.findViewById(R.id.tvLocationName)
        private val tvAddress: TextView = itemView.findViewById(R.id.tvLocationAddress)
        private val tvVerified: TextView = itemView.findViewById(R.id.tvVerified)

        fun bind(location: Location) {
            tvName.text = location.name
            tvAddress.text = location.address
            tvVerified.visibility = if (location.isVerified) View.VISIBLE else View.GONE
            
            itemView.setOnClickListener { onLocationClick(location) }
        }
    }

    class LocationDiffCallback : DiffUtil.ItemCallback<Location>() {
        override fun areItemsTheSame(oldItem: Location, newItem: Location): Boolean = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: Location, newItem: Location): Boolean = oldItem == newItem
    }
}
