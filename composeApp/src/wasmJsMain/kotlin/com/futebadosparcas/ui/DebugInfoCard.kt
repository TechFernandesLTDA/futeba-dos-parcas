package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager

@Composable
fun DebugInfoCard(
    modifier: Modifier = Modifier
) {
    val firebaseProjectId = remember { "futeba-dos-parcas-dev" }
    val appVersion = remember { "1.10.7" }
    val buildType = remember { "DEBUG" }
    val buildDate = remember { "2026-02-22" }
    val kotlinVersion = remember { "2.2.10" }
    val composeVersion = remember { "1.10.0" }
    
    val currentUserId = FirebaseManager.getCurrentUserId()
    val currentUserEmail = FirebaseManager.getCurrentUserEmail()
    val localStorageSize = remember { calculateLocalStorageSize() }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "🔧 Informações de Debug",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = if (buildType == "DEBUG") 
                        MaterialTheme.colorScheme.error 
                    else 
                        MaterialTheme.colorScheme.primary
                ) {
                    Text(
                        text = buildType,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onError
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            DebugInfoRow(label = "Versão do App", value = appVersion)
            DebugInfoRow(label = "Data do Build", value = buildDate)
            DebugInfoRow(label = "Kotlin", value = kotlinVersion)
            DebugInfoRow(label = "Compose", value = composeVersion)
            
            HorizontalDivider(
                modifier = Modifier.padding(vertical = 8.dp),
                color = MaterialTheme.colorScheme.outlineVariant
            )
            
            DebugInfoRow(label = "Firebase Project", value = firebaseProjectId)
            DebugInfoRow(label = "User ID", value = currentUserId ?: "Não logado")
            DebugInfoRow(label = "Email", value = currentUserEmail ?: "-")
            
            HorizontalDivider(
                modifier = Modifier.padding(vertical = 8.dp),
                color = MaterialTheme.colorScheme.outlineVariant
            )
            
            DebugInfoRow(label = "LocalStorage", value = localStorageSize)
            DebugInfoRow(label = "Plataforma", value = "Web (WASM)")
            DebugInfoRow(label = "User Agent", value = getUserAgentShort())
        }
    }
}

@Composable
private fun DebugInfoRow(
    label: String,
    value: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1
        )
    }
}

private fun calculateLocalStorageSize(): String {
    return try {
        val byteCount = jsCalculateLocalStorageBytes()
        when {
            byteCount < 1024 -> "$byteCount B"
            byteCount < 1024 * 1024 -> "${(byteCount / 1024)} KB"
            else -> "${(byteCount / (1024 * 1024))} MB"
        }
    } catch (e: Exception) {
        "N/A"
    }
}

private fun getUserAgentShort(): String {
    return try {
        val ua = jsGetUserAgent()
        when {
            ua.contains("Firefox") -> "Firefox"
            ua.contains("Chrome") && !ua.contains("Edg") -> "Chrome"
            ua.contains("Safari") && !ua.contains("Chrome") -> "Safari"
            ua.contains("Edg") -> "Edge"
            ua.contains("Opera") || ua.contains("OPR") -> "Opera"
            else -> "Browser"
        }
    } catch (e: Exception) {
        "Unknown"
    }
}
