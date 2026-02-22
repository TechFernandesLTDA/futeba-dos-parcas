package com.futebadosparcas.performance

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.launch

object WebPerformance {
    private val scope = CoroutineScope(Dispatchers.Main)
    
    private val loadedModules = mutableSetOf<String>()
    private val moduleLoadTimes = mutableMapOf<String, Long>()
    
    fun markModuleLoaded(moduleName: String) {
        val loadTime = jsGetTimestamp().toLong()
        loadedModules.add(moduleName)
        moduleLoadTimes[moduleName] = loadTime
    }
    
    fun getLoadedModules(): Set<String> = loadedModules.toSet()
    
    fun getModuleLoadTimes(): Map<String, Long> = moduleLoadTimes.toMap()
    
    fun clearModuleTracking() {
        loadedModules.clear()
        moduleLoadTimes.clear()
    }
}

class LazyLoader<T>(
    private val loadFunction: suspend () -> T,
    private val preload: Boolean = false
) {
    private var data: T? = null
    private var loadJob: Job? = null
    private val _state = MutableStateFlow<LazyLoadState<T>>(LazyLoadState.Idle)
    val state: Flow<LazyLoadState<T>> = _state
    
    suspend fun load(): T {
        if (data != null) return data!!
        
        _state.value = LazyLoadState.Loading
        return try {
            val result = loadFunction()
            data = result
            _state.value = LazyLoadState.Loaded(result)
            result
        } catch (e: Exception) {
            _state.value = LazyLoadState.Error(e.message ?: "Unknown error")
            throw e
        }
    }
    
    fun loadAsync(scope: CoroutineScope) {
        if (loadJob?.isActive == true) return
        loadJob = scope.launch {
            load()
        }
    }
    
    fun cancelLoad() {
        loadJob?.cancel()
        loadJob = null
    }
    
    fun reset() {
        cancelLoad()
        data = null
        _state.value = LazyLoadState.Idle
    }
    
    fun getData(): T? = data
}

sealed class LazyLoadState<out T> {
    object Idle : LazyLoadState<Nothing>()
    object Loading : LazyLoadState<Nothing>()
    data class Loaded<T>(val data: T) : LazyLoadState<T>()
    data class Error(val message: String) : LazyLoadState<Nothing>()
}

@Composable
fun <T> rememberLazyLoader(
    loadFunction: suspend () -> T,
    preload: Boolean = false
): LazyLoader<T> {
    return remember { LazyLoader(loadFunction, preload) }
}

@Composable
fun <T> LazyLoadContent(
    loader: LazyLoader<T>,
    loadingContent: @Composable () -> Unit = { ImagePlaceholder() },
    errorContent: @Composable (String) -> Unit = { ImagePlaceholder() },
    content: @Composable (T) -> Unit
) {
    val state by loader.state.collectAsState(LazyLoadState.Idle)
    val scope = rememberCoroutineScope()
    
    LaunchedEffect(loader) {
        if (state == LazyLoadState.Idle) {
            loader.loadAsync(scope)
        }
    }
    
    when (val currentState = state) {
        is LazyLoadState.Idle,
        is LazyLoadState.Loading -> loadingContent()
        is LazyLoadState.Error -> errorContent(currentState.message)
        is LazyLoadState.Loaded -> content(currentState.data)
    }
}

@Composable
fun ImagePlaceholder(
    modifier: Modifier = Modifier,
    size: Dp = 100.dp,
    cornerRadius: Dp = 8.dp,
    shimmerEnabled: Boolean = true
) {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )
    
    Box(
        modifier = modifier
            .size(size)
            .clip(RoundedCornerShape(cornerRadius))
            .background(
                if (shimmerEnabled) {
                    Brush.linearGradient(shimmerColors)
                } else {
                    Brush.linearGradient(listOf(Color.Gray, Color.Gray))
                }
            )
    )
}

@Composable
fun ImagePlaceholderWithSize(
    width: Dp,
    height: Dp,
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 8.dp
) {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )
    
    Box(
        modifier = modifier
            .size(width, height)
            .clip(RoundedCornerShape(cornerRadius))
            .background(Brush.linearGradient(shimmerColors))
    )
}

class Debouncer<T>(
    private val delayMillis: Long = 300L,
    private val onDebounced: (T) -> Unit
) {
    private var job: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main)
    
    fun submit(value: T) {
        job?.cancel()
        job = scope.launch {
            delay(delayMillis)
            onDebounced(value)
        }
    }
    
    fun cancel() {
        job?.cancel()
        job = null
    }
    
    fun flush(value: T) {
        cancel()
        onDebounced(value)
    }
}

class Throttler<T>(
    private val intervalMillis: Long = 100L,
    private val onThrottled: (T) -> Unit
) {
    private var lastExecutionTime = 0L
    private var pendingValue: T? = null
    private var job: Job? = null
    private val scope = CoroutineScope(Dispatchers.Main)
    
    fun submit(value: T) {
        val now = jsGetTimestamp().toLong()
        val timeSinceLastExecution = now - lastExecutionTime
        
        if (timeSinceLastExecution >= intervalMillis) {
            lastExecutionTime = now
            onThrottled(value)
        } else {
            pendingValue = value
            job?.cancel()
            job = scope.launch {
                delay(intervalMillis - timeSinceLastExecution)
                pendingValue?.let { 
                    lastExecutionTime = jsGetTimestamp().toLong()
                    onThrottled(it)
                }
                pendingValue = null
            }
        }
    }
    
    fun cancel() {
        job?.cancel()
        job = null
        pendingValue = null
    }
    
    fun flush() {
        pendingValue?.let { 
            onThrottled(it)
            lastExecutionTime = jsGetTimestamp().toLong()
        }
        cancel()
    }
}

@Composable
fun <T> rememberDebouncer(
    delayMillis: Long = 300L,
    onDebounced: (T) -> Unit
): Debouncer<T> {
    val debouncer = remember { Debouncer(delayMillis, onDebounced) }
    DisposableEffect(debouncer) {
        onDispose {
            debouncer.cancel()
        }
    }
    return debouncer
}

@Composable
fun <T> rememberThrottler(
    intervalMillis: Long = 100L,
    onThrottled: (T) -> Unit
): Throttler<T> {
    val throttler = remember { Throttler(intervalMillis, onThrottled) }
    DisposableEffect(throttler) {
        onDispose {
            throttler.cancel()
        }
    }
    return throttler
}

@Composable
fun rememberDebouncedSearchState(
    debounceDelay: Long = 300L,
    onSearch: (String) -> Unit
): DebouncedSearchState {
    val state = remember { DebouncedSearchState(debounceDelay, onSearch) }
    
    DisposableEffect(state) {
        onDispose {
            state.cancel()
        }
    }
    
    return state
}

class DebouncedSearchState(
    private val debounceDelay: Long = 300L,
    private val onSearch: (String) -> Unit
) {
    var query by mutableStateOf("")
        private set
    
    private val debouncer = Debouncer<String>(debounceDelay) { debouncedQuery ->
        onSearch(debouncedQuery)
    }
    
    fun onQueryChange(newQuery: String) {
        query = newQuery
        if (newQuery.isEmpty()) {
            debouncer.cancel()
            onSearch("")
        } else {
            debouncer.submit(newQuery)
        }
    }
    
    fun clear() {
        query = ""
        debouncer.cancel()
        onSearch("")
    }
    
    fun cancel() {
        debouncer.cancel()
    }
    
    fun searchNow() {
        debouncer.flush(query)
    }
}

object WebPerformanceMonitor {
    private var frameCount = 0
    private var lastFpsCheck = 0L
    private var currentFps = 60.0
    private val performanceListeners = mutableListOf<(PerformanceMetrics) -> Unit>()
    
    data class PerformanceMetrics(
        val fps: Double,
        val memoryUsed: Long?,
        val bundleSizeEstimate: String,
        val modulesLoaded: Int
    )
    
    fun startMonitoring() {
        lastFpsCheck = jsGetTimestamp().toLong()
        scheduleFrameCallback()
    }
    
    private fun scheduleFrameCallback() {
        jsRequestAnimationFrame {
            frameCount++
            val now = jsGetTimestamp().toLong()
            val elapsed = now - lastFpsCheck
            
            if (elapsed >= 1000) {
                currentFps = (frameCount.toDouble() / elapsed.toDouble()) * 1000.0
                frameCount = 0
                lastFpsCheck = now
                
                notifyListeners()
            }
            
            scheduleFrameCallback()
        }
    }
    
    fun getMetrics(): PerformanceMetrics {
        return PerformanceMetrics(
            fps = currentFps,
            memoryUsed = getMemoryUsage(),
            bundleSizeEstimate = estimateBundleSize(),
            modulesLoaded = WebPerformance.getLoadedModules().size
        )
    }
    
    private fun getMemoryUsage(): Long? {
        return try {
            jsGetMemoryUsage()?.toLong()
        } catch (e: Exception) {
            null
        }
    }
    
    private fun estimateBundleSize(): String {
        return try {
            jsGetBundleSizeEstimate() ?: "~8.5 MB"
        } catch (e: Exception) {
            "~8.5 MB"
        }
    }
    
    fun addListener(listener: (PerformanceMetrics) -> Unit) {
        performanceListeners.add(listener)
    }
    
    fun removeListener(listener: (PerformanceMetrics) -> Unit) {
        performanceListeners.remove(listener)
    }
    
    private fun notifyListeners() {
        val metrics = getMetrics()
        performanceListeners.forEach { it(metrics) }
    }
}
