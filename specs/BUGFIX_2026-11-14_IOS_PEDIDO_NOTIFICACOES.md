# BUGFIX: Pedido de notificações na abertura e botões "Permitir" que não pedem nada (iOS)

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Claude (continuação do pedido da sessão principal, autorizado pelo dono)
> **Data:** 2026-11-14

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

- O `AppDelegate` pede a permissão de notificações em `didFinishLaunching`. Na primeira abertura, o alerta do
  sistema aparece por cima da tela de abertura, antes de a pessoa saber o que é o app.
- No onboarding de permissões (`PermissionOnboardingScreen` do `:composeApp`), os botões "Permitir" de
  Notificações e Localização só marcam o cartão como concedido. Nenhum pedido chega ao sistema.

### 1.2 Comportamento Esperado (Correto)

- A abertura não mostra alerta de permissão.
- "Permitir" em Notificações abre o alerta do iOS e, se a pessoa aceitar, registra o app para push.
- "Permitir" em Localização abre o alerta "durante o uso" do iOS.
- Os cartões só ficam marcados quando o sistema confirma.
- Quem já autorizou antes continua registrado para push em toda abertura.

## 2. Correção

- `composeApp/.../ui/core/SystemPermissions.kt`: funções `expect` para pedir as duas permissões.
- `SystemPermissions.ios.kt`:
  - `UNUserNotificationCenter.requestAuthorization` seguido de `registerForRemoteNotifications`.
  - `CLLocationManager.requestWhenInUseAuthorization`, com o delegate esperando a resposta.
- `SystemPermissions.nonIos.kt`: o Android usa o onboarding do `:app`; mantém o comportamento anterior.
- `PermissionOnboardingScreen.kt`: "Permitir" chama as funções acima.
- `AppDelegate.swift`: troca o `requestAuthorization` por `getNotificationSettings`. Só registra para push se o
  status já for autorizado, provisório ou efêmero.

Fora do escopo:

- Quem negou e toca "Permitir" de novo não vê alerta (o iOS não pergunta duas vezes) e o cartão continua sem marca.
  Mandar para os Ajustes fica para outra mudança.
- Android e web não mudam.

## 3. Mobile DoD

- [x] Simulador: abertura a frio sem alerta; "Permitir" mostra o alerta e marca o cartão depois de aceito.
- [ ] Não conferido num iPhone real (o token APNs só chega no aparelho).
