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

    func testPerfilEExclusaoDeConta() throws {
        let ambiente = ProcessInfo.processInfo.environment
        guard ambiente["FUTEBA_BATERIA"] == "1",
              let email = ambiente["FUTEBA_BATERIA_EMAIL"],
              let senha = ambiente["FUTEBA_BATERIA_SENHA"] else {
            throw XCTSkip("Modo bateria desligado: rode via scripts/bateria/ios-ui-capturas-logado.sh")
        }

        // BLOQUEIO CONHECIDO (issue #4670): os `OutlinedTextField` do Compose no
        // iOS não aparecem na árvore de acessibilidade como `textFields` — o
        // XCUITest só os alcança por coordenada, e a digitação perde caracteres
        // de forma intermitente (o e-mail sai sem a primeira letra, a senha com
        // menos dígitos), então o login falha. Enquanto o a11y não expuser os
        // campos, Perfil/Exclusão seguem no roteiro manual do #4431.
        _ = email
        _ = senha
        throw XCTSkip("Perfil/Exclusão dependem do a11y dos campos de texto (#4670); roteiro manual no #4431")
    }

    /// Mantido documentando o fluxo pretendido (Welcome → Login → Perfil →
    /// Exclusão) para quando os campos forem expostos como textFields.
    private func fluxoPretendido(email: String, senha: String) {
        app.launch()
        settle(4)

        // 1. Welcome → Permissões → Login.
        guard let comecar = rolarAte("Começar") else {
            capture("login-falhou-welcome")
            XCTFail("Botão 'Começar' não apareceu.")
            return
        }
        comecar.tap()
        settle()

        if let continuar = rolarAte("Continuar", passos: 4) {
            continuar.tap()
            settle()
        }

        // 2. Formulário de e-mail (o login com Google não serve no emulador).
        if let entrarComEmail = rolarAte("Entrar com email", passos: 4) {
            entrarComEmail.tap()
            settle()
        }

        // O Compose expõe os campos como elementos genéricos (não como
        // `textFields`), então tocamos na posição deles e digitamos. As
        // coordenadas vêm do layout do card de login (formulário centrado).
        // O primeiro caractere digitado logo após o toque é engolido pela
        // troca de foco: digita um "x" e apaga antes do texto real.
        func preencher(_ rotulo: String, dy: CGFloat, texto: String) {
            if let campo = elemento(comRotulo: rotulo, timeout: 6) {
                campo.tap()
            } else {
                app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: dy)).tap()
            }
            // Espera o teclado subir: o IME do Compose demora a assumir o foco e
            // engole a primeira tecla se digitarmos antes. O Cmd+A absorve essa
            // perda e seleciona o conteúdo; o texto digitado substitui a seleção.
            _ = app.keyboards.firstMatch.waitForExistence(timeout: 6)
            settle(1.2)
            app.typeKey("a", modifierFlags: .command)
            settle(0.5)
            app.typeText(texto)
            settle(0.5)
        }

        preencher("Email", dy: 0.31, texto: email)
        preencher("Senha", dy: 0.44, texto: senha)
        capture("login-preenchido")

        // Fecha o teclado, se estiver cobrindo o botão.
        if app.keyboards.element.exists {
            app.typeText("\n")
            settle(1)
        }

        if let entrar = rolarAte("Entrar", passos: 4) {
            entrar.tap()
        }
        settle(8)

        // 3. Perfil.
        guard let perfil = elemento(comRotulo: "Perfil", timeout: 25) else {
            capture("login-nao-concluiu")
            XCTFail("Aba 'Perfil' não apareceu — o login pela UI falhou.")
            return
        }
        perfil.tap()
        settle()
        capture("perfil")

        // 4. Excluir conta (fim da lista de ações).
        guard let excluir = rolarAte("Excluir conta", passos: 10) else {
            capture("perfil-sem-excluir")
            XCTFail("Ação 'Excluir conta' não encontrada no perfil.")
            return
        }
        excluir.tap()
        settle(3)
        capture("exclusao-de-conta")
    }
}
