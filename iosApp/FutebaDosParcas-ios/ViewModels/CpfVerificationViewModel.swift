//
//  CpfVerificationViewModel.swift
//  Futeba dos Parças - iOS
//
//  ViewModel pra etapa 2/2 do onboarding: verificação de CPF.
//  Chama verifyCpf + setUserVerified callables.
//
//  Issue: #447
//

import Foundation

@MainActor
final class CpfVerificationViewModel: ObservableObject {
    @Published var cpfInput: String = ""
    @Published var loading: Bool = false
    @Published var success: Bool = false
    @Published var errorMessage: String?

    /// CPF formatado pra display ("123.456.789-01") atualizado on-input.
    func updateCpf(_ raw: String) {
        cpfInput = CpfValidator.applyProgressiveMask(raw)
        errorMessage = nil
    }

    /// Valida CPF localmente (mod-11) antes de enviar pro server.
    var isCpfValid: Bool {
        CpfValidator.isValid(cpfInput)
    }

    /// Submete CPF: verifyCpf + setUserVerified.
    func submit() async {
        errorMessage = nil

        guard isCpfValid else {
            errorMessage = "CPF inválido. Confira os dígitos."
            return
        }

        loading = true
        defer { loading = false }

        let stripped = CpfValidator.stripCpf(cpfInput)

        do {
            _ = try await VerificationService.shared.verifyCpf(cpf: stripped)
            try await VerificationService.shared.setUserVerified()
            success = true
        } catch let err as VerificationError {
            errorMessage = err.errorDescription
        } catch {
            errorMessage = "Erro inesperado. Tente novamente."
        }
    }
}
