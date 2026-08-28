package com.futebadosparcas.ui.groups

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import com.futebadosparcas.R
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.ui.adaptive.ExpandedListDetailPane
import com.futebadosparcas.ui.adaptive.adaptiveContentWidth
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.theme.MotionDuration
import com.futebadosparcas.ui.theme.MotionEasing
import com.futebadosparcas.ui.theme.rememberReduceMotion
import org.koin.compose.viewmodel.koinViewModel

/**
 * Tela principal de listagem de grupos em Jetpack Compose
 *
 * Features:
 * - Lista de grupos com shimmer loading
 * - Pull-to-refresh
 * - Busca com debounce
 * - Estados: Loading, Empty, Success, Error
 * - Material Design 3
 * - Suporte a temas claro/escuro
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupsScreen(
    viewModel: GroupsViewModel = koinViewModel(),
    onGroupClick: (String) -> Unit,
    onCreateGroupClick: () -> Unit,
    onDiscoverGroupsClick: () -> Unit = {},
    onInvitePlayersClick: (String) -> Unit = {},
    onCashboxClick: (String) -> Unit = {},
    onCreateGameInGroupClick: (String) -> Unit = {},
    onWallClick: (String) -> Unit = {},
    onBackClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()
    val isRefreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            GroupsTopBar(
                onBackClick = onBackClick,
                onDiscoverGroupsClick = onDiscoverGroupsClick
            )
        },
        floatingActionButton = {
            // Mostra FAB apenas se não estiver no estado Empty inicial
            val showFab = uiState is GroupsUiState.Success ||
                         (uiState is GroupsUiState.Empty && searchQuery.isNotEmpty())

            AnimatedVisibility(
                visible = showFab,
                enter = scaleIn() + fadeIn(),
                exit = scaleOut() + fadeOut()
            ) {
                CreateGroupFab(onClick = onCreateGroupClick)
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is GroupsUiState.Loading -> {
                    // Shimmer loading
                    GroupsLoadingContent()
                }

                is GroupsUiState.Empty -> {
                    if (searchQuery.isEmpty()) {
                        // Estado vazio inicial - nenhum grupo
                        EmptyGroupsState(onCreateGroup = onCreateGroupClick)
                    } else {
                        // Busca sem resultados
                        Column(modifier = Modifier.fillMaxSize()) {
                            SearchBar(
                                query = searchQuery,
                                onQueryChange = { viewModel.searchGroups(it) },
                                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                            )
                            EmptySearchGroupsState(
                                query = searchQuery,
                                onClearSearch = { viewModel.searchGroups("") }
                            )
                        }
                    }
                }

                is GroupsUiState.Success -> {
                    PullToRefreshBox(
                        isRefreshing = isRefreshing,
                        onRefresh = { viewModel.refreshGroups() }
                    ) {
                        GroupsSuccessContent(
                            groups = state.groups,
                            searchQuery = searchQuery,
                            onSearchQueryChange = { viewModel.searchGroups(it) },
                            onGroupClick = onGroupClick,
                            onInvitePlayersClick = onInvitePlayersClick,
                            onCashboxClick = onCashboxClick,
                            onCreateGameInGroupClick = onCreateGameInGroupClick,
                            onWallClick = onWallClick
                        )
                    }
                }

                is GroupsUiState.Error -> {
                    EmptyState(
                        type = EmptyStateType.Error(
                            title = stringResource(R.string.error),
                            description = state.message,
                            onRetry = { viewModel.refreshGroups() }
                        )
                    )
                }
            }
        }
    }
}

/**
 * TopBar da tela de grupos
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GroupsTopBar(
    onBackClick: () -> Unit,
    onDiscoverGroupsClick: () -> Unit = {}
) {
    TopAppBar(
        title = {
            Text(
                text = stringResource(R.string.cd_groups),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.close)
                )
            }
        },
        actions = {
            IconButton(onClick = onDiscoverGroupsClick) {
                Icon(
                    imageVector = Icons.Default.Public,
                    contentDescription = stringResource(R.string.discover_groups_title)
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface,
            navigationIconContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}

/**
 * FAB para criar novo grupo
 */
@Composable
private fun CreateGroupFab(
    onClick: () -> Unit
) {
    FloatingActionButton(
        onClick = onClick,
        containerColor = MaterialTheme.colorScheme.primary,
        contentColor = MaterialTheme.colorScheme.onPrimary,
        elevation = FloatingActionButtonDefaults.elevation(
            defaultElevation = 6.dp,
            pressedElevation = 12.dp
        )
    ) {
        Icon(
            imageVector = Icons.Default.Add,
            contentDescription = stringResource(R.string.fragment_groups_contentdescription_7)
        )
    }
}

/**
 * Conteúdo de sucesso com lista de grupos
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun GroupsSuccessContent(
    groups: List<UserGroup>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onGroupClick: (String) -> Unit,
    onInvitePlayersClick: (String) -> Unit,
    onCashboxClick: (String) -> Unit,
    onCreateGameInGroupClick: (String) -> Unit,
    onWallClick: (String) -> Unit
) {
    // Mostra busca apenas se houver 3+ grupos
    val showSearch = groups.size >= 3
    var selectedGroupId by rememberSaveable { mutableStateOf<String?>(null) }

    val groupsKey = remember(groups) { groups.joinToString(",") { it.groupId } }
    LaunchedEffect(groupsKey) {
        if (groups.none { it.groupId == selectedGroupId }) {
            selectedGroupId = groups.firstOrNull()?.groupId
        }
    }

    val listContent: @Composable ((String) -> Unit) -> Unit = { onGroupSelected ->
        LazyColumn(
            // SECFIX #489: adaptiveContentWidth limita largura em tablets
            modifier = Modifier
                .fillMaxSize()
                .adaptiveContentWidth(),
            contentPadding = PaddingValues(vertical = 8.dp) // Padding mínimo, FAB já é posicionado pelo Scaffold
        ) {
            // Campo de busca
            if (showSearch) {
                item {
                    SearchBar(
                        query = searchQuery,
                        onQueryChange = onSearchQueryChange,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                    )
                }
            }

            // Lista de grupos
            items(
                items = groups,
                key = { it.groupId }
            ) { group ->
                GroupCard(
                    group = group,
                    onClick = { onGroupSelected(group.groupId) },
                    modifier = Modifier
                        .padding(horizontal = 16.dp, vertical = 6.dp)
                        .animateItem()
                )
            }
        }
    }

    ExpandedListDetailPane(
        selectedId = selectedGroupId,
        onSelectId = { selectedGroupId = it },
        compactContent = {
            listContent(onGroupClick)
        },
        listPane = { onGroupSelected ->
            listContent(onGroupSelected)
        },
        detailPane = { groupId ->
            if (groupId == null) {
                GroupsDetailPlaceholder()
            } else {
                key(groupId) {
                    val detailViewModel: GroupDetailViewModel = koinViewModel()
                    GroupDetailScreen(
                        viewModel = detailViewModel,
                        groupId = groupId,
                        onNavigateBack = { selectedGroupId = null },
                        onNavigateToInvite = { onInvitePlayersClick(groupId) },
                        onNavigateToCashbox = { onCashboxClick(groupId) },
                        onNavigateToWall = { onWallClick(groupId) },
                        onNavigateToCreateGame = { onCreateGameInGroupClick(groupId) }
                    )
                }
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}

@Composable
private fun GroupsDetailPlaceholder() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = stringResource(R.string.group_detail),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Barra de busca
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier.fillMaxWidth(),
        placeholder = {
            Text(text = stringResource(R.string.fragment_groups_hint_1))
        },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = stringResource(R.string.search),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = stringResource(R.string.close),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        shape = RoundedCornerShape(28.dp),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            disabledIndicatorColor = Color.Transparent
        ),
        singleLine = true
    )
}

/**
 * Card de grupo individual
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GroupCard(
    group: UserGroup,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val memberLabel = pluralStringResource(
        R.plurals.groups_member_count,
        group.memberCount,
        group.memberCount
    )
    val roleLabel = group.getRoleEnum().displayName
    val cardCd = stringResource(R.string.cd_group_card, group.groupName, memberLabel, roleLabel)

    Card(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .semantics(mergeDescendants = true) { contentDescription = cardCd },
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 2.dp,
            pressedElevation = 6.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Foto do grupo
            GroupPhoto(
                photoUrl = group.groupPhoto,
                groupName = group.groupName,
                modifier = Modifier.size(56.dp)
            )

            Spacer(modifier = Modifier.width(16.dp))

            // Informações do grupo
            Column(
                modifier = Modifier.weight(1f)
            ) {
                // Nome do grupo
                Text(
                    text = group.groupName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Informações secundárias
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Número de membros
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Default.People,
                            contentDescription = memberLabel,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = memberLabel,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Badge do papel do usuário
                    RoleBadge(role = group.getRoleEnum())
                }
            }

            // Ícone de navegação
            Icon(
                imageVector = Icons.Default.ChevronRight,
                contentDescription = stringResource(R.string.cd_access_group),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Foto do grupo com fallback
 */
@Composable
private fun GroupPhoto(
    photoUrl: String?,
    groupName: String,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(CircleShape),
        contentAlignment = Alignment.Center
    ) {
        CachedProfileImage(
            photoUrl = photoUrl,
            userName = groupName,
            size = 56.dp
        )
    }
}

/**
 * Badge indicando o papel do usuário no grupo
 */
@Composable
private fun RoleBadge(
    role: com.futebadosparcas.data.model.GroupMemberRole
) {
    if (role != com.futebadosparcas.data.model.GroupMemberRole.MEMBER) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = when (role) {
                com.futebadosparcas.data.model.GroupMemberRole.OWNER ->
                    MaterialTheme.colorScheme.primaryContainer
                com.futebadosparcas.data.model.GroupMemberRole.ADMIN ->
                    MaterialTheme.colorScheme.secondaryContainer
                else -> MaterialTheme.colorScheme.surfaceVariant
            }
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = when (role) {
                        com.futebadosparcas.data.model.GroupMemberRole.OWNER -> Icons.Default.Star
                        com.futebadosparcas.data.model.GroupMemberRole.ADMIN -> Icons.Default.Shield
                        else -> Icons.Default.Person
                    },
                    contentDescription = role.displayName,
                    modifier = Modifier.size(12.dp),
                    tint = when (role) {
                        com.futebadosparcas.data.model.GroupMemberRole.OWNER ->
                            MaterialTheme.colorScheme.onPrimaryContainer
                        com.futebadosparcas.data.model.GroupMemberRole.ADMIN ->
                            MaterialTheme.colorScheme.onSecondaryContainer
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
                Text(
                    text = role.displayName,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium,
                    color = when (role) {
                        com.futebadosparcas.data.model.GroupMemberRole.OWNER ->
                            MaterialTheme.colorScheme.onPrimaryContainer
                        com.futebadosparcas.data.model.GroupMemberRole.ADMIN ->
                            MaterialTheme.colorScheme.onSecondaryContainer
                        else -> MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
        }
    }
}

/**
 * Estado vazio - nenhum grupo
 */
@Composable
private fun EmptyGroupsState(
    onCreateGroup: () -> Unit
) {
    EmptyState(
        type = EmptyStateType.NoData(
            title = stringResource(R.string.fragment_groups_text_2),
            description = stringResource(R.string.fragment_groups_text_3),
            icon = Icons.Default.Groups,
            actionLabel = stringResource(R.string.fragment_groups_text_4),
            onAction = onCreateGroup
        )
    )
}

/**
 * Estado vazio - busca sem resultados
 */
@Composable
private fun EmptySearchGroupsState(
    query: String,
    onClearSearch: () -> Unit
) {
    EmptyState(
        type = EmptyStateType.NoResults(
            description = stringResource(R.string.fragment_groups_text_5),
            actionLabel = stringResource(R.string.groups_clear_search),
            onAction = onClearSearch
        )
    )
}

/**
 * Conteúdo de loading com shimmer
 */
@Composable
private fun GroupsLoadingContent() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(5) {
            ShimmerGroupCard()
        }
    }
}

/**
 * Card shimmer para estado de loading
 */
@Composable
private fun ShimmerGroupCard() {
    val reducedMotion = rememberReduceMotion()
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val translate = if (reducedMotion) {
        500f
    } else {
        val transition = rememberInfiniteTransition(label = "shimmer")
        transition.animateFloat(
            initialValue = 0f,
            targetValue = 1000f,
            animationSpec = infiniteRepeatable(
                animation = tween(
                    durationMillis = MotionDuration.Long,
                    easing = MotionEasing.Standard
                ),
                repeatMode = RepeatMode.Restart
            ),
            label = "shimmer_translate"
        ).value
    }

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = androidx.compose.ui.geometry.Offset(
            translate - 1000f,
            translate - 1000f
        ),
        end = androidx.compose.ui.geometry.Offset(translate, translate)
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Foto circular
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(brush)
            )

            Spacer(modifier = Modifier.width(16.dp))

            // Textos
            Column(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .width(150.dp)
                        .height(20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .width(100.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }

            // Ícone
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(brush)
            )
        }
    }
}
