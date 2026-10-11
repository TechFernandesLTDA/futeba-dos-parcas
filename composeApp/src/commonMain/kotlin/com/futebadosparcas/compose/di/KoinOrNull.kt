package com.futebadosparcas.compose.di

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import org.koin.compose.getKoin
import org.koin.core.annotation.KoinInternalApi
import org.koin.compose.currentKoinScope
import org.koin.viewmodel.defaultExtras
import org.koin.viewmodel.resolveViewModel

/**
 * Variantes "ou nulo" de `koinInject` / `koinViewModel`.
 *
 * Várias telas do composeApp aceitam dependência ausente (definição Koin não registrada na
 * plataforma, ex.: harness Android) e exibem um estado "indisponível". Antes isso era feito com
 * `runCatching { koinInject<T>() }`, mas o compilador Compose do Kotlin 2.4 proíbe invocar
 * `@Composable` dentro de `runCatching` (try/catch). Aqui só a parte NÃO composable fica dentro
 * do `runCatching`, mantendo o mesmo comportamento (#4265).
 */
@Composable
internal inline fun <reified T : Any> koinInjectOrNull(): T? {
    val koin = getKoin()
    return remember(koin) { runCatching { koin.get<T>() }.getOrNull() }
}

@OptIn(KoinInternalApi::class)
@Composable
internal inline fun <reified VM : ViewModel> koinViewModelOrNull(): VM? {
    val owner = LocalViewModelStoreOwner.current ?: return null
    val scope = currentKoinScope()
    val extras = defaultExtras(owner)
    return runCatching {
        resolveViewModel(VM::class, owner.viewModelStore, null, extras, null, scope, null)
    }.getOrNull()
}
