import SwiftUI
import ComposeApp

@main
struct FutebaApp: App {

    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onOpenURL { url in
                    MainViewControllerKt.handleIncomingDeepLink(url: url.absoluteString)
                }
        }
    }
}
