# ⚽ Futeba dos Parças

[![Android CI](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/android-ci.yml/badge.svg)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/android-ci.yml)
[![iOS Build](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/ios-build.yml/badge.svg)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions/workflows/ios-build.yml)
[![Version](https://img.shields.io/badge/version-1.8.0-green.svg)](https://github.com/TechFernandesLTDA/futeba-dos-parcas/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-lightgrey.svg)](https://github.com/TechFernandesLTDA/futeba-dos-parcas)

> Organize suas peladas com gamificação, estatísticas e diversão! 🎮

[📱 Download na Play Store](https://play.google.com/store/apps/details?id=com.futebadosparcas) | [📖 Documentação](https://futebadosparcas.web.app) | [🐛 Report Bug](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/new?template=bug_report.yml)

---

## 🌟 Features

### ⚽ Gestão de Jogos
- ✅ Criar e gerenciar partidas
- ✅ Sistema de confirmação de presença
- ✅ Check-in com validação GPS
- ✅ Formação automática de times equilibrados
- ✅ Registro de eventos ao vivo (gols, assistências, cartões)

### 🎮 Gamificação
- 🏆 Sistema de XP e níveis
- 🥇 Rankings por temporada (mensal)
- 🎖️ Badges e conquistas desbloqueáveis
- 🔥 Streaks de participação
- 👑 Votação de MVP e Bola Murcha

### 📊 Estatísticas
- 📈 Histórico completo de jogos
- ⚽ Gols, assistências, defesas
- 📉 Win rate e performance
- 🏅 Divisões (Bronze, Prata, Ouro, Diamante)
- 📱 Widgets Android para próximos jogos

### 🚀 Moderno & Multiplataforma
- 🎨 Material Design 3
- 🌓 Dark Mode
- 📱 Jetpack Compose (Android)
- 🍎 SwiftUI + Compose Multiplatform (iOS - em desenvolvimento)
- 🔄 Kotlin Multiplatform (~95% código compartilhado)
- ⚡ Performance otimizada com Baseline Profiles

---

## 📱 Screenshots

| Home | Game Detail | Live Game | Profile |
|------|-------------|-----------|---------|
| ![Home](screenshots/home.png) | ![Game](screenshots/game.png) | ![Live](screenshots/live.png) | ![Profile](screenshots/profile.png) |

---

> **📘 New to the codebase?** Start with **[CLAUDE.md](CLAUDE.md)** - your comprehensive guide to the project architecture, build commands, coding patterns, and Spec-Driven Development workflow. Perfect for onboarding and AI-assisted development!

---

## 🛠️ Tech Stack

### Android
- **Language:** Kotlin 2.0+
- **UI:** Jetpack Compose + Material 3
- **Architecture:** MVVM + Clean Architecture
- **DI:** Hilt
- **Async:** Coroutines + Flow
- **Local DB:** Room + DataStore
- **Network:** Ktor Client
- **Image Loading:** Coil

### iOS (Em Desenvolvimento)
- **Language:** Kotlin (shared) + Swift
- **UI:** Compose Multiplatform
- **Architecture:** KMP (Kotlin Multiplatform)
- **Code Reuse:** ~95%

### Backend
- **Firebase Auth** - Autenticação
- **Cloud Firestore** - Database NoSQL
- **Cloud Storage** - Imagens e arquivos
- **Cloud Functions** - Lógica server-side (TypeScript)
- **FCM** - Push Notifications
- **Crashlytics** - Crash reporting

---

## 🚀 Quick Start

### Pré-requisitos

- JDK 17+
- Android Studio Ladybug (2024.2.1+)
- Android SDK 35
- Firebase CLI (para Functions)

### Clone & Build

```bash
# Clone o repositório
git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
cd futeba-dos-parcas

# Build Android
./gradlew :app:assembleDebug

# Instalar no device
./gradlew :app:installDebug

# Rodar testes
./gradlew :app:testDebugUnitTest
```

### Configuração Firebase

1. Criar projeto no [Firebase Console](https://console.firebase.google.com)
2. Baixar `google-services.json` → `app/`
3. Configurar `local.properties`:

```properties
MAPS_API_KEY=sua_chave_google_maps
```

4. Instalar Functions:

```bash
cd functions
npm install
firebase emulators:start
```

---

## 📂 Estrutura do Projeto

```
futeba-dos-parcas/
├── app/                    # Android app (Jetpack Compose)
├── shared/                 # Kotlin Multiplatform (business logic)
├── composeApp/             # Compose Multiplatform UI (Android + iOS)
├── iosApp/                 # iOS app (Swift + KMP)
├── functions/              # Cloud Functions (TypeScript)
├── firestore.rules         # Firestore security rules
├── specs/                  # Specs técnicas (SDD)
└── .github/workflows/      # CI/CD pipelines
```

---

## 📖 Documentation

For developers and contributors, please refer to our comprehensive documentation:

### 🤖 For AI-Assisted Development
- **[CLAUDE.md](CLAUDE.md)** - **Complete development guide** with build commands, architecture patterns, Spec-Driven Development workflow, common gotchas, and quick references. Optimized for Claude Code and other AI coding assistants.
- **[.claude/rules/](\.claude\rules)** - Detailed patterns for Compose, Material 3, ViewModels, Firestore, Kotlin style, testing, and security
- **[.claude/PROJECT_CONTEXT.md](\.claude\PROJECT_CONTEXT.md)** - Consolidated project context for LLMs

### 📚 For Developers
- **[Tech Stack & Context](docs/TECH_STACK_AND_CONTEXT.md)** - Architecture, libraries, and navigation guide
- **[Business Rules](docs/BUSINESS_RULES.md)** - XP system, Match Lifecycle, and Ranking logic
- **[Setup Guide](SETUP_GUIDE.md)** - Complete development environment setup
- **[Specs](specs/)** - Technical specifications for all features (Spec-Driven Development)

---

## 🤝 Contribuindo

Contribuições são **muito bem-vindas**!

1. Veja o guia em [CONTRIBUTING.md](CONTRIBUTING.md)
2. Leia as [specs](specs/) antes de implementar features
3. Siga [Conventional Commits](https://www.conventionalcommits.org/)
4. Abra um PR com descrição clara

### Spec-Driven Development (SDD)

Este projeto segue **Spec-Driven Development** rigorosamente:

- ✅ Toda feature ou bugfix DEVE ter uma spec aprovada em `/specs/` antes da implementação
- ✅ Fases obrigatórias: `REQUIREMENTS → UX/UI → TECHNICAL DESIGN → TASKS → IMPLEMENTATION → VERIFY`
- ✅ Templates disponíveis: `_TEMPLATE_FEATURE_MOBILE.md` e `_TEMPLATE_BUGFIX_MOBILE.md`
- ✅ Decisões técnicas documentadas em `/specs/DECISIONS.md`

**Consulte [CLAUDE.md](CLAUDE.md) para o workflow completo e regras obrigatórias.**

---

## 🔐 Environment & Access

This repository is configured with necessary environment variables and access keys for development:
- **Firebase Access**: Authenticated via Service Account (located in project root)
- **Scripts**: Node.js scripts in `/scripts` configured for maintenance tasks
- **Secrets**: Never commit `google-services.json`, `.env`, or `*.keystore` files

---

## 📄 License

Este projeto está sob a licença MIT - veja [LICENSE](LICENSE) para detalhes.

---

## 🔗 Links

- 🌐 [Website](https://futebadosparcas.web.app)
- 📱 [Google Play Store](https://play.google.com/store/apps/details?id=com.futebadosparcas)
- 📧 [Contato](mailto:techfernandesltda@gmail.com)
- 🐛 [Reportar Bug](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/new?template=bug_report.yml)
- 💡 [Solicitar Feature](https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues/new?template=feature_request.yml)

---

## 📊 Status do Projeto

- ✅ **Android:** Produção (v1.8.0 na Play Store)
- 🚧 **iOS:** Em desenvolvimento (FASE 1 completa)
- ✅ **Backend:** Firebase Cloud Functions v2
- ✅ **CI/CD:** GitHub Actions

---

## 🎮 Sistema de XP

| Action | XP |
|--------|-----|
| Participation | +10 |
| Goal | +5 |
| Assist | +3 |
| Save (GK) | +2 |
| MVP | +50 |
| Win | +20 |
| Streak 3+ | +10 |
| Streak 7+ | +20 |
| Streak 10+ | +30 |

**Season Reset**: Mensal no dia 1. XP global nunca reseta.

---

**Feito com ❤️ pela Tech Fernandes Ltda**

*Built for broken ankles and spectacular goals.*
