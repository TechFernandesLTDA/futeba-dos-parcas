package com.futebadosparcas.util

import com.futebadosparcas.BuildConfig
import com.google.firebase.functions.FirebaseFunctions
import kotlin.random.Random

enum class RealtimeTelemetryFlow(val wireName: String) {
    GAMES("games"),
    GROUP_POLLS("group_polls"),
    DIRECT_MESSAGES("direct_messages"),
    PLAYERS("players"),
    LIVE_EVENTS("live_events"),
    CASHBOX("cashbox"),
    LIVE_GAME("live_game"),
    SOCIAL_FEED("social_feed"),
    PUBLIC_GAMES_MAP("public_games_map"),
    LOCATIONS_MAP("locations_map")
}

enum class RealtimeTelemetryPhase(val wireName: String) {
    BOOTSTRAP("bootstrap"),
    APPLY("apply"),
    RECONNECT("reconnect"),
    ERROR("error")
}

fun interface RealtimeTelemetryClock {
    fun nowMillis(): Long
}

fun interface RealtimeTelemetryRandom {
    fun nextDouble(): Double
}

fun interface RealtimeTelemetrySink {
    fun emit(sample: RealtimeTelemetrySample)
}

/** Payload fechado do callable reportRealtimeSloMetric. */
data class RealtimeTelemetrySample(
    val platform: String,
    val flow: String,
    val phase: String,
    val duration: Long,
    val release: String
) {
    fun toPayload(): Map<String, Any> = mapOf(
        "platform" to platform,
        "flow" to flow,
        "phase" to phase,
        "duration" to duration,
        "release" to release
    )
}

/** Adapter assíncrono: o Task do callable não bloqueia nem captura lifecycle de tela. */
class FirebaseFunctionsRealtimeTelemetrySink(
    private val functions: FirebaseFunctions
) : RealtimeTelemetrySink {
    override fun emit(sample: RealtimeTelemetrySample) {
        functions.getHttpsCallable(CALLABLE_NAME)
            .call(sample.toPayload())
            .addOnFailureListener {
                AppLogger.w(TAG) { "Falha ao enviar amostra realtime SLO" }
            }
    }

    companion object {
        private const val TAG = "RealtimeTelemetry"
        private const val CALLABLE_NAME = "reportRealtimeSloMetric"
    }
}

/**
 * Telemetria realtime sem PII. A decisão de sampling é tomada uma única vez por
 * instância (singleton em produção), mantendo o cliente estável durante o processo.
 */
class RealtimeTelemetry(
    private val release: String,
    sampleRate: Double = MAX_SAMPLE_RATE,
    random: RealtimeTelemetryRandom = RealtimeTelemetryRandom { Random.nextDouble() },
    private val clock: RealtimeTelemetryClock = RealtimeTelemetryClock { System.currentTimeMillis() },
    private val sink: RealtimeTelemetrySink
) {
    private val sampled: Boolean

    init {
        require(RELEASE_PATTERN.matches(release)) { "release fora do schema realtime SLO" }
        val boundedRate = sampleRate.coerceIn(0.0, MAX_SAMPLE_RATE)
        sampled = boundedRate > 0.0 && random.nextDouble() < boundedRate
    }

    fun tracker(flow: RealtimeTelemetryFlow): RealtimeTelemetryTracker =
        RealtimeTelemetryTracker(this, flow, clock)

    internal fun record(
        flow: RealtimeTelemetryFlow,
        phase: RealtimeTelemetryPhase,
        durationMillis: Long
    ) {
        if (!sampled) return
        val sample = RealtimeTelemetrySample(
            platform = PLATFORM_ANDROID,
            flow = flow.wireName,
            phase = phase.wireName,
            duration = durationMillis.coerceIn(0L, MAX_DURATION_MILLIS),
            release = release
        )
        runCatching { sink.emit(sample) }
            .onFailure {
                AppLogger.w(TAG) { "Sink realtime SLO rejeitou amostra" }
            }
    }

    companion object {
        const val MAX_SAMPLE_RATE = 0.05
        const val MAX_DURATION_MILLIS = 120_000L
        private const val PLATFORM_ANDROID = "android"
        private const val TAG = "RealtimeTelemetry"
        private val RELEASE_PATTERN = Regex(
            "^(?:v?\\d+\\.\\d+\\.\\d+(?:[-+][0-9A-Za-z.-]+)?|[0-9a-fA-F]{7,12})$"
        )

        private val disabledInstance by lazy {
            RealtimeTelemetry(
                release = "0.0.0",
                sampleRate = 0.0,
                random = RealtimeTelemetryRandom { 1.0 },
                sink = RealtimeTelemetrySink { }
            )
        }

        fun disabled(): RealtimeTelemetry = disabledInstance

        fun production(functions: FirebaseFunctions): RealtimeTelemetry = RealtimeTelemetry(
            release = BuildConfig.VERSION_NAME,
            sink = FirebaseFunctionsRealtimeTelemetrySink(functions)
        )
    }
}

class RealtimeTelemetryTracker internal constructor(
    private val telemetry: RealtimeTelemetry,
    private val flow: RealtimeTelemetryFlow,
    private val clock: RealtimeTelemetryClock
) {
    private var phaseStartedAt = clock.nowMillis()
    private var bootstrapped = false
    private var reconnectPending = false

    @Synchronized
    fun startReconnect() {
        reconnectPending = true
        phaseStartedAt = clock.nowMillis()
    }

    @Synchronized
    fun startApply() {
        phaseStartedAt = clock.nowMillis()
    }

    @Synchronized
    fun recordApply() {
        val now = clock.nowMillis()
        val phase = when {
            !bootstrapped -> RealtimeTelemetryPhase.BOOTSTRAP
            reconnectPending -> RealtimeTelemetryPhase.RECONNECT
            else -> RealtimeTelemetryPhase.APPLY
        }
        telemetry.record(flow, phase, now - phaseStartedAt)
        bootstrapped = true
        reconnectPending = false
        phaseStartedAt = now
    }

    @Synchronized
    fun recordError() {
        val now = clock.nowMillis()
        telemetry.record(
            flow = flow,
            phase = RealtimeTelemetryPhase.ERROR,
            durationMillis = now - phaseStartedAt
        )
        reconnectPending = true
        phaseStartedAt = now
    }
}
