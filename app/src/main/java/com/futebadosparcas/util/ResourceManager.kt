package com.futebadosparcas.util

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.drawable.Drawable
import androidx.annotation.ColorRes
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.core.content.ContextCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Resource Manager
 *
 * Centralized access to Android resources with type safety and caching.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var resourceManager: ResourceManager
 *
 * // Get string
 * val text = resourceManager.getString(R.string.app_name)
 *
 * // Get color
 * val color = resourceManager.getColor(R.color.primary)
 *
 * // Get drawable
 * val icon = resourceManager.getDrawable(R.drawable.ic_star)
 * ```
 */
@Singleton
class ResourceManager @Inject constructor(
    @ApplicationContext private val context: Context
) {

    /**
     * Get string resource
     */
    fun getString(@StringRes resId: Int): String {
        return context.getString(resId)
    }

    /**
     * Get string with format arguments
     */
    fun getString(@StringRes resId: Int, vararg formatArgs: Any): String {
        return context.getString(resId, *formatArgs)
    }

    /**
     * Get plural string
     */
    fun getQuantityString(resId: Int, quantity: Int): String {
        return context.resources.getQuantityString(resId, quantity)
    }

    /**
     * Get plural string with format arguments
     */
    fun getQuantityString(resId: Int, quantity: Int, vararg formatArgs: Any): String {
        return context.resources.getQuantityString(resId, quantity, *formatArgs)
    }

    /**
     * Get color
     */
    fun getColor(@ColorRes resId: Int): Int {
        return ContextCompat.getColor(context, resId)
    }

    /**
     * Get color state list
     */
    fun getColorStateList(@ColorRes resId: Int): ColorStateList? {
        return ContextCompat.getColorStateList(context, resId)
    }

    /**
     * Get drawable
     */
    fun getDrawable(@DrawableRes resId: Int): Drawable? {
        return ContextCompat.getDrawable(context, resId)
    }

    /**
     * Get dimension in pixels
     */
    fun getDimensionPixelSize(resId: Int): Int {
        return context.resources.getDimensionPixelSize(resId)
    }

    /**
     * Get dimension
     */
    fun getDimension(resId: Int): Float {
        return context.resources.getDimension(resId)
    }

    /**
     * Get integer
     */
    fun getInteger(resId: Int): Int {
        return context.resources.getInteger(resId)
    }

    /**
     * Get boolean
     */
    fun getBoolean(resId: Int): Boolean {
        return context.resources.getBoolean(resId)
    }

    /**
     * Get string array
     */
    fun getStringArray(resId: Int): Array<String> {
        return context.resources.getStringArray(resId)
    }

    /**
     * Get integer array
     */
    fun getIntArray(resId: Int): IntArray {
        return context.resources.getIntArray(resId)
    }

    /**
     * Get typed array
     */
    fun getTypedArray(resId: Int): android.content.res.TypedArray {
        return context.resources.obtainTypedArray(resId)
    }

    /**
     * Get resource identifier by name
     */
    fun getResourceId(name: String, defType: String, defPackage: String = context.packageName): Int {
        return context.resources.getIdentifier(name, defType, defPackage)
    }

    /**
     * Check if resource exists
     */
    fun resourceExists(resId: Int): Boolean {
        return try {
            context.resources.getResourceName(resId)
            true
        } catch (e: Exception) {
            false
        }
    }
}
