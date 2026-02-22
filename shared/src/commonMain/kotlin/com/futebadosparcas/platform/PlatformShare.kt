package com.futebadosparcas.platform

/**
 * Abstração multiplataforma para compartilhamento de conteúdo
 * - Android: Intent.ACTION_SEND
 * - iOS: UIActivityViewController
 * - Web: Web Share API (navigator.share)
 */
interface PlatformShare {
    /**
     * Compartilha texto e/ou URL usando o sistema de compartilhamento nativo
     *
     * @param text Texto a compartilhar (obrigatório)
     * @param url URL opcional para compartilhar junto
     * @param title Título opcional para o compartilhamento
     * @return true se o compartilhamento foi iniciado com sucesso, false caso contrário
     */
    suspend fun share(
        text: String,
        url: String? = null,
        title: String? = null
    ): Boolean

    /**
     * Compartilha uma imagem usando o sistema de compartilhamento nativo
     *
     * @param uri URI da imagem a compartilhar
     * @param text Texto opcional para acompanhar a imagem
     * @param title Título opcional
     * @return true se o compartilhamento foi iniciado com sucesso
     */
    suspend fun shareImage(
        uri: PlatformUri,
        text: String? = null,
        title: String? = null
    ): Boolean

    /**
     * Verifica se o compartilhamento é suportado na plataforma atual
     */
    fun isSupported(): Boolean
}

/**
 * Factory para criar instância de PlatformShare específica da plataforma
 */
expect object PlatformShareFactory {
    fun create(): PlatformShare
}
