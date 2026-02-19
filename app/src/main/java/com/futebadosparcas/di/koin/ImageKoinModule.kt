package com.futebadosparcas.di.koin

import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module

val imageKoinModule = module {

    single<ImageLoader> {
        val context = androidContext()
        ImageLoader.Builder(context)
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("image_cache"))
                    .maxSizeBytes(100 * 1024 * 1024) // 100MB
                    .build()
            }
            .memoryCache {
                MemoryCache.Builder(context)
                    .maxSizePercent(0.25)
                    .maxSizeBytes(50 * 1024 * 1024) // 50MB
                    .weakReferencesEnabled(true)
                    .build()
            }
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .networkCachePolicy(CachePolicy.ENABLED)
            .respectCacheHeaders(false)
            .crossfade(true)
            .crossfade(300)
            .allowHardware(true)
            .allowRgb565(true)
            .build()
    }
}
