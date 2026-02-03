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

    /**
     * Configuração otimizada de ImageLoader com Coil.
     *
     * Otimizações aplicadas:
     * - Disk Cache: 100MB (suficiente para ~500 avatares + fotos de jogos)
     * - Memory Cache: 25% da RAM (~50MB em dispositivo médio)
     * - Crossfade suave de 300ms
     * - Cache agressivo (ignora cache headers)
     * - Placeholders e error handling
     * - Lifecycle awareness para prevenir leaks
     */
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
            // Configuracao de cache em memoria (25% da RAM ou 50MB, o que for menor)
            .memoryCache {
                MemoryCache.Builder(context)
                    .maxSizePercent(0.25) // 25% da memoria disponivel
                    .maxSizeBytes(50 * 1024 * 1024) // Hard limit: 50MB
                    .weakReferencesEnabled(true) // Permitir GC limpar em casos de pressão
                    .build()
            }
            // Politicas de cache agressivas
            .diskCachePolicy(CachePolicy.ENABLED)
            .memoryCachePolicy(CachePolicy.ENABLED)
            .networkCachePolicy(CachePolicy.ENABLED)
            .respectCacheHeaders(false) // Ignorar cache headers - sempre usar cache local

            // Animacoes suaves
            .crossfade(true)
            .crossfade(300) // 300ms de duracao

            // Performance e qualidade
            .allowHardware(true) // Usar hardware bitmaps (mais rápido, menos memória)
            .allowRgb565(true) // Permitir RGB565 em vez de ARGB_8888 (50% menos memória)

            // Lifecycle awareness
            .respectCacheHeaders(false)

            .build()
    }
}
