package com.futebadosparcas.di.koin

import com.futebadosparcas.BuildConfig
import com.futebadosparcas.data.remote.ViaCepService
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.koin.dsl.module
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

val networkKoinModule = module {

    single<OkHttpClient> {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
        OkHttpClient.Builder()
            .connectTimeout(10L, TimeUnit.SECONDS)
            .readTimeout(15L, TimeUnit.SECONDS)
            .writeTimeout(15L, TimeUnit.SECONDS)
            .addInterceptor(logging)
            // PERF #4411: sem header manual `Accept-Encoding` — forçar gzip/deflate
            // desliga a descompressão transparente do OkHttp. O cliente já negocia
            // gzip sozinho e infla a resposta (ViaCEP incluído).
            .build()
    }

    single<ViaCepService> {
        Retrofit.Builder()
            .baseUrl("https://viacep.com.br/ws/")
            .client(get())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ViaCepService::class.java)
    }
}
