import UIKit
import AppTrackingTransparency
import GoogleMobileAds
import UserMessagingPlatform
import ComposeApp

/// Ponte do Google Mobile Ads (AdMob) + consentimento UMP + ATT para o Kotlin (`IosAdsBridge`).
///
/// Regras (decididas no Kotlin, `MonetizationController`/`AdsGate`, testadas em commonTest):
/// - `startAds` só é chamado depois da primeira vitória e nunca para assinante;
/// - ordem: formulário de consentimento do Google (UMP, só onde a região exige) -> pedido de
///   rastreamento (ATT) -> início do SDK. Recusar o ATT só pede anúncio não personalizado;
/// - sem `ADMOB_BANNER_UNIT_ID` (config de build vazia) `unitConfigured` é falso e nada inicia.
///
/// IDs: Debug usa as unidades de TESTE do Google (project.yml). Release lê `ADMOB_APP_ID` e
/// `ADMOB_BANNER_UNIT_ID` da config de build, a preencher na fase 2 (docs/MONETIZACAO.md).
final class AdsService: NSObject, IosAdsBridge {

    static let shared = AdsService()

    private let unitId: String
    private var running = false
    private var sdkStarted = false

    private override init() {
        let raw = Bundle.main.object(forInfoDictionaryKey: "ADMOB_BANNER_UNIT_ID") as? String ?? ""
        let clean = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        // "$(ADMOB_BANNER_UNIT_ID)" sem substituição também vale como "não configurado".
        self.unitId = clean.hasPrefix("$(") ? "" : clean
        super.init()
    }

    // MARK: - AdsBridge

    var unitConfigured: Bool { !unitId.isEmpty }

    var privacyOptionsRequired: Bool {
        ConsentInformation.shared.privacyOptionsRequirementStatus == .required
    }

    func startAds(onResult: @escaping (KotlinBoolean, KotlinInt) -> Void) {
        DispatchQueue.main.async { [self] in
            guard unitConfigured, !running else { return }
            running = true
            requestConsent { [self] canRequestAds in
                guard canRequestAds else {
                    finish(canRequestAds: false, att: -1, onResult: onResult)
                    return
                }
                requestTracking { [self] att in
                    startSdkOnce()
                    finish(canRequestAds: true, att: att, onResult: onResult)
                }
            }
        }
    }

    func showPrivacyOptions(onClosed: @escaping () -> Void) {
        DispatchQueue.main.async {
            ConsentForm.presentPrivacyOptionsForm(from: Self.rootViewController()) { _ in
                onClosed()
            }
        }
    }

    // MARK: - IosAdsBridge (banner)

    func bannerHeight(widthPoints: Double) -> Double {
        Double(currentOrientationAnchoredAdaptiveBanner(width: CGFloat(widthPoints)).size.height)
    }

    func createBannerView(
        widthPoints: Double,
        nonPersonalized: Bool,
        onLoadChanged: @escaping (KotlinBoolean) -> Void
    ) -> UIView {
        let container = AdBannerContainer(
            unitId: unitId,
            width: CGFloat(widthPoints),
            nonPersonalized: nonPersonalized,
            rootViewController: Self.rootViewController()
        ) { loaded in
            onLoadChanged(KotlinBoolean(bool: loaded))
        }
        return container
    }

    // MARK: - Fluxo

    private func requestConsent(_ done: @escaping (Bool) -> Void) {
        let params = RequestParameters()
        ConsentInformation.shared.requestConsentInfoUpdate(with: params) { _ in
            ConsentForm.loadAndPresentIfRequired(from: Self.rootViewController()) { _ in
                done(ConsentInformation.shared.canRequestAds)
            }
        }
    }

    /// 1 = autorizado, 0 = negado ou restrito, -1 = não decidido.
    private func requestTracking(_ done: @escaping (Int) -> Void) {
        func code(_ status: ATTrackingManager.AuthorizationStatus) -> Int {
            switch status {
            case .authorized: return 1
            case .denied, .restricted: return 0
            default: return -1
            }
        }
        let current = ATTrackingManager.trackingAuthorizationStatus
        guard current == .notDetermined else {
            done(code(current))
            return
        }
        let ask = {
            // Pequena folga depois do formulário do Google, senão o iOS ignora o pedido.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                ATTrackingManager.requestTrackingAuthorization { status in
                    DispatchQueue.main.async { done(code(status)) }
                }
            }
        }
        if UIApplication.shared.applicationState == .active {
            ask()
        } else {
            // O ATT só aparece com o app ativo: espera voltar ao primeiro plano.
            var token: NSObjectProtocol?
            token = NotificationCenter.default.addObserver(
                forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
            ) { _ in
                if let token { NotificationCenter.default.removeObserver(token) }
                ask()
            }
        }
    }

    private func startSdkOnce() {
        guard !sdkStarted else { return }
        sdkStarted = true
        MobileAds.shared.start(completionHandler: nil)
    }

    private func finish(
        canRequestAds: Bool,
        att: Int,
        onResult: (KotlinBoolean, KotlinInt) -> Void
    ) {
        running = false
        onResult(KotlinBoolean(bool: canRequestAds), KotlinInt(int: Int32(att)))
    }

    static func rootViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive } ??
            UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var top = scene?.windows.first(where: \.isKeyWindow)?.rootViewController
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}

/// Container do banner adaptativo ancorado: guarda o `BannerView` e o delegate (que precisa
/// continuar vivo) e avisa o Compose quando o anúncio carregou ou falhou.
private final class AdBannerContainer: UIView, BannerViewDelegate {
    private let banner: BannerView
    private let onLoadChanged: (Bool) -> Void

    init(
        unitId: String,
        width: CGFloat,
        nonPersonalized: Bool,
        rootViewController: UIViewController?,
        onLoadChanged: @escaping (Bool) -> Void
    ) {
        self.banner = BannerView(adSize: currentOrientationAnchoredAdaptiveBanner(width: width))
        self.onLoadChanged = onLoadChanged
        super.init(frame: .zero)
        banner.adUnitID = unitId
        banner.rootViewController = rootViewController
        banner.delegate = self
        banner.translatesAutoresizingMaskIntoConstraints = false
        addSubview(banner)
        NSLayoutConstraint.activate([
            banner.centerXAnchor.constraint(equalTo: centerXAnchor),
            banner.topAnchor.constraint(equalTo: topAnchor),
        ])

        let request = Request()
        if nonPersonalized {
            // Recusou o ATT: só anúncios não personalizados.
            let extras = Extras()
            extras.additionalParameters = ["npa": "1"]
            request.register(extras)
        }
        banner.load(request)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) não é usado") }

    func bannerViewDidReceiveAd(_ bannerView: BannerView) { onLoadChanged(true) }

    func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
        onLoadChanged(false)
    }
}
