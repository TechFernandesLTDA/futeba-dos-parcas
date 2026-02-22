package com.futebadosparcas.di.koin

import coil3.ImageLoader
import coil3.disk.DiskCache
import coil3.memory.MemoryCache
import coil3.request.CachePolicy
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import okhttp3.OkHttpClient
import okio.Path.Companion.toOkioPath
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module
import java.util.concurrent.TimeUnit

val imageKoinModule = module {

    single<ImageLoader> {
        val context = androidContext()

        // OkHttp client configurado para Coil 3
        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        ImageLoader.Builder(context)
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("image_cache").toPath().toOkioPath())
                    .maxSizeBytes(100 * 1024 * 1024) // 100MB
                    .build()
            }
            .memoryCache {
                MemoryCache.Builder()
                    .maxSizePercent(percent = 0.25, context = context)
                    .maxSizeBytes(50 * 1024 * 1024) // 50MB
                    .weakReferencesEnabled(true)
                    .build()
            }
            // Coil 3 requires explicit network fetcher
            .components {
                add(OkHttpNetworkFetcherFactory(callFactory = okHttpClient))
            }
            // Cache policies
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .networkCachePolicy(CachePolicy.ENABLED)
<<<<<<< HEAD
            // Image loading options
            .allowHardware(true)
            .allowRgb565(true)
=======
>>>>>>> f3237fc2328fe3c708bd99fb005154a8d51298a3
            .build()
    }
}
