import Foundation
import Security

protocol PushTokenSecureStoring: AnyObject {
    var token: String? { get }
    func save(token: String)
    func clearToken()
}

/// Armazena o segredo FCM no Keychain. Identificador e sequência da instalação
/// ficam em UserDefaults porque não são credenciais e precisam ser lidos pelo KMP.
final class KeychainPushTokenStore: PushTokenSecureStoring {
    private let service: String
    private let account = "fcm-token"

    init(service: String = "com.futebadosparcas.push") {
        self.service = service
    }

    var token: String? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func save(token: String) {
        guard let data = token.data(using: .utf8) else { return }
        let attributes = [kSecValueData as String: data]
        let status = SecItemUpdate(baseQuery as CFDictionary, attributes as CFDictionary)
        if status == errSecSuccess { return }
        guard status == errSecItemNotFound else {
            NSLog("Push token Keychain update failed with status %d", status)
            return
        }

        var item = baseQuery
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let addStatus = SecItemAdd(item as CFDictionary, nil)
        if addStatus != errSecSuccess {
            NSLog("Push token Keychain insert failed with status %d", addStatus)
        }
    }

    func clearToken() {
        SecItemDelete(baseQuery as CFDictionary)
    }

    private var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
