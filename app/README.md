# 📱 Android App - Futeba dos Parças

**Kotlin + Jetpack Compose + Clean Architecture** - MVVM mobile app para gerenciar futsal/pelada games.

## 🚀 Quick Start

```bash
# Prerequisites: Android Studio, JDK 17, google-services.json

# 1. Clone & open in Android Studio
git clone <repo>
cd futeba-dos-parcas
# File → Open → select project

# 2. Add google-services.json
# Download from Firebase Console → paste in app/google-services.json

# 3. Sync Gradle
# Ctrl+Alt+S or File → Sync Now

# 4. Run
# Shift+F10 or Run → Run 'app'
```

## 📚 Documentação Completa

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Clean Architecture, MVVM, patterns
- **[MODULES.md](./MODULES.md)** - Features (Home, Games, Players, etc)

## 🏗️ Arquitetura

**Clean Architecture com 3 camadas:**

```
DATA LAYER (Repositories, Room, Firestore)
    ↓
DOMAIN LAYER (Use Cases, Business Logic)
    ↓
PRESENTATION LAYER (ViewModels, UI, Fragments, Compose)
```

**Stack:**
- **Kotlin** - Linguagem
- **Jetpack Compose** - Modern UI (novos screens)
- **XML Layouts** - Legacy UI (screens existentes)
- **Room** - Local database (offline cache)
- **Firestore** - Cloud sync real-time
- **Hilt** - Dependency injection
- **Coroutines + Flow** - Async/reactive

## 📂 Estrutura

```
app/src/main/java/com/futebadosparcas/
├── data/
│   ├── repository/          # Game, User, Location, etc repos
│   ├── datasource/          # Local (Room) + Remote (Firestore)
│   ├── local/               # Room database + DAOs
│   ├── mapper/              # Entity ↔ Domain model
│   └── model/               # Domain models
├── domain/
│   ├── usecase/             # Business logic (use cases)
│   ├── ai/                  # Team balancer algorithm
│   ├── gamification/        # Badge awarding, XP
│   └── ranking/             # Ranking calculations
├── ui/
│   ├── home/                # Home hub screen
│   ├── games/               # Games list + create
│   ├── players/             # Player directory
│   ├── league/              # Rankings
│   ├── statistics/          # Stats dashboard
│   ├── locations/           # Field locations + map
│   ├── groups/              # Group management
│   ├── livegame/            # Live score tracking
│   ├── badges/              # Badge collection
│   └── main/                # Navigation hub
├── di/                      # Hilt dependency injection
├── service/                 # FCM push notifications
└── util/                    # Helpers (prefs, theme, etc)
```

## 🎯 Features

| Feature | Screen | Status |
|---------|--------|--------|
| **Authentication** | Auth | ✅ Complete |
| **Home Hub** | Home | ✅ Complete |
| **Games List** | Games | ✅ Complete |
| **Create Game** | Games → Create | ✅ Complete |
| **Confirm Presence** | Game Detail | ✅ Complete |
| **Team Generation** | Games → Teams | ✅ Complete |
| **Live Game** | Live | ✅ Complete |
| **Statistics** | Statistics | ✅ Complete |
| **Rankings** | League | ✅ Complete |
| **Player Directory** | Players | ✅ Complete |
| **Locations** | Locations | ✅ Complete |
| **Badges** | Badges | ✅ Complete |
| **Groups** | Groups | ✅ Complete |
| **Push Notifications** | Notifications | ✅ Complete |

## 🔧 Build & Run

### Debug Build

```bash
# Via Android Studio
# Run → Run 'app' (Shift+F10)

# Or terminal
./gradlew installDebug
```

### Release Build

```bash
# Build APK
./gradlew assembleRelease

# Build Bundle (for Play Store)
./gradlew bundleRelease

# Output:
# app/build/outputs/apk/release/app-release.apk
# app/build/outputs/bundle/release/app-release.aab
```

## ⚙️ Configuration

### Build Config (app/build.gradle.kts)

```kotlin
android {
    compileSdk = 35
    defaultConfig {
        minSdk = 24
        targetSdk = 35
    }
}
```

### Properties Files

**local.properties** (machine-specific, not committed):
```properties
sdk.dir=/path/to/android/sdk
MAPS_API_KEY=your-maps-api-key
```

### Google Services

**google-services.json** (download from Firebase):
```
Placed in: app/google-services.json
Not committed to git
```

## 🏃 Development

### Running Tests

```bash
# Unit tests (JVM)
./gradlew testDebug

# Instrumented tests (Device/Emulator)
./gradlew connectedAndroidTest

# Code coverage
./gradlew createDebugCoverageReport
```

### Debugging

**Android Studio:**
- Set breakpoints (click line number)
- Shift+F9 to debug
- F8 = Step over, F7 = Step into

**Logcat:**
```bash
adb logcat | grep futebadosparcas
```

## 🚀 Release

### App Signing

```bash
# Generate keystore (one-time)
keytool -genkey -v -keystore futeba.keystore \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias futeba

# Sign APK (automatic in release build)
# Configure in app/build.gradle.kts:
signingConfigs {
    release {
        storeFile = file("futeba.keystore")
        storePassword = "..."
        keyAlias = "futeba"
        keyPassword = "..."
    }
}
```

### Play Store Deployment

```bash
# 1. Build bundle
./gradlew bundleRelease

# 2. Upload to Play Store Console
# https://play.google.com/console

# 3. Create release, add changelog, deploy
```

## 📚 Dependencies

**Core:**
- androidx.compose:compose-bom:2024.09.00
- androidx.room:room-runtime:2.6.1
- com.google.dagger:hilt-android:2.51.1

**Firebase:**
- firebase-bom:33.7.0 (Auth, Firestore, Messaging, Storage)

**Networking:**
- com.squareup.retrofit2:retrofit:2.9.0
- io.coil-kt:coil:2.7.0 (images)

**See:** [app/build.gradle.kts](./build.gradle.kts)

## 🔐 Firebase Setup

### Google Services JSON

1. Firebase Console → Project Settings
2. Download google-services.json for Android
3. Place in `app/google-services.json`
4. Sync Gradle

### Emulator (Development)

In `FirebaseModule.kt`:
```kotlin
if (BuildConfig.DEBUG) {
    // USE_EMULATOR = true
    firestore.useEmulator("10.0.2.2", 8085)
}
```

## 🎨 UI Architecture

### Jetpack Compose Screens

Modern UI using Compose:
- HomeFragment, GameDetailScreen, LeagueScreen

### XML Layouts (Legacy)

Traditional XML layouts still used in:
- Some game flows, legacy screens

### Theme System

```kotlin
// Configured in: ThemeRepository + compose theme
// Supports: Light, Dark, System (default)
// Switch in: Preferences screen
```

## 🔔 Push Notifications

**FCM Integration:**
- Service: `FcmService.kt`
- Handles game invites, reminders, badges
- Token stored in User profile

**Testing:**
```bash
# Send test notification via Firebase Console
# Or use fcm-tools
```

## 📊 Offline-First Strategy

- **Room Database** - Local cache of games, users, stats
- **Firestore Sync** - Automatic sync when online
- **Fallback** - Use Room data if Firestore unavailable

## 🤝 Contributing

1. Fork repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m "feat: description"`
4. Push: `git push origin feature/my-feature`
5. Create Pull Request

See [DEVELOPMENT_GUIDE.md](../DEVELOPMENT_GUIDE.md) for coding standards.

## 📚 See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Clean Architecture, MVVM, patterns
- [MODULES.md](./MODULES.md) - Features & screens detailed
- [../SETUP_GUIDE.md](../SETUP_GUIDE.md) - Full development setup
- [../API_REFERENCE.md](../API_REFERENCE.md) - Backend API docs

---

**Última atualização:** Dezembro 2025
**Version:** 1.1.3 | **SDK:** 35 | **Min SDK:** 24
