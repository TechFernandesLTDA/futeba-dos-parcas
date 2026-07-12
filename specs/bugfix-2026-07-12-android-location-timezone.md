# BUGFIX: Preservar e modelar `locations.time_zone` no Android/KMP

> **Status:** `TRIAGED`
> **Severidade:** `MEDIUM`
> **Autor:** SDD spec (issue #3553)
> **Data:** 2026-07-12
> **PR:** #3553
> **Issue:** #3553 (follow-up do PR #3552 / issue #3550)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

A Web 1.53.3 (commit `5fa02d21`, PR #3552) passou a persistir o campo canônico
`time_zone` (IANA, ex.: `America/Sao_Paulo`) nos documentos da coleção
`locations`, com backfill idempotente em `scripts/migrations/backfill-location-time-zones.js`
e validação em `firestore.rules`.

No entanto, o modelo KMP/Android **não representa** esse campo. Consequentemente:

1. **Leitura:** o documento é desserializado em `LocationFirebaseOperations.toLocationOrNull()`
   sem ler `time_zone`, então o valor é descartado em memória.
2. **Escrita destrutiva:** `FirebaseDataSource.updateLocation()` faz
   `firestore.collection("locations").document(id).set(location)` — um `.set()` de
   **objeto inteiro** (overwrite). Como o `Location` serializado não contém `time_zone`,
   qualquer `time_zone` gravado pela Web/migração é **apagado** na próxima edição móvel.
3. **Round-trip:** os mappers `toKmpLocation()` / `toAndroidLocation()` em
   `ModelMappers.kt` não trafegam o campo, então nem um cliente novo conseguiria
   preservá-lo.

### 1.2 Comportamento Esperado (Correto)

- O modelo KMP/Android representa `time_zone` (`timeZone`) com fallback legado
  `America/Sao_Paulo`, espelhando `DEFAULT_LOCATION_TIME_ZONE` da Web.
- `updateLocation()` móvel **preserva** `time_zone` (update parcial ou round-trip
  completo do campo), nunca apagando o campo criado pela Web/migração.
- Documentos legados (sem `time_zone`) são lidos com fallback sem quebrar.
- Edição móvel de qualquer campo de um local não remove `time_zone`.

### 1.3 Passos para Reproduzir

1. Backfill executado: documento `locations/{id}` contém `time_zone: "America/Manaus"`.
2. Abrir o app Android, editar qualquer campo do local (ex.: descrição).
3. Salvar → `LocationDetailViewModel.updateLocation()` → `locationRepository.updateLocation()`.
4. `FirebaseDataSource.updateLocation()` executa `.set(location)` sem `time_zone`.
5. Reabrir o documento no console Firestore: `time_zone` **sumiu** (ou voltou ao
   fallback na próxima leitura Web, quebrando horários overnight em fusos != SP).

### 1.4 Contexto

| Item | Valor |
|------|-------|
| Plataforma | Android (KMP `:shared` + `app`) |
| Versão Web (canônica) | 1.53.3 |
| Versão Android afetada | todas até o fix |
| Frequência | Sempre que um local com `time_zone` é editado no Android |
| Impacto em usuários | Fusos fora de SP calculam horário errado após edição móvel |
| Severidade | MEDIUM (não bloqueia release Web; leitura canônica está na Web) |

### 1.5 Screenshots / Logs

```
// FirebaseDataSource.kt:3281 (estado atual, bugado)
firestore.collection("locations").document(location.id).set(location)
//    ^ .set() sobrescreve o documento inteiro; sem timeZone no modelo => apaga time_zone
```

---

## 2. Análise de Causa Raiz

### 2.1 Investigação

- **Web (referência canônica):** `web/src/types/location.ts:122` define
  `timeZone?: string`; constante `DEFAULT_LOCATION_TIME_ZONE = 'America/Sao_Paulo'`
  (linha 11). Gravação em `LocationFormScreen.tsx:512` envia `time_zone` (snake_case).
  Backfill em `scripts/migrations/backfill-location-time-zones.js` grava
  `time_zone` (snake_case). `firestore.rules` valida `data.get('time_zone', 'America/Sao_Paulo')`.
  → **Campo Firestore canônico: `time_zone` (snake_case).**
- **KMP:** `shared/.../commonMain/.../domain/model/Location.kt` — sem `timeZone`.
  Desserialização em `LocationFirebaseOperations.toLocationOrNull()` — sem ler `time_zone`.
- **Android:** `app/.../data/model/Location.kt` — sem `timeZone`.
  Mappers em `util/ModelMappers.kt` — não mapeiam `timeZone`.
- **Escrita:** `FirebaseDataSource.updateLocation()` usa `.set(location)` (overwrite total).

### 2.2 Causa Raiz

Dois defeitos combinados:

1. **Modelo incompleto:** o campo `time_zone` foi adicionado apenas na Web; KMP e
   Android não foram atualizados, então o round-trip perde o valor.
2. **Write semântico errado:** `updateLocation()` usa `.set()` (replace inteiro) em vez
   de update parcial. Mesmo após modelar o campo, um **cliente antigo** (que ainda não
   tem a propriedade no modelo) apagaria `time_zone` ao editar. O update parcial é a
   defesa correta para migração gradual de clientes.

### 2.3 Arquivos Afetados

| Arquivo | Motivo |
|---------|--------|
| `shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/Location.kt` | Adicionar `timeZone` + constante de fallback `DEFAULT_TIME_ZONE` |
| `shared/src/nativeAndAndroidMain/kotlin/com/futebadosparcas/platform/firebase/LocationFirebaseOperations.kt` | Ler `time_zone` em `toLocationOrNull()` (fallback legado) |
| `shared/src/nativeAndAndroidMain/kotlin/com/futebadosparcas/platform/firebase/FirebaseDataSource.kt` | Trocar `updateLocation()` de `.set()` para update parcial preservando `time_zone` |
| `app/src/main/java/com/futebadosparcas/data/model/Location.kt` | Adicionar `timeZone` com `@PropertyName("time_zone")` |
| `app/src/main/java/com/futebadosparcas/util/ModelMappers.kt` | Mapear `timeZone` em `toKmpLocation()` e `toAndroidLocation()` |

---

## 3. Solução Proposta

### 3.1 Abordagem

1. **Modelar o campo (KMP):** adicionar
   `@SerialName("time_zone") val timeZone: String? = null` ao `Location` de
   `commonMain`, mais uma constante `const val DEFAULT_LOCATION_TIME_ZONE = "America/Sao_Paulo"`
   (espelhar `web/src/types/location.ts:11`). Nulo significa "documento legado não
   backfilhado"; o fallback é aplicado no ponto de uso, como na Web.
2. **Modelar o campo (Android):** adicionar
   `@get:PropertyName("time_zone") @set:PropertyName("time_zone") var timeZone: String? = null`
   ao `Location` de `app/.../data/model/Location.kt`.
3. **Desserialização:** em `toLocationOrNull()`, adicionar
   `timeZone = get<String?>("time_zone")` (mantém nulo para legados; quem consome aplica
   o fallback).
4. **Mappers:** trafegar `timeZone` nos dois sentidos em `ModelMappers.kt`.
5. **Write defensivo:** trocar `updateLocation()` de `.set(location)` para um **map
   parcial** via `.update(mapOf(...))`, incluindo sempre `time_zone` (preservando o
   valor existente, ou aplicando o fallback se vazio). Isso garante que campos não
   editáveis/agregados (e o `time_zone`) não sejam apagados e que um cliente antigo
   não destrua o campo.

> **Decisão de design:** O `updateLocation()` atual sobrescreve **todo** o documento,
> incluindo agregados de backend (`games_count`, `location_stats_updated_at`, etc.).
> O fix usa update parcial apenas dos campos de domínio editáveis pelo cliente + força
> a preservação de `time_zone`. Isso também corrige um risco latente de overwrite de
> agregados. Alternativa menor (apenas modelar o campo e manter `.set()`) não protege
> contra clientes antigos — rejeitada.

### 3.2 Código Antes/Depois

```kotlin
// ANTES — shared/.../domain/model/Location.kt (sem timeZone)
@Serializable
data class Location(
    // ... campos existentes ...
    val openingTime: String = "08:00",
    val closingTime: String = "23:00",
    val operatingDays: List<Int> = listOf(1, 2, 3, 4, 5, 6, 7),
    val minGameDurationMinutes: Int = 60,
    // ❌ sem timeZone
    // ...
)

// DEPOIS — shared/.../domain/model/Location.kt
@Serializable
data class Location(
    // ... campos existentes ...
    val openingTime: String = "08:00",
    val closingTime: String = "23:00",
    val operatingDays: List<Int> = listOf(1, 2, 3, 4, 5, 6, 7),
    val minGameDurationMinutes: Int = 60,

    // Fuso IANA do local (ex.: "America/Sao_Paulo"). Documentos legados sem o
    // campo usam DEFAULT_LOCATION_TIME_ZONE no ponto de consumo (espelha a Web).
    @SerialName("time_zone") val timeZone: String? = null,
    // ...
) {
    companion object {
        const val DEFAULT_LOCATION_TIME_ZONE = "America/Sao_Paulo"

        /** Retorna o fuso efetivo, aplicando o fallback legado quando ausente/vazio. */
        fun Location.effectiveTimeZone(): String =
            timeZone?.takeIf { it.isNotBlank() } ?: DEFAULT_LOCATION_TIME_ZONE
    }
}
```

```kotlin
// ANTES — FirebaseDataSource.kt:3279 (overwrite destrutivo)
actual suspend fun updateLocation(location: Location): Result<Unit> {
    return try {
        firestore.collection("locations").document(location.id).set(location)
        //    ^^^ sobrescreve tudo; apaga time_zone e agregados de backend
        Result.success(Unit)
    } catch (e: Exception) { logLocationUpdateError(location.id, "update", e); Result.failure(e) }
}

// DEPOIS — FirebaseDataSource.kt:3279 (update parcial + preserva time_zone)
actual suspend fun updateLocation(location: Location): Result<Unit> {
    return try {
        val updates = location.toEditableUpdateMap() // só campos de domínio + time_zone
        firestore.collection("locations").document(location.id).update(updates)
        Result.success(Unit)
    } catch (e: Exception) { logLocationUpdateError(location.id, "update", e); Result.failure(e) }
}

// Helper (em LocationFirebaseOperations.kt ou FirebaseDataSource.kt):
internal fun Location.toEditableUpdateMap(): Map<String, Any?> = buildMap {
    put("name", name)
    put("address", address)
    put("cep", cep); put("street", street); put("number", number)
    put("complement", complement); put("district", district)
    put("city", city); put("state", state); put("country", country)
    put("neighborhood", neighborhood); put("region", region)
    latitude?.let { put("latitude", it) }
    longitude?.let { put("longitude", it) }
    placeId?.let { put("place_id", it) }
    put("description", description); photoUrl?.let { put("photo_url", it) }
    put("amenities", amenities)
    phone?.let { put("phone", it) }; website?.let { put("website", it) }
    instagram?.let { put("instagram", it) }
    put("opening_time", openingTime); put("closing_time", closingTime)
    put("operating_days", operatingDays)
    put("min_game_duration_minutes", minGameDurationMinutes)
    // Preserva/aplica fuso: nunca envia null; fallback legado se vazio.
    put("time_zone", effectiveTimeZone())
    // updated_at via FieldValue.serverTimestamp() quando suportado pelo gitlive
}
```

```kotlin
// ANTES — ModelMappers.kt (não mapeia timeZone)
fun AndroidLocation.toKmpLocation(): KmpLocation {
    return KmpLocation(
        // ...
        minGameDurationMinutes = minGameDurationMinutes,
        // ❌ timeZone omitido
    )
}

// DEPOIS — ModelMappers.kt (round-trip do fuso)
fun AndroidLocation.toKmpLocation(): KmpLocation {
    return KmpLocation(
        // ...
        minGameDurationMinutes = minGameDurationMinutes,
        timeZone = timeZone, // preserva o fuso lido do documento
    )
}
// toAndroidLocation(): análogo — timeZone = timeZone
```

### 3.3 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Update parcial omite algum campo editável hoje incluído no `.set()` | Revisar `toEditableUpdateMap()` contra todos os campos do form (`LocationDetailScreen`); testes de round-trip |
| Regressão em `createLocation()` (também usa `.set()`) | `createLocation` continua com `.set()` (criação não apaga nada), mas deve incluir `time_zone` — garantir via modelo |
| Cliente antigo publicado ainda faz `.set()` e apaga `time_zone` | Accept para esta spec (migração gradual); o backfill é re-rodável e idempotente. Documentar no release notes |
| Firestore Rules rejeitando update parcial por validação de campos ausentes | Rules usam `data.get('time_zone', 'America/Sao_Paulo')` (commit `5fa02d21`) — tolerante a ausência. Validar com `firestore-rules-tests` |
| `time_zone` inválido persistido por cliente móvel sem validação | Validar entrada no ViewModel antes de salvar (espelhar `isValidLocationTimeZone` da Web com lista `LOCATION_TIME_ZONE_OPTIONS`) |

---

## 4. Verificação

### 4.1 Testes Adicionados

#### Testes de modelo (shared, multiplataforma)
- [ ] `shared/src/commonTest/kotlin/com/futebadosparcas/domain/model/LocationTest.kt`
  - adicionar: `location_timeZone_nulo_por_default_retornaNull()`
  - adicionar: `location_effectiveTimeZone_aplicaFallback_quandoAusente()`
  - adicionar: `location_effectiveTimeZone_preservaValor_quandoPreenchido()`
  - (seguir convenção `kotlin.test` + `makeLocation()` helper já existente)

#### Testes de mapper (Android, JUnit5 + Truth)
- [ ] `app/src/test/java/com/futebadosparcas/util/ModelMappersLocationTimeZoneTest.kt` (novo)
  - `toKmpLocation_preservaTimeZone()`
  - `toAndroidLocation_preservaTimeZone()`
  - `toKmpLocation_timeZoneNulo_permiteRoundTrip()`
  - (convenção: `@DisplayName`, `assertThat` do Truth, factory `createValidLocation`
    espelhando `LocationValidationTest.kt`)

#### Testes de compatibilidade legado (Android)
- [ ] `app/src/test/java/com/futebadosparcas/domain/validation/LocationValidationTest.kt`
  - adicionar `@Nested`: documento legado (sem `time_zone`) desserializa com
    `timeZone == null` e `effectiveTimeZone() == "America/Sao_Paulo"`

#### Testes de update parcial (Android, MockK)
- [ ] `app/src/test/java/com/futebadosparcas/data/repository/LocationUpdatePreservesTimeZoneTest.kt` (novo)
  - Mock do `FirebaseDataSource`/Firestore capturando o mapa enviado a `.update()`
  - `updateLocation_incluiTimeZone_noMapaParcial()`
  - `updateLocation_aplicaFallback_quandoTimeZoneVazio()`
  - `updateLocation_naoApagaAgregados_deBackend()`

#### Testes de Rules (já existentes)
- [ ] `firestore-rules-tests/src/locations.test.ts` — adicionar caso: update parcial
  móvel preservando `time_zone` é aceito pelas Rules (commit `5fa02d21` já cobre validação)

### 4.2 Testes de Regressão

- [ ] Criar local pelo Android → documento contém `time_zone` (fallback se não escolhido)
- [ ] Editar descrição de local existente pelo Android → `time_zone` **preservado**
- [ ] Local com `time_zone: "America/Manaus"` editado no Android → continua `"America/Manaus"`
- [ ] Local legado (sem `time_zone`) lido no Android → não crasha; Web mostra fallback SP
- [ ] `isCommerciallyAvailable()` e agregados (`games_count`, etc.) inalterados após update parcial
- [ ] `createLocation()` e `getOrCreateLocationFromPlace()` ainda funcionam

### 4.3 Checklist

- [ ] Bug não reproduz mais (edição móvel não apaga `time_zone`)
- [ ] `./gradlew :app:compileDebugKotlin` passa (KMP shared compila)
- [ ] `./gradlew :app:testDebugUnitTest` passa
- [ ] `./gradlew detekt` sem novos warnings
- [ ] `cd functions && npm run build && npx jest` (se functions relevantes)
- [ ] Testado em dispositivo com local em fuso != SP

---

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

O PR #3552 modelou `time_zone` apenas na Web, sem um espelho contratual no KMP/Android.
Não existe um teste de **paridade de schema** entre Web/KMP/Android para a coleção
`locations`. O `.set()` de objeto inteiro em `updateLocation` era um risco latente que
só virou bug visível quando a Web passou a gravar um campo novo.

### 5.2 Ações para evitar bugs similares

- [ ] Adicionar teste de paridade: para cada campo de `web/src/types/location.ts`
      `Location`, existe uma propriedade equivalente no KMP `Location.kt` e no Android
      `Location.kt` (gerador de diff de schema ou teste de snapshot)
- [ ] Padronizar `updateLocation()` como update parcial por padrão; proibir `.set()` em
      updates de documentos compartilhados entre plataformas
- [ ] Documentar o contrato `time_zone` em `docs/LOCATION_TIMEZONES.md` mencionando
      explicitamente o Android/KMP (hoje só cita a Web)
- [ ] Considerar um `AGENTS.md`/CLAUDE.md note: "ao adicionar campo Firestore em uma
      plataforma, atualizar Web + KMP + Android + mappers simultaneamente"

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-12 | issue #3553 | Bug reportado (follow-up PR #3552 / issue #3550) |
| 2026-07-12 | SDD spec | Análise de causa raiz e spec criada |
