package com.futebadosparcas.ui.tactical

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

data class Formation(
    val id: String,
    val name: String,
    val displayName: String,
    val positions: List<FormationPosition>
)

data class FormationPosition(
    val x: Float,
    val y: Float,
    val role: String
)

object Formations {
    val FORMATIONS = listOf(
        Formation(
            id = "4-4-2",
            name = "4-4-2",
            displayName = "4-4-2 (Clássico)",
            positions = listOf(
                FormationPosition(0.5f, 0.92f, "GK"),
                FormationPosition(0.15f, 0.72f, "ZAG"),
                FormationPosition(0.38f, 0.72f, "ZAG"),
                FormationPosition(0.62f, 0.72f, "ZAG"),
                FormationPosition(0.85f, 0.72f, "ZAG"),
                FormationPosition(0.15f, 0.48f, "LAT"),
                FormationPosition(0.38f, 0.48f, "VOL"),
                FormationPosition(0.62f, 0.48f, "MEI"),
                FormationPosition(0.85f, 0.48f, "LAT"),
                FormationPosition(0.35f, 0.22f, "ATA"),
                FormationPosition(0.65f, 0.22f, "ATA")
            )
        ),
        Formation(
            id = "3-5-2",
            name = "3-5-2",
            displayName = "3-5-2 (Com Ala)",
            positions = listOf(
                FormationPosition(0.5f, 0.92f, "GK"),
                FormationPosition(0.25f, 0.72f, "ZAG"),
                FormationPosition(0.5f, 0.72f, "ZAG"),
                FormationPosition(0.75f, 0.72f, "ZAG"),
                FormationPosition(0.08f, 0.50f, "ALA"),
                FormationPosition(0.35f, 0.52f, "VOL"),
                FormationPosition(0.5f, 0.48f, "MEI"),
                FormationPosition(0.65f, 0.52f, "VOL"),
                FormationPosition(0.92f, 0.50f, "ALA"),
                FormationPosition(0.35f, 0.22f, "ATA"),
                FormationPosition(0.65f, 0.22f, "ATA")
            )
        ),
        Formation(
            id = "4-3-3",
            name = "4-3-3",
            displayName = "4-3-3 (Ofensivo)",
            positions = listOf(
                FormationPosition(0.5f, 0.92f, "GK"),
                FormationPosition(0.15f, 0.72f, "ZAG"),
                FormationPosition(0.38f, 0.72f, "ZAG"),
                FormationPosition(0.62f, 0.72f, "ZAG"),
                FormationPosition(0.85f, 0.72f, "ZAG"),
                FormationPosition(0.3f, 0.50f, "VOL"),
                FormationPosition(0.5f, 0.48f, "MEI"),
                FormationPosition(0.7f, 0.50f, "VOL"),
                FormationPosition(0.2f, 0.22f, "PON"),
                FormationPosition(0.5f, 0.18f, "ATA"),
                FormationPosition(0.8f, 0.22f, "PON")
            )
        ),
        Formation(
            id = "5-3-2",
            name = "5-3-2",
            displayName = "5-3-2 (Defensivo)",
            positions = listOf(
                FormationPosition(0.5f, 0.92f, "GK"),
                FormationPosition(0.1f, 0.72f, "LAT"),
                FormationPosition(0.3f, 0.75f, "ZAG"),
                FormationPosition(0.5f, 0.75f, "ZAG"),
                FormationPosition(0.7f, 0.75f, "ZAG"),
                FormationPosition(0.9f, 0.72f, "LAT"),
                FormationPosition(0.3f, 0.50f, "VOL"),
                FormationPosition(0.5f, 0.48f, "MEI"),
                FormationPosition(0.7f, 0.50f, "VOL"),
                FormationPosition(0.35f, 0.22f, "ATA"),
                FormationPosition(0.65f, 0.22f, "ATA")
            )
        )
    )

    fun getById(id: String): Formation = FORMATIONS.find { it.id == id } ?: FORMATIONS[0]
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FormationSelector(
    selectedFormation: Formation,
    onFormationSelected: (Formation) -> Unit,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
        modifier = modifier
    ) {
        OutlinedTextField(
            value = selectedFormation.displayName,
            onValueChange = {},
            readOnly = true,
            label = { Text("Formação") },
            trailingIcon = {
                ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
            },
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(),
            modifier = Modifier.menuAnchor()
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            Formations.FORMATIONS.forEach { formation ->
                DropdownMenuItem(
                    text = {
                        Column {
                            Text(formation.displayName)
                            Text(
                                text = getFormationDescription(formation.id),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    },
                    onClick = {
                        onFormationSelected(formation)
                        expanded = false
                    },
                    contentPadding = ExposedDropdownMenuDefaults.ItemContentPadding
                )
            }
        }
    }
}

private fun getFormationDescription(formationId: String): String {
    return when (formationId) {
        "4-4-2" -> "Equilibrado, bom para contra-ataques"
        "3-5-2" -> "Domínio do meio-campo, alas importantes"
        "4-3-3" -> "Ofensivo, pressão alta"
        "5-3-2" -> "Defensivo, sólido na retaguarda"
        else -> "Formação padrão"
    }
}
