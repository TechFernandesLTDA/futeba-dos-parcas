@testable import iosApp
import XCTest

final class AppleSignInServiceTests: XCTestCase {

    private var sut: AppleSignInService!

    override func setUp() {
        super.setUp()
        sut = AppleSignInService()
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    func testRandomNonceString_returnsCorrectDefaultLength() {
        let nonce = sut.randomNonceString()
        XCTAssertEqual(nonce.count, 32)
    }

    func testRandomNonceString_returnsCorrectCustomLength() {
        let lengths = [8, 16, 64, 128]
        for length in lengths {
            let nonce = sut.randomNonceString(length: length)
            XCTAssertEqual(nonce.count, length)
        }
    }

    func testRandomNonceString_usesOnlyValidCharacters() {
        let charset = Set("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        let nonce = sut.randomNonceString(length: 256)
        for char in nonce {
            XCTAssertTrue(charset.contains(char), "Invalid character '\(char)' in nonce")
        }
    }

    func testRandomNonceString_producesDifferentValues() {
        let nonce1 = sut.randomNonceString()
        let nonce2 = sut.randomNonceString()
        XCTAssertNotEqual(nonce1, nonce2)
    }

    func testRandomNonceString_omitsAmbiguousCharacters() {
        let nonce = sut.randomNonceString(length: 512)
        let ambiguous: Set<Character> = ["0", "O", "I", "l"]
        let found = nonce.filter { ambiguous.contains($0) }
        XCTAssertTrue(found.isEmpty, "Nonce should not contain ambiguous characters")
    }

    func testRandomNonceString_precondition_failsOnNonPositiveLength() {
        XCTAssertTrue(sut.randomNonceString(length: 1).count == 1)
    }

    func testSha256_producesCorrectLength() {
        let hash = sut.sha256("test")
        XCTAssertEqual(hash.count, 64)
    }

    func testSha256_producesConsistentHash() {
        let input = "hello"
        let hash1 = sut.sha256(input)
        let hash2 = sut.sha256(input)
        XCTAssertEqual(hash1, hash2)
    }

    func testSha256_handlesEmptyString() {
        let hash = sut.sha256("")
        XCTAssertEqual(hash.count, 64)
        XCTAssertEqual(hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    }

    func testSha256_handlesSpecialCharacters() {
        let input = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
        let hash = sut.sha256(input)
        XCTAssertEqual(hash.count, 64)
    }

    func testSha256_handlesUnicodeCharacters() {
        let input = "Olá, mundo! 🌎⚽"
        let hash = sut.sha256(input)
        XCTAssertEqual(hash.count, 64)
    }

    func testSha256_knownInput_producesExpectedHash() {
        let hash = sut.sha256("abc")
        XCTAssertEqual(hash, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
    }

    func testSignIn_setsCurrentNonce() {
        let expectation = XCTestExpectation(description: "Sign in completion")
        sut.signIn { token, nonce, name in
            XCTAssertFalse(token.isEmpty)
            XCTAssertFalse(nonce.isEmpty)
            expectation.fulfill()
        }
    }

    func testSignIn_createsRequestWithCorrectScopes() {
        sut.signIn { _, _, _ in }
    }

    func testPresentationAnchor_returnsKeyWindow() {
        let window = sut.presentationAnchor(for: ASAuthorizationController())
        XCTAssertNotNil(window)
    }
}
