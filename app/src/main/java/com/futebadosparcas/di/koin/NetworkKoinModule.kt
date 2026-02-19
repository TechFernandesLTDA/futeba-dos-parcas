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
            .addNetworkInterceptor { chain ->
                val originalRequest = chain.request()
                val requestWithGzip = originalRequest.newBuilder()
                    .header("Accept-Encoding", "gzip, deflate")
                    .build()
                chain.proceed(requestWithGzip)
            }
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
