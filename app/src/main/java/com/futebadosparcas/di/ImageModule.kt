package com.futebadosparcas.di

import android.content.Context
import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import coil.request.CachePolicy
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Modulo Hilt para configuracao de cache de imagens com Coil.
 *
 * Configuracoes aplicadas:
 * - Disk Cache: 100MB
 * - Memory Cache: 50MB
 * - Crossfade animation habilitado por padrao
 */
@Module
@InstallIn(SingletonComponent::class)
object ImageModule {

    @Provides
    @Singleton
    fun provideImageLoader(@ApplicationContext context: Context): ImageLoader {
        return ImageLoader.Builder(context)
            // Configuracao de cache em disco (100MB)
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("image_cache"))
                    .maxSizeBytes(100 * 1024 * 1024) // 100MB
                    .build()
            }
            // Configuracao de cache em memoria (50MB)
            .memoryCache {
                MemoryCache.Builder(context)
                    .maxSizePercent(0.25) // 25% da memoria disponivel, max 50MB
                    .maxSizeBytes(50 * 1024 * 1024) // 50MB
                    .build()
            }
            // Politicas de cache
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .networkCachePolicy(CachePolicy.ENABLED)
            // Crossfade animation habilitado por padrao
            .crossfade(true)
            .crossfade(300) // 300ms de duracao
            // Respeitar pausas de conexao
            .respectCacheHeaders(false) // Usar cache agressivamente
            .build()
    }
}
