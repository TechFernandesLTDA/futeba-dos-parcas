package com.futebadosparcas.ui.components.cards
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.foundation.background
import org.jetbrains.compose.resources.stringResource
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.futebadosparcas.ui.components.CachedProfileImage

/**
 * Card de usuário reutilizável
 *
 * Componente genérico para exibir informações de usuário/jogador/membro.
 * Suporta foto, nome, subtitle, badge, e ações via menu.
 *
 * @param photoUrl URL da foto do usuário (null usa ícone padrão)
 * @param name Nome do usuário
 * @param subtitle Texto secundário (role, stats, etc)
 * @param badge Badge opcional (Owner, Admin, Level, etc)
 * @param badgeColor Cor do badge
 * @param badgeIcon Ícone do badge
 * @param onClick Callback ao clicar no card
 * @param showMenu Se deve mostrar botão de menu
 * @param menuItems Itens do menu dropdown
 * @param modifier Modificador para customização
 *
 * Exemplo de uso:
 * ```kotlin
 * UserCard(
 *     photoUrl = member.userPhoto,
 *     name = member.getDisplayName(),
 *     subtitle = "Membro desde Jan/2024",
 *     badge = "Admin",
 *     badgeColor = MaterialTheme.colorScheme.primary,
 *     badgeIcon = Icons.Default.Shield,
 *     onClick = { onMemberClick(member.userId) },
 *     showMenu = canManage,
 *     menuItems = listOf(
 *         UserCardMenuItem("Promover", Icons.Default.ArrowUpward) { onPromote() },
 *         UserCardMenuItem("Remover", Icons.Default.Delete, isDestructive = true) { onRemove() }
 *     )
 * )
 * ```
 */
@Composable
fun UserCard(
    photoUrl: String?,
    name: String,
    subtitle: String?,
    modifier: Modifier = Modifier,
    badge: String? = null,
    badgeColor: Color? = null,
    badgeIcon: ImageVector? = null,
    onClick: (() -> Unit)? = null,
    showMenu: Boolean = false,
    menuItems: List<UserCardMenuItem> = emptyList(),
    onMenuExpand: ((Boolean) -> Unit)? = null
) {
    var showDropdownMenu = false

    Card(
        modifier = modifier
            .fillMaxWidth()
            .then(
                if (onClick != null) Modifier.clickable(onClick = onClick)
                else Modifier
            ),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Foto do usuário
            CachedProfileImage(
                photoUrl = photoUrl,
                userName = name,
                size = 48.dp
            )

            // Nome e subtitle
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Badge (se houver)
                if (badge != null) {
                    Spacer(modifier = Modifier.height(4.dp))

                    Row(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (badgeIcon != null) {
                            Icon(
                                imageVector = badgeIcon,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = badgeColor ?: MaterialTheme.colorScheme.primary
                            )
                        }
                        Text(
                            text = badge,
                            style = MaterialTheme.typography.labelSmall,
                            color = badgeColor ?: MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            // Botão de menu (se showMenu)
            if (showMenu && menuItems.isNotEmpty()) {
                Box {
                    IconButton(onClick = {
                        showDropdownMenu = true
                        onMenuExpand?.invoke(true)
                    }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = stringResource(Res.string.cd_more_options)
                        )
                    }

                    DropdownMenu(
                        expanded = showDropdownMenu,
                        onDismissRequest = {
                            showDropdownMenu = false
                            onMenuExpand?.invoke(false)
                        }
                    ) {
                        menuItems.forEach { item ->
                            DropdownMenuItem(
                                text = { Text(item.label) },
                                onClick = {
                                    showDropdownMenu = false
                                    onMenuExpand?.invoke(false)
                                    item.onClick()
                                },
                                leadingIcon = item.icon?.let {
                                    {
                                        Icon(
                                            imageVector = it,
                                            contentDescription = null
                                        )
                                    }
                                },
                                colors = if (item.isDestructive) {
                                    MenuDefaults.itemColors(
                                        textColor = MaterialTheme.colorScheme.error,
                                        leadingIconColor = MaterialTheme.colorScheme.error
                                    )
                                } else {
                                    MenuDefaults.itemColors()
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Item de menu para UserCard
 */
data class UserCardMenuItem(
    val label: String,
    val icon: ImageVector? = null,
    val isDestructive: Boolean = false,
    val onClick: () -> Unit
)

/**
 * Variantes específicas para casos de uso comuns
 */

/**
 * Card de membro de grupo
 */
@Composable
fun GroupMemberCard(
    photoUrl: String?,
    name: String,
    role: String,
    roleIcon: ImageVector,
    roleColor: Color,
    onClick: () -> Unit,
    canManage: Boolean,
    modifier: Modifier = Modifier,
    onPromote: (() -> Unit)? = null,
    onDemote: (() -> Unit)? = null,
    onRemove: (() -> Unit)? = null
) {
    val menuItems = buildList {
        if (onPromote != null) {
            add(UserCardMenuItem("Promover a Admin", Icons.Default.ArrowUpward, onClick = onPromote))
        }
        if (onDemote != null) {
            add(UserCardMenuItem("Rebaixar para Membro", Icons.Default.ArrowDownward, onClick = onDemote))
        }
        if (onRemove != null) {
            add(UserCardMenuItem("Remover do Grupo", Icons.Default.Delete, isDestructive = true, onClick = onRemove))
        }
    }

    UserCard(
        photoUrl = photoUrl,
        name = name,
        subtitle = null,
        badge = role,
        badgeColor = roleColor,
        badgeIcon = roleIcon,
        onClick = onClick,
        showMenu = canManage,
        menuItems = menuItems,
        modifier = modifier
    )
}

/**
 * Card compacto de usuário (para listas densas)
 */
@Composable
fun UserCardCompact(
    photoUrl: String?,
    name: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    trailingContent: (@Composable () -> Unit)? = null
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Foto
        CachedProfileImage(
            photoUrl = photoUrl,
            userName = name,
            size = 40.dp
        )

        // Nome e subtitle
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (subtitle != null) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Trailing content (badge, botão, etc)
        trailingContent?.invoke()
    }
}
