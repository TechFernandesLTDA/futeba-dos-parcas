import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore

@objc public class IosFirebaseBridge: NSObject {

    private let auth = Auth.auth()
    private let db = Firestore.firestore()

    // MARK: - Authentication

    @objc public func getCurrentUserId() -> String? {
        return auth.currentUser?.uid
    }

    @objc public func getCurrentUserEmail() -> String? {
        return auth.currentUser?.email
    }

    @objc public func signInWithEmail(
        email: String,
        password: String,
        completion: @escaping (String?, String?) -> Void
    ) {
        auth.signIn(withEmail: email, password: password) { result, error in
            if let error = error {
                completion(nil, error.localizedDescription)
            } else {
                completion(result?.user.uid, nil)
            }
        }
    }

    @objc public func signUpWithEmail(
        email: String,
        password: String,
        completion: @escaping (String?, String?) -> Void
    ) {
        auth.createUser(withEmail: email, password: password) { result, error in
            if let error = error {
                completion(nil, error.localizedDescription)
            } else {
                completion(result?.user.uid, nil)
            }
        }
    }

    @objc public func signOut(completion: @escaping (String?) -> Void) {
        do {
            try auth.signOut()
            completion(nil)
        } catch let error {
            completion(error.localizedDescription)
        }
    }

    @objc public func addAuthStateListener(
        callback: @escaping (String?) -> Void
    ) -> NSObjectProtocol {
        return auth.addStateDidChangeListener { _, user in
            callback(user?.uid)
        }
    }

    // MARK: - Firestore

    @objc public func getDocument(
        collection: String,
        documentId: String,
        completion: @escaping ([String: Any]?, String?) -> Void
    ) {
        db.collection(collection).document(documentId).getDocument { snapshot, error in
            if let error = error {
                completion(nil, error.localizedDescription)
            } else {
                completion(snapshot?.data(), nil)
            }
        }
    }

    @objc public func setDocument(
        collection: String,
        documentId: String,
        data: [String: Any],
        merge: Bool,
        completion: @escaping (String?) -> Void
    ) {
        db.collection(collection).document(documentId).setData(data, merge: merge) { error in
            completion(error?.localizedDescription)
        }
    }

    @objc public func updateDocument(
        collection: String,
        documentId: String,
        data: [String: Any],
        completion: @escaping (String?) -> Void
    ) {
        db.collection(collection).document(documentId).updateData(data) { error in
            completion(error?.localizedDescription)
        }
    }

    @objc public func deleteDocument(
        collection: String,
        documentId: String,
        completion: @escaping (String?) -> Void
    ) {
        db.collection(collection).document(documentId).delete { error in
            completion(error?.localizedDescription)
        }
    }

    @objc public func queryDocuments(
        collection: String,
        field: String?,
        value: Any?,
        orderBy: String?,
        limit: Int,
        completion: @escaping ([[String: Any]]?, String?) -> Void
    ) {
        var query: Query = db.collection(collection)

        if let field = field, let value = value {
            query = query.whereField(field, isEqualTo: value)
        }

        if let orderBy = orderBy {
            query = query.order(by: orderBy)
        }

        if limit > 0 {
            query = query.limit(to: limit)
        }

        query.getDocuments { snapshot, error in
            if let error = error {
                completion(nil, error.localizedDescription)
            } else {
                let documents = snapshot?.documents.compactMap { $0.data() } ?? []
                completion(documents, nil)
            }
        }
    }
}
