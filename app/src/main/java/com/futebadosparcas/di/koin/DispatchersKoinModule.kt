package com.futebadosparcas.di.koin

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import org.koin.core.qualifier.named
import org.koin.dsl.module

val dispatchersKoinModule = module {

    single<CoroutineDispatcher>(named("io")) { Dispatchers.IO }

    single<CoroutineDispatcher>(named("default")) { Dispatchers.Default }

    single<CoroutineDispatcher>(named("main")) { Dispatchers.Main }

    single<CoroutineDispatcher>(named("unconfined")) { Dispatchers.Unconfined }
}
