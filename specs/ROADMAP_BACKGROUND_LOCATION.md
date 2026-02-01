# Feature: Check-in Automático via Geofence

**Status**: Planejado
**Prioridade**: Média
**Versão Alvo**: 1.8.0+
**Criado em**: Janeiro 2026

---

## Contexto

Na versão 1.7.0, a permissão `ACCESS_BACKGROUND_LOCATION` foi removida porque:
1. O Google Play exige vídeo demonstrativo para apps com essa permissão
2. O recurso de check-in automático em background **não estava implementado**
3. O check-in atual é **manual** (jogador clica no botão enquanto está no app)

O check-in manual atual funciona perfeitamente para validar presença:
- Jogador abre o app → clica em "Check-in" → GPS valida distância
- Sem check-in = não pode votar MVP, marcar gols, etc.

---

## Feature Futura: Check-in Automático

### Objetivo
Quando um jogo está prestes a começar e o jogador está no local, fazer check-in automaticamente sem precisar abrir o app.

### Implementação Proposta

#### 1. Geofence API
```kotlin
// Criar geofence ao redor do local do jogo
val geofence = Geofence.Builder()
    .setRequestId("game_${gameId}")
    .setCircularRegion(lat, lng, radiusMeters.toFloat())
    .setExpirationDuration(Geofence.NEVER_EXPIRE)
    .setTransitionTypes(Geofence.GEOFENCE_TRANSITION_ENTER)
    .build()
```

#### 2. BroadcastReceiver
```kotlin
class GeofenceReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val event = GeofencingEvent.fromIntent(intent)
        if (event.geofenceTransition == Geofence.GEOFENCE_TRANSITION_ENTER) {
            // Realizar check-in automático
            val gameId = event.triggeringGeofences.first().requestId
            performAutoCheckIn(gameId)
        }
    }
}
```

#### 3. Foreground Service (obrigatório para background location)
```kotlin
class LocationTrackingService : Service() {
    // Serviço com notificação persistente
    // Ativo apenas durante jogos agendados
}
```

### Requisitos Google Play

1. **Vídeo demonstrativo** no YouTube mostrando o recurso
2. **Justificativa clara** no formulário de permissões
3. **Política de privacidade** atualizada explicando o uso
4. **Notificação persistente** enquanto rastreia em background

### Fluxo de Usuário

1. Usuário confirma presença em um jogo
2. App pergunta: "Deseja ativar check-in automático?"
3. Se sim, solicita permissão de localização em background
4. Cria geofence ao redor do local do jogo
5. Quando jogador entra na área, notificação: "Check-in realizado!"
6. Geofence é removida após o jogo terminar

### Arquivos a Modificar

- [ ] `AndroidManifest.xml` - Adicionar `ACCESS_BACKGROUND_LOCATION`
- [ ] `PermissionHelper.kt` - Solicitar permissão de background
- [ ] Criar `GeofenceManager.kt` - Gerenciar geofences
- [ ] Criar `GeofenceReceiver.kt` - Receiver para eventos
- [ ] Criar `LocationTrackingService.kt` - Foreground service
- [ ] `ConfirmationUseCase.kt` - Integrar check-in automático
- [ ] `GameDetailScreen.kt` - UI para ativar/desativar
- [ ] `strings.xml` - Textos para notificações e UI

### Considerações

- **Bateria**: Geofence é mais eficiente que GPS contínuo
- **Privacidade**: Só ativar quando há jogo agendado
- **Opt-in**: Usuário deve escolher ativar (não é padrão)
- **Fallback**: Manter check-in manual como alternativa

---

## Referências

- [Android Geofencing API](https://developer.android.com/training/location/geofencing)
- [Background Location Access](https://developer.android.com/training/location/background)
- [Google Play Policy](https://support.google.com/googleplay/android-developer/answer/9799150)

---

## Histórico

| Data | Versão | Ação |
|------|--------|------|
| Jan/2026 | 1.7.0 | Permissão removida, check-in manual mantido |
| Futuro | 1.8.0+ | Implementar geofence para check-in automático |
