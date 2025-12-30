package com.futebadosparcas.ui.profile

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.fragment.app.Fragment
import androidx.navigation.fragment.findNavController
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.FutebaTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader

class AboutFragment : Fragment() {

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        return ComposeView(requireContext()).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
            setContent {
                FutebaTheme {
                    AboutScreen(
                        onBack = { findNavController().popBackStack() }
                    )
                }
            }
        }
    }
}

data class Release(val version: String, val date: String, val sections: List<Section>)
data class Section(val title: String, val items: List<String>)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AboutScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var releases by remember { mutableStateOf<List<Release>>(emptyList()) }

    LaunchedEffect(Unit) {
        releases = loadChangelog(context)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sobre o Futeba", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Logo do App com fundo circular
            Box(
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.verticalGradient(
                            listOf(
                                MaterialTheme.colorScheme.primary,
                                MaterialTheme.colorScheme.secondary
                            )
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                // Using the specific icon requested: ic_launcher-playstore (mapped to ic_app_logo_full)
                Image(
                    painter = painterResource(id = R.drawable.ic_app_logo_full),
                    contentDescription = null,
                    modifier = Modifier.size(100.dp),
                    contentScale = ContentScale.Fit
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "Futeba dos Parças",
                fontSize = 28.sp,
                fontWeight = FontWeight.ExtraBold,
                color = MaterialTheme.colorScheme.primary
            )

            Text(
                text = "Versão ${BuildConfig.VERSION_NAME}",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(32.dp))

            // Card de Missão
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        Icons.Filled.Info,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(32.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Nossa Missão",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Simplificar a vida de quem ama bater uma pelada. Organize jogos, gerencie times e acompanhe sua evolução para se tornar uma lenda do campo!",
                        textAlign = TextAlign.Center,
                        fontSize = 15.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 22.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Seção Changelog
            Text(
                text = "Novidades das Atualizações",
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                textAlign = TextAlign.Start,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (releases.isEmpty()) {
                CircularProgressIndicator(modifier = Modifier.padding(16.dp))
            } else {
                releases.forEach { release ->
                    ReleaseItem(release)
                    Spacer(modifier = Modifier.height(16.dp))
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Seção de Tecnologia
            Text(
                text = "Tecnologia & Inovação",
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Start
            )

            Spacer(modifier = Modifier.height(12.dp))

            TechItem("Kotlin", "Moderno e seguro por padrão")
            TechItem("Jetpack Compose", "UI nativa e performante")
            TechItem("Firebase", "Dados em tempo real")
            TechItem("Material 3", "Design system avançado")

            Spacer(modifier = Modifier.height(40.dp))

            Text(
                text = "Desenvolvido com ❤️ pelo time Tech Fernandes",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
fun ReleaseItem(release: Release) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "v${release.version}",
                    fontWeight = FontWeight.Black,
                    fontSize = 18.sp,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = release.date,
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            Spacer(modifier = Modifier.height(8.dp))
            
            release.sections.forEach { section ->
                Text(
                    text = section.title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                )
                section.items.forEach { item ->
                    Row(modifier = Modifier.padding(vertical = 2.dp)) {
                        Text(
                            text = "•",
                            modifier = Modifier.padding(end = 8.dp),
                            color = MaterialTheme.colorScheme.primary
                        )
                        Text(
                            text = item,
                            fontSize = 13.sp,
                            lineHeight = 18.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TechItem(title: String, description: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primary)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(text = title, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text(text = description, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

suspend fun loadChangelog(context: Context): List<Release> = withContext(Dispatchers.IO) {
    val releases = mutableListOf<Release>()
    try {
        val inputStream = context.assets.open("CHANGELOG.md")
        val reader = BufferedReader(InputStreamReader(inputStream))
        
        var currentVersion = ""
        var currentDate = ""
        var currentSections = mutableListOf<Section>()
        var currentSectionTitle = ""
        var currentItems = mutableListOf<String>()

        reader.forEachLine { line ->
            val trimmed = line.trim()
            when {
                trimmed.startsWith("## [") -> {
                    // Save previous release
                    if (currentVersion.isNotEmpty()) {
                        if (currentSectionTitle.isNotEmpty()) {
                            currentSections.add(Section(currentSectionTitle, currentItems.toList()))
                        }
                        releases.add(Release(currentVersion, currentDate, currentSections.toList()))
                    }
                    // Start new release
                    // Format: ## [1.1.0] - 2025-12-29
                    val versionPart = trimmed.substringAfter("[").substringBefore("]")
                    val datePart = trimmed.substringAfter("- ").trim()
                    currentVersion = versionPart
                    currentDate = datePart
                    currentSections = mutableListOf()
                    currentItems = mutableListOf()
                    currentSectionTitle = ""
                }
                trimmed.startsWith("### ") -> {
                    // Save previous section
                    if (currentSectionTitle.isNotEmpty()) {
                        currentSections.add(Section(currentSectionTitle, currentItems.toList()))
                    }
                    currentSectionTitle = trimmed.substringAfter("### ").trim()
                    currentItems = mutableListOf()
                }
                trimmed.startsWith("- ") -> {
                    var content = trimmed.substringAfter("- ").trim()
                    // Remove bold markdown for cleaner look if needed, or keeping it plain
                    content = content.replace("**", "")
                    currentItems.add(content)
                }
            }
        }
        
        // Add last release
        if (currentVersion.isNotEmpty()) {
             if (currentSectionTitle.isNotEmpty()) {
                currentSections.add(Section(currentSectionTitle, currentItems.toList()))
            }
            releases.add(Release(currentVersion, currentDate, currentSections.toList()))
        }
        
        reader.close()
    } catch (e: Exception) {
        e.printStackTrace()
    }
    releases
}
