import SwiftUI
import ComposeApp

/// Wraps o `MainViewController` do composeApp (Compose Multiplatform UI compartilhada).
/// O composeApp/iosMain/MainViewController.kt cria um `UIViewController` que renderiza
/// `App()` (commonMain) — mesma UI que Android usa.
struct ContentView: View {
    var body: some View {
        ComposeView()
            .ignoresSafeArea(.all)
    }
}

struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        MainViewControllerKt.MainViewController()
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {
        // No updates needed
    }
}

#Preview {
    ContentView()
}
