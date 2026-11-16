#if DEBUG
import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore
import FirebaseFunctions
import FirebaseStorage

/// Só em DEBUG. Chave da bateria de testes (scripts/bateria/ios.sh).
///
/// Com a variável de ambiente `FUTEBA_BATERIA=1` (o script passa pelo
/// `xcrun simctl launch`), o app sobe no projeto `demo-futebadosparcas` e fala
/// só com o Firebase Emulator Suite do Mac. Projeto demo não alcança recurso
/// real e o `GoogleService-Info.plist` nem é lido. Sem a variável, nada muda.
///
/// `FUTEBA_BATERIA_EMAIL` e `FUTEBA_BATERIA_SENHA` (contas do seed do emulador)
/// fazem o login antes da primeira tela, para o roteiro abrir o app já dentro.
enum BateriaEmulador {
    private static let ambiente = ProcessInfo.processInfo.environment
    private static let projeto = "demo-futebadosparcas"

    static var ativo: Bool { ambiente["FUTEBA_BATERIA"] == "1" }

    static func configurar() {
        let host = ambiente["FUTEBA_BATERIA_HOST"] ?? "127.0.0.1"

        // Identificadores fictícios, só no formato que os SDKs exigem.
        let opcoes = FirebaseOptions(
            googleAppID: "1:000000000000:ios:0000000000000000",
            gcmSenderID: "000000000000"
        )
        opcoes.projectID = projeto
        opcoes.apiKey = "A" + String(repeating: "0", count: 38)
        opcoes.storageBucket = "\(projeto).appspot.com"
        FirebaseApp.configure(options: opcoes)

        Auth.auth().useEmulator(withHost: host, port: porta("AUTH", padrao: 19099))
        Firestore.firestore().useEmulator(withHost: host, port: porta("FIRESTORE", padrao: 18085))
        Functions.functions(region: "southamerica-east1")
            .useEmulator(withHost: host, port: porta("FUNCTIONS", padrao: 15001))
        Storage.storage().useEmulator(withHost: host, port: porta("STORAGE", padrao: 19199))
        print("[bateria] Firebase apontado para o projeto \(projeto) em \(host)")

        entrarSePedido()
    }

    private static func porta(_ servico: String, padrao: Int) -> Int {
        ambiente["FUTEBA_BATERIA_PORTA_\(servico)"].flatMap(Int.init) ?? padrao
    }

    private static func entrarSePedido() {
        guard let email = ambiente["FUTEBA_BATERIA_EMAIL"],
              let senha = ambiente["FUTEBA_BATERIA_SENHA"] else { return }
        // A sessão do Auth fica no keychain do Simulador entre uma conta e outra.
        try? Auth.auth().signOut()
        Auth.auth().signIn(withEmail: email, password: senha) { _, erro in
            if let erro = erro {
                print("[bateria] login falhou (\(email)): \(erro.localizedDescription)")
            } else {
                print("[bateria] login ok (\(email))")
            }
        }
    }
}
#endif
