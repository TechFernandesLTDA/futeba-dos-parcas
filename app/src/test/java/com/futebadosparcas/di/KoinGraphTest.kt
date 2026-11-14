package com.futebadosparcas.di

import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.di.koin.allKoinModules
import com.futebadosparcas.domain.gamification.BadgeAwarder
import com.futebadosparcas.domain.ranking.PostGameEventEmitter
import com.futebadosparcas.domain.usecase.user.UpdateProfileUseCase
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.koin.core.annotation.KoinInternalApi
import org.koin.core.context.stopKoin
import org.koin.dsl.koinApplication

/**
 * Garante que tudo que o app Android injeta logo depois do login (MainActivityCompose)
 * tem definicao em algum modulo carregado por [allKoinModules]. Sem isso o app fecha com
 * NoDefinitionFoundException na primeira tela.
 */
class KoinGraphTest {

    @AfterEach
    fun tearDown() {
        stopKoin()
    }

    @OptIn(KoinInternalApi::class)
    @Test
    fun `tipos injetados na MainActivityCompose tem definicao nos modulos carregados`() {
        val app = koinApplication { modules(allKoinModules) }
        val definidos = app.koin.instanceRegistry.instances.values
            .map { it.beanDefinition.primaryType }
            .toSet()

        val exigidos = listOf(
            PostGameEventEmitter::class,
            UpdateProfileUseCase::class,
            BadgeAwarder::class,
            GameRepository::class,
        )
        val faltando = exigidos.filter { it !in definidos }.map { it.simpleName }
        assertTrue(faltando.isEmpty(), "Sem definicao no Koin: $faltando")
    }
}
