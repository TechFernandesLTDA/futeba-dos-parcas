package com.futebadosparcas.domain.repository

/**
 * Factory para criar instancias de repositorios no Android.
 *
 * NOTA: No Android, use Hilt/Dagger para injecao de dependencia.
 * Este arquivo serve como stub para organizacao da estrutura KMP.
 *
 * As implementacoes reais permanecem em:
 * app/src/main/java/com/futebadosparcas/data/repository/
 */
object AndroidRepositoryFactory {

    // Os repositorios Android sao injetados via Hilt no modulo app/
    // Este factory e apenas um placeholder para a estrutura KMP

    /**
     * Exemplo de como criar repositorios no Android:
     *
     * @Module
     * @InstallIn(SingletonComponent::class)
     * object RepositoryModule {
     *     @Provides
     *     @Singleton
     *     fun provideUserRepository(
     *         firestore: FirebaseFirestore,
     *         auth: FirebaseAuth
     *     ): UserRepository = UserRepositoryImpl(firestore, auth)
     * }
     */
}
