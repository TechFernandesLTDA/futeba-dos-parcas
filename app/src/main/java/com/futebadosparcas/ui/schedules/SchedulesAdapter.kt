package com.futebadosparcas.ui.schedules

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.futebadosparcas.data.model.Schedule
import com.futebadosparcas.databinding.ItemScheduleBinding

class SchedulesAdapter(
    private val onEditClick: (Schedule) -> Unit,
    private val onDeleteClick: (String) -> Unit
) : ListAdapter<Schedule, SchedulesAdapter.ViewHolder>(DiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemScheduleBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(private val binding: ItemScheduleBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(schedule: Schedule) {
            binding.tvScheduleName.text = schedule.name.ifEmpty { "Sem nome" }
            
            val dayStr = getDayOfWeekString(schedule.dayOfWeek)
            val recurrenceStr = when (schedule.recurrenceType) {
                com.futebadosparcas.data.model.RecurrenceType.weekly -> "Semanal"
                com.futebadosparcas.data.model.RecurrenceType.biweekly -> "Quinzenal"
                com.futebadosparcas.data.model.RecurrenceType.monthly -> "Mensal"
            }
            binding.tvRecurrenceInfo.text = "$recurrenceStr • $dayStr às ${schedule.time}"
            
            binding.tvLocationInfo.text = "${schedule.locationName} - ${schedule.fieldName}"
            
            binding.btnEdit.setOnClickListener {
                onEditClick(schedule)
            }

            binding.btnDelete.setOnClickListener {
                onDeleteClick(schedule.id)
            }
        }

        private fun getDayOfWeekString(day: Int): String {
            return when (day) {
                0 -> "Domingo"
                1 -> "Segunda-feira"
                2 -> "Terça-feira"
                3 -> "Quarta-feira"
                4 -> "Quinta-feira"
                5 -> "Sexta-feira"
                6 -> "Sábado"
                else -> "Desconhecido"
            }
        }
    }

    companion object DiffCallback : DiffUtil.ItemCallback<Schedule>() {
        override fun areItemsTheSame(oldItem: Schedule, newItem: Schedule): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: Schedule, newItem: Schedule): Boolean {
            return oldItem == newItem
        }
    }
}
