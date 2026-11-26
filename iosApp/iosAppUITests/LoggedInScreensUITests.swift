import XCTest

/// #4432/#4431: captura Perfil e Exclusão de conta com sessão aberta.
///
/// Estas telas exigem login, então o teste faz o login **pela própria UI** (o
/// caminho real do usuário) contra o Firebase Emulator Suite da bateria — ver
/// `scripts/bateria/ios-ui-capturas-logado.sh`, que sobe os emuladores e passa
/// as credenciais de uma conta semeada.
///
/// Por que não usar o auto-login do `BateriaEmulador`: ele é assíncrono e o
/// Compose decide a tela inicial (`isLoggedIn()`) de forma síncrona logo na
/// abertura — o app acabava no Welcome. Digitar usuário/senha no formulário
/// também exercita o fluxo de login de verdade.
///
/// O teste NÃO confirma a exclusão: para na tela, que é o que o QA visual pede.
final class LoggedInScreensUITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = true
        app = XCUIApplication()

        // O `xcodebuild test` entrega ao runner as variáveis com prefixo
        // TEST_RUNNER_ (ele remove o prefixo); repassamos ao app as chaves que
        // o modo bateria lê (BateriaEmulador.swift).
        let chaves = [
            "FUTEBA_BATERIA",
            "FUTEBA_BATERIA_HOST",
            "FUTEBA_BATERIA_PORTA_AUTH",
            "FUTEBA_BATERIA_PORTA_FIRESTORE",
            "FUTEBA_BATERIA_PORTA_FUNCTIONS",
            "FUTEBA_BATERIA_PORTA_STORAGE",
            "FUTEBA_BATERIA_EMAIL",
            "FUTEBA_BATERIA_SENHA",
        ]
        for chave in chaves {
            if let valor = ProcessInfo.processInfo.environment[chave] {
                app.launchEnvironment[chave] = valor
            }
        }
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "qa-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func settle(_ seconds: TimeInterval = 2.0) {
        Thread.sleep(forTimeInterval: seconds)
    }

    private func swipeUp() {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
            .press(forDuration: 0.05,
                   thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)))
        Thread.sleep(forTimeInterval: 0.6)
    }

    private func elemento(comRotulo rotulo: String, timeout: TimeInterval = 8) -> XCUIElement? {
        let consultas: [XCUIElementQuery] = [app.buttons, app.staticTexts, app.descendants(matching: .any)]
        let limite = Date().addingTimeInterval(timeout)
        repeat {
            for consulta in consultas {
                let candidato = consulta[rotulo]
                if candidato.exists && candidato.isHittable { return candidato }
            }
            Thread.sleep(forTimeInterval: 0.4)
        } while Date() < limite
        return nil
    }

    /// Rola até o rótulo aparecer (o botão pode nascer abaixo da dobra).
    private func rolarAte(_ rotulo: String, passos: Int = 8) -> XCUIElement? {
        var achado = elemento(comRotulo: rotulo, timeout: 2)
        var feitos = 0
        while achado == nil && feitos < passos {
            swipeUp()
            feitos += 1
            achado = elemento(comRotulo: rotulo, timeout: 1.2)
        }
        return achado
    }

    /// Preenche um campo do Compose com verificação.
    ///
    /// #4671: o IME do Compose no iOS perde a primeira tecla logo após o toque
    /// (a view de texto só assume o foco depois do primeiro evento). Digitar
    /// caractere a caractere, conferindo o valor lido na árvore, e repetir a
    /// operação quando não bater, deixa o preenchimento determinístico.
    @discardableResult
    private func preencher(_ campo: XCUIElement, com texto: String) -> Bool {
        for _ in 0..<4 {
            campo.tap()
            Thread.sleep(forTimeInterval: 1.2)

            // Limpa o que já estiver no campo (placeholder do Compose não conta).
            if let atual = campo.value as? String, !atual.isEmpty, atual != texto {
                campo.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: atual.count))
                Thread.sleep(forTimeInterval: 0.4)
            }

            for caractere in texto {
                campo.typeText(String(caractere))
                Thread.sleep(forTimeInterval: 0.06)
            }
            Thread.sleep(forTimeInterval: 0.6)

            if (campo.value as? String) == texto { return true }
        }
        return (campo.value as? String) == texto
    }

    func testPerfilEExclusaoDeConta() throws {
        // Perfil e Exclusão exigem sessão. O login por UI já foi levado até o
        // fim do formulário: os campos são encontrados como `TextView` pelos
        // identificadores `login-email`/`login-password` e o texto chega
        // íntegro (verificado lendo `value`). A chamada de auth, porém, não
        // conclui no modo bateria — investigação em #4671. Enquanto isso, o
        // roteiro manual segue no #4431.
        throw XCTSkip("Login ponta a ponta no modo bateria pendente (#4671); roteiro manual no #4431")
    }
}
