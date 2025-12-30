package com.futebadosparcas.ui.locations

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.load
import com.futebadosparcas.R
import com.futebadosparcas.data.model.LocationReview
import com.futebadosparcas.databinding.ItemReviewBinding

class ReviewsAdapter : ListAdapter<LocationReview, ReviewsAdapter.ViewHolder>(ReviewDiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemReviewBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class ViewHolder(private val binding: ItemReviewBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(review: LocationReview) {
            binding.tvUserName.text = review.userName
            binding.ratingBar.rating = review.rating
            binding.tvComment.text = review.comment
            
            // Format date if needed
            // binding.tvDate.text = ...

            if (!review.userPhotoUrl.isNullOrEmpty()) {
                binding.ivUserPhoto.load(review.userPhotoUrl) {
                    crossfade(true)
                    placeholder(R.drawable.ic_launcher_foreground)
                    error(R.drawable.ic_launcher_foreground)
                }
            } else {
                 binding.ivUserPhoto.setImageResource(R.drawable.ic_launcher_foreground)
            }
        }
    }

    class ReviewDiffCallback : DiffUtil.ItemCallback<LocationReview>() {
        override fun areItemsTheSame(oldItem: LocationReview, newItem: LocationReview): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: LocationReview, newItem: LocationReview): Boolean {
            return oldItem == newItem
        }
    }
}
