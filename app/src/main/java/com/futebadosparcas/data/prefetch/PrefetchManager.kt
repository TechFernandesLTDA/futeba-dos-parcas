package com.futebadosparcas.data.prefetch

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Gerenciador de Prefetch Inteligente.
 */

enum class PrefetchDataType {
    UPCOMING_GAMES, GROUP_DATA, PLAYER_PROFILES, LOCATION_DETAILS, STATISTICS, NOTIFICATIONS
}

enum class PrefetchPriority { HIGH, MEDIUM, LOW }

enum class NetworkCondition { WIFI_ONLY, UNMETERED, ANY }

data class PrefetchItem(
    val id: String,
    val dataType: PrefetchDataType,
    val priority: PrefetchPriority,
    val networkCondition: NetworkCondition = NetworkCondition.ANY,
    val entityIds: List<String> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + (30 * 60 * 1000)
)

sealed class PrefetchResult {
    data class Success(val itemId: String, val dataSize: Long) : PrefetchResult()
    data class Skipped(val itemId: String, val reason: String) : PrefetchResult()
    data class Failed(val itemId: String, val error: String) : PrefetchResult()
}

data class PrefetchConfig(
    val maxConcurrentPrefetches: Int = 3,
    val maxQueueSize: Int = 50,
    val defaultTTLMinutes: Int = 30
)

interface PrefetchExecutor {
    suspend fun executePrefetch(item: PrefetchItem): PrefetchResult
}

interface PrefetchListener {
    fun onPrefetchStarted(item: PrefetchItem)
    fun onPrefetchCompleted(result: PrefetchResult)
    fun onQueueChanged(queueSize: Int)
}

class PrefetchManager(
    private val context: Context,
    private val config: PrefetchConfig = PrefetchConfig()
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val queue = mutableListOf<PrefetchItem>()
    private val activeJobs = mutableMapOf<String, Job>()
    private var executor: PrefetchExecutor? = null
    private var listener: PrefetchListener? = null

    fun setExecutor(executor: PrefetchExecutor) { this.executor = executor }
    fun setListener(listener: PrefetchListener) { this.listener = listener }

    fun schedule(item: PrefetchItem) {
        if (queue.size >= config.maxQueueSize) {
            queue.removeAll { it.priority == PrefetchPriority.LOW }
        }
        if (queue.none { it.id == item.id }) {
            queue.add(item)
            queue.sortBy { it.priority.ordinal }
            listener?.onQueueChanged(queue.size)
            processQueue()
        }
    }

    fun scheduleAll(items: List<PrefetchItem>) = items.forEach { schedule(it) }

    fun cancel(itemId: String) {
        queue.removeAll { it.id == itemId }
        activeJobs[itemId]?.cancel()
        activeJobs.remove(itemId)
        listener?.onQueueChanged(queue.size)
    }

    fun cancelAll() {
        queue.clear()
        activeJobs.values.forEach { it.cancel() }
        activeJobs.clear()
        listener?.onQueueChanged(0)
    }

    fun isPending(itemId: String) = queue.any { it.id == itemId } || activeJobs.containsKey(itemId)
    fun getQueueSize() = queue.size
    fun getActiveItems() = activeJobs.keys.toList()

    private fun processQueue() {
        if (activeJobs.size >= config.maxConcurrentPrefetches) return
        if (!isNetworkAvailable()) return

        val nextItem = queue.firstOrNull { item ->
            canExecuteWithCurrentNetwork(item.networkCondition) &&
            System.currentTimeMillis() <= item.expiresAt &&
            !activeJobs.containsKey(item.id)
        } ?: return

        queue.remove(nextItem)
        executePrefetch(nextItem)
    }

    private fun executePrefetch(item: PrefetchItem) {
        val exec = executor ?: return
        val job = scope.launch {
            listener?.onPrefetchStarted(item)
            val result = try {
                exec.executePrefetch(item)
            } catch (e: Exception) {
                PrefetchResult.Failed(item.id, e.message ?: "Unknown error")
            }
            activeJobs.remove(item.id)
            listener?.onPrefetchCompleted(result)
            listener?.onQueueChanged(queue.size)
            delay(100)
            processQueue()
        }
        activeJobs[item.id] = job
    }

    private fun canExecuteWithCurrentNetwork(condition: NetworkCondition): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return false
        return when (condition) {
            NetworkCondition.WIFI_ONLY -> caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
            NetworkCondition.UNMETERED -> caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
            NetworkCondition.ANY -> caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return cm.getNetworkCapabilities(cm.activeNetwork)
            ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }
}

object PrefetchStrategies {
    fun onAppStart(userId: String) = listOf(
        PrefetchItem("upcoming_games_$userId", PrefetchDataType.UPCOMING_GAMES, PrefetchPriority.HIGH, entityIds = listOf(userId)),
        PrefetchItem("notifications_$userId", PrefetchDataType.NOTIFICATIONS, PrefetchPriority.HIGH, entityIds = listOf(userId)),
        PrefetchItem("statistics_$userId", PrefetchDataType.STATISTICS, PrefetchPriority.MEDIUM, entityIds = listOf(userId))
    )

    fun onGroupScreen(groupId: String, memberIds: List<String>) = listOf(
        PrefetchItem("group_games_$groupId", PrefetchDataType.UPCOMING_GAMES, PrefetchPriority.HIGH, entityIds = listOf(groupId)),
        PrefetchItem("group_members_$groupId", PrefetchDataType.PLAYER_PROFILES, PrefetchPriority.MEDIUM, entityIds = memberIds.take(20))
    )

    fun onGameDetail(gameId: String, locationId: String, playerIds: List<String>) = listOf(
        PrefetchItem("location_$locationId", PrefetchDataType.LOCATION_DETAILS, PrefetchPriority.HIGH, entityIds = listOf(locationId)),
        PrefetchItem("game_players_$gameId", PrefetchDataType.PLAYER_PROFILES, PrefetchPriority.MEDIUM,
            NetworkCondition.UNMETERED, playerIds.take(30))
    )

    fun backgroundRefresh(userId: String, groupIds: List<String>): List<PrefetchItem> {
        val items = mutableListOf(
            PrefetchItem("all_upcoming_games", PrefetchDataType.UPCOMING_GAMES, PrefetchPriority.LOW, NetworkCondition.WIFI_ONLY)
        )
        groupIds.forEach { groupId ->
            items.add(PrefetchItem("group_data_$groupId", PrefetchDataType.GROUP_DATA, PrefetchPriority.LOW,
                NetworkCondition.WIFI_ONLY, listOf(groupId)))
        }
        return items
    }
}
