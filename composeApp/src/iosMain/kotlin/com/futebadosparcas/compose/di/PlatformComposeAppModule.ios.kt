package com.futebadosparcas.compose.di

import com.futebadosparcas.data.AuthRepositoryImpl
import com.futebadosparcas.data.CashboxRepositoryImpl
import com.futebadosparcas.data.GamificationRepositoryImpl
import com.futebadosparcas.data.LocationRepositoryImpl
import com.futebadosparcas.data.RankingRepositoryImpl
import com.futebadosparcas.data.StatisticsRepositoryImpl
import com.futebadosparcas.data.ThemeRepositoryImpl
import com.futebadosparcas.data.repository.LiveGameRepositoryImpl
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.LiveGameRepository
import com.futebadosparcas.domain.repository.RankingRepository
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.repository.ThemeRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.storage.PreferencesService
import com.futebadosparcas.domain.model.GameWithConfirmations
import com.futebadosparcas.ui.core.GamesViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import org.koin.core.module.Module
import org.koin.core.module.dsl.viewModel
import org.koin.dsl.module
import platform.Foundation.NSBundle

/**
 * O Firebase só é configurado pelo `AppDelegate` quando o `GoogleService-Info.plist`
 * está no bundle (modo smoke-test sem ele, ver iosApp/SETUP.md). Sem configuração,
 * instanciar o `FirebaseDataSource` lança `FIRIllegalStateException`, uma NSException
 * que o `runCatching` do Kotlin não captura: o app fechava ao abrir. Mesmo critério
 * do `AppDelegate.swift`.
 */
internal fun isFirebaseConfigured(): Boolean =
    NSBundle.mainBundle.pathForResource("GoogleService-Info", ofType = "plist") != null

internal actual fun platformComposeAppModules(): List<Module> = listOf(
    module {
        single { PreferencesService() }
        // #4097 — preferências de tema persistidas em NSUserDefaults (shared/iosMain).
        single<ThemeRepository> { ThemeRepositoryImpl() }
    },
    if (isFirebaseConfigured()) firebaseModule() else module { }
)

/** Dependências que tocam o Firebase; ausentes, as telas mostram o estado "indisponível". */
private fun firebaseModule(): Module = module {
    single { FirebaseDataSource() }
    single<AuthRepository> { AuthRepositoryImpl(get()) }
    single<RankingRepository> { RankingRepositoryImpl(get()) }
    single<GamificationRepository> { GamificationRepositoryImpl(get()) }
    single<LocationRepository> { LocationRepositoryImpl(get()) }
    single<CashboxRepository> { CashboxRepositoryImpl(get()) }
    single<StatisticsRepository> { StatisticsRepositoryImpl(get()) }
    single<LiveGameRepository> { LiveGameRepositoryImpl(get()) }
    // Aba Jogos: não existe `GameRepository` no iOS; a lista vem direto do Firestore.
    viewModel {
        val dataSource = get<FirebaseDataSource>()
        GamesViewModel(observeGames = { gamesForList(dataSource) })
    }
}

/**
 * Jogos da aba "Jogos" no iOS: próximos jogos públicos (o filtro de visibilidade é exigido
 * pelas regras do Firestore) somados aos jogos em que a pessoa confirmou presença.
 * Se só a parte dos confirmados falhar, a lista pública continua valendo.
 */
private fun gamesForList(dataSource: FirebaseDataSource): Flow<Result<List<GameWithConfirmations>>> = flow {
    val publicGames = dataSource.getPublicGames(PUBLIC_GAMES_LIMIT)
    val userId = dataSource.getCurrentUserId()
    val confirmed = if (userId != null) {
        dataSource.getConfirmedGamesForUser(userId).getOrNull().orEmpty()
    } else {
        emptyList()
    }
    val confirmedIds = confirmed.map { it.id }.toSet()
    publicGames.fold(
        onSuccess = { games ->
            val all = (games + confirmed).distinctBy { it.id }
                .sortedBy { "${it.date} ${it.time}" }
                .map { GameWithConfirmations(it, it.playersCount, it.id in confirmedIds) }
            emit(Result.success(all))
        },
        onFailure = { error ->
            if (confirmed.isEmpty()) {
                emit(Result.failure(error))
            } else {
                emit(Result.success(confirmed.sortedBy { "${it.date} ${it.time}" }
                    .map { GameWithConfirmations(it, it.playersCount, true) }))
            }
        }
    )
}

private const val PUBLIC_GAMES_LIMIT = 50
