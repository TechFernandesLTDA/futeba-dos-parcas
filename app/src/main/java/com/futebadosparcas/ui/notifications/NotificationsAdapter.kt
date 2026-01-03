package com.futebadosparcas.ui.notifications

import android.text.format.DateUtils
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import coil.transform.CircleCropTransformation
import com.futebadosparcas.data.model.AppNotification
import com.futebadosparcas.data.model.NotificationAction
import com.futebadosparcas.data.model.NotificationType
import com.futebadosparcas.databinding.ItemNotificationBinding
import java.text.SimpleDateFormat
import java.util.Locale

class NotificationsAdapter(
    private val onItemClick: (AppNotification) -> Unit,
    private val onAcceptClick: (AppNotification) -> Unit,
    private val onDeclineClick: (AppNotification) -> Unit
) : ListAdapter<AppNotification, NotificationsAdapter.NotificationViewHolder>(NotificationDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): NotificationViewHolder {
        val binding = ItemNotificationBinding.inflate(
            LayoutInflater.from(parent.context),
            parent,
            false
        )
        return NotificationViewHolder(binding)
    }

    override fun onBindViewHolder(holder: NotificationViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class NotificationViewHolder(
        private val binding: ItemNotificationBinding
    ) : RecyclerView.ViewHolder(binding.root) {

        init {
            binding.root.setOnClickListener {
                val position = bindingAdapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onItemClick(getItem(position))
                }
            }

            binding.btnAccept.setOnClickListener {
                val position = bindingAdapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onAcceptClick(getItem(position))
                }
            }

            binding.btnDecline.setOnClickListener {
                val position = bindingAdapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onDeclineClick(getItem(position))
                }
            }
        }

        fun bind(notification: AppNotification) {
            binding.tvTitle.text = notification.title
            binding.tvMessage.text = notification.message

            val createdDate = notification.createdAt
            if (createdDate != null) {
                val dateFormat = SimpleDateFormat("dd/MM/yyyy 'as' HH:mm", Locale("pt", "BR"))
                val exactTime = dateFormat.format(createdDate)

                val relativeTime = DateUtils.getRelativeTimeSpanString(
                    createdDate.time,
                    System.currentTimeMillis(),
                    DateUtils.MINUTE_IN_MILLIS
                )

                binding.tvTime.text = "$relativeTime - $exactTime"
                binding.tvTime.visibility = View.VISIBLE
            } else {
                binding.tvTime.text = "Data desconhecida"
                binding.tvTime.visibility = View.VISIBLE
            }

            binding.unreadIndicator.visibility = if (!notification.read) View.VISIBLE else View.GONE

            val iconRes = notification.getIconResource()
            if (!notification.senderPhoto.isNullOrEmpty()) {
                binding.ivSenderPhoto.load(notification.senderPhoto) {
                    crossfade(true)
                    placeholder(iconRes)
                    error(iconRes)
                    transformations(CircleCropTransformation())
                }
            } else {
                binding.ivSenderPhoto.setImageResource(iconRes)
            }

            val actionType = notification.getActionTypeEnum()
            val showActions = actionType == NotificationAction.ACCEPT_DECLINE ||
                actionType == NotificationAction.CONFIRM_POSITION

            binding.layoutActions.visibility = if (showActions) View.VISIBLE else View.GONE

            if (actionType == NotificationAction.CONFIRM_POSITION) {
                binding.btnAccept.text = "Confirmar"
                binding.btnDecline.text = "Recusar"
            } else {
                binding.btnAccept.text = "Aceitar"
                binding.btnDecline.text = "Recusar"
            }

            binding.root.alpha = if (notification.read) 0.6f else 1.0f

            when (notification.getTypeEnum()) {
                NotificationType.ACHIEVEMENT -> {
                    binding.root.strokeColor = android.graphics.Color.parseColor("#FFD700")
                    binding.root.strokeWidth = 4
                }
                NotificationType.ADMIN_MESSAGE -> {
                    binding.root.strokeColor = android.graphics.Color.parseColor("#58CC02")
                    binding.root.strokeWidth = 4
                }
                else -> {
                    binding.root.strokeWidth = 0
                }
            }
        }
    }

    class NotificationDiffCallback : DiffUtil.ItemCallback<AppNotification>() {
        override fun areItemsTheSame(oldItem: AppNotification, newItem: AppNotification): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: AppNotification, newItem: AppNotification): Boolean {
            return oldItem == newItem
        }
    }
}
