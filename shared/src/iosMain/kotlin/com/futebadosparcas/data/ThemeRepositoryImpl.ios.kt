package com.futebadosparcas.data

import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.DefaultSeeds
import com.futebadosparcas.domain.model.SeedColors
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.domain.repository.ThemeRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import platform.Foundation.NSUserDefaults

/**
 * Implementação iOS do [ThemeRepository] usando `NSUserDefaults` (#4097).
 *
 * Espelha o contrato da implementação Android (`app/.../data/ThemeRepositoryImpl.kt`,
 * DataStore): mesmas chaves, mesma serialização (`ThemeMode.name` / `ContrastLevel.name`
 * como String, seeds como Int ARGB, flag booleana para Material You) e mesma leitura
 * tolerante — valor persistido inválido cai no default em vez de quebrar o app.
 *
 * Diferenças intencionais em relação ao Android:
 * - **Default de instalação nova é [ThemeMode.SYSTEM]** (não LIGHT). É a decisão dos
 *   #4086/#4095: o iOS segue `UIUserInterfaceStyle = Automatic` do `Info.plist` até o
 *   usuário escolher explicitamente. Nada é gravado até a primeira escolha, então o
 *   comportamento anterior (sempre SYSTEM) é preservado sem regressão.
 * - `useDynamicColor` (Material You) é lido/gravado por paridade de contrato, mas o
 *   `DynamicThemeEngine` do composeApp não o consome no iOS.
 *
 * O [themeConfig] é um `StateFlow` alimentado por leitura síncrona do `NSUserDefaults`
 * na criação e re-lido após cada escrita — `NSUserDefaults` é thread-safe e a leitura
 * é local (sem I/O de rede), então não há necessidade de dispatcher dedicado.
 */
class ThemeRepositoryImpl(
    private val userDefaults: NSUserDefaults = NSUserDefaults.standardUserDefaults,
    private val defaultConfig: AppThemeConfig = DEFAULT_CONFIG
) : ThemeRepository {

    /** Chaves idênticas às do DataStore Android para manter a semântica alinhada. */
    private object Keys {
        const val THEME_MODE = "theme_mode"
        const val PRIMARY_COLOR = "primary_color"
        const val SECONDARY_COLOR = "secondary_color"
        const val TERTIARY_COLOR = "tertiary_color"
        const val CONTRAST_LEVEL = "contrast_level"
        const val USE_DYNAMIC_COLOR = "use_dynamic_color"
    }

    private val state = MutableStateFlow(readConfig())

    override val themeConfig: Flow<AppThemeConfig> = state.asStateFlow()

    override suspend fun updateThemeConfig(config: AppThemeConfig) {
        writeConfig(config)
        publish()
    }

    override suspend fun setPrimaryColor(color: Int) {
        putInt(Keys.PRIMARY_COLOR, color)
        publish()
    }

    override suspend fun setSecondaryColor(color: Int) {
        putInt(Keys.SECONDARY_COLOR, color)
        publish()
    }

    override suspend fun setThemeMode(mode: ThemeMode) {
        putString(Keys.THEME_MODE, mode.name)
        publish()
    }

    override suspend fun setContrastLevel(level: ContrastLevel) {
        putString(Keys.CONTRAST_LEVEL, level.name)
        publish()
    }

    override suspend fun setUseDynamicColor(enabled: Boolean) {
        putBoolean(Keys.USE_DYNAMIC_COLOR, enabled)
        publish()
    }

    /**
     * Restaura o default da plataforma ([defaultConfig], SYSTEM no iOS).
     *
     * Grava os valores explicitamente (como o Android) em vez de apenas remover as
     * chaves, para que o estado persistido seja determinístico após o reset.
     */
    override suspend fun resetThemeConfig() {
        writeConfig(defaultConfig)
        publish()
    }

    // ─── Leitura ─────────────────────────────────────────────────────────────

    private fun readConfig(): AppThemeConfig {
        val mode = readEnum(Keys.THEME_MODE, defaultConfig.mode) { ThemeMode.valueOf(it) }
        val contrast = readEnum(Keys.CONTRAST_LEVEL, defaultConfig.contrastLevel) {
            ContrastLevel.valueOf(it)
        }

        // Seeds vêm do modelo canônico (DefaultSeeds/AppThemeConfig), nunca hardcodadas
        // aqui — mesma regra do Android (#3934). Tertiary sempre não-nulo (#3933).
        val defaultSeeds = defaultConfig.seedColors
        val primary = getInt(Keys.PRIMARY_COLOR) ?: defaultSeeds.primary
        val secondary = getInt(Keys.SECONDARY_COLOR) ?: defaultSeeds.secondary
        val tertiary = getInt(Keys.TERTIARY_COLOR)
            ?: defaultSeeds.tertiary
            ?: DefaultSeeds.TERTIARY_ARGB

        val useDynamicColor = getBoolean(Keys.USE_DYNAMIC_COLOR) ?: defaultConfig.useDynamicColor

        return AppThemeConfig(
            seedColors = SeedColors(primary, secondary, tertiary),
            mode = mode,
            contrastLevel = contrast,
            useDynamicColor = useDynamicColor
        )
    }

    private inline fun <T> readEnum(key: String, default: T, parse: (String) -> T): T {
        val raw = userDefaults.stringForKey(key) ?: return default
        return try {
            parse(raw)
        } catch (e: IllegalArgumentException) {
            // Valor persistido desconhecido (ex.: versão futura do app) — cai no default.
            default
        }
    }

    private fun getInt(key: String): Int? =
        if (userDefaults.objectForKey(key) != null) userDefaults.integerForKey(key).toInt() else null

    private fun getBoolean(key: String): Boolean? =
        if (userDefaults.objectForKey(key) != null) userDefaults.boolForKey(key) else null

    // ─── Escrita ─────────────────────────────────────────────────────────────

    private fun writeConfig(config: AppThemeConfig) {
        userDefaults.setObject(config.mode.name, forKey = Keys.THEME_MODE)
        userDefaults.setInteger(config.seedColors.primary.toLong(), forKey = Keys.PRIMARY_COLOR)
        userDefaults.setInteger(config.seedColors.secondary.toLong(), forKey = Keys.SECONDARY_COLOR)
        userDefaults.setInteger(
            (config.seedColors.tertiary ?: DefaultSeeds.TERTIARY_ARGB).toLong(),
            forKey = Keys.TERTIARY_COLOR
        )
        userDefaults.setObject(config.contrastLevel.name, forKey = Keys.CONTRAST_LEVEL)
        userDefaults.setBool(config.useDynamicColor, forKey = Keys.USE_DYNAMIC_COLOR)
        userDefaults.synchronize()
    }

    private fun putString(key: String, value: String) {
        userDefaults.setObject(value, forKey = key)
        userDefaults.synchronize()
    }

    private fun putInt(key: String, value: Int) {
        // ARGB negativos (ex.: 0xFF00852A.toInt()) sobrevivem ao round-trip Long → Int.
        userDefaults.setInteger(value.toLong(), forKey = key)
        userDefaults.synchronize()
    }

    private fun putBoolean(key: String, value: Boolean) {
        userDefaults.setBool(value, forKey = key)
        userDefaults.synchronize()
    }

    /** Re-lê o `NSUserDefaults` após uma escrita e emite para os coletores do tema. */
    private fun publish() {
        state.value = readConfig()
    }

    companion object {
        /**
         * Default de instalação nova no iOS: segue o sistema (#4086/#4095).
         * Seeds e contraste vêm de [AppThemeConfig.DEFAULT].
         */
        val DEFAULT_CONFIG: AppThemeConfig = AppThemeConfig.DEFAULT.copy(mode = ThemeMode.SYSTEM)
    }
}
