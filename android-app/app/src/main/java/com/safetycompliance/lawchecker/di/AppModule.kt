package com.safetycompliance.lawchecker.di

import android.content.Context
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.safetycompliance.lawchecker.data.local.LawDatabaseLoader
import com.safetycompliance.lawchecker.data.repository.LawRepository
import com.safetycompliance.lawchecker.network.AIService
import com.safetycompliance.lawchecker.network.GeminiApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideGson(): Gson {
        return GsonBuilder()
            .setLenient()
            .create()
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        return OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient, gson: Gson): Retrofit {
        return Retrofit.Builder()
            .baseUrl(GeminiApiService.BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }

    @Provides
    @Singleton
    fun provideGeminiApiService(retrofit: Retrofit): GeminiApiService {
        return retrofit.create(GeminiApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideLawDatabaseLoader(
        @ApplicationContext context: Context,
        gson: Gson
    ): LawDatabaseLoader {
        return LawDatabaseLoader(context, gson)
    }

    @Provides
    @Singleton
    fun provideLawRepository(databaseLoader: LawDatabaseLoader): LawRepository {
        return LawRepository(databaseLoader)
    }

    @Provides
    @Singleton
    fun provideAIService(geminiApi: GeminiApiService): AIService {
        return AIService(geminiApi)
    }
}
