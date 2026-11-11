import UIKit
import StoreKit
import ComposeApp

/// Ponte do StoreKit 2 para o Kotlin (`StoreBridge`): assinatura anual `futeba_sem_anuncios_anual`
/// (ID próprio do iOS: o `sem_anuncios_anual` já é do Cuidia na conta Apple; o Play do Futeba segue `sem_anuncios_anual`). Compra, "Restaurar compra", conferência na abertura e "Gerenciar
/// assinatura".
///
/// Regras (decididas no Kotlin, `AdsFreeEntitlement`, testadas): só a LOJA respondendo "não há
/// assinatura nossa" revoga o direito; sem loja/rede (`UNAVAILABLE`) ou pendente, nada muda.
final class StoreService: NSObject, StoreBridge {

    static let shared = StoreService()
    private static let productId = "futeba_sem_anuncios_anual"

    private var product: Product?
    private var updatesTask: Task<Void, Never>?

    private override init() { super.init() }

    /// Ouve renovações, reembolsos e compras que compensam fora do app. Chamar uma vez,
    /// na abertura (AppDelegate).
    func startListening() {
        guard updatesTask == nil else { return }
        updatesTask = Task.detached {
            for await result in Transaction.updates {
                if case .verified(let transaction) = result, transaction.productID == Self.productId {
                    await transaction.finish()
                    let outcome = await Self.entitlementOutcome()
                    await MainActor.run {
                        MonetizationHolder.shared.controller?.applyEntitlement(outcome: outcome)
                    }
                }
            }
        }
    }

    // MARK: - StoreBridge

    func loadPriceLabel(callback: @escaping (String?) -> Void) {
        Task {
            let label = await self.loadProduct()?.displayPrice
            await MainActor.run { callback(label) }
        }
    }

    func purchase(callback: @escaping (StoreOutcome) -> Void) {
        Task {
            let outcome = await self.runPurchase()
            await MainActor.run { callback(outcome) }
        }
    }

    func restore(callback: @escaping (StoreOutcome) -> Void) {
        Task {
            var outcome: StoreOutcome
            do {
                try await AppStore.sync()
                outcome = await Self.entitlementOutcome()
            } catch {
                outcome = .unavailable
            }
            await MainActor.run { callback(outcome) }
        }
    }

    func currentEntitlement(callback: @escaping (StoreOutcome) -> Void) {
        Task {
            let outcome = await Self.entitlementOutcome()
            await MainActor.run { callback(outcome) }
        }
    }

    func manageSubscriptions() {
        Task { @MainActor in
            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
                do {
                    try await AppStore.showManageSubscriptions(in: scene)
                    return
                } catch {
                    // Cai para a página de assinaturas.
                }
            }
            if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                await UIApplication.shared.open(url)
            }
        }
    }

    // MARK: - Interno

    private func loadProduct() async -> Product? {
        if let product { return product }
        do {
            let products = try await Product.products(for: [Self.productId])
            product = products.first
            return product
        } catch {
            return nil
        }
    }

    private func runPurchase() async -> StoreOutcome {
        guard let product = await loadProduct() else { return .failed }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                guard case .verified(let transaction) = verification else { return .failed }
                await transaction.finish()
                return .active
            case .pending:
                return .pending
            case .userCancelled:
                return .cancelled
            @unknown default:
                return .failed
            }
        } catch {
            return .failed
        }
    }

    /// ACTIVE = assinatura nossa vigente e não revogada. NONE = a loja respondeu sem nada nosso.
    /// (`Transaction.currentEntitlements` lê o que o aparelho já tem; funciona offline.)
    private static func entitlementOutcome() async -> StoreOutcome {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result,
               transaction.productID == productId,
               transaction.revocationDate == nil,
               (transaction.expirationDate ?? .distantFuture) > Date() {
                return .active
            }
        }
        return .none
    }
}
