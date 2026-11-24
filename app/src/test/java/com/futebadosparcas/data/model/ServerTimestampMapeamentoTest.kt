package com.futebadosparcas.data.model

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import com.google.firebase.firestore.util.CustomClassMapper
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import java.util.Date

/**
 * #4592: como o mapper do Firestore (o mesmo do app) trata o `@ServerTimestamp`
 * quando o nome do campo no documento vem de `@get:PropertyName`.
 */
class ServerTimestampMapeamentoTest {

    // Forma usada nos modelos: a anotação vai para o campo Java e o mapper não a vê.
    class SemAlvo {
        @ServerTimestamp
        @get:PropertyName("created_at")
        @set:PropertyName("created_at")
        var createdAt: Date? = null
    }

    // Forma que o mapper enxerga: a anotação no getter, junto do nome.
    class ComAlvoNoGetter {
        @get:ServerTimestamp
        @get:PropertyName("created_at")
        @set:PropertyName("created_at")
        var createdAt: Date? = null
    }

    // O que aconteceria com AppNotification.createdAtRaw se a anotação passasse a valer.
    class AnotacaoNoGetterEmAny {
        @get:ServerTimestamp
        @get:PropertyName("created_at")
        @set:PropertyName("created_at")
        var createdAtRaw: Any? = null
    }

    private fun mapa(obj: Any): Map<String, Any?> {
        @Suppress("UNCHECKED_CAST")
        return CustomClassMapper.convertToPlainJavaTypes(obj) as Map<String, Any?>
    }

    @Test
    fun serverTimestamp_semAlvoComPropertyName_gravaNulo() {
        val gravado = mapa(SemAlvo())

        assertNull(gravado["created_at"])
    }

    @Test
    fun serverTimestamp_noGetterComPropertyName_gravaHoraDoServidor() {
        val gravado = mapa(ComAlvoNoGetter())

        assertEquals(FieldValue.serverTimestamp(), gravado["created_at"])
    }

    @Test
    fun cashbox_lancamentoNovo_naoSaiComDataDeEstorno() {
        val gravado = mapa(CashboxEntry())

        assertNull(gravado["voided_at"])
    }

    @Test
    fun serverTimestamp_noGetterEmCampoAny_lancaExcecao() {
        assertThrows(RuntimeException::class.java) { mapa(AnotacaoNoGetterEmAny()) }
    }

    @Test
    fun appNotification_semDataDeCriacao_serializaSemErro() {
        val gravado = mapa(AppNotification())

        assertNull(gravado["created_at"])
    }
}
