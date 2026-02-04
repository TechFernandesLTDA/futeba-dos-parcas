package com.futebadosparcas.ui.navigation.components

import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import com.futebadosparcas.R
import androidx.compose.material3.MaterialTheme

/**
 * TopBar padrao para telas secundarias com botao de voltar.
 *
 * **LEGACY**: Use AppTopBar.Secondary() para novos codigos.
 * Esta funcao e mantida para compatibilidade com telas existentes.
 *
 * CMD-16: TopBar padronizada - Todos devem usar AppTopBar ou esta wrapper.
 *
 * Uso:
 * ```
 * SecondaryTopBar(
 *     title = "Detalhes do Jogo",
 *     onNavigateBack = { navController.popBackStack() }
 * )
 * ```
 *
 * Com string resource:
 * ```
 * SecondaryTopBar(
 *     titleResId = R.string.game_detail_title,
 *     onNavigateBack = { navController.popBackStack() }
 * )
 * ```
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SecondaryTopBar(
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
    title: String? = null,
    titleResId: Int? = null,
    backgroundColor: Color? = null,
    contentColor: Color? = null
) {
    // Usa cores do tema se nao especificado
    val containerColor = backgroundColor ?: MaterialTheme.colorScheme.primary
    val titleColor = contentColor ?: MaterialTheme.colorScheme.onPrimary

    CenterAlignedTopAppBar(
        title = {
            Text(
                text = when {
                    titleResId != null -> stringResource(titleResId)
                    title != null -> title
                    else -> ""
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.back_button_content_description)
                )
            }
        },
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
            containerColor = containerColor,
            titleContentColor = titleColor,
            navigationIconContentColor = titleColor
        ),
        modifier = modifier
    )
}

/**
 * Versao com scroll behavior para telas com scroll.
 *
 * **LEGACY**: Use AppTopBar.Secondary com scrollBehavior para novos codigos.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SecondaryTopBarScroll(
    onNavigateBack: () -> Unit,
    scrollBehavior: androidx.compose.material3.TopAppBarScrollBehavior,
    modifier: Modifier = Modifier,
    title: String? = null,
    titleResId: Int? = null,
    backgroundColor: Color? = null,
    contentColor: Color? = null
) {
    // Usa cores do tema se nao especificado
    val containerColor = backgroundColor ?: MaterialTheme.colorScheme.primary
    val titleColor = contentColor ?: MaterialTheme.colorScheme.onPrimary

    CenterAlignedTopAppBar(
        title = {
            Text(
                text = when {
                    titleResId != null -> stringResource(titleResId)
                    title != null -> title
                    else -> ""
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.back_button_content_description)
                )
            }
        },
        colors = TopAppBarDefaults.centerAlignedTopAppBarColors(
            containerColor = containerColor,
            titleContentColor = titleColor,
            navigationIconContentColor = titleColor,
            scrolledContainerColor = containerColor
        ),
        scrollBehavior = scrollBehavior,
        modifier = modifier
    )
}
