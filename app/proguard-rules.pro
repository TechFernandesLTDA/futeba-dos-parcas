# Futeba dos Parcas ProGuard Rules

# Keep generic signature of Call, Response (R8 full mode strips signatures from non-kept items)
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class retrofit2.Response

# With R8 full mode generic signatures are stripped for classes that are not kept.
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation

# Retrofit
-keepattributes Signature
-keepattributes Exceptions
-keepattributes *Annotation*

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.stream.** { *; }
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keepclassmembers,allowobfuscation class * {
  @com.google.gson.annotations.SerializedName <fields>;
}

# Data models
-keep class com.futebadosparcas.data.model.** { *; }
-keep class com.futebadosparcas.data.remote.** { *; }

# Hilt
-keepclasseswithmembers class * {
    @dagger.hilt.android.lifecycle.HiltViewModel <init>(...);
}

# Firebase
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.libraries.places.internal.**
-dontwarn com.google.android.gms.internal.location.**
-dontwarn com.google.android.libraries.places.internal.zzbpg
-dontwarn com.google.android.libraries.places.internal.zzbpn
-dontwarn com.google.android.libraries.places.internal.zzboz
-dontwarn com.google.android.libraries.places.internal.zzbou
-dontwarn com.google.android.gms.internal.location.zze

# MPAndroidChart
-keep class com.github.mikephil.charting.** { *; }

# Navigation Component Safe Args
-keepnames class * extends android.os.Parcelable
-keepnames class * extends java.io.Serializable

# Room - Complete rules to prevent crashes
-keep class * extends androidx.room.RoomDatabase
-keep class androidx.room.** { *; }
-keep @androidx.room.Entity class *
-keep @androidx.room.Dao class *
-dontwarn androidx.room.paging.**

# Room Database implementations (generated classes like *_Impl)
-keep class **_Impl { *; }
-keepclassmembers class **_Impl {
    <init>();
}

# WorkManager - Required for Hilt WorkManager integration
-keep class * extends androidx.work.Worker
-keep class * extends androidx.work.InputMerger
-keep class androidx.work.** { *; }
-keep class androidx.work.impl.** { *; }
-keep class androidx.work.impl.WorkDatabase { *; }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }

# Hilt WorkManager Factory
-keep class * extends androidx.work.WorkerFactory
-keep class androidx.hilt.work.HiltWorkerFactory { *; }

# Silence benign R8 warnings from third-party libraries
-ignorewarnings

# ========================================
# #030 - SECURITY & OPTIMIZATION RULES
# ========================================

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}

# Remove Timber logging
-assumenosideeffects class timber.log.Timber* {
    public static *** v(...);
    public static *** d(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# Obfuscate sensitive strings (Firebase API keys, etc.)
-keepclassmembers class com.futebadosparcas.BuildConfig {
    public static final java.lang.String APPLICATION_ID;
    public static final java.lang.String VERSION_NAME;
    public static final int VERSION_CODE;
}

# Remove debug annotations
-assumenosideeffects class kotlin.jvm.internal.Intrinsics {
    static void checkParameterIsNotNull(java.lang.Object, java.lang.String);
    static void checkNotNullParameter(java.lang.Object, java.lang.String);
}

# Optimize reflection
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Kotlin Coroutines optimization
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}

# Jetpack Compose
-keep class androidx.compose.runtime.** { *; }
-keep class androidx.compose.ui.** { *; }
-dontwarn androidx.compose.animation.graphics.ExperimentalAnimationGraphicsApi

# Kotlin Serialization (for KMP)
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# KMP Shared Module
-keep class com.futebadosparcas.shared.** { *; }
-keep class app.cash.sqldelight.** { *; }

# ViewBinding
-keep class * implements androidx.viewbinding.ViewBinding {
    public static *** bind(android.view.View);
    public static *** inflate(android.view.LayoutInflater);
}

# Enum optimization
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Crashlytics - Keep line numbers for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Security: Remove printStackTrace calls
-assumenosideeffects class java.lang.Throwable {
    public void printStackTrace();
}
