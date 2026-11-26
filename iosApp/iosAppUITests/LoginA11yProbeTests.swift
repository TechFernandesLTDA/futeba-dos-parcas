import XCTest

/// #4671: sonda de diagnóstico da árvore de acessibilidade do login.
///
/// Não é um teste de aceitação: ele **imprime** como o Compose expõe (ou não)
/// os campos de texto, para decidirmos a correção com dados em vez de palpite.
/// Rode com `scripts/bateria/ios-ui-capturas.sh` (o alvo `iosAppUITests` inclui
/// todos os testes) ou direto:
///   xcodebuild test -scheme iosAppUITests -only-testing:iosAppUITests/LoginA11yProbeTests
final class LoginA11yProbeTests: XCTestCase {

    func testDumpLoginAccessibilityTree() throws {
        let app = XCUIApplication()
        app.launch()
        Thread.sleep(forTimeInterval: 4)

        // Vai até o formulário de e-mail.
        for rotulo in ["Começar", "Continuar", "Entrar com email"] {
            var alvo = app.buttons[rotulo]
            if !alvo.exists || !alvo.isHittable {
                for _ in 0..<6 where !alvo.exists || !alvo.isHittable {
                    app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
                        .press(forDuration: 0.05,
                               thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)))
                    Thread.sleep(forTimeInterval: 0.6)
                }
            }
            if alvo.exists && alvo.isHittable {
                alvo.tap()
                Thread.sleep(forTimeInterval: 2.5)
            }
        }

        // O dump completo: tipos de elemento, identificadores e rótulos.
        let dump = app.debugDescription
        print("=== A11Y DUMP INICIO ===")
        print(dump)
        print("=== A11Y DUMP FIM ===")

        // Resumo objetivo para o relatório.
        let resumo = """
        textFields=\(app.textFields.count) \
        secureTextFields=\(app.secureTextFields.count) \
        otherElements=\(app.otherElements.count) \
        byIdLoginEmail=\(app.descendants(matching: .any)["login-email"].exists) \
        byIdLoginPassword=\(app.descendants(matching: .any)["login-password"].exists)
        """
        print("=== A11Y RESUMO: \(resumo)")

        let anexo = XCTAttachment(string: dump)
        anexo.name = "qa-a11y-dump"
        anexo.lifetime = .keepAlways
        add(anexo)

        let resumoAnexo = XCTAttachment(string: resumo)
        resumoAnexo.name = "qa-a11y-resumo"
        resumoAnexo.lifetime = .keepAlways
        add(resumoAnexo)
    }

    /// Mede o que realmente chega no campo (não o que a tela desenha).
    func testTypingIntoComposeField() throws {
        let app = XCUIApplication()
        app.launch()
        Thread.sleep(forTimeInterval: 4)

        for rotulo in ["Começar", "Continuar", "Entrar com email"] {
            var alvo = app.buttons[rotulo]
            var voltas = 0
            while (!alvo.exists || !alvo.isHittable) && voltas < 6 {
                app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.55))
                    .press(forDuration: 0.05,
                           thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)))
                Thread.sleep(forTimeInterval: 0.6)
                voltas += 1
            }
            if alvo.exists && alvo.isHittable { alvo.tap(); Thread.sleep(forTimeInterval: 2.5) }
        }

        let esperado = "jogador05@bateria.futeba.test"
        let campo = app.textViews["login-email"]
        guard campo.waitForExistence(timeout: 15) else { XCTFail("sem campo"); return }

        campo.tap()
        Thread.sleep(forTimeInterval: 1.5)
        campo.typeText(esperado)
        Thread.sleep(forTimeInterval: 1.5)
        let valor1 = (campo.value as? String) ?? "<nil>"

        // Segunda tentativa: apaga tudo e digita de novo (foco já estabelecido).
        campo.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: valor1.count + 2))
        Thread.sleep(forTimeInterval: 0.8)
        campo.typeText(esperado)
        Thread.sleep(forTimeInterval: 1.5)
        let valor2 = (campo.value as? String) ?? "<nil>"

        // Senha: o valor vem mascarado, então comparamos o comprimento.
        let senha = "Bateria#2026"
        let campoSenha = app.textViews["login-password"]
        campoSenha.tap()
        Thread.sleep(forTimeInterval: 1.2)
        campoSenha.typeText(senha)
        Thread.sleep(forTimeInterval: 1.0)
        let senhaDigitada = (campoSenha.value as? String) ?? "<nil>"

        let resumo = "esperado=\(esperado) | valor1=\(valor1) | valor2=\(valor2) | " +
            "senhaEsperada=\(senha.count) | senhaValor=\(senhaDigitada) (\(senhaDigitada.count))"
        print("=== A11Y TYPING: \(resumo)")
        let anexo = XCTAttachment(string: resumo)
        anexo.name = "qa-a11y-typing"
        anexo.lifetime = .keepAlways
        add(anexo)
    }
}
