package com.futebadosparcas.auto

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Placeholder para Android Auto Service do Futeba dos Parças.
 *
 * Para ativar o Android Auto, adicione ao build.gradle.kts:
 * ```kotlin
 * implementation("androidx.car.app:app:1.4.0")
 * ```
 *
 * E descomente a implementação completa neste arquivo.
 *
 * Funcionalidades planejadas:
 * - Ver próximos jogos
 * - Ver placar de jogos ao vivo
 * - Navegar até o local do jogo
 */

// ==================== Data Models ====================

/**
 * Modelo de dados para jogo no Android Auto.
 */
data class AutoGameData(
    val id: String,
    val locationName: String,
    val fieldName: String,
    val date: Date,
    val confirmedPlayers: Int,
    val maxPlayers: Int,
    val address: String,
    val latitude: Double,
    val longitude: Double
) {
    private val dateFormat = SimpleDateFormat("dd/MM HH:mm", Locale.forLanguageTag("pt-BR"))

    fun getFormattedDateTime(): String = dateFormat.format(date)
}

/**
 * Modelo de dados para jogo ao vivo no Android Auto.
 */
data class AutoLiveGameData(
    val gameId: String,
    val locationName: String,
    val team1Name: String,
    val team1Score: Int,
    val team2Name: String,
    val team2Score: Int,
    val gameTime: String
)

// ==================== Helper Functions ====================

/**
 * Retorna lista de próximos jogos para exibir no Android Auto.
 * Em produção, buscar do GameRepository.
 */
fun getSampleUpcomingGames(): List<AutoGameData> {
    return listOf(
        AutoGameData(
            id = "1",
            locationName = "Arena Futeba",
            fieldName = "Quadra 1",
            date = Date(System.currentTimeMillis() + 3600000), // 1 hora
            confirmedPlayers = 12,
            maxPlayers = 14,
            address = "Rua das Peladas, 123",
            latitude = -23.550520,
            longitude = -46.633309
        ),
        AutoGameData(
            id = "2",
            locationName = "Complexo Esportivo",
            fieldName = "Campo Society",
            date = Date(System.currentTimeMillis() + 86400000), // Amanhã
            confirmedPlayers = 18,
            maxPlayers = 22,
            address = "Av. dos Esportes, 456",
            latitude = -23.561414,
            longitude = -46.655881
        )
    )
}

/**
 * Retorna lista de jogos ao vivo para exibir no Android Auto.
 * Em produção, buscar do LiveGameRepository.
 */
fun getSampleLiveGames(): List<AutoLiveGameData> {
    return listOf(
        AutoLiveGameData(
            gameId = "live1",
            locationName = "Arena Futeba",
            team1Name = "Time A",
            team1Score = 3,
            team2Name = "Time B",
            team2Score = 2,
            gameTime = "32'"
        )
    )
}

/*
 * ==================== IMPLEMENTAÇÃO COMPLETA (requer dependência) ====================
 *
 * Para habilitar o Android Auto, adicione a dependência e descomente o código abaixo:
 *
 * ```kotlin
 * // build.gradle.kts
 * implementation("androidx.car.app:app:1.4.0")
 * ```
 *
 * ```xml
 * <!-- AndroidManifest.xml -->
 * <service
 *     android:name=".auto.FutebaAutoService"
 *     android:exported="true"
 *     android:permission="androidx.car.app.permission.TEMPLATE_RENDERER">
 *     <intent-filter>
 *         <action android:name="androidx.car.app.CarAppService" />
 *         <category android:name="androidx.car.app.category.IOT" />
 *     </intent-filter>
 * </service>
 *
 * <meta-data
 *     android:name="com.google.android.gms.car.application"
 *     android:resource="@xml/automotive_app_desc" />
 * ```
 *
 * O código completo da implementação estava:
 * - FutebaAutoService : CarAppService
 * - FutebaAutoSession : Session
 * - MainAutoScreen : Screen - Tela principal com opções
 * - UpcomingGamesScreen : Screen - Lista de próximos jogos
 * - LiveGamesScreen : Screen - Lista de jogos ao vivo
 * - GameDetailAutoScreen : Screen - Detalhes do jogo com navegação
 * - LiveScoreAutoScreen : Screen - Placar ao vivo
 */
