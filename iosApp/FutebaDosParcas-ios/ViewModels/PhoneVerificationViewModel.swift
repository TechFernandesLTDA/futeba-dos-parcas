//
//  PhoneVerificationViewModel.swift
//  Futeba dos Parças - iOS
//
//  ViewModel pra etapa 1/2 do onboarding: verificação de telefone via SMS OTP.
//  Usa Firebase PhoneAuthProvider (link com user atual via linkWithCredential).
//
//  Issue: #447
//

import Foundation
import FirebaseAuth

@MainActor
final class PhoneVerificationViewModel: ObservableObject {
    enum Step {
        case enterPhone
        case enterCode
        case success
    }

    @Published var step: Step = .enterPhone
    @Published var phoneNumber: String = ""
    @Published var verificationId: String?
    @Published var smsCode: String = ""
    @Published var loading: Bool = false
    @Published var errorMessage: String?

    /// Solicita SMS OTP. Phone deve estar em formato E.164 (+5511999999999).
    func requestOtp() async {
        errorMessage = nil
        loading = true
        defer { loading = false }

        let trimmed = phoneNumber.trimmingCharacters(in: .whitespaces)
        guard isValidE164(trimmed) else {
            errorMessage = "Telefone inválido. Use formato +55119xxxxxxxx"
            return
        }

        do {
            let id = try await PhoneAuthProvider.provider()
                .verifyPhoneNumber(trimmed, uiDelegate: nil)
            verificationId = id
            step = .enterCode
        } catch let nsError as NSError {
            errorMessage = mapAuthError(nsError, fallback: "Falha ao enviar SMS. Tente novamente.")
        }
    }

    /// Verifica código OTP e linka credential com user atual.
    func verifyOtp() async {
        errorMessage = nil
        loading = true
        defer { loading = false }

        guard let verificationId = verificationId else {
            errorMessage = "Solicite um novo código"
            step = .enterPhone
            return
        }

        let code = smsCode.trimmingCharacters(in: .whitespaces)
        guard code.count == 6, code.allSatisfy(\.isNumber) else {
            errorMessage = "Código deve ter 6 dígitos"
            return
        }

        guard let user = Auth.auth().currentUser else {
            errorMessage = "Sessão expirou. Faça login novamente."
            return
        }

        let credential = PhoneAuthProvider.provider().credential(
            withVerificationID: verificationId,
            verificationCode: code
        )

        do {
            _ = try await user.link(with: credential)
            // Force token refresh pra Firebase popular phoneNumber no userRecord
            _ = try await user.getIDTokenResult(forcingRefresh: true)
            step = .success
        } catch let nsError as NSError {
            // Phone já linked? Considera success
            if nsError.code == AuthErrorCode.providerAlreadyLinked.rawValue {
                step = .success
                return
            }
            errorMessage = mapAuthError(nsError, fallback: "Código inválido. Tente novamente.")
        }
    }

    /// Volta pra entrada de telefone.
    func resetToPhoneStep() {
        step = .enterPhone
        smsCode = ""
        verificationId = nil
        errorMessage = nil
    }

    // MARK: - Helpers

    private func isValidE164(_ phone: String) -> Bool {
        // Regex E.164: + seguido de 10-15 dígitos
        let pattern = "^\\+[1-9]\\d{9,14}$"
        return phone.range(of: pattern, options: .regularExpression) != nil
    }

    private func mapAuthError(_ error: NSError, fallback: String) -> String {
        guard let code = AuthErrorCode(rawValue: error.code) else {
            return fallback
        }
        switch code {
        case .invalidVerificationCode:
            return "Código incorreto. Confira o SMS."
        case .invalidVerificationID:
            return "Verificação expirou. Solicite novo código."
        case .quotaExceeded:
            return "Muitas tentativas. Aguarde alguns minutos."
        case .invalidPhoneNumber:
            return "Telefone inválido."
        case .missingPhoneNumber:
            return "Informe o telefone."
        case .networkError:
            return "Sem conexão. Verifique sua internet."
        case .tooManyRequests:
            return "Muitas tentativas. Tente novamente mais tarde."
        case .credentialAlreadyInUse:
            return "Este telefone já está em outra conta."
        default:
            return fallback
        }
    }
}
