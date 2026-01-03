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

# Room
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# Silence benign R8 warnings from third-party libraries
-ignorewarnings
