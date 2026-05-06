//
//  VerificationService.swift
//  Futeba dos Parças - iOS
//
//  Wrapper das callables Firebase Functions de Phone+CPF verification:
//  - verifyCpf({ cpf })
//  - setUserVerified({})
//
//  Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md
//  Issue: #447 (Phone+CPF Fase 4 iOS)
//

import Foundation
import FirebaseAuth
import FirebaseFunctions

enum VerificationError: LocalizedError {
    case unauthenticated
    case alreadyExists
    case invalidArgument(String)
    case permissionDenied(String)
    case failedPrecondition(String)
    case network
    case unknown(String)

    var errorDescription: String? {
        switch self {
        case .unauthenticated:
            return "Sua sessão expirou. Faça login novamente."
        case .alreadyExists:
            return "Este CPF já está em outra conta. Use seu próprio CPF."
        case .invalidArgument(let msg):
            return msg.isEmpty ? "Dados inválidos. Confira e tente novamente." : msg
        case .permissionDenied(let msg):
            return msg.isEmpty ? "Operação não permitida." : msg
        case .failedPrecondition(let msg):
            return msg.isEmpty ? "Conclua o passo anterior primeiro." : msg
        case .network:
            return "Sem conexão. Verifique sua internet."
        case .unknown(let msg):
            return msg.isEmpty ? "Erro inesperado. Tente novamente." : msg
        }
    }
}

final class VerificationService {
    static let shared = VerificationService()

    private let functions: Functions

    private init() {
        // us-central1 é a region das callables (consistente com Android/Web)
        self.functions = Functions.functions(region: "us-central1")
    }

    /// Verifica CPF do usuário autenticado.
    /// - Parameter cpf: CPF stripped (apenas dígitos, ex: "12345678901")
    /// - Returns: CPF mascarado (ex: "***.456.789-**")
    /// - Throws: VerificationError
    func verifyCpf(cpf: String) async throws -> String {
        guard Auth.auth().currentUser != nil else {
            throw VerificationError.unauthenticated
        }

        do {
            let result = try await functions
                .httpsCallable("verifyCpf")
                .call(["cpf": cpf])

            guard
                let data = result.data as? [String: Any],
                let success = data["success"] as? Bool,
                success
            else {
                throw VerificationError.unknown("Resposta inválida do servidor")
            }

            return data["cpfMasked"] as? String ?? CpfValidator.maskCpf(cpf)
        } catch let nsError as NSError {
            throw mapError(nsError)
        }
    }

    /// Conclui verificação setando custom claim verified=true.
    /// Pré-condição: phone OTP + verifyCpf já executados.
    func setUserVerified() async throws {
        guard let user = Auth.auth().currentUser else {
            throw VerificationError.unauthenticated
        }

        do {
            _ = try await functions
                .httpsCallable("setUserVerified")
                .call([:])

            // Force token refresh pra ProtectedView re-ler custom claim
            _ = try await user.getIDTokenResult(forcingRefresh: true)
        } catch let nsError as NSError {
            throw mapError(nsError)
        }
    }

    /// Mapeia FunctionsErrorCode → VerificationError com mensagens PT-BR.
    private func mapError(_ error: NSError) -> VerificationError {
        guard error.domain == FunctionsErrorDomain else {
            return .network
        }

        let code = FunctionsErrorCode(rawValue: error.code) ?? .unknown
        let message = (error.userInfo[NSLocalizedDescriptionKey] as? String) ?? ""

        switch code {
        case .unauthenticated:
            return .unauthenticated
        case .alreadyExists:
            return .alreadyExists
        case .invalidArgument:
            return .invalidArgument(message)
        case .permissionDenied:
            return .permissionDenied(message)
        case .failedPrecondition:
            return .failedPrecondition(message)
        default:
            return .unknown(message)
        }
    }
}
