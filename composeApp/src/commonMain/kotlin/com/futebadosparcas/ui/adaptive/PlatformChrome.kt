package com.futebadosparcas.ui.adaptive

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.SheetState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

enum class PlatformChromeKind {
    Material,
    Cupertino
}

internal expect val platformChromeKind: PlatformChromeKind

data class AdaptiveNavItem(
    val label: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val contentDescription: String,
    val selected: Boolean,
    val onClick: () -> Unit
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdaptiveTopBar(
    title: String,
    modifier: Modifier = Modifier,
    navigationIcon: @Composable () -> Unit = EmptyNavigationIcon,
    actions: @Composable RowScope.() -> Unit = {},
    containerColor: Color = MaterialTheme.colorScheme.surface,
    contentColor: Color = MaterialTheme.colorScheme.onSurface
) {
    val colors = TopAppBarDefaults.topAppBarColors(
        containerColor = containerColor,
        titleContentColor = contentColor,
        actionIconContentColor = contentColor,
        navigationIconContentColor = contentColor
    )

    when (platformChromeKind) {
        PlatformChromeKind.Material -> TopAppBar(
            title = { Text(title) },
            modifier = modifier,
            navigationIcon = navigationIcon,
            actions = actions,
            colors = colors
        )
        PlatformChromeKind.Cupertino -> {
            if (navigationIcon === EmptyNavigationIcon) {
                CenterAlignedTopAppBar(
                    title = {
                        Text(
                            text = title,
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    modifier = modifier,
                    actions = actions,
                    colors = colors
                )
            } else {
                LargeTopAppBar(
                    title = {
                        Text(
                            text = title,
                            fontWeight = FontWeight.SemiBold
                        )
                    },
                    modifier = modifier,
                    navigationIcon = navigationIcon,
                    actions = actions,
                    colors = colors
                )
            }
        }
    }
}

@Composable
fun AdaptiveTabBar(
    items: List<AdaptiveNavItem>,
    modifier: Modifier = Modifier
) {
    when (platformChromeKind) {
        PlatformChromeKind.Material -> {
            NavigationBar(modifier = modifier) {
                items.forEach { item ->
                    NavigationBarItem(
                        icon = {
                            Icon(
                                imageVector = if (item.selected) item.selectedIcon else item.unselectedIcon,
                                contentDescription = item.contentDescription
                            )
                        },
                        label = { Text(item.label) },
                        selected = item.selected,
                        onClick = item.onClick
                    )
                }
            }
        }
        PlatformChromeKind.Cupertino -> {
            Surface(
                modifier = modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f),
                tonalElevation = 3.dp
            ) {
                Column {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 62.dp)
                            .padding(horizontal = 6.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        items.forEach { item ->
                            CupertinoTabItem(
                                item = item,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdaptiveModalBottomSheet(
    onDismissRequest: () -> Unit,
    sheetState: SheetState,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismissRequest,
        sheetState = sheetState,
        modifier = modifier,
        dragHandle = {
            when (platformChromeKind) {
                PlatformChromeKind.Material -> BottomSheetDefaults.DragHandle()
                PlatformChromeKind.Cupertino -> CupertinoSheetGrabber()
            }
        },
        content = content
    )
}

@Composable
private fun CupertinoTabItem(
    item: AdaptiveNavItem,
    modifier: Modifier = Modifier
) {
    val tint = if (item.selected) {
        MaterialTheme.colorScheme.primary
    } else {
        MaterialTheme.colorScheme.onSurfaceVariant
    }

    Column(
        modifier = modifier
            .selectable(
                selected = item.selected,
                role = Role.Tab,
                onClick = item.onClick
            )
            .semantics { contentDescription = item.contentDescription }
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Icon(
            imageVector = if (item.selected) item.selectedIcon else item.unselectedIcon,
            contentDescription = null,
            tint = tint
        )
        Text(
            text = item.label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = if (item.selected) FontWeight.SemiBold else FontWeight.Medium,
            color = tint
        )
    }
}

@Composable
private fun CupertinoSheetGrabber() {
    Box(
        modifier = Modifier
            .padding(top = 10.dp, bottom = 8.dp)
            .width(44.dp)
            .height(5.dp)
            .clip(RoundedCornerShape(percent = 50))
            .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.42f))
    )
}

private val EmptyNavigationIcon: @Composable () -> Unit = {}
