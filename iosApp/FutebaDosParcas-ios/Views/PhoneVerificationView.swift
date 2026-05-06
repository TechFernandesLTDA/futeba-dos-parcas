//
//  PhoneVerificationView.swift
//  Futeba dos Parças - iOS
//
//  Etapa 1/2 do onboarding obrigatório (Phone+CPF).
//  Issue: #447
//

import SwiftUI

struct PhoneVerificationView: View {
    @StateObject private var viewModel = PhoneVerificationViewModel()
    let onCompleted: () -> Void

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.appPrimary.opacity(0.15), Color.appSecondary.opacity(0.15)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: 24) {
                ProgressHeader(currentStep: 0, totalSteps: 2)
                    .padding(.top, 16)

                Spacer().frame(height: 8)

                switch viewModel.step {
                case .enterPhone:
                    enterPhoneSection
                case .enterCode:
                    enterCodeSection
                case .success:
                    successSection
                }

                Spacer()
            }
            .padding(.horizontal, 24)
        }
        .onChange(of: viewModel.step) { _, newStep in
            if newStep == .success {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    onCompleted()
                }
            }
        }
    }

    // MARK: - Sections

    private var enterPhoneSection: some View {
        VStack(spacing: 20) {
            VStack(spacing: 8) {
                Image(systemName: "phone.badge.checkmark")
                    .font(.system(size: 60))
                    .foregroundColor(.appPrimary)
                Text("Verificar telefone")
                    .font(.title2.weight(.bold))
                Text("Etapa 1 de 2")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text("Vamos enviar um SMS pra confirmar seu número. Custo zero pra você — só uma vez.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if let err = viewModel.errorMessage {
                ErrorBanner(message: err)
            }

            TextField("+5511999999999", text: $viewModel.phoneNumber)
                .textFieldStyle(AppTextFieldStyle())
                .keyboardType(.phonePad)
                .textContentType(.telephoneNumber)
                .disabled(viewModel.loading)

            Button {
                Task { await viewModel.requestOtp() }
            } label: {
                HStack {
                    if viewModel.loading {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.white)
                    }
                    Text(viewModel.loading ? "Enviando…" : "Enviar código SMS")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.appPrimary)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(viewModel.loading || viewModel.phoneNumber.isEmpty)

            ShieldCard(
                title: "Privacidade",
                body: "Seu número fica privado e é usado apenas pra " +
                    "verificar identidade. Nunca compartilhamos."
            )
        }
    }

    private var enterCodeSection: some View {
        VStack(spacing: 20) {
            VStack(spacing: 8) {
                Image(systemName: "number.square.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.appPrimary)
                Text("Digite o código")
                    .font(.title2.weight(.bold))
                Text("Enviamos um SMS de 6 dígitos pra \(viewModel.phoneNumber)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            if let err = viewModel.errorMessage {
                ErrorBanner(message: err)
            }

            TextField("000000", text: $viewModel.smsCode)
                .textFieldStyle(AppTextFieldStyle())
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .multilineTextAlignment(.center)
                .font(.title.weight(.bold))
                .disabled(viewModel.loading)

            Button {
                Task { await viewModel.verifyOtp() }
            } label: {
                HStack {
                    if viewModel.loading {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.white)
                    }
                    Text(viewModel.loading ? "Verificando…" : "Confirmar código")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.appPrimary)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(viewModel.loading || viewModel.smsCode.count != 6)

            Button("Mudar número") {
                viewModel.resetToPhoneStep()
            }
            .font(.footnote)
            .foregroundColor(.appPrimary)
        }
    }

    private var successSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.statusSuccess)
            Text("Telefone verificado!")
                .font(.title2.weight(.bold))
            Text("Vamos pro CPF agora.")
                .font(.body)
                .foregroundColor(.secondary)
            ProgressView().padding(.top, 16)
        }
        .padding(.top, 40)
    }
}

// MARK: - Subviews compartilhadas

struct ProgressHeader: View {
    let currentStep: Int
    let totalSteps: Int

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<totalSteps, id: \.self) { idx in
                Capsule()
                    .fill(idx <= currentStep ? Color.appPrimary : Color.gray.opacity(0.3))
                    .frame(height: 4)
            }
        }
    }
}

struct ErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(message)
                .font(.subheadline)
        }
        .foregroundColor(.statusError)
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.statusError.opacity(0.1))
        .cornerRadius(8)
    }
}

struct ShieldCard: View {
    let title: String
    let body: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "shield.lefthalf.filled")
                .foregroundColor(.appPrimary)
                .font(.title3)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.caption.weight(.semibold))
                Text(body)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }
}
