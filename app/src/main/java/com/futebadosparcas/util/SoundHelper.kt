package com.futebadosparcas.util

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.SoundPool
import android.media.ToneGenerator
import androidx.annotation.RawRes
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Sound Helper - Reprodutor de efeitos sonoros para eventos do jogo
 *
 * Fornece sons para eventos do jogo ao vivo:
 * - Apito de inicio/fim de jogo
 * - Buzina de gol
 * - Som de cartao
 * - Som de defesa
 * - Som de substituicao
 *
 * Usa SoundPool para sons curtos e MediaPlayer para sons longos.
 * Os sons sao carregados sob demanda e cacheados para performance.
 *
 * Uso:
 * ```kotlin
 * @Inject lateinit var soundHelper: SoundHelper
 *
 * // Tocar som de gol
 * soundHelper.playGoalHorn()
 *
 * // Tocar apito
 * soundHelper.playWhistle()
 *
 * // Tocar som de cartao
 * soundHelper.playCardSound()
 * ```
 */
@Singleton
class SoundHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    companion object {
        private const val TAG = "SoundHelper"
        private const val MAX_STREAMS = 5
        private const val DEFAULT_VOLUME = 1.0f
        private const val DEFAULT_RATE = 1.0f
    }

    // SoundPool para sons curtos (< 1 segundo)
    private val soundPool: SoundPool by lazy {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        SoundPool.Builder()
            .setMaxStreams(MAX_STREAMS)
            .setAudioAttributes(audioAttributes)
            .build()
    }

    // Cache de IDs de som carregados
    private val loadedSounds = mutableMapOf<SoundType, Int>()

    // Estado de som habilitado (pode ser controlado por preferencias)
    private var soundEnabled = true

    // Volume de 0.0f a 1.0f
    private var volume = DEFAULT_VOLUME

    /**
     * Tipos de som disponiveis
     *
     * Os arquivos de som devem ser adicionados em res/raw/:
     * - sound_whistle.mp3 ou .ogg - Apito curto
     * - sound_goal.mp3 ou .ogg - Buzina de gol
     * - sound_card.mp3 ou .ogg - Som de cartao
     * - sound_save.mp3 ou .ogg - Som de defesa
     * - sound_substitution.mp3 ou .ogg - Som de substituicao
     * - sound_tick.mp3 ou .ogg - Som de tick (timer)
     * - sound_error.mp3 ou .ogg - Som de erro
     * - sound_success.mp3 ou .ogg - Som de sucesso
     *
     * Enquanto os arquivos nao estiverem disponiveis, o app
     * usa ToneGenerator como fallback.
     */
    enum class SoundType(val resourceName: String, val fallbackFrequency: Int, val fallbackDuration: Int) {
        WHISTLE("sound_whistle", 800, 300),       // Apito de inicio/fim
        GOAL_HORN("sound_goal", 500, 500),        // Buzina de gol
        CARD("sound_card", 400, 200),             // Som de cartao
        SAVE("sound_save", 600, 250),             // Som de defesa
        SUBSTITUTION("sound_substitution", 700, 200), // Som de substituicao
        TICK("sound_tick", 1000, 50),             // Som de tick (timer)
        ERROR("sound_error", 300, 300),           // Som de erro
        SUCCESS("sound_success", 900, 200)        // Som de sucesso
    }

    /**
     * Habilita ou desabilita todos os sons
     */
    fun setSoundEnabled(enabled: Boolean) {
        soundEnabled = enabled
        AppLogger.d(TAG) { "Sons ${if (enabled) "habilitados" else "desabilitados"}" }
    }

    /**
     * Verifica se os sons estao habilitados
     */
    fun isSoundEnabled(): Boolean = soundEnabled

    /**
     * Define o volume (0.0f a 1.0f)
     */
    fun setVolume(newVolume: Float) {
        volume = newVolume.coerceIn(0f, 1f)
    }

    /**
     * Obtem o volume atual
     */
    fun getVolume(): Float = volume

    /**
     * Pre-carrega sons para reproduzao mais rapida
     */
    fun preloadSounds(vararg types: SoundType) {
        types.forEach { type ->
            loadSound(type)
        }
        AppLogger.d(TAG) { "Pre-carregados ${types.size} sons" }
    }

    /**
     * Pre-carrega todos os sons do jogo ao vivo
     */
    fun preloadGameSounds() {
        preloadSounds(
            SoundType.WHISTLE,
            SoundType.GOAL_HORN,
            SoundType.CARD,
            SoundType.SAVE,
            SoundType.SUBSTITUTION
        )
    }

    // ToneGenerator para fallback quando arquivos de som nao estao disponiveis
    private val toneGenerator: ToneGenerator? by lazy {
        try {
            ToneGenerator(AudioManager.STREAM_MUSIC, (volume * 100).toInt())
        } catch (e: Exception) {
            AppLogger.w(TAG) { "ToneGenerator nao disponivel" }
            null
        }
    }

    /**
     * Carrega um som no SoundPool
     */
    private fun loadSound(type: SoundType): Int? {
        if (loadedSounds.containsKey(type)) {
            return loadedSounds[type]
        }

        return try {
            // Tenta carregar o arquivo de som pelo nome do recurso
            val resourceId = context.resources.getIdentifier(
                type.resourceName,
                "raw",
                context.packageName
            )

            if (resourceId != 0) {
                val soundId = soundPool.load(context, resourceId, 1)
                loadedSounds[type] = soundId
                soundId
            } else {
                AppLogger.d(TAG) { "Arquivo de som nao encontrado para ${type.name}, usando fallback" }
                null
            }
        } catch (e: Exception) {
            AppLogger.w(TAG) { "Erro ao carregar som ${type.name}: ${e.message}" }
            null
        }
    }

    /**
     * Reproduz som usando ToneGenerator como fallback
     */
    private fun playFallbackTone(type: SoundType) {
        try {
            toneGenerator?.startTone(
                when (type) {
                    SoundType.WHISTLE -> ToneGenerator.TONE_PROP_BEEP
                    SoundType.GOAL_HORN -> ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD
                    SoundType.CARD -> ToneGenerator.TONE_PROP_ACK
                    SoundType.SAVE -> ToneGenerator.TONE_PROP_PROMPT
                    SoundType.SUBSTITUTION -> ToneGenerator.TONE_CDMA_SOFT_ERROR_LITE
                    SoundType.TICK -> ToneGenerator.TONE_PROP_BEEP
                    SoundType.ERROR -> ToneGenerator.TONE_PROP_NACK
                    SoundType.SUCCESS -> ToneGenerator.TONE_CDMA_CONFIRM
                },
                type.fallbackDuration
            )
            AppLogger.d(TAG) { "Reproduzindo tom fallback: ${type.name}" }
        } catch (e: Exception) {
            AppLogger.w(TAG) { "Erro ao reproduzir tom fallback: ${e.message}" }
        }
    }

    /**
     * Reproduz um som especifico
     */
    fun playSound(type: SoundType, volumeMultiplier: Float = 1.0f) {
        if (!soundEnabled) return

        val soundId = loadSound(type)

        if (soundId != null) {
            val finalVolume = (volume * volumeMultiplier).coerceIn(0f, 1f)

            soundPool.play(
                soundId,
                finalVolume,
                finalVolume,
                1, // priority
                0, // loop (0 = no loop)
                DEFAULT_RATE
            )

            AppLogger.d(TAG) { "Reproduzindo som: ${type.name}" }
        } else {
            // Fallback para ToneGenerator se arquivo nao disponivel
            playFallbackTone(type)
        }
    }

    /**
     * Toca apito de inicio/fim de jogo
     */
    fun playWhistle() {
        playSound(SoundType.WHISTLE)
    }

    /**
     * Toca buzina de gol
     */
    fun playGoalHorn() {
        playSound(SoundType.GOAL_HORN)
    }

    /**
     * Toca som de cartao (amarelo ou vermelho)
     */
    fun playCardSound() {
        playSound(SoundType.CARD)
    }

    /**
     * Toca som de defesa
     */
    fun playSaveSound() {
        playSound(SoundType.SAVE)
    }

    /**
     * Toca som de substituicao
     */
    fun playSubstitutionSound() {
        playSound(SoundType.SUBSTITUTION)
    }

    /**
     * Toca som de tick (timer)
     */
    fun playTick() {
        playSound(SoundType.TICK, 0.5f)
    }

    /**
     * Toca som de erro
     */
    fun playError() {
        playSound(SoundType.ERROR)
    }

    /**
     * Toca som de sucesso
     */
    fun playSuccess() {
        playSound(SoundType.SUCCESS)
    }

    /**
     * Toca sequencia de apitos (inicio de jogo: 1 longo)
     */
    fun playGameStartSequence() {
        if (!soundEnabled) return
        playWhistle()
    }

    /**
     * Toca sequencia de apitos (fim de jogo: 3 curtos)
     */
    fun playGameEndSequence() {
        if (!soundEnabled) return
        // Pode ser implementado com delays usando coroutines
        playWhistle()
    }

    /**
     * Toca sequencia de intervalo (2 apitos)
     */
    fun playHalfTimeSequence() {
        if (!soundEnabled) return
        playWhistle()
    }

    /**
     * Reproduz som longo usando MediaPlayer (para sons > 1 segundo)
     */
    fun playLongSound(@RawRes resourceId: Int, onComplete: (() -> Unit)? = null) {
        if (!soundEnabled) return

        try {
            val mediaPlayer = MediaPlayer.create(context, resourceId)
            mediaPlayer?.apply {
                setVolume(volume, volume)
                setOnCompletionListener {
                    it.release()
                    onComplete?.invoke()
                }
                start()
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao reproduzir som longo", e)
        }
    }

    /**
     * Libera recursos do SoundPool
     */
    fun release() {
        try {
            soundPool.release()
            toneGenerator?.release()
            loadedSounds.clear()
            AppLogger.d(TAG) { "Recursos de som liberados" }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao liberar recursos de som", e)
        }
    }

    /**
     * Para todos os sons em reproducao
     */
    fun stopAll() {
        loadedSounds.values.forEach { soundId ->
            soundPool.stop(soundId)
        }
    }
}
