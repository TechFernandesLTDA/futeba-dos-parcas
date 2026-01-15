# OBSERVABILITY - Futeba dos Parças

> Estratégia de observabilidade: logs, métricas, rastreamento.
> Última atualização: 2025-01-10

---

## 1. STACK DE OBSERVABILIDADE

| Camada | Ferramenta | Uso |
|--------|------------|-----|
| **Crash Reporting** | Firebase Crashlytics | Crashes, ANRs |
| **Analytics** | Firebase Analytics | Eventos de usuário |
| **Performance** | Firebase Performance Monitoring | Tempo de resposta |
| **Logging** | AppLogger (custom) | Logs de debug |
| **Remote Config** | Firebase Remote Config | Feature flags, config |

---

## 2. CRASHLYTICS

### 2.1 Configuração

**Inicialização automática via:**
```xml
<!-- app/build.gradle.kts -->
plugin id 'com.google.firebase.crashlytics'
```

### 2.2 Non-Fatal Exceptions

**Registrar exceções tratadas:**
```kotlin
try {
    processGameEvents(events)
} catch (e: Exception) {
    FirebaseCrashlytics.getInstance().apply {
        setCustomKey("game_id", gameId)
        setCustomKey("event_count", events.size)
        recordException(e)
    }
}
```

### 2.3 Custom Keys

**Adicionar contexto sem PII:**
```kotlin
FirebaseCrashlytics.getInstance().apply {
    setUserId(user.id) // Apenas ID, não email
    setCustomKey("user_level", user.level)
    setCustomKey("app_version", BuildConfig.VERSION_NAME)
    setCustomKey("screen", currentScreen)
}
```

### 2.4 Stack Traces

**Crashlytics captura automaticamente:**
- Stack trace completo
- Device info
- Android version
- App version
- Momento do crash

---

## 3. ANALYTICS

### 3.1 Eventos Rastreados

| Categoria | Evento | Parâmetros |
|-----------|--------|------------|
| **Auth** | `login_success` | method |
| **Games** | `game_created` | type, visibility |
| **Games** | `game_confirmed` | game_id |
| **Games** | `game_finished` | duration, score |
| **Profile** | `profile_updated` | fields |
| **Ranking** | `level_up` | from, to |
| **Badges** | `badge_unlocked` | badge_id |
| **Cashbox** | `payment_made` | amount |

### 3.2 Exemplos de Implementação

```kotlin
// Login
fun logLoginSuccess(method: String) {
    analytics.logEvent("login_success", bundleOf(
        "method" to method
    ))
}

// Confirmação de jogo
fun logGameConfirmed(gameId: String, playerCount: Int) {
    analytics.logEvent("game_confirmed", bundleOf(
        "game_id" to gameId,
        "player_count" to playerCount
    ))
}

// Level up
fun logLevelUp(from: Int, to: Int) {
    analytics.logEvent("level_up", bundleOf(
        "from_level" to from,
        "to_level" to to
    ))
}
```

### 3.3 Screen Tracking

```kotlin
// Automaticamente via Firebase
analytics.logEvent("screen_view", bundleOf(
    "screen_name" to screenName
))
```

---

## 4. PERFORMANCE MONITORING

### 4.1 Traces Automáticos

**Firebase Performance Monitor captura:**
- Cold start
- Warm start
- Activity display time
- Fragment display time
- Network requests

### 4.2 Custom Traces

**Rastrear operações específicas:**
```kotlin
val trace = Firebase.performance.newTrace("load_games")
trace.start()

try {
    // Carregar jogos
    val games = repository.getUpcomingGames()
} finally {
    trace.stop()
}
```

### 4.3 Métricas Customizadas

```kotlin
val trace = Firebase.performance.newTrace("process_game_events")

trace.putMetric("event_count", events.size)
trace.putMetric("player_count", players.size)

trace.start()
// ...
trace.stop()
```

### 4.4 Network Monitoring

**Automaticamente rastreado:**
- Tempo de resposta
- Taxa de sucesso/falha
- Payload size

### 4.5 Thresholds de Performance

| Métrica | Threshold | Alerta |
|---------|-----------|--------|
| Cold start | < 3s | Firebase dashboard |
| Game list load | < 2s | Custom trace |
| Game detail load | < 1s | Custom trace |
| Image load | < 500ms | Coil cache |

---

## 5. LOGGING

### 5.1 AppLogger

**Classe customizada para logging:**
```kotlin
object AppLogger {
    private const val TAG_PREFIX = "Futeba"

    fun d(tag: String, message: String) {
        if (BuildConfig.DEBUG) {
            Log.d("$TAG_PREFIX/$tag", message)
        }
    }

    fun e(tag: String, message: String, throwable: Throwable? = null) {
        if (BuildConfig.DEBUG) {
            Log.e("$TAG_PREFIX/$tag", message, throwable)
        }
        // Sempre reportar erros em prod
        throwable?.let {
            FirebaseCrashlytics.getInstance().recordException(it)
        }
    }

    fun w(tag: String, message: String) {
        if (BuildConfig.DEBUG) {
            Log.w("$TAG_PREFIX/$tag", message)
        }
    }
}
```

### 5.2 Níveis de Log

| Nível | Uso | Exemplo |
|-------|-----|---------|
| **DEBUG** | Informação detalhada | `"Loading games for user $userId"` |
| **INFO** | Eventos importantes | `"User successfully logged in"` |
| **WARN** | Situações anormais | `"Cache miss, fetching from remote"` |
| **ERROR** | Erros tratados | `"Failed to load games: ${e.message}"` |

### 5.3 Logs em Produção

**Regras:**
- ❌ NENHUM log em release builds (via `if (BuildConfig.DEBUG)`)
- ✅ Erros reportados via Crashlytics
- ✅ Eventos importantes via Analytics

---

## 6. REMOTE CONFIG

### 6.1 Configuração

```kotlin
val remoteConfig = FirebaseRemoteConfig.getInstance()

val configSettings = FirebaseRemoteConfigSettings.Builder()
    .setMinimumFetchIntervalInSeconds(3600) // 1 hora
    .build()

remoteConfig.setConfigSettingsAsync(configSettings)
remoteConfig.fetchAndActivate()
```

### 6.2 Parâmetros

| Parâmetro | Tipo | Uso |
|-----------|------|-----|
| `feature_ranking_enabled` | Boolean | Feature flag |
| `max_players_per_game` | Number | Configuração |
| `xp_multiplier` | Number | Balanceamento |
| `maintenance_mode` | Boolean | Manutenção |

### 6.3 Exemplo de Uso

```kotlin
fun isRankingEnabled(): Boolean {
    return remoteConfig.getBoolean("feature_ranking_enabled")
}

fun getMaxPlayers(): Int {
    return remoteConfig.getLong("max_players_per_game").toInt()
}
```

---

## 7. ALERTAS E MONITORAMENTO

### 7.1 Dashboard Firebase

**Métricas monitoradas:**
- Crash-free users (%)
- ANR rate (%)
- App start time (ms)
- Active users (DAU/MAU)
- Eventos principais

### 7.2 Thresholds de Alerta

| Métrica | Threshold | Ação |
|---------|-----------|------|
| Crash-free users | < 99% | Investigar imediatamente |
| ANR rate | > 0.5% | Investigar em 24h |
| Cold start | > 5s | Investigar em 48h |
| Daily active users | < -20% | Investigar tendência |

### 7.3 Alertas Configurados

**No Firebase Console:**
- Crash rate > 1%
- Novos issues de crash
- Problemas de performance
- Queda de usuários ativos

---

## 8. DEBUGGING

### 8.1 Habilitar Debug Logging

```kotlin
if (BuildConfig.DEBUG) {
    FirebasePerformance.getInstance().setPerformanceCollectionEnabled(true)
    FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(true)
}
```

### 8.2 Verificar Analytics

```bash
# DebugView no Firebase Console
# Habilitar no dispositivo:
adb shell setprop debug.firebase.analytics.app com.futebadosparcas
```

---

## 9. MELHORIA CONTÍNUA

### 9.1 Revisar Mensalmente

- Top crashes
- Eventos com erro
- Performance degradation
- Tendências de uso

### 9.2 Ações Baseadas em Dados

**Exemplos:**
- Adotar feature com alta taxa de uso
- Corrigir fluxo com alta taxa de abandono
- Otimizar tela com carregamento lento

---

## 10. EVENTOS CRÍTICOS

### 10.1 Eventos de Negócio

```kotlin
// Registrar sempre
fun logGameCreated(game: Game) {
    analytics.logEvent("game_created", bundleOf(
        "game_id" to game.id,
        "type" to game.type.name,
        "visibility" to game.visibility.name,
        "max_players" to game.maxPlayers
    ))
}
```

### 10.2 Funis de Conversão

**Funil de criação de jogo:**
1. `create_game_screen_view`
2. `create_game_location_selected`
3. `create_game_details_filled`
4. `create_game_success`

**Funil de confirmação:**
1. `game_detail_view`
2. `confirm_presence_clicked`
3. `position_selected`
4. `presence_confirmed`

---

## 11. RELATÓRIOS

### 11.1 Diário

- Crashes nas últimas 24h
- Active users
- Eventos principais

### 11.2 Semanal

- Tendência de crashes
- Performance por tela
- Engajamento (sessões, jogos criados)

### 11.3 Mensal

- Health score do app
- Features mais usadas
- Áreas de melhoria

---

## 12. INTEGRAÇÃO COM FERRAMENTAS EXTERNAS

### 12.1 Slack/Discord

**Webhooks para alertas críticos:**
```kotlin
fun sendSlackAlert(message: String) {
    // Enviar alerta para canal #app-alerts
}
```

### 12.2 Email

**Alertas de problemas graves:**
- Crash rate > 5%
- Maintenance mode ativado

---

## 13. REFERÊNCIAS

- [Firebase Crashlytics](https://firebase.google.com/docs/crashlytics)
- [Firebase Analytics](https://firebase.google.com/docs/analytics)
- [Firebase Performance](https://firebase.google.com/docs/perf-mon)
- [Firebase Remote Config](https://firebase.google.com/docs/remote-config)
