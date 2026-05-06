//
//  CpfValidator.swift
//  Futeba dos Parças - iOS
//
//  Validação de CPF brasileiro via algoritmo mod-11.
//  Espelha shared/commonMain/.../validation/CpfValidator.kt
//
//  Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md
//  Issue: #447 (Phone+CPF Fase 4 iOS)
//

import Foundation

enum CpfValidator {
    /// Strip non-digits e retorna 11-digit string ou nil se inválido tamanho.
    static func stripCpf(_ raw: String) -> String {
        return raw.filter { $0.isNumber }
    }

    /// Formata CPF: "12345678901" → "123.456.789-01"
    static func formatCpf(_ raw: String) -> String {
        let digits = stripCpf(raw)
        guard digits.count == 11 else { return raw }
        let chars = Array(digits)
        return "\(chars[0])\(chars[1])\(chars[2])." +
            "\(chars[3])\(chars[4])\(chars[5])." +
            "\(chars[6])\(chars[7])\(chars[8])-" +
            "\(chars[9])\(chars[10])"
    }

    /// Mascara CPF pra display público: "123.456.789-01" → "***.456.789-**"
    static func maskCpf(_ raw: String) -> String {
        let digits = stripCpf(raw)
        guard digits.count == 11 else { return raw }
        let chars = Array(digits)
        return "***." +
            "\(chars[3])\(chars[4])\(chars[5])." +
            "\(chars[6])\(chars[7])\(chars[8])-**"
    }

    /// Valida CPF via algoritmo mod-11 (formato + dígitos verificadores).
    static func isValid(_ raw: String) -> Bool {
        let digits = stripCpf(raw)

        // 11 dígitos exatos
        guard digits.count == 11 else { return false }

        // Rejeita sequências repetidas (000.000.000-00, 111.111.111-11, etc)
        let allSame = digits.allSatisfy { $0 == digits.first }
        if allSame { return false }

        let nums = digits.compactMap { Int(String($0)) }
        guard nums.count == 11 else { return false }

        // Primeiro dígito verificador
        let sum1 = (0..<9).reduce(0) { acc, i in
            acc + nums[i] * (10 - i)
        }
        let rem1 = sum1 % 11
        let dv1 = rem1 < 2 ? 0 : 11 - rem1
        if nums[9] != dv1 { return false }

        // Segundo dígito verificador
        let sum2 = (0..<10).reduce(0) { acc, i in
            acc + nums[i] * (11 - i)
        }
        let rem2 = sum2 % 11
        let dv2 = rem2 < 2 ? 0 : 11 - rem2
        if nums[10] != dv2 { return false }

        return true
    }

    /// Aplica máscara progressiva enquanto user digita.
    /// "12345" → "123.45", "123456789" → "123.456.789", "12345678901" → "123.456.789-01"
    static func applyProgressiveMask(_ input: String) -> String {
        let digits = stripCpf(input).prefix(11)
        let chars = Array(digits)

        switch chars.count {
        case 0...3:
            return String(chars)
        case 4...6:
            return "\(chars[0])\(chars[1])\(chars[2]).\(chars[3...].map(String.init).joined())"
        case 7...9:
            let first = "\(chars[0])\(chars[1])\(chars[2])"
            let second = "\(chars[3])\(chars[4])\(chars[5])"
            let third = chars[6...].map(String.init).joined()
            return "\(first).\(second).\(third)"
        default:
            return formatCpf(String(chars))
        }
    }
}
