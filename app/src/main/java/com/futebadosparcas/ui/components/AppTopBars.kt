package com.futebadosparcas.ui.components

import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.TopAppBarColors
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable

/**
 * #027 - Standardized TopAppBar colors using Material 3
 *
 * Provides consistent color schemes for all TopAppBars in the app.
 * Ensures proper contrast and accessibility.
 */
object AppTopBar {

    /**
     * Surface colors (default) - Used for most screens
     * Background: surface
     * Content: onSurface
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun surfaceColors(): TopAppBarColors = TopAppBarDefaults.topAppBarColors(
        containerColor = MaterialTheme.colorScheme.surface,
        scrolledContainerColor = MaterialTheme.colorScheme.surface,
        navigationIconContentColor = MaterialTheme.colorScheme.onSurface,
        titleContentColor = MaterialTheme.colorScheme.onSurface,
        actionIconContentColor = MaterialTheme.colorScheme.onSurface
    )

    /**
     * Primary colors - Used for important/highlighted screens
     * Background: primary
     * Content: onPrimary
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun primaryColors(): TopAppBarColors = TopAppBarDefaults.topAppBarColors(
        containerColor = MaterialTheme.colorScheme.primary,
        scrolledContainerColor = MaterialTheme.colorScheme.primary,
        navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
        titleContentColor = MaterialTheme.colorScheme.onPrimary,
        actionIconContentColor = MaterialTheme.colorScheme.onPrimary
    )

    /**
     * Primary Container colors - Used for subtle highlights
     * Background: primaryContainer
     * Content: onPrimaryContainer
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun primaryContainerColors(): TopAppBarColors = TopAppBarDefaults.topAppBarColors(
        containerColor = MaterialTheme.colorScheme.primaryContainer,
        scrolledContainerColor = MaterialTheme.colorScheme.primaryContainer,
        navigationIconContentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        actionIconContentColor = MaterialTheme.colorScheme.onPrimaryContainer
    )

    /**
     * Surface Variant colors - Used for differentiation
     * Background: surfaceVariant
     * Content: onSurfaceVariant
     */
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable
    fun surfaceVariantColors(): TopAppBarColors = TopAppBarDefaults.topAppBarColors(
        containerColor = MaterialTheme.colorScheme.surfaceVariant,
        scrolledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
        navigationIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
        titleContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
        actionIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant
    )
}
