import UIKit
import GoogleMobileAds
import UserMessagingPlatform
import ComposeApp

/// Ponte do Google Mobile Ads (AdMob) + consentimento UMP para o Kotlin (`IosAdsBridge`).
///
/// Regras (decididas no Kotlin, `MonetizationController`/`AdsGate`, testadas em commonTest):
/// - `startAds` só é chamado depois da primeira vitória e nunca para assinante;
/// - ordem: formulário de consentimento do Google (UMP, só onde a região exige) -> início do SDK;
/// - o app NÃO pede ATT (AppTrackingTransparency): os anúncios são sempre não personalizados, e o
///   resultado informado ao Kotlin é sempre 0 (sem permissão de rastreamento);
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
                startSdkOnce()
                finish(canRequestAds: true, att: Self.noTracking, onResult: onResult)
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

    /// Sem ATT, o Kotlin recebe sempre "0" (rastreamento não autorizado) e só pede anúncio
    /// não personalizado (`npa=1`). 1 = autorizado, 0 = negado ou restrito, -1 = não decidido.
    private static let noTracking = 0

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
            // Sem ATT: só anúncios não personalizados.
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
