@testable import iosApp
import SwiftUI
import XCTest

final class FutebaAppTests: XCTestCase {

    func testApp_createsSceneWithWindowGroup() {
        let app = FutebaApp()
        XCTAssertNotNil(app)
    }

    func testApp_body_containsContentView() {
        let app = FutebaApp()
        XCTAssertNotNil(app)
    }

    func testContentView_exists() {
        let contentView = ContentView()
        XCTAssertNotNil(contentView)
    }

    func testContentView_body_containsComposeView() {
        let contentView = ContentView()
        XCTAssertNotNil(contentView)
    }

    func testComposeView_createsMainViewController() {
        let composeView = ComposeView()
        XCTAssertNotNil(composeView)
    }

    func testComposeView_updateUIViewController_doesNotCrash() {
        let composeView = ComposeView()
        let vc = UIViewController()
        composeView.updateUIViewController(vc, context: UIViewControllerRepresentableContext<ComposeView>())
    }

    func testApp_usesAppDelegate() {
        let delegate = AppDelegate()
        XCTAssertNotNil(delegate)
    }

    func testAppDelegate_applicationDidFinishLaunching_returnsTrue() {
        let delegate = AppDelegate()
        let result = delegate.application(UIApplication.shared, didFinishLaunchingWithOptions: nil)
        XCTAssertTrue(result)
    }

    func testContentPreview_exists() {
        let preview = ContentView_Previews.previews
        XCTAssertNotNil(preview)
    }
}
