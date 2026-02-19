package com.futebadosparcas.util

import android.app.Activity
import android.content.Context
import android.view.View
import android.view.inputmethod.InputMethodManager
import androidx.fragment.app.Fragment

/**
 * Keyboard Helper
 *
 * Provides utilities for showing and hiding the soft keyboard.
 *
 * Usage:
 * ```kotlin
 * lateinit var keyboardHelper: KeyboardHelper
 *
 * // Show keyboard
 * keyboardHelper.showKeyboard(editText)
 *
 * // Hide keyboard
 * keyboardHelper.hideKeyboard(activity)
 *
 * // Check if keyboard is visible
 * if (keyboardHelper.isKeyboardVisible(activity)) {
 *     // Adjust UI
 * }
 * ```
 */
class KeyboardHelper constructor(
    private val context: Context
) {

    private val inputMethodManager: InputMethodManager =
        context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager

    /**
     * Show keyboard for a view
     */
    fun showKeyboard(view: View) {
        view.requestFocus()
        inputMethodManager.showSoftInput(view, InputMethodManager.SHOW_IMPLICIT)
    }

    /**
     * Show keyboard from activity
     */
    fun showKeyboard(activity: Activity) {
        activity.currentFocus?.let { view ->
            showKeyboard(view)
        }
    }

    /**
     * Show keyboard from fragment
     */
    fun showKeyboard(fragment: Fragment) {
        fragment.view?.let { view ->
            showKeyboard(view)
        }
    }

    /**
     * Hide keyboard from view
     */
    fun hideKeyboard(view: View) {
        inputMethodManager.hideSoftInputFromWindow(view.windowToken, 0)
    }

    /**
     * Hide keyboard from activity
     */
    fun hideKeyboard(activity: Activity) {
        val view = activity.currentFocus ?: activity.window.decorView
        hideKeyboard(view)
    }

    /**
     * Hide keyboard from fragment
     */
    fun hideKeyboard(fragment: Fragment) {
        fragment.view?.let { view ->
            hideKeyboard(view)
        }
    }

    /**
     * Toggle keyboard visibility
     */
    fun toggleKeyboard() {
        inputMethodManager.toggleSoftInput(
            InputMethodManager.SHOW_FORCED,
            0
        )
    }

    /**
     * Check if keyboard is visible (heuristic)
     */
    fun isKeyboardVisible(activity: Activity): Boolean {
        val view = activity.window.decorView
        val rootView = view.rootView

        val heightDiff = rootView.height - view.height

        // If height difference is more than 200dp, keyboard is probably visible
        val dp200 = (200 * context.resources.displayMetrics.density).toInt()
        return heightDiff > dp200
    }

    /**
     * Force show keyboard
     */
    fun forceShowKeyboard(view: View) {
        view.requestFocus()
        inputMethodManager.showSoftInput(view, InputMethodManager.SHOW_FORCED)
    }

    /**
     * Force hide keyboard
     */
    fun forceHideKeyboard(view: View) {
        inputMethodManager.hideSoftInputFromWindow(
            view.windowToken,
            InputMethodManager.HIDE_IMPLICIT_ONLY
        )
    }

    /**
     * Clear focus and hide keyboard
     */
    fun clearFocusAndHideKeyboard(view: View) {
        view.clearFocus()
        hideKeyboard(view)
    }

    /**
     * Clear focus and hide keyboard from activity
     */
    fun clearFocusAndHideKeyboard(activity: Activity) {
        activity.currentFocus?.let { view ->
            clearFocusAndHideKeyboard(view)
        }
    }

    /**
     * Show keyboard with delay
     */
    fun showKeyboardDelayed(view: View, delayMs: Long = 200) {
        view.postDelayed({
            showKeyboard(view)
        }, delayMs)
    }

    /**
     * Hide keyboard with delay
     */
    fun hideKeyboardDelayed(view: View, delayMs: Long = 100) {
        view.postDelayed({
            hideKeyboard(view)
        }, delayMs)
    }

    /**
     * Is input method active
     */
    fun isInputMethodActive(): Boolean {
        return inputMethodManager.isActive
    }

    /**
     * Is input method active for specific view
     */
    fun isInputMethodActive(view: View): Boolean {
        return inputMethodManager.isActive(view)
    }

    /**
     * Restart input for view
     */
    fun restartInput(view: View) {
        inputMethodManager.restartInput(view)
    }
}
