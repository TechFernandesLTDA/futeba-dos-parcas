import UIKit
import FirebaseCore
import FirebaseMessaging
import FirebaseAppCheck
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {

        // Assinatura "Sem anúncios": ouve renovações/reembolsos desde a abertura (StoreKit 2).
        StoreService.shared.startListening()

        // Notificações: o pedido de permissão fica no onboarding ("Permitir"), não na abertura,
        // para o alerta não cobrir a tela de abertura. Aqui só registra para push quem já autorizou.
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            default:
                break
            }
        }

#if DEBUG
        // Bateria de testes (scripts/bateria/ios.sh): projeto demo + emuladores locais.
        // Sem push nem App Check: nada aqui alcança produção.
        if BateriaEmulador.ativo {
            BateriaEmulador.configurar()
            return true
        }
#endif

        // Firebase só inicializa se GoogleService-Info.plist presente (smoke-test mode sem config)
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
#if DEBUG
            AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
#else
            AppCheck.setAppCheckProviderFactory(FutebaAppCheckProviderFactory())
#endif
            FirebaseApp.configure()
            Messaging.messaging().delegate = self
            PushTokenManager.shared.start()
        } else {
            print("WARNING: GoogleService-Info.plist nao encontrado — Firebase desativado (smoke-test mode)")
        }

        return true
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        Messaging.messaging().apnsToken = deviceToken
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("Failed to register for remote notifications: \(error)")
    }

    // MARK: - UNUserNotificationCenterDelegate

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound, .badge])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        // Handle notification tap
        completionHandler()
    }

    // MARK: - MessagingDelegate

    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        PushTokenManager.shared.didReceiveRegistrationToken(fcmToken)
    }
}
