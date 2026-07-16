import Foundation
import FirebaseAuth
import FirebaseFunctions

protocol PushTokenCalling {
    func call(
        name: String,
        data: [String: Any],
        completion: @escaping (Error?) -> Void
    )
}

final class FirebasePushTokenCaller: PushTokenCalling {
    private let functions = Functions.functions(region: "southamerica-east1")

    func call(
        name: String,
        data: [String: Any],
        completion: @escaping (Error?) -> Void
    ) {
        functions.httpsCallable(name).call(data) { _, error in completion(error) }
    }
}

/// Mantém o token FCM sincronizado com o registro privado. Operações são
/// serializadas e recebem uma sequência monotônica persistente; o backend pode
/// assim ignorar callbacks atrasados depois de troca de conta ou logout.
final class PushTokenManager {
    static let shared = PushTokenManager()

    private enum Keys {
        static let deviceId = "push.installation.device-id"
        static let sequence = "push.installation.sequence"
        static let legacyToken = "push.installation.fcm-token"
    }

    private enum Kind {
        case register(token: String, attempt: Int)
        case unregister(token: String?, completion: (Bool) -> Void)
    }

    private struct Operation {
        let id = UUID()
        let sequence: Int64
        let kind: Kind
    }

    private enum OperationTimeout: Error { case elapsed }

    private let caller: PushTokenCalling
    private let defaults: UserDefaults
    private let secureStore: PushTokenSecureStoring
    private let currentUserId: () -> String?
    private let scheduleRetry: (TimeInterval, @escaping () -> Void) -> Void
    private let scheduleTimeout: (TimeInterval, @escaping () -> Void) -> Void
    private let requestTimeout: TimeInterval
    private let logoutTimeout: TimeInterval
    private var authListener: AuthStateDidChangeListenerHandle?
    private var pending: [Operation] = []
    private var active: Operation?

    init(
        caller: PushTokenCalling = FirebasePushTokenCaller(),
        defaults: UserDefaults = .standard,
        secureStore: PushTokenSecureStoring = KeychainPushTokenStore(),
        currentUserId: @escaping () -> String? = { Auth.auth().currentUser?.uid },
        scheduleRetry: @escaping (TimeInterval, @escaping () -> Void) -> Void = Self.schedule,
        scheduleTimeout: @escaping (TimeInterval, @escaping () -> Void) -> Void = Self.schedule,
        requestTimeout: TimeInterval = 1.5,
        logoutTimeout: TimeInterval = 2.0
    ) {
        self.caller = caller
        self.defaults = defaults
        self.secureStore = secureStore
        self.currentUserId = currentUserId
        self.scheduleRetry = scheduleRetry
        self.scheduleTimeout = scheduleTimeout
        self.requestTimeout = requestTimeout
        self.logoutTimeout = logoutTimeout
        migrateLegacyTokenIfNeeded()
    }

    func start() {
        guard authListener == nil else { return }
        authListener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            guard user != nil, let self, let token = self.secureStore.token else { return }
            self.enqueueRegistration(token: token, sequence: self.nextSequence())
        }
    }

    func didReceiveRegistrationToken(_ token: String?) {
        guard let normalized = token?.trimmingCharacters(in: .whitespacesAndNewlines),
              !normalized.isEmpty else { return }
        secureStore.save(token: normalized)
        enqueueRegistration(token: normalized, sequence: nextSequence())
    }

    /// Enfileira a revogação enquanto Auth ainda existe e sempre libera o
    /// logout em até `logoutTimeout`, inclusive quando o SDK não chama callback.
    func unregisterBeforeLogout(completion: @escaping () -> Void) {
        guard currentUserId() != nil else {
            completion()
            return
        }

        let sequence = nextSequence()
        let token = secureStore.token
        pending.removeAll { operation in
            if case .register = operation.kind { return true }
            return false
        }

        var completed = false
        let finishLogout: () -> Void = {
            guard !completed else { return }
            completed = true
            completion()
        }
        pending.append(
            Operation(
                sequence: sequence,
                kind: .unregister(token: token) { [weak self] succeeded in
                    if succeeded { self?.secureStore.clearToken() }
                    finishLogout()
                }
            )
        )
        processNext()
        scheduleTimeout(logoutTimeout) {
            if !completed { NSLog("Push token unregister timed out; continuing secure logout") }
            finishLogout()
        }
    }

    private func enqueueRegistration(token: String, sequence: Int64) {
        guard currentUserId() != nil, secureStore.token == token else { return }
        pending.append(Operation(sequence: sequence, kind: .register(token: token, attempt: 0)))
        processNext()
    }

    private func processNext() {
        guard active == nil, !pending.isEmpty else { return }
        let operation = pending.removeFirst()
        active = operation

        let name: String
        var payload: [String: Any] = [
            "deviceId": deviceId,
            "sequence": operation.sequence,
        ]
        switch operation.kind {
        case let .register(token, _):
            name = "registerPushToken"
            payload["token"] = token
            payload["platform"] = "ios"
        case let .unregister(token, _):
            name = "unregisterPushToken"
            if let token { payload["token"] = token }
        }

        caller.call(name: name, data: payload) { [weak self] error in
            self?.finish(operation: operation, error: error)
        }
        scheduleTimeout(requestTimeout) { [weak self] in
            self?.finish(operation: operation, error: OperationTimeout.elapsed)
        }
    }

    private func finish(operation: Operation, error: Error?) {
        guard active?.id == operation.id else { return }
        active = nil

        switch operation.kind {
        case let .register(token, attempt):
            if error != nil,
               attempt < 5,
               secureStore.token == token,
               currentSequence == operation.sequence {
                let delay = min(pow(2.0, Double(attempt)), 16.0)
                scheduleRetry(delay) { [weak self] in
                    guard let self,
                          self.secureStore.token == token,
                          self.currentSequence == operation.sequence,
                          self.currentUserId() != nil else { return }
                    self.pending.append(
                        Operation(
                            sequence: operation.sequence,
                            kind: .register(token: token, attempt: attempt + 1)
                        )
                    )
                    self.processNext()
                }
            }
        case let .unregister(_, completion):
            completion(error == nil)
        }
        processNext()
    }

    private var deviceId: String {
        if let existing = defaults.string(forKey: Keys.deviceId), !existing.isEmpty {
            return existing
        }
        let generated = UUID().uuidString.lowercased()
        defaults.set(generated, forKey: Keys.deviceId)
        return generated
    }

    private var currentSequence: Int64 {
        max(0, Int64(defaults.integer(forKey: Keys.sequence)))
    }

    private func nextSequence() -> Int64 {
        let next = currentSequence == Int64.max ? 1 : currentSequence + 1
        defaults.set(next, forKey: Keys.sequence)
        return next
    }

    private func migrateLegacyTokenIfNeeded() {
        guard secureStore.token == nil,
              let legacy = defaults.string(forKey: Keys.legacyToken),
              !legacy.isEmpty else { return }
        secureStore.save(token: legacy)
        defaults.removeObject(forKey: Keys.legacyToken)
    }

    private static func schedule(delay: TimeInterval, work: @escaping () -> Void) {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }
}
