//
//  FirebaseSetup.swift
//  Futeba dos Parças - iOS
//
//  Configuração do Firebase iOS SDK
//

import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
import FirebaseStorage

class FirebaseSetup {
    static let shared = FirebaseSetup()

    private init() {}

    func configure() {
        // Firebase é configurado automaticamente via GoogleService-Info.plist
        // mas podemos adicionar configurações adicionais aqui
        FirebaseApp.configure()

        // Configurar Firestore settings
        let settings = FirestoreSettings()
        settings.cacheSettings = FirestoreCacheSettings(persistCache: true)
        settings.isPersistenceEnabled = true

        let db = Firestore.firestore()
        db.settings = settings

        print("✅ Firebase configurado com sucesso")
    }

    // MARK: - Helpers

    static var firestore: Firestore {
        return Firestore.firestore()
    }

    static var auth: Auth {
        return Auth.auth()
    }

    static var storage: Storage {
        return Storage.storage()
    }

    static var currentUser: FirebaseAuth.User? {
        return auth.currentUser
    }

    static var currentUserId: String? {
        return auth.currentUser?.uid
    }
}

// MARK: - Firestore Document Extensions

extension DocumentReference {
    /// Tenta decodificar um documento para um tipo Codable
    func decode<T: Decodable>(as type: T.Type, completion: @escaping (Result<T, Error>) -> Void) {
        getDocument { snapshot, error in
            if let error = error {
                completion(.failure(error))
                return
            }

            guard let data = snapshot?.data() else {
                completion(.failure(NSError(domain: "Firestore", code: -1, userInfo: [NSLocalizedDescriptionKey: "Documento não encontrado"])))
                return
            }

            do {
                let json = try JSONSerialization.data(withJSONObject: data)
                let decoder = JSONDecoder()
                decoder.dateDecodingStrategy = .millisecondsSince1970
                let result = try decoder.decode(T.self, from: json)
                completion(.success(result))
            } catch {
                completion(.failure(error))
            }
        }
    }
}

// MARK: - Codable Extensions

extension Encodable {
    /// Converte um Encodable para Dictionary
    func asDictionary() throws -> [String: Any] {
        let data = try JSONEncoder().encode(self)
        guard let dictionary = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "JSONSerialization", code: -1, userInfo: nil)
        }
        return dictionary
    }
}
