# BUGFIX: Archive de Release do iOS sem o framework de device

> **Status:** `APPROVED`
> **Severidade:** `HIGH` (bloqueia o archive para a App Store)
> **Autor:** Claude (autonomia ampla autorizada pelo dono; iOS: só bugs e CI)
> **Data:** 2026-11-01
> **PR:** a definir (issue #4430, épico #4401)

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)
O `preBuildScript` do `iosApp/project.yml` sempre roda `:composeApp:linkDebugFrameworkIosSimulatorArm64`, qualquer que seja o SDK ou a configuração. O `FRAMEWORK_SEARCH_PATHS[sdk=iphoneos*]` aponta para `iosArm64/debugFramework`, que nada gera, e a dependência `framework:` fixa o caminho do simulador. Um build de device ou um archive de Release não encontra o `ComposeApp.framework` certo e, na melhor hipótese, linka um framework Debug.

### 1.2 Comportamento Esperado (Correto)
O framework KMP segue o SDK e a configuração do Xcode:

| SDK | Configuração | Tarefa Gradle | Pasta |
|---|---|---|---|
| iphonesimulator | Debug | `linkDebugFrameworkIosSimulatorArm64` | `iosSimulatorArm64/debugFramework` |
| iphonesimulator | Release | `linkReleaseFrameworkIosSimulatorArm64` | `iosSimulatorArm64/releaseFramework` |
| iphoneos | Debug | `linkDebugFrameworkIosArm64` | `iosArm64/debugFramework` |
| iphoneos | Release (archive) | `linkReleaseFrameworkIosArm64` | `iosArm64/releaseFramework` |

### 1.3 Passos para Reproduzir
1. `cd iosApp && xcodegen generate && pod install`
2. `xcodebuild -workspace iosApp.xcworkspace -scheme iosApp -configuration Release -sdk iphoneos CODE_SIGNING_ALLOWED=NO build`
3. O link falha (framework do simulador ou ausente).

---

## 2. Causa Raiz e Solução

O script e os caminhos foram escritos só para o simulador Debug.

- Duas variáveis de build no target: `KMP_TARGET` (por SDK: `iosSimulatorArm64` ou `iosArm64`) e `KMP_BUILD_TYPE` (por configuração: `debug` ou `release`).
- `FRAMEWORK_SEARCH_PATHS` e o `outputFiles` do script usam `$(KMP_TARGET)/$(KMP_BUILD_TYPE)Framework`.
- O script monta a tarefa `link<Debug|Release>Framework<IosSimulatorArm64|IosArm64>` a partir das duas variáveis.
- Sai a dependência `framework:` com caminho fixo do simulador. O link já é feito por `OTHER_LDFLAGS -framework ComposeApp` mais o caminho de busca, e o framework é estático (`embed: false`), então a referência só fixava o caminho errado.
- `SKIP_KMP_BUILD=YES` (CI) continua igual: o CI prepara o Debug do simulador antes.

| Arquivo | Motivo |
|---|---|
| `iosApp/project.yml` | Variáveis, caminhos e script por SDK/configuração |

## 3. Verificação

- `xcodegen generate` sem erro.
- Build Debug no simulador continua passando.
- Build Release `-sdk iphoneos CODE_SIGNING_ALLOWED=NO` linka o `iosArm64/releaseFramework`.
- O archive assinado e o envio à App Store dependem da conta Apple do dono (#4395) e ficam fora deste bugfix.
