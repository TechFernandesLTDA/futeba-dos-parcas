//
//  AuthView.swift
//  Futeba dos Parças - iOS
//
//  Tela de autenticação (Login/Registro)
//

import SwiftUI

struct AuthView: View {
    @StateObject private var viewModel = AuthViewModel()
    @State private var isLoginMode = true
    @State private var showingForgotPassword = false
    @State private var showingGoogleSignIn = false

    var body: some View {
        NavigationStack {
            ZStack {
                // Background gradient
                LinearGradient(
                    colors: [Color.appPrimary.opacity(0.2), Color.appSecondary.opacity(0.2)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                VStack(spacing: 24) {
                    Spacer()
                        .frame(height: 40)

                    // Logo e título
                    VStack(spacing: 8) {
                        Image(systemName: "soccerball.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.appPrimary)

                        Text("Futeba dos Parças")
                            .font(.title)
                            .fontWeight(.bold)

                        Text(isLoginMode ? "Entre para organizar suas peladas" : "Crie sua conta")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }

                    // Form
                    VStack(spacing: 16) {
                        if !isLoginMode {
                            TextField("Nome completo", text: $viewModel.name)
                                .textFieldStyle(AppTextFieldStyle())
                                .textInputAutocapitalization(.words)
                        }

                        TextField("E-mail", text: $viewModel.email)
                            .textFieldStyle(AppTextFieldStyle())
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()

                        SecureField("Senha", text: $viewModel.password)
                            .textFieldStyle(AppTextFieldStyle())

                        if !isLoginMode {
                            SecureField("Confirmar senha", text: $viewModel.confirmPassword)
                                .textFieldStyle(AppTextFieldStyle())
                        }

                        if !viewModel.errorMessage.isEmpty {
                            Text(viewModel.errorMessage)
                                .font(.caption)
                                .foregroundColor(.red)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .padding(.horizontal)

                    // Forgot password (só no login)
                    if isLoginMode {
                        HStack {
                            Spacer()
                            Button("Esqueci minha senha") {
                                showingForgotPassword = true
                            }
                            .font(.caption)
                            .foregroundColor(.appPrimary)
                        }
                        .padding(.horizontal)
                    }

                    // Botão principal
                    Button {
                        if isLoginMode {
                            Task {
                                await viewModel.signIn()
                            }
                        } else {
                            Task {
                                await viewModel.signUp()
                            }
                        }
                    } label: {
                        HStack {
                            if viewModel.isLoading {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            }
                            Text(isLoginMode ? "Entrar" : "Criar conta")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(viewModel.isFormValid ? Color.appPrimary : Color.gray)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(.horizontal)
                    .disabled(!viewModel.isFormValid || viewModel.isLoading)

                    // Social login
                    if isLoginMode {
                        SocialLoginButtons(isLoading: viewModel.isLoading)
                    }

                    // Toggle login/signup
                    Button {
                        withAnimation {
                            isLoginMode.toggle()
                            viewModel.clearError()
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(isLoginMode ? "Não tem conta?" : "Já tem conta?")
                                .foregroundColor(.secondary)

                            Text(isLoginMode ? "Criar conta" : "Entrar")
                                .fontWeight(.semibold)
                                .foregroundColor(.appPrimary)
                        }
                        .font(.subheadline)
                    }

                    Spacer()
                }
                .padding()
            }
            .navigationBarHidden(true)
            .alert("Erro", isPresented: $viewModel.showError) {
                Button("OK") { }
            } message: {
                Text(viewModel.errorMessage)
            }
        }
    }
}

// MARK: - Social Login Buttons

struct SocialLoginButtons: View {
    let isLoading: Bool
    @State private var isShowingAppleSignIn = false

    var body: some View {
        VStack(spacing: 12) {
            // Google Sign In
            Button {
                // Implementar Google Sign In
            } label: {
                HStack {
                    Image(systemName: "g.circle.fill")
                        .font(.title3)

                    Text("Entrar com Google")
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.white)
                .foregroundColor(.primary)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                )
            }
            .disabled(isLoading)

            // Apple Sign In
            Button {
                isShowingAppleSignIn = true
            } label: {
                HStack {
                    Image(systemName: "applelogo")
                        .font(.title3)

                    Text("Entrar com Apple")
                        .fontWeight(.medium)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.black)
                .foregroundColor(.white)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(isLoading)
        }
        .padding(.horizontal)
    }
}

// MARK: - App TextField Style

struct AppTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding()
            .background(Color(uiColor: .secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Auth ViewModel

@MainActor
class AuthViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var name = ""
    @Published var confirmPassword = ""
    @Published var isLoading = false
    @Published var showError = false
    @Published var errorMessage = ""

    private let authRepository = IosRepositoryFactory.shared.createAuthRepository()

    var isFormValid: Bool {
        if !email.isEmpty && !password.isEmpty {
            if name.isEmpty {
                return password.count >= 6
            } else {
                return !name.isEmpty && password == confirmPassword && password.count >= 6
            }
        }
        return false
    }

    func signIn() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let user = try await authRepository.signIn(email: email, password: password)
            // AuthManager vai atualizar automaticamente
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func signUp() async {
        isLoading = true
        defer { isLoading = false }

        guard password == confirmPassword else {
            errorMessage = "As senhas não coincidem"
            showError = true
            return
        }

        do {
            let user = try await authRepository.signUp(
                email: email,
                password: password,
                name: name
            )
            // AuthManager vai atualizar automaticamente
        } catch {
            errorMessage = error.localizedDescription
            showError = true
        }
    }

    func clearError() {
        errorMessage = ""
        showError = false
    }
}

// MARK: - Preview

#Preview {
    AuthView()
}
