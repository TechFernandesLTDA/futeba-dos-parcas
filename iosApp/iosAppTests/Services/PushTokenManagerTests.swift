@testable import iosApp
import XCTest

final class PushTokenManagerTests: XCTestCase {
    private var defaults: UserDefaults!
    private var caller: PushTokenCallerSpy!
    private var secureStore: InMemoryPushTokenStore!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "PushTokenManagerTests")
        defaults.removePersistentDomain(forName: "PushTokenManagerTests")
        caller = PushTokenCallerSpy()
        secureStore = InMemoryPushTokenStore()
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "PushTokenManagerTests")
        secureStore = nil
        caller = nil
        defaults = nil
        super.tearDown()
    }

    func testRegistrationUsesSequenceAndKeepsTokenOutOfUserDefaults() {
        let sut = makeSut()

        sut.didReceiveRegistrationToken("secret-fcm-token")

        XCTAssertEqual(caller.calls.count, 1)
        XCTAssertEqual(caller.calls[0].name, "registerPushToken")
        XCTAssertEqual(caller.calls[0].data["token"] as? String, "secret-fcm-token")
        XCTAssertEqual(caller.calls[0].data["platform"] as? String, "ios")
        XCTAssertEqual(caller.calls[0].data["sequence"] as? Int64, 1)
        XCTAssertFalse((caller.calls[0].data["deviceId"] as? String ?? "").isEmpty)
        XCTAssertNil(defaults.string(forKey: "push.installation.fcm-token"))
        XCTAssertEqual(secureStore.token, "secret-fcm-token")
    }

    func testRegistrationsAreSerializedAndLaterTokenHasHigherSequence() {
        let sut = makeSut()

        sut.didReceiveRegistrationToken("token-a")
        sut.didReceiveRegistrationToken("token-b")

        XCTAssertEqual(caller.calls.count, 1)
        caller.complete(index: 0, error: nil)
        XCTAssertEqual(caller.calls.count, 2)
        XCTAssertEqual(caller.calls[1].data["token"] as? String, "token-b")
        XCTAssertEqual(caller.calls[1].data["sequence"] as? Int64, 2)
    }

    func testRegistrationWithoutAuthenticatedUserRemainsPending() {
        let sut = makeSut(currentUserId: { nil })
        sut.didReceiveRegistrationToken("pending-token")
        XCTAssertTrue(caller.calls.isEmpty)
    }

    func testTransientFailureSchedulesRetryWithSameSequenceAndInstallation() {
        var scheduledWork: (() -> Void)?
        let sut = makeSut(scheduleRetry: { _, work in scheduledWork = work })
        sut.didReceiveRegistrationToken("retry-token")

        caller.complete(index: 0, error: TestError.offline)
        XCTAssertNotNil(scheduledWork)
        scheduledWork?()

        XCTAssertEqual(caller.calls.count, 2)
        XCTAssertEqual(caller.calls[0].data["deviceId"] as? String, caller.calls[1].data["deviceId"] as? String)
        XCTAssertEqual(caller.calls[0].data["sequence"] as? Int64, caller.calls[1].data["sequence"] as? Int64)
    }

    func testNewerTokenCancelsRetryForOlderSequence() {
        var scheduledWork: (() -> Void)?
        let sut = makeSut(scheduleRetry: { _, work in scheduledWork = work })
        sut.didReceiveRegistrationToken("token-a")
        caller.complete(index: 0, error: TestError.offline)
        sut.didReceiveRegistrationToken("token-b")
        caller.complete(index: 1, error: nil)

        scheduledWork?()

        XCTAssertEqual(caller.calls.count, 2)
    }

    func testLogoutUsesNextSequenceAndPreservesInstallationTokenForNextLogin() {
        let sut = makeSut()
        sut.didReceiveRegistrationToken("logout-token")
        caller.complete(index: 0, error: nil)
        var completed = false

        sut.unregisterBeforeLogout { completed = true }

        XCTAssertFalse(completed)
        XCTAssertEqual(caller.calls[1].name, "unregisterPushToken")
        XCTAssertEqual(caller.calls[1].data["token"] as? String, "logout-token")
        XCTAssertEqual(caller.calls[1].data["sequence"] as? Int64, 2)
        caller.complete(index: 1, error: nil)
        XCTAssertTrue(completed)
        XCTAssertEqual(secureStore.token, "logout-token")
    }

    func testReloginRegistersPreservedTokenWithANewerSequence() {
        let sut = makeSut()
        sut.didReceiveRegistrationToken("persisted-token")
        caller.complete(index: 0, error: nil)
        sut.unregisterBeforeLogout {}
        caller.complete(index: 1, error: nil)

        sut.handleAuthStateChanged(isAuthenticated: true)

        XCTAssertEqual(caller.calls[2].name, "registerPushToken")
        XCTAssertEqual(caller.calls[2].data["token"] as? String, "persisted-token")
        XCTAssertEqual(caller.calls[2].data["sequence"] as? Int64, 3)
    }

    func testLogoutTimeoutCompletesWhenCallableNeverReturns() {
        var timeoutWorks: [() -> Void] = []
        let sut = makeSut(scheduleTimeout: { _, work in timeoutWorks.append(work) })
        sut.didReceiveRegistrationToken("logout-token")
        var completed = false

        sut.unregisterBeforeLogout { completed = true }
        XCTAssertFalse(completed)

        timeoutWorks.last?()
        XCTAssertTrue(completed)
    }

    private func makeSut(
        currentUserId: @escaping () -> String? = { "user-1" },
        scheduleRetry: @escaping (TimeInterval, @escaping () -> Void) -> Void = { _, _ in },
        scheduleTimeout: @escaping (TimeInterval, @escaping () -> Void) -> Void = { _, _ in }
    ) -> PushTokenManager {
        PushTokenManager(
            caller: caller,
            defaults: defaults,
            secureStore: secureStore,
            currentUserId: currentUserId,
            scheduleRetry: scheduleRetry,
            scheduleTimeout: scheduleTimeout
        )
    }
}

private enum TestError: Error { case offline }

private final class InMemoryPushTokenStore: PushTokenSecureStoring {
    var token: String?
    func save(token: String) { self.token = token }
    func clearToken() { token = nil }
}

private final class PushTokenCallerSpy: PushTokenCalling {
    struct Call {
        let name: String
        let data: [String: Any]
        let completion: (Error?) -> Void
    }

    private(set) var calls: [Call] = []

    func call(name: String, data: [String: Any], completion: @escaping (Error?) -> Void) {
        calls.append(Call(name: name, data: data, completion: completion))
    }

    func complete(index: Int, error: Error?) {
        calls[index].completion(error)
    }
}
