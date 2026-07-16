import DeviceCheck
import FirebaseAppCheck
import FirebaseCore

/// App Attest quando suportado pelo hardware, com fallback DeviceCheck para
/// aparelhos compatíveis com iOS 15 que não oferecem App Attest.
final class FutebaAppCheckProviderFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
        if #available(iOS 14.0, *), DCAppAttestService.shared.isSupported {
            return AppAttestProvider(app: app)
        }
        return DeviceCheckProvider(app: app)
    }
}
