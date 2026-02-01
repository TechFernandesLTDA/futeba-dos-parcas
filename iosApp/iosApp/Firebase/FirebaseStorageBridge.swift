import Foundation
import FirebaseStorage

@objc public class FirebaseStorageBridge: NSObject {

    private let storage = Storage.storage()

    @objc public func uploadFile(
        path: String,
        fileData: Data,
        metadata: [String: String]?,
        progressCallback: @escaping (Double) -> Void,
        completion: @escaping (String?, String?) -> Void
    ) {
        let storageRef = storage.reference().child(path)

        var uploadMetadata: StorageMetadata?
        if let metadata = metadata {
            uploadMetadata = StorageMetadata()
            uploadMetadata?.customMetadata = metadata
        }

        let uploadTask = storageRef.putData(fileData, metadata: uploadMetadata)

        uploadTask.observe(.progress) { snapshot in
            if let progress = snapshot.progress {
                let percentComplete = Double(progress.completedUnitCount) / Double(progress.totalUnitCount)
                progressCallback(percentComplete)
            }
        }

        uploadTask.observe(.success) { snapshot in
            storageRef.downloadURL { url, error in
                if let error = error {
                    completion(nil, error.localizedDescription)
                } else {
                    completion(url?.absoluteString, nil)
                }
            }
        }

        uploadTask.observe(.failure) { snapshot in
            if let error = snapshot.error {
                completion(nil, error.localizedDescription)
            }
        }
    }

    @objc public func downloadFile(
        path: String,
        completion: @escaping (Data?, String?) -> Void
    ) {
        let storageRef = storage.reference().child(path)

        storageRef.getData(maxSize: 10 * 1024 * 1024) { data, error in
            if let error = error {
                completion(nil, error.localizedDescription)
            } else {
                completion(data, nil)
            }
        }
    }

    @objc public func getDownloadURL(
        path: String,
        completion: @escaping (String?, String?) -> Void
    ) {
        let storageRef = storage.reference().child(path)

        storageRef.downloadURL { url, error in
            if let error = error {
                completion(nil, error.localizedDescription)
            } else {
                completion(url?.absoluteString, nil)
            }
        }
    }

    @objc public func deleteFile(
        path: String,
        completion: @escaping (String?) -> Void
    ) {
        let storageRef = storage.reference().child(path)

        storageRef.delete { error in
            completion(error?.localizedDescription)
        }
    }
}
