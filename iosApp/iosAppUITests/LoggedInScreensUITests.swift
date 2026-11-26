import XCTest

/// #4432/#4431: captura Perfil e Exclusão de conta com sessão já aberta.
///
/// Diferente de `ScreenCaptureUITests`, estas telas exigem login. Em vez de
/// pedir uma conta real (o que tornaria o teste impossível de rodar em CI), o
/// app sobe no modo bateria (`FUTEBA_BATERIA=1` + contas do seed) falando com o
/// Firebase Emulator Suite do próprio Mac — ver `BateriaEmulador.swift` e
/// `scripts/bateria/ios-ui-capturas-logado.sh`.
///
/// Sem as variáveis de ambiente, o teste é pulado (não falha): assim o alvo
/// continua verde em máquina sem emulador no ar.
final class LoggedInScreensUITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = true
        app = XCUIApplication()

        // O `xcodebuild test` herda o ambiente do shell; repassamos ao app as
        // chaves que o modo bateria lê (BateriaEmulador.swift).
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

    private func settle(_ seconds: TimeInterval = 2.5) {
        Thread.sleep(forTimeInterval: seconds)
    }

    private func elemento(comRotulo rotulo: String, timeout: TimeInterval = 10) -> XCUIElement? {
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

    func testPerfilEExclusaoDeConta() throws {
        guard ProcessInfo.processInfo.environment["FUTEBA_BATERIA"] == "1" else {
            throw XCTSkip("Modo bateria desligado: rode via scripts/bateria/ios-ui-capturas-logado.sh")
        }

        app.launch()
        settle(8)

        // Aba Perfil (barra inferior).
        guard let perfil = elemento(comRotulo: "Perfil", timeout: 20) else {
            capture("perfil-nao-encontrado")
            XCTFail("Aba 'Perfil' não apareceu — o login do modo bateria pode ter falhado.")
            return
        }
        perfil.tap()
        settle()
        capture("perfil")

        // "Excluir conta" fica na lista de ações do perfil (pode exigir rolagem).
        var excluir = elemento(comRotulo: "Excluir conta", timeout: 5)
        var passos = 0
        while excluir == nil && passos < 8 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
                .press(forDuration: 0.05,
                       thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)))
            Thread.sleep(forTimeInterval: 0.7)
            passos += 1
            excluir = elemento(comRotulo: "Excluir conta", timeout: 1.5)
        }

        guard let botaoExcluir = excluir else {
            capture("perfil-sem-excluir")
            XCTFail("Ação 'Excluir conta' não encontrada no perfil.")
            return
        }
        botaoExcluir.tap()
        settle(3)
        capture("exclusao-de-conta")
    }
}
