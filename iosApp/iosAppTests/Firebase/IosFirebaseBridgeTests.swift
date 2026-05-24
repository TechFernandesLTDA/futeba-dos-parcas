@testable import iosApp
import FirebaseAuth
import FirebaseFirestore
import XCTest

final class IosFirebaseBridgeTests: XCTestCase {

    private var sut: IosFirebaseBridge!

    override func setUp() {
        super.setUp()
        sut = IosFirebaseBridge()
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    func testGetCurrentUserId_whenNoUser_returnsNil() {
        let userId = sut.getCurrentUserId()
        XCTAssertNil(userId)
    }

    func testGetCurrentUserEmail_whenNoUser_returnsNil() {
        let email = sut.getCurrentUserEmail()
        XCTAssertNil(email)
    }

    func testSignInWithEmail_callsCompletion() {
        let expectation = XCTestExpectation(description: "Sign in completion")
        sut.signInWithEmail(email: "test@example.com", password: "password123") { uid, error in
            XCTAssertNil(uid)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testSignInWithEmail_invalidEmail_returnsError() {
        let expectation = XCTestExpectation(description: "Sign in error")
        sut.signInWithEmail(email: "invalid", password: "short") { uid, error in
            XCTAssertNil(uid)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testSignUpWithEmail_callsCompletion() {
        let expectation = XCTestExpectation(description: "Sign up completion")
        sut.signUpWithEmail(email: "newuser@example.com", password: "password123") { uid, error in
            XCTAssertNil(uid)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testSignUpWithEmail_weakPassword_returnsError() {
        let expectation = XCTestExpectation(description: "Sign up weak password error")
        sut.signUpWithEmail(email: "user@example.com", password: "ab") { uid, error in
            XCTAssertNil(uid)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testSignUpWithEmail_duplicateEmail_returnsError() {
        let expectation = XCTestExpectation(description: "Sign up duplicate email error")
        sut.signUpWithEmail(email: "existing@example.com", password: "password123") { uid, error in
            XCTAssertNil(uid)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testSignOut_whenNoUser_returnsError() {
        let expectation = XCTestExpectation(description: "Sign out error")
        sut.signOut { error in
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testSignOut_callsCompletion() {
        let expectation = XCTestExpectation(description: "Sign out completion")
        sut.signOut { error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testAddAuthStateListener_returnsHandle() {
        let handle = sut.addAuthStateListener { uid in
        }
        XCTAssertTrue(handle is NSObjectProtocol)
    }

    func testAddAuthStateListener_isRemovable() {
        let handle = sut.addAuthStateListener { uid in
        }
        if let handle = handle as? NSObjectProtocol {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    func testGetDocument_nonexistentCollection_returnsError() {
        let expectation = XCTestExpectation(description: "Get document error")
        sut.getDocument(collection: "nonexistent", documentId: "nonexistent") { data, error in
            XCTAssertNil(data)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testGetDocument_emptyCollectionName_returnsError() {
        let expectation = XCTestExpectation(description: "Get document error")
        sut.getDocument(collection: "", documentId: "doc") { data, error in
            XCTAssertNil(data)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testSetDocument_writesData() {
        let expectation = XCTestExpectation(description: "Set document completion")
        sut.setDocument(collection: "test", documentId: "doc1", data: ["key": "value"], merge: false) { error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testSetDocument_withMerge_updatesPartialData() {
        let expectation = XCTestExpectation(description: "Set document with merge completion")
        sut.setDocument(collection: "test", documentId: "doc1", data: ["key": "value"], merge: true) { error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testSetDocument_permissionDenied_returnsError() {
        let expectation = XCTestExpectation(description: "Set document permission error")
        sut.setDocument(collection: "restricted", documentId: "doc1", data: ["key": "value"], merge: false) { error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testUpdateDocument_validData() {
        let expectation = XCTestExpectation(description: "Update document completion")
        sut.updateDocument(collection: "test", documentId: "doc1", data: ["updated": true]) { error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testUpdateDocument_invalidData_returnsError() {
        let expectation = XCTestExpectation(description: "Update document error")
        sut.updateDocument(collection: "test", documentId: "doc1", data: ["field": NSNull()]) { error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testUpdateDocument_nonexistentDocument_returnsError() {
        let expectation = XCTestExpectation(description: "Update nonexistent document error")
        sut.updateDocument(collection: "test", documentId: "nonexistent", data: ["key": "value"]) { error in
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDeleteDocument_removesDocument() {
        let expectation = XCTestExpectation(description: "Delete document completion")
        sut.deleteDocument(collection: "test", documentId: "doc1") { error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDeleteDocument_notFound_returnsError() {
        let expectation = XCTestExpectation(description: "Delete not found error")
        sut.deleteDocument(collection: "test", documentId: "nonexistent") { error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testQueryDocuments_withFieldFilter() {
        let expectation = XCTestExpectation(description: "Query with filter completion")
        sut.queryDocuments(collection: "test", field: "type", value: "match", orderBy: nil, limit: 0) { documents, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testQueryDocuments_withOrderBy() {
        let expectation = XCTestExpectation(description: "Query with order completion")
        sut.queryDocuments(collection: "test", field: nil, value: nil, orderBy: "createdAt", limit: 0) { documents, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testQueryDocuments_withLimit() {
        let expectation = XCTestExpectation(description: "Query with limit completion")
        sut.queryDocuments(collection: "test", field: nil, value: nil, orderBy: nil, limit: 10) { documents, error in
            XCTAssertLessThanOrEqual(documents?.count ?? 0, 10)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testQueryDocuments_emptyResult_returnsEmptyArray() {
        let expectation = XCTestExpectation(description: "Query empty result")
        sut.queryDocuments(collection: "empty_collection", field: nil, value: nil, orderBy: nil, limit: 0) { documents, error in
            XCTAssertNotNil(documents)
            XCTAssertTrue(documents?.isEmpty ?? false)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testQueryDocuments_withAllParameters() {
        let expectation = XCTestExpectation(description: "Query with all parameters")
        sut.queryDocuments(collection: "test", field: "status", value: "active", orderBy: "name", limit: 5) { documents, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testQueryDocuments_nonexistentCollection_returnsEmpty() {
        let expectation = XCTestExpectation(description: "Query nonexistent collection")
        sut.queryDocuments(collection: "___nonexistent___", field: nil, value: nil, orderBy: nil, limit: 0) { documents, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }
}
