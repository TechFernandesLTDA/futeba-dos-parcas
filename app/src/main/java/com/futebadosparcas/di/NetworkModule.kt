package com.futebadosparcas.di

import com.futebadosparcas.BuildConfig
import com.futebadosparcas.data.remote.ViaCepService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val CONNECT_TIMEOUT_SECONDS = 10L
    private const val READ_TIMEOUT_SECONDS = 15L
    private const val WRITE_TIMEOUT_SECONDS = 15L

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        return OkHttpClient.Builder()
            .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .addInterceptor(logging)
            // Gzip compression - servidor responde comprimido se suportado
            .addNetworkInterceptor { chain ->
                val originalRequest = chain.request()
                val requestWithGzip = originalRequest.newBuilder()
                    .header("Accept-Encoding", "gzip, deflate")
                    .build()
                chain.proceed(requestWithGzip)
            }
            .build()
    }

    @Provides
    @Singleton
    fun provideViaCepService(client: OkHttpClient): ViaCepService {
        return Retrofit.Builder()
            .baseUrl("https://viacep.com.br/ws/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ViaCepService::class.java)
    }
}
