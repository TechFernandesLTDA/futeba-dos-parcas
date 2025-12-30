# Tech Stack & Context Dictionary

## 🧠 Project Overview

**Futeba dos Parças** is a comprehensive Android application for managing soccer/futsal matches, groups, and player statistics with a heavy emphasis on gamification (XP, Rankings, Achievements).

## 🛠 Technology Stack

- **Language**: Kotlin
- **Architecture**: MVVM (Model-View-ViewModel) + Clean Architecture principles (Repositories, Use cases).
- **DI**: Hilt (Dagger)
- **UI Framework**: Hybrid (XML Views + Jetpack Compose for new features).
  - *Material Design 3* compliant.
- **Navigation**: Jetpack Navigation Component (SafeArgs).
- **Async**: Coroutines + Flow.
- **Backend/Data**: Firebase
  - *Firestore*: NoSQL Database.
  - *Auth*: User authentication.
  - *Storage*: Image uploads.
  - *Functions*: Backend logic (likely triggers).
  - *Crashlytics*: Error monitoring.

## 📂 Project Structure Map

For LLMs navigating the codebase, here are the key locations:

### 📱 App Module (`app/src/main/java/com/padawanbr/futebadosparcas/`)

| Package | Description |
|---------|-------------|
| `data/` | Repositories, Data Sources, and Models (DTOs). |
| `domain/` | Use Cases (Business Logic) and Domain Models. |
| `presentation/` | UI Layer: Fragments, ViewModels, Adapters, Compose Screens. |
| `di/` | Hilt Dependencies Modules (`AppModule`, `FirebaseModule`). |
| `utils/` | Extension functions, Constants (`AppConstants`), Helpers. |

### 🔧 Key Files

- **`AndroidManifest.xml`**: App permissions and Activity declarations.
- **`build.gradle.kts`**: Dependencies and build config.
- **`nav_graph.xml`**: Navigation paths and arguments.
- **`firestore.indexes.json`**: Database indexing rules.

## 🤖 LLM Tips

- **Theme**: The app uses `Theme.FutebaDosParcas`. Look for `colors.xml` and `themes.xml` for styling.
- **Gamification**: Logic for XP calculations resides mainly in `MatchFinalizationService` (or similar UseCases).
- **Testing**: Tests are located in `src/test` (Unit) and `src/androidTest` (Instrumented).
