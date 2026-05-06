//
//  CpfVerificationView.swift
//  Futeba dos Parças - iOS
//
//  Etapa 2/2 do onboarding obrigatório (Phone+CPF).
//  Issue: #447
//

import SwiftUI

struct CpfVerificationView: View {
    @StateObject private var viewModel = CpfVerificationViewModel()
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
                ProgressHeader(currentStep: 1, totalSteps: 2)
                    .padding(.top, 16)

                Spacer().frame(height: 8)

                if viewModel.success {
                    successSection
                } else {
                    formSection
                }

                Spacer()
            }
            .padding(.horizontal, 24)
        }
        .onChange(of: viewModel.success) { _, isSuccess in
            if isSuccess {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.4) {
                    onCompleted()
                }
            }
        }
    }

    // MARK: - Sections

    private var formSection: some View {
        VStack(spacing: 20) {
            VStack(spacing: 8) {
                Image(systemName: "person.text.rectangle.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.appPrimary)
                Text("Quase lá! Verificar CPF")
                    .font(.title2.weight(.bold))
                Text("Etapa 2 de 2")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Text("Seu CPF garante 1 conta por pessoa — sem bots ou contas falsas no ranking.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if let err = viewModel.errorMessage {
                ErrorBanner(message: err)
            }

            TextField("999.999.999-99", text: Binding(
                get: { viewModel.cpfInput },
                set: { viewModel.updateCpf($0) }
            ))
            .textFieldStyle(AppTextFieldStyle())
            .keyboardType(.numberPad)
            .multilineTextAlignment(.center)
            .font(.title3.weight(.semibold))
            .disabled(viewModel.loading)

            Button {
                Task { await viewModel.submit() }
            } label: {
                HStack {
                    if viewModel.loading {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .tint(.white)
                    }
                    Text(viewModel.loading ? "Verificando…" : "Concluir verificação")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(viewModel.isCpfValid ? Color.appPrimary : Color.gray.opacity(0.3))
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(viewModel.loading || !viewModel.isCpfValid)

            ShieldCard(
                title: "Como protegemos seu CPF",
                body: "Nunca exposto, mostrado mascarado pra outros usuários " +
                    "(***.456.789-**), criptografado nos servidores. LGPD-compliant."
            )

            // Footer com termos
            (
                Text("Ao continuar, você concorda com a ") +
                Text("Política de Privacidade")
                    .foregroundColor(.appPrimary) +
                Text(" e os ") +
                Text("Termos de Uso")
                    .foregroundColor(.appPrimary) +
                Text(".")
            )
            .font(.caption2)
            .foregroundColor(.secondary)
            .multilineTextAlignment(.center)
        }
    }

    private var successSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 80))
                .foregroundColor(.statusSuccess)
            Text("Tudo pronto! 🎉")
                .font(.title2.weight(.bold))
            Text("Sua conta está verificada.")
                .font(.body)
                .foregroundColor(.secondary)
            Text("Bora jogar uma pelada!")
                .font(.footnote)
                .foregroundColor(.secondary)
            ProgressView().padding(.top, 16)
        }
        .padding(.top, 40)
    }
}
