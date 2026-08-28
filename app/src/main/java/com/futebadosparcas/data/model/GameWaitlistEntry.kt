package com.futebadosparcas.data.model

import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.model.WaitlistStatus
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName

/**
 * Espelho Android de `domain.model.GameWaitlist` para o mapper do Firestore (#4066).
 *
 * O modelo KMP anota os campos com `kotlinx.serialization.@SerialName`, que o
 * `CustomClassMapper` do SDK Android **ignora** — ele so honra `@PropertyName`.
 * Gravar/ler o modelo KMP direto fazia o Android escrever `userId`/`queuePosition`/
 * `addedAt` enquanto rules, web e Cloud Functions operam em snake_case: o `create`
 * era negado pelas rules e a leitura devolvia objetos-default (posicao 0, nome vazio).
 *
 * Mesmo padrao ja aplicado a `Game` no #346.
 *
 * ## Por que os campos de tempo sao `Any?`
 *
 * O servidor grava `added_at`/`notified_at`/`response_deadline` ora como
 * `com.google.firebase.Timestamp` (Cloud Functions), ora como numero de millis
 * (clientes web/Android). Declarar `Long?` aqui trocaria o bug silencioso por uma
 * excecao de desserializacao ("Failed to convert value of type Timestamp to long").
 * `Any?` aceita as duas formas; a normalizacao para `Long?` acontece na fronteira do
 * dominio, em `toKmpWaitlist()`. Na escrita gravamos sempre millis (`Long`), que e o
 * que `firestore.rules` valida com `is number`.
 */
@IgnoreExtraProperties
data class GameWaitlistEntry(
    @DocumentId
    var id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("user_name")
    @set:PropertyName("user_name")
    var userName: String = "",
    @get:PropertyName("user_photo")
    @set:PropertyName("user_photo")
    var userPhoto: String? = null,
    var position: String = PlayerPosition.LINE.name,
    @get:PropertyName("queue_position")
    @set:PropertyName("queue_position")
    var queuePosition: Int = 0,
    var status: String = WaitlistStatus.WAITING.name,
    @get:PropertyName("added_at")
    @set:PropertyName("added_at")
    var addedAt: Any? = null,
    @get:PropertyName("notified_at")
    @set:PropertyName("notified_at")
    var notifiedAt: Any? = null,
    @get:PropertyName("response_deadline")
    @set:PropertyName("response_deadline")
    var responseDeadline: Any? = null
)
