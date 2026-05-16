package com.futebadosparcas.domain.repository

/**
 * Factory de repositórios para iOS.
 *
 * No iOS, a injeção de dependência ocorre via Koin no módulo composeApp,
 * espelhando exatamente o padrão do Android (onde o DI real fica em
 * app/.../di/koin/ e AndroidRepositoryFactory é apenas placeholder).
 *
 * As implementações reais de repositório usam o GitLive Firebase SDK
 * (dev.gitlive:firebase-*) que suporta Android e iOS nativamente via
 * fontes em nativeAndAndroidMain — veja shared/src/nativeAndAndroidMain/.
 *
 * Este objeto é mantido para organização da estrutura KMP e documentação.
 * Não instancie repositórios diretamente aqui — use Koin via koinViewModel()
 * ou get() nas telas Compose.
 */
object IosRepositoryFactory {

    // Repositórios iOS são providos via Koin (composeApp/iosMain ou shared Koin modules).
    // Padrão de wiring:
    //   module {
    //       single<UserRepository> { UserRepositoryImpl(get(), get()) }
    //   }
    // onde UserRepositoryImpl reside em shared/src/nativeAndAndroidMain (GitLive SDK).
}
