import XCTest

/// #4432: captura as telas do onboarding para QA visual (claro/escuro/AX3).
///
/// O `xcrun simctl` não tem comando de toque; este XCUITest é o caminho
/// repetível para abrir o app, avançar Welcome → Permissões → Login e anexar
/// uma captura de cada tela ao `.xcresult`. `scripts/bateria/ios-ui-capturas.sh`
/// roda três vezes (claro, escuro e accessibility-extra-large) e extrai os PNGs.
///
/// Escopo e limite (iguais aos da issue):
/// - Welcome, Permissões e Login NÃO exigem conta: são capturados aqui.
/// - Perfil e Exclusão de conta exigem login real → seguem manuais (#4431).
final class ScreenCaptureUITests: XCTestCase {

    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = true
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    /// Captura a tela atual com nome estável (o script usa o prefixo `qa-`).
    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "qa-\(name)"
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    /// Espera o app estabilizar (Compose desenha em camada própria; sem espera
    /// a captura sai em branco nos primeiros frames).
    private func settle(_ seconds: TimeInterval = 2.5) {
        Thread.sleep(forTimeInterval: seconds)
    }

    /// Rola a tela para baixo. O conteúdo do Compose fica num Column rolável e
    /// o botão "Começar" nasce fora da dobra em telas pequenas (Futeba SE).
    private func swipeUp(times: Int = 1) {
        let meio = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        for _ in 0..<times {
            meio.press(
                forDuration: 0.05,
                thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15))
            )
            Thread.sleep(forTimeInterval: 0.6)
        }
    }

    /// Procura um elemento por rótulo em qualquer tipo (Compose expõe `Text`
    /// como staticText e o `Button` como botão; o tipo varia por versão).
    private func elemento(comRotulo rotulo: String, timeout: TimeInterval = 8) -> XCUIElement? {
        let candidatos: [XCUIElementQuery] = [
            app.buttons, app.staticTexts, app.otherElements,
            app.descendants(matching: .any),
        ]
        let limite = Date().addingTimeInterval(timeout)
        repeat {
            for consulta in candidatos {
                let elemento = consulta[rotulo]
                if elemento.exists && elemento.isHittable { return elemento }
            }
            Thread.sleep(forTimeInterval: 0.4)
        } while Date() < limite
        return nil
    }

    func testOnboardingScreens() throws {
        settle(4)

        // 1) Boas-vindas (topo).
        capture("welcome")

        // O botão "Começar" fica abaixo da dobra: rola até ele aparecer.
        // Em AX3 o conteúdo é muito mais alto, então rola em passos até achar
        // (8 passos cobrem o Welcome inteiro no tamanho máximo de fonte).
        var comecar = elemento(comRotulo: "Começar", timeout: 3)
        var passos = 0
        while comecar == nil && passos < 8 {
            swipeUp()
            passos += 1
            if passos == 1 {
                settle(1)
                capture("welcome-fim")
            }
            comecar = elemento(comRotulo: "Começar", timeout: 1.5)
        }

        guard let botaoComecar = comecar else {
            XCTFail("Botão 'Começar' não encontrado após rolar — o app pode ter travado antes do Welcome.")
            return
        }
        botaoComecar.tap()
        settle()

        // 2) Permissões.
        capture("permissoes")

        // 3) Login: o botão "Continuar" da tela de permissões leva ao Login.
        var continuar = elemento(comRotulo: "Continuar", timeout: 5)
        if continuar == nil {
            swipeUp(times: 2)
            settle(1)
            continuar = elemento(comRotulo: "Continuar", timeout: 5)
        }
        if let botaoContinuar = continuar {
            botaoContinuar.tap()
            settle()
            capture("login")

            // 4) Formulário de e-mail (mesma tela, estado alternativo).
            if let entrarComEmail = elemento(comRotulo: "Entrar com email", timeout: 6) {
                entrarComEmail.tap()
                settle()
                capture("login-email")
            }
        } else {
            capture("permissoes-sem-continuar")
        }
    }
}
