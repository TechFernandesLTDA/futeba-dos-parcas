//
//  FutebaDosParcas_iosApp.swift
//  Futeba dos Parças - iOS
//
//  Created by KMP Build
//

import SwiftUI
import Combine

@main
struct FutebaDosParcasApp: App {

    @StateObject private var themeManager = ThemeManager()
    @StateObject private var authManager = AuthManager.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(themeManager)
                .environmentObject(authManager)
                .onAppear {
                    setupApp()
                }
        }
    }

    private func setupApp() {
        // Configurar Firebase
        FirebaseSetup.shared.configure()

        // Configurar aparência
        setupAppearance()
    }

    private func setupAppearance() {
        // Configurar navegação
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor.systemBackground

        UINavigationBar.appearance().standardAppearance = appearance
        UINavigationBar.appearance().scrollEdgeAppearance = appearance
        UINavigationBar.appearance().compactAppearance = appearance
    }
}

// MARK: - ContentView Principal

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                MainTabView()
            } else {
                AuthView()
            }
        }
        .animation(.easeInOut, value: authManager.isAuthenticated)
    }
}

// MARK: - Theme Manager

class ThemeManager: ObservableObject {
    @Published var isDarkMode: Bool = false

    init() {
        // Carregar preferência do usuário
        self.isDarkMode = UserDefaults.standard.bool(forKey: "isDarkMode")
    }

    func toggleTheme() {
        isDarkMode.toggle()
        UserDefaults.standard.set(isDarkMode, forKey: "isDarkMode")
    }
}

// MARK: - Auth Manager

class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?
    @Published var isLoading: Bool = true

    private var cancellables = Set<AnyCancellable>()
    private let authRepository = IosRepositoryFactory.shared.createUserRepository()

    private init() {
        checkAuthStatus()
    }

    private func checkAuthStatus() {
        isLoading = true

        Task {
            do {
                let user = try await authRepository.getCurrentUser()
                await MainActor.run {
                    self.currentUser = user
                    self.isAuthenticated = true
                    self.isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.isAuthenticated = false
                    self.currentUser = nil
                    self.isLoading = false
                }
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        let user = try await authRepository.signIn(email: email, password: password)
        await MainActor.run {
            self.currentUser = user
            self.isAuthenticated = true
        }
    }

    func signUp(email: String, password: String, name: String) async throws {
        let user = try await authRepository.signUp(email: email, password: password, name: name)
        await MainActor.run {
            self.currentUser = user
            self.isAuthenticated = true
        }
    }

    func signOut() {
        authRepository.signOut()
        currentUser = nil
        isAuthenticated = false
    }
}
