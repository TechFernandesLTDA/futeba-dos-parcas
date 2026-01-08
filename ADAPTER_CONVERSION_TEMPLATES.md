# Template de Conversão: Adapter RecyclerView → Composable LazyColumn

Este documento fornece templates prontos para converter os próximos adapters.

---

## Template 1: Adapter Simples (Sem Callbacks)

### Cenário: RankingAdapter, ReviewsAdapter (apenas exibição)

#### Adapter Original
```kotlin
class RankingAdapter : ListAdapter<RankingItem, RankingAdapter.ViewHolder>(DiffCallback()) {
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemRankingBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(val binding: ItemRankingBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(item: RankingItem) {
            binding.apply {
                tvPosition.text = "${absoluteAdapterPosition + 1}"
                tvPlayerName.text = item.playerName
                tvPoints.text = item.points.toString()
                tvWins.text = item.wins.toString()
                tvLosses.text = item.losses.toString()
                tvWinRate.text = "${item.getWinPercentage()}%"
                tvRank.text = item.rank
                vRankColor.setBackgroundColor(Color.parseColor(item.rankColor))
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<RankingItem>() {
        override fun areItemsTheSame(oldItem: RankingItem, newItem: RankingItem) = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: RankingItem, newItem: RankingItem) = oldItem == newItem
    }
}
```

#### Composable Equivalente
```kotlin
// RankingScreen.kt
package com.futebadosparcas.ui.ranking

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.data.model.RankingItem

@Composable
fun RankingScreen(
    viewModel: RankingViewModel,
    modifier: Modifier = Modifier
) {
    val rankings by viewModel.rankings.collectAsStateWithLifecycle()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (rankings.isEmpty()) {
            RankingEmptyState()
        } else {
            RankingList(rankings)
        }
    }
}

@Composable
private fun RankingList(rankings: List<RankingItem>) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        itemsIndexed(rankings, key = { _, item -> item.id }) { index, item ->
            RankingItemCard(
                position = index + 1,
                item = item
            )
        }
    }
}

@Composable
private fun RankingItemCard(
    position: Int,
    item: RankingItem,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Posição com cor
            Surface(
                modifier = Modifier
                    .size(40.dp)
                    .background(Color(android.graphics.Color.parseColor(item.rankColor))),
                shape = RoundedCornerShape(8.dp)
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize()
                ) {
                    Text(
                        text = "$position",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }

            // Informações
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = item.playerName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = item.rank,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Stats
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatColumn(label = "Pts", value = item.points.toString())
                StatColumn(label = "V", value = item.wins.toString())
                StatColumn(label = "D", value = item.losses.toString())
                StatColumn(label = "TX", value = "${item.getWinPercentage()}%")
            }
        }
    }
}

@Composable
private fun StatColumn(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun RankingEmptyState() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text("Sem rankings disponíveis")
    }
}
```

---

## Template 2: Adapter com Callbacks Simples

### Cenário: GroupMembersAdapter, InvitePlayersAdapter

#### Adapter Original
```kotlin
class GroupMembersAdapter(
    private val onMemberClick: (Member) -> Unit,
    private val onRemove: (Member) -> Unit
) : ListAdapter<Member, GroupMembersAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemMemberBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(val binding: ItemMemberBinding) : RecyclerView.ViewHolder(binding.root) {
        init {
            binding.root.setOnClickListener {
                val position = bindingAdapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onMemberClick(getItem(position))
                }
            }

            binding.btnRemove.setOnClickListener {
                val position = bindingAdapterPosition
                if (position != RecyclerView.NO_POSITION) {
                    onRemove(getItem(position))
                }
            }
        }

        fun bind(member: Member) {
            binding.apply {
                tvMemberName.text = member.name
                tvMemberRole.text = member.role
                Glide.with(itemView).load(member.photoUrl).into(ivMemberPhoto)
                btnRemove.visibility = if (member.canBeRemoved) View.VISIBLE else View.GONE
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<Member>() {
        override fun areItemsTheSame(oldItem: Member, newItem: Member) = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: Member, newItem: Member) = oldItem == newItem
    }
}
```

#### Composable Equivalente
```kotlin
// GroupMembersScreen.kt
@Composable
fun GroupMembersScreen(
    viewModel: GroupMembersViewModel,
    modifier: Modifier = Modifier
) {
    val members by viewModel.members.collectAsStateWithLifecycle()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (members.isEmpty()) {
            EmptyState(
                type = EmptyStateType.NoData(
                    title = "Sem membros",
                    description = "Nenhum membro neste grupo"
                )
            )
        } else {
            MembersList(
                members = members,
                onMemberClick = { member ->
                    viewModel.handleMemberClick(member)
                },
                onRemove = { member ->
                    viewModel.removeMember(member.id)
                }
            )
        }
    }
}

@Composable
private fun MembersList(
    members: List<Member>,
    onMemberClick: (Member) -> Unit,
    onRemove: (Member) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(members, key = { it.id }) { member ->
            MemberCard(
                member = member,
                onClick = { onMemberClick(member) },
                onRemove = { onRemove(member) }
            )
        }
    }
}

@Composable
private fun MemberCard(
    member: Member,
    onClick: () -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Foto
            AsyncImage(
                model = member.photoUrl,
                contentDescription = member.name,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
            )

            // Informações
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = member.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = member.role,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Botão remove
            if (member.canBeRemoved) {
                IconButton(onClick = onRemove) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Remover",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}
```

---

## Template 3: Adapter com Multiple Callbacks + Conditional Logic

### Cenário: SchedulesAdapter, ManageFieldsAdapter

#### Adapter Original
```kotlin
class SchedulesAdapter(
    private val onEditClick: (Schedule) -> Unit,
    private val onDeleteClick: (Schedule) -> Unit,
    private val onEnableClick: (Schedule) -> Unit,
    private val onDisableClick: (Schedule) -> Unit
) : ListAdapter<Schedule, SchedulesAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemScheduleBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class ViewHolder(val binding: ItemScheduleBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(schedule: Schedule) {
            binding.apply {
                tvScheduleName.text = schedule.name
                tvScheduleFrequency.text = schedule.getFrequencyText()
                tvScheduleStatus.text = if (schedule.isActive) "Ativo" else "Inativo"
                tvScheduleStatus.setTextColor(
                    if (schedule.isActive) Color.GREEN else Color.GRAY
                )

                btnEdit.setOnClickListener { onEditClick(schedule) }
                btnDelete.setOnClickListener { onDeleteClick(schedule) }

                if (schedule.isActive) {
                    btnToggle.text = "Desativar"
                    btnToggle.setOnClickListener { onDisableClick(schedule) }
                } else {
                    btnToggle.text = "Ativar"
                    btnToggle.setOnClickListener { onEnableClick(schedule) }
                }
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<Schedule>() {
        override fun areItemsTheSame(oldItem: Schedule, newItem: Schedule) = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: Schedule, newItem: Schedule) = oldItem == newItem
    }
}
```

#### Composable Equivalente
```kotlin
// SchedulesScreen.kt
@Composable
fun SchedulesScreen(
    viewModel: SchedulesViewModel,
    modifier: Modifier = Modifier
) {
    val schedules by viewModel.schedules.collectAsStateWithLifecycle()
    val actionState by viewModel.actionState.collectAsStateWithLifecycle()

    var selectedSchedule by remember { mutableStateOf<Schedule?>(null) }

    Box(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(schedules, key = { it.id }) { schedule ->
                ScheduleCard(
                    schedule = schedule,
                    onEdit = { selectedSchedule = it },
                    onDelete = { viewModel.deleteSchedule(it.id) },
                    onToggle = {
                        if (it.isActive) {
                            viewModel.disableSchedule(it.id)
                        } else {
                            viewModel.enableSchedule(it.id)
                        }
                    }
                )
            }
        }
    }

    // Edit Dialog
    selectedSchedule?.let { schedule ->
        ScheduleEditDialog(
            schedule = schedule,
            onDismiss = { selectedSchedule = null },
            onSave = { updated ->
                viewModel.updateSchedule(updated)
                selectedSchedule = null
            }
        )
    }
}

@Composable
private fun ScheduleCard(
    schedule: Schedule,
    onEdit: (Schedule) -> Unit,
    onDelete: (Schedule) -> Unit,
    onToggle: (Schedule) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (schedule.isActive) {
                MaterialTheme.colorScheme.surface
            } else {
                MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            }
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = schedule.name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = schedule.getFrequencyText(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Status badge
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (schedule.isActive) {
                        Color(0xFF4CAF50).copy(alpha = 0.2f)
                    } else {
                        Color.Gray.copy(alpha = 0.2f)
                    }
                ) {
                    Text(
                        text = if (schedule.isActive) "Ativo" else "Inativo",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (schedule.isActive) Color(0xFF4CAF50) else Color.Gray,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = { onEdit(schedule) },
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Editar")
                }

                Button(
                    onClick = { onToggle(schedule) },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (schedule.isActive) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.primary
                        }
                    )
                ) {
                    Text(if (schedule.isActive) "Desativar" else "Ativar")
                }

                IconButton(
                    onClick = { onDelete(schedule) },
                    modifier = Modifier.size(40.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = "Deletar",
                        tint = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}
```

---

## Template 4: Adapter com AsyncImage (Coil)

### Cenário: LocationDashboardAdapter, ManageLocationsAdapter

#### Adapter Original
```kotlin
class LocationsAdapter(
    private val onLocationClick: (Location) -> Unit
) : ListAdapter<Location, LocationsAdapter.ViewHolder>(DiffCallback()) {

    inner class ViewHolder(val binding: ItemLocationBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(location: Location) {
            binding.apply {
                tvLocationName.text = location.name
                tvLocationAddress.text = location.address

                // Coil loading
                binding.ivLocationPhoto.load(location.photoUrl) {
                    crossfade(true)
                    placeholder(R.drawable.ic_placeholder)
                    error(R.drawable.ic_error)
                }

                root.setOnClickListener { onLocationClick(location) }
            }
        }
    }
}
```

#### Composable Equivalente
```kotlin
@Composable
private fun LocationCard(
    location: Location,
    onClick: (Location) -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onClick(location) },
        shape = RoundedCornerShape(12.dp)
    ) {
        Column {
            // Imagem
            AsyncImage(
                model = location.photoUrl,
                contentDescription = location.name,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp),
                contentScale = ContentScale.Crop,
                placeholder = painterResource(R.drawable.ic_placeholder),
                error = painterResource(R.drawable.ic_error)
            )

            // Info
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = location.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = location.address,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
```

---

## Template 5: Adapter com SwipeToDismiss + Conditional Content

### Cenário: CashboxEntriesAdapter

#### Adapter Original
```kotlin
class CashboxAdapter(
    private val onEntryClick: (Entry) -> Unit,
    private val onDeleteClick: (Entry) -> Unit
) : ListAdapter<Entry, CashboxAdapter.ViewHolder>(DiffCallback()) {

    inner class ViewHolder(val binding: ItemCashboxBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(entry: Entry) {
            binding.apply {
                tvDescription.text = entry.description
                tvAmount.text = "R$ ${entry.amount}"
                tvAmount.setTextColor(
                    if (entry.type == "ENTRADA") Color.GREEN else Color.RED
                )
                tvDate.text = SimpleDateFormat("dd/MM/yyyy HH:mm").format(entry.date)

                if (entry.canDelete) {
                    btnDelete.visibility = View.VISIBLE
                    btnDelete.setOnClickListener { onDeleteClick(entry) }
                }
            }
        }
    }
}
```

#### Composable Equivalente
```kotlin
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CashboxEntryCard(
    entry: Entry,
    onDelete: (Entry) -> Unit,
    modifier: Modifier = Modifier
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            when (dismissValue) {
                SwipeToDismissBoxValue.EndToStart -> {
                    onDelete(entry)
                    true
                }
                else -> false
            }
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.error)
                    .padding(horizontal = 20.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Deletar",
                    tint = MaterialTheme.colorScheme.onError
                )
            }
        },
        enableDismissFromStartToEnd = false
    ) {
        Card(
            modifier = modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Ícone de tipo
                Surface(
                    shape = CircleShape,
                    color = if (entry.type == "ENTRADA") {
                        Color(0xFF4CAF50).copy(alpha = 0.2f)
                    } else {
                        Color(0xFFE53935).copy(alpha = 0.2f)
                    }
                ) {
                    Icon(
                        imageVector = if (entry.type == "ENTRADA") {
                            Icons.Default.Add
                        } else {
                            Icons.Default.Remove
                        },
                        contentDescription = null,
                        tint = if (entry.type == "ENTRADA") {
                            Color(0xFF4CAF50)
                        } else {
                            Color(0xFFE53935)
                        },
                        modifier = Modifier.padding(8.dp)
                    )
                }

                // Conteúdo
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = entry.description,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR"))
                            .format(entry.date),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Valor
                Text(
                    text = "R$ ${String.format("%.2f", entry.amount)}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (entry.type == "ENTRADA") {
                        Color(0xFF4CAF50)
                    } else {
                        Color(0xFFE53935)
                    }
                )
            }
        }
    }
}
```

---

## Checklist Rápido para Conversão

```
Para cada adapter XyzAdapter.kt:

[ ] 1. Encontrar data model: data class Xyz
[ ] 2. Listar callbacks: onAction(), onEdit(), etc
[ ] 3. Procurar Screen Compose existente
    [ ] 3a. Se existe: Verificar se já tem LazyColumn/LazyVerticalGrid
    [ ] 3b. Se não existe: Criar novo arquivo XyzScreen.kt
[ ] 4. Implementar componentes:
    [ ] 4a. @Composable fun XyzList(items, callbacks)
    [ ] 4b. @Composable fun XyzCard(item, callbacks)
    [ ] 4c. Funções utilitárias
[ ] 5. Testar:
    [ ] LazyColumn renderiza todos items
    [ ] Callbacks funcionam
    [ ] Estados vazios/erro aparecem
    [ ] Shimmer loading aparece
[ ] 6. Cleanup:
    [ ] Marcar adapter XML para remoção
    [ ] Atualizar Fragment/Activity para usar ComposeView
    [ ] Testes passam
```

---

## Imports Comuns para Todos Templates

```kotlin
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import java.text.SimpleDateFormat
import java.util.Locale
```

---

**Próximo passo:** Escolher um dos adapters acima (ex: SchedulesAdapter) e usar este template como guia para conversão.
