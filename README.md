# ⚽ Futeba dos Parças

![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-0095D5?style=for-the-badge&logo=kotlin&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![Status](https://img.shields.io/badge/Status-Active-success?style=for-the-badge)

**Futeba dos Parças** is the ultimate companion app for amateur soccer groups ("peladas"). Manage matches, track statistics, and climb the rankings in a fully gamified experience.

---

## 🚀 Features

- **🏆 Gamification**: Earn XP, level up, and unlock achievements based on real-world performance.
- **📊 Advanced Stats**: Track goals, assists, wins, and clean sheets.
- **⚖️ Team Balancing**: Smart algorithms to create fair and competitive teams.
- **📍 Location Management**: Integration with maps to find and save court locations.
- **🔔 Live Notifications**: Push notifications for game invites and reminders.

## 📖 Documentation

For developers and contributors, please refer to our detailed documentation:

- **[Tech Stack & Context](docs/TECH_STACK_AND_CONTEXT.md)**: Architecture, libraries, and LLM-friendly navigation guide.
- **[Business Rules](docs/BUSINESS_RULES.md)**: Deep dive into the XP system, Match Lifecycle, and Ranking logic.

## 🛠 Getting Started

### Quick Start (5 minutes)

**Requirements:** Android Studio, JDK 17, `google-services.json`

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/futeba-dos-parcas.git
   cd futeba-dos-parcas
   ```

2. **Configure Firebase:**
   - Download `google-services.json` from [Firebase Console](https://console.firebase.google.com)
   - Place it in: `app/google-services.json`

3. **Run the app:**
   ```bash
   # Android Studio → Run → Run 'app' (Shift+F10)
   # Or terminal:
   ./gradlew installDebug
   ```

4. **For full setup with backend:**
   - Follow [SETUP_GUIDE.md](./SETUP_GUIDE.md) for Android + Backend + Database setup
   - Takes ~30 minutes for complete development environment

## 🔐 Environment & Access

This repository is configured with the necessary environment variables and access keys for development in the current environment.
- **Firebase Access**: Authenticated via Service Account (`futebadosparcas-firebase-adminsdk-fbsvc-afdd15710a.json` located in project root).
- **Scripts**: Node.js scripts in `/scripts` are configured to use this service account for maintenance tasks.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to submit Pull Requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
*Built with ❤️ for broken ankles and spectacular goals.*
