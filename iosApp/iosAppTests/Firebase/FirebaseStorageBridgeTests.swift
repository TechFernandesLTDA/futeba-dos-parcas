@testable import iosApp
import FirebaseStorage
import XCTest

final class FirebaseStorageBridgeTests: XCTestCase {

    private var sut: FirebaseStorageBridge!

    override func setUp() {
        super.setUp()
        sut = FirebaseStorageBridge()
    }

    override func tearDown() {
        sut = nil
        super.tearDown()
    }

    func testUploadFile_sendsDataToCorrectPath() {
        let expectation = XCTestExpectation(description: "Upload file completion")
        let data = Data("test content".utf8)
        sut.uploadFile(path: "test/upload.txt", fileData: data, metadata: nil, progressCallback: { _ in }) { url, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testUploadFile_onSuccess_returnsDownloadURL() {
        let expectation = XCTestExpectation(description: "Upload success returns URL")
        let data = Data("test content".utf8)
        sut.uploadFile(path: "test/success.txt", fileData: data, metadata: ["type": "text"], progressCallback: { _ in }) { url, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testUploadFile_onFailure_returnsError() {
        let expectation = XCTestExpectation(description: "Upload failure returns error")
        let data = Data()
        sut.uploadFile(path: "", fileData: data, metadata: nil, progressCallback: { _ in }) { url, error in
            XCTAssertNil(url)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testUploadFile_reportsProgress() {
        let expectation = XCTestExpectation(description: "Upload progress callback")
        var progressValues: [Double] = []
        let data = Data("test content for progress tracking".utf8)
        sut.uploadFile(path: "test/progress.txt", fileData: data, metadata: nil, progressCallback: { progress in
            progressValues.append(progress)
        }) { url, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testUploadFile_withMetadata_includesCustomMetadata() {
        let expectation = XCTestExpectation(description: "Upload with metadata")
        let data = Data("test".utf8)
        let metadata = ["author": "test", "version": "1.0"]
        sut.uploadFile(path: "test/metadata.txt", fileData: data, metadata: metadata, progressCallback: { _ in }) { url, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDownloadFile_downloadsFromPath() {
        let expectation = XCTestExpectation(description: "Download file completion")
        sut.downloadFile(path: "test/download.txt") { data, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDownloadFile_onSuccess_returnsData() {
        let expectation = XCTestExpectation(description: "Download success returns data")
        sut.downloadFile(path: "test/existing.txt") { data, error in
            XCTAssertNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDownloadFile_notFound_returnsError() {
        let expectation = XCTestExpectation(description: "Download not found error")
        sut.downloadFile(path: "test/nonexistent.txt") { data, error in
            XCTAssertNil(data)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDownloadFile_invalidPath_returnsError() {
        let expectation = XCTestExpectation(description: "Download invalid path error")
        sut.downloadFile(path: "") { data, error in
            XCTAssertNil(data)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testGetDownloadURL_existingPath_returnsURL() {
        let expectation = XCTestExpectation(description: "Get download URL completion")
        sut.getDownloadURL(path: "test/existing.txt") { url, error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testGetDownloadURL_nonexistentPath_returnsError() {
        let expectation = XCTestExpectation(description: "Get download URL not found error")
        sut.getDownloadURL(path: "test/nonexistent.txt") { url, error in
            XCTAssertNil(url)
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDeleteFile_deletesAtPath() {
        let expectation = XCTestExpectation(description: "Delete file completion")
        sut.deleteFile(path: "test/todelete.txt") { error in
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDeleteFile_onSuccess_returnsNilError() {
        let expectation = XCTestExpectation(description: "Delete success returns nil error")
        sut.deleteFile(path: "test/deleted.txt") { error in
            XCTAssertNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDeleteFile_nonexistent_returnsError() {
        let expectation = XCTestExpectation(description: "Delete not found error")
        sut.deleteFile(path: "test/nonexistent.txt") { error in
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }

    func testDeleteFile_emptyPath_returnsError() {
        let expectation = XCTestExpectation(description: "Delete empty path error")
        sut.deleteFile(path: "") { error in
            XCTAssertNotNil(error)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 5.0)
    }
}
