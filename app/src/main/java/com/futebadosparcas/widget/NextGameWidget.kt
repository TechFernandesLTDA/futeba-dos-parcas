package com.futebadosparcas.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.futebadosparcas.R
import com.futebadosparcas.ui.main.MainActivityCompose
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldPath
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Widget que mostra o próximo jogo confirmado do usuário.
 * Atualiza automaticamente e permite abrir o app diretamente.
 */
class NextGameWidget : AppWidgetProvider() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Atualiza cada instância do widget
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {
        // Widget ativado pela primeira vez
    }

    override fun onDisabled(context: Context) {
        // Último widget removido
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        // Ações customizadas
        when (intent.action) {
            ACTION_REFRESH -> {
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val widgetComponent = ComponentName(context, NextGameWidget::class.java)
                val appWidgetIds = appWidgetManager.getAppWidgetIds(widgetComponent)
                onUpdate(context, appWidgetManager, appWidgetIds)
            }
        }
    }

    private fun updateWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        scope.launch {
            try {
                val gameData = fetchNextGame()

                val views = if (gameData != null) {
                    createGameViews(context, gameData, appWidgetId)
                } else {
                    createEmptyViews(context, appWidgetId)
                }

                appWidgetManager.updateAppWidget(appWidgetId, views)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Registra antes de mostrar o estado de erro, para a falha não sumir.
                AppLogger.e(TAG, "Falha ao buscar o próximo jogo do widget", e)
                val views = createErrorViews(context, appWidgetId)
                appWidgetManager.updateAppWidget(appWidgetId, views)
            }
        }
    }

    private suspend fun fetchNextGame(): NextGameData? {
        val userId = FirebaseAuth.getInstance().currentUser?.uid ?: return null

        val firestore = FirebaseFirestore.getInstance()
        val today = Date()

        // Busca próximas confirmações do usuário
        val confirmations = firestore.collection("confirmations")
            .whereEqualTo("user_id", userId)
            .whereEqualTo("status", "CONFIRMED")
            .get()
            .await()

        if (confirmations.isEmpty) return null

        val gameIds = confirmations.documents.mapNotNull { it.getString("game_id") }
        if (gameIds.isEmpty()) return null

        // #4594: filtro por ID de documento não combina com desigualdade em `dateTime`
        // (o Firestore recusa a consulta). Busca por ID em blocos, só com `status in`,
        // e escolhe no cliente o jogo futuro mais próximo. Percorre todos os blocos,
        // em vez de só as dez primeiras confirmações.
        val candidatos = ProximoJogoWidget.blocos(gameIds).flatMap { bloco ->
            buscarBloco(firestore, bloco)
        }
        val game = ProximoJogoWidget.escolherProximo(candidatos, today) { doc ->
            runCatching { doc.getDate("dateTime") }.getOrNull()
        } ?: return null

        return NextGameData(
            id = game.id,
            title = game.getString("group_name") ?: "Pelada",
            location = game.getString("location_name") ?: "",
            date = game.getString("date") ?: "",
            time = game.getString("time") ?: "",
            confirmedCount = (game.get("confirmed_count") as? Long)?.toInt() ?: 0,
            maxPlayers = (game.get("max_players") as? Long)?.toInt() ?: 14
        )
    }

    /**
     * Lê um bloco de até dez jogos ativos. Se um jogo do bloco não puder mais ser lido
     * (grupo de que a pessoa saiu), as regras negam a consulta inteira; nesse caso lê
     * os jogos um por um e ignora os negados.
     */
    private suspend fun buscarBloco(
        firestore: FirebaseFirestore,
        bloco: List<String>
    ): List<DocumentSnapshot> {
        val games = firestore.collection("games")
        return try {
            games.whereIn(FieldPath.documentId(), bloco)
                .whereIn("status", ProximoJogoWidget.STATUS_ATIVOS)
                .get()
                .await()
                .documents
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            AppLogger.w(TAG) { "Bloco de jogos negado; lendo um por um: ${e.message}" }
            bloco.mapNotNull { id ->
                try {
                    games.document(id).get().await().takeIf { doc ->
                        doc.exists() && doc.getString("status") in ProximoJogoWidget.STATUS_ATIVOS
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    null
                }
            }
        }
    }

    private fun createGameViews(
        context: Context,
        game: NextGameData,
        appWidgetId: Int
    ): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_next_game)

        // Formata a data
        val formattedDate = try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val outputFormat = SimpleDateFormat("EEE, dd/MM", Locale.forLanguageTag("pt-BR"))
            val date = inputFormat.parse(game.date)
            date?.let { outputFormat.format(it) } ?: game.date
        } catch (e: Exception) {
            game.date
        }

        // Atualiza textos
        views.setTextViewText(R.id.widget_game_title, game.title)
        views.setTextViewText(R.id.widget_game_location, game.location)
        views.setTextViewText(R.id.widget_game_datetime, "$formattedDate às ${game.time}")
        views.setTextViewText(
            R.id.widget_game_players,
            "${game.confirmedCount}/${game.maxPlayers} confirmados"
        )

        // Intent para abrir o jogo
        val openIntent = Intent(context, MainActivityCompose::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "game_detail")
            putExtra("game_id", game.id)
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_container, openPendingIntent)

        // Intent para refresh
        val refreshIntent = Intent(context, NextGameWidget::class.java).apply {
            action = ACTION_REFRESH
        }
        val refreshPendingIntent = PendingIntent.getBroadcast(
            context,
            appWidgetId + 1000,
            refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_refresh_button, refreshPendingIntent)

        return views
    }

    private fun createEmptyViews(context: Context, appWidgetId: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_next_game_empty)

        // Intent para abrir o app
        val openIntent = Intent(context, MainActivityCompose::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            appWidgetId,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_empty_container, openPendingIntent)

        return views
    }

    private fun createErrorViews(context: Context, appWidgetId: Int): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_next_game_error)

        // Intent para refresh
        val refreshIntent = Intent(context, NextGameWidget::class.java).apply {
            action = ACTION_REFRESH
        }
        val refreshPendingIntent = PendingIntent.getBroadcast(
            context,
            appWidgetId + 2000,
            refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_error_container, refreshPendingIntent)

        return views
    }

    companion object {
        const val ACTION_REFRESH = "com.futebadosparcas.widget.ACTION_REFRESH"
        private const val TAG = "NextGameWidget"

        /**
         * Atualiza todos os widgets do app.
         */
        fun updateAllWidgets(context: Context) {
            val intent = Intent(context, NextGameWidget::class.java).apply {
                action = ACTION_REFRESH
            }
            context.sendBroadcast(intent)
        }
    }
}

/**
 * Dados do próximo jogo para o widget.
 */
data class NextGameData(
    val id: String,
    val title: String,
    val location: String,
    val date: String,
    val time: String,
    val confirmedCount: Int,
    val maxPlayers: Int
)
