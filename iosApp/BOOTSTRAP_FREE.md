# iOS Bootstrap Free — Rodar no Seu iPhone Sem $99

> Runbook pra rodar o app no seu próprio iPhone usando Apple ID gratuita.
> Sem TestFlight, sem distribuição, sem custo. Validação local de device-real.

---

## O que essa rota dá

✅ App rodando no seu iPhone físico via cabo
✅ Validação que KMP framework + Compose Multiplatform abrem no device de verdade
✅ Debug, breakpoints, console logs em iPhone real
✅ Zero custo

## O que essa rota NÃO dá

❌ **Build expira em 7 dias** — depois precisa reconectar cabo e rebuildar
❌ **Sem TestFlight** — só você tem o app
❌ **Sem Push Notifications** (APNs requer Apple Dev Program)
❌ **Sem Sign in with Apple** (requer entitlement de paid program)
❌ **Sem Background Modes completos**
❌ **Máximo 3 apps** ativos por Apple ID grátis
❌ **Máximo 7 devices** associados à Apple ID em rolling window

Se você só quer **validar que o app abre no seu iPhone**, basta. Pra time testando ou release, precisa do $99.

---

## Pré-requisitos

| Item | Estado |
|------|--------|
| MacBook com Xcode 15+ | ✅ (já instalado, memory `reference_xcode_ios_simulator.md`) |
| Apple ID (qualquer, mesmo a free) | Você já tem? |
| iPhone com iOS 15+ | iPhone 6s ou mais novo |
| Cabo Lightning/USB-C compatível | Verificar |
| KMP framework buildado | ✅ (xcodebuild smoke OK 2026-05-07) |

---

## Passo 1 — Adicionar Apple ID no Xcode

1. Abrir Xcode
2. **Xcode menu → Settings** (ou `Cmd+,`)
3. Tab **Accounts**
4. Botão **+** (canto inferior esquerdo) → **Apple ID**
5. Login com seu Apple ID + senha + 2FA
6. Após login, vai aparecer **"Personal Team"** vinculado ao seu nome
   - Esse é o team grátis. Team ID começa com letras tipo `5VW3HHF...` (é único pro seu Apple ID)
7. **Manage Certificates** (botão à direita) → deve aparecer **"Apple Development"** cert. Se não, clica `+` → **Apple Development**

---

## Passo 2 — Configurar iPhone

### 2.1 Habilitar Developer Mode (iOS 16+)

iOS 16+ exige Developer Mode ON no device:

1. No iPhone: **Settings → Privacy & Security → Developer Mode** → **ON**
2. iPhone reinicia
3. Após reiniciar, confirma com PIN do device

iOS 15 não precisa disso (já vem ativo).

### 2.2 Conectar via cabo

1. Conecta iPhone no MacBook via cabo
2. iPhone vai pedir **"Trust This Computer?"** → **Trust** + digita PIN
3. No Xcode: **Window → Devices and Simulators** (`Cmd+Shift+2`)
4. Seu iPhone aparece na esquerda → clica
5. Espera Xcode "Preparing device for development" (1-5 min na primeira vez, baixa Developer Disk Image)

---

## Passo 3 — Build pra device

### 3.1 Atualizar project.yml pra signing automatic + Personal Team

Você vai editar **uma linha** no Xcode (não no project.yml, porque project.yml é regenerado):

1. Em `iosApp/`:
   ```bash
   cd iosApp
   xcodegen generate
   LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install
   open iosApp.xcworkspace
   ```

2. No Xcode (workspace aberto):
   - Clica no projeto **iosApp** (raiz, ícone azul)
   - Tab **Signing & Capabilities**
   - Toggle **Automatically manage signing** ✅
   - Dropdown **Team** → escolhe **"<Seu Nome> (Personal Team)"**
   - Verifica que **Bundle Identifier** = `com.futebadosparcas` (talvez precise mudar pra `com.<seu-apple-id>.futebadosparcas` se der conflito — Apple não deixa dois Apple IDs distintos usarem o mesmo bundle)

### 3.2 Build framework KMP pra ARM64 device (não simulator)

```bash
cd /Users/renanlocatizfernandes/Code/personal/TechFernandesLTDA/futeba-dos-parcas
./gradlew :shared:linkDebugFrameworkIosArm64
./gradlew :composeApp:linkDebugFrameworkIosArm64
```

> ⚠️ **Importante:** project.yml atual usa `iosSimulatorArm64`. Pra device físico, precisa do `iosArm64`. Posso criar uma config separada no project.yml (`Debug-Device`) — me avisa se quiser.
>
> Por ora, manualmente: no Xcode → Build Settings → Framework Search Paths → adicionar `$(SRCROOT)/../shared/build/bin/iosArm64/debugFramework` no topo da lista quando buildando pra device.

### 3.3 Run

1. No Xcode topo da janela: **Scheme: iosApp** → **Destination: <Seu iPhone>** (não simulator)
2. **Play button** (▶) ou `Cmd+R`
3. Xcode compila, assina com Personal Team, instala no iPhone
4. **Primeira vez:** iPhone vai dizer "Untrusted Developer" — não abre
   - No iPhone: **Settings → General → VPN & Device Management → <Seu Apple ID>** → **Trust** → confirma
   - Volta no app no iPhone → abre OK

---

## Passo 4 — Validação smoke

Quando app abrir, você deve ver:
- Tela placeholder do `ContentView` (smoke test atual)
- Texto vindo do `Platform()` do shared KMP (`"iOS <version>"`)

Se abrir: ✅ pipeline KMP→iOS funciona em device real.

---

## Rebuild semanal

Build expira em **7 dias**. Quando expirar:

1. Conecta iPhone no cabo
2. Xcode → `Cmd+R` (build + run de novo)
3. Trust de novo se mudou cert
4. Pronto

Não tem como evitar sem pagar $99.

---

## Troubleshooting

### "Could not launch <app> because no provisioning profile"
- Xcode → Signing & Capabilities → confirma Team selecionado
- Tenta `Cmd+Shift+K` (Clean Build Folder) → rebuild

### "Bundle ID is already in use by another app"
- Outro Apple ID já usou `com.futebadosparcas` no Personal Team. Mude pra `com.<seu-nome>.futebadosparcas` só pra essa rota grátis. Reverte pra `com.futebadosparcas` quando for fazer setup pago.

### "Device not eligible / could not prepare device"
- iOS muito antigo (< 15)? Atualiza
- Developer Mode OFF? Liga (Settings → Privacy & Security)
- Reinicia iPhone + Xcode

### "Personal Team has reached maximum number of apps"
- Free team limita 3 apps simultâneos com bundle IDs distintos. Apaga apps antigos do Xcode → Devices → "+" → remove

### Framework não encontrado em runtime
- Confirmou que rodou `:shared:linkDebugFrameworkIosArm64` (com Arm64, não SimulatorArm64)?
- Framework Search Paths no Xcode aponta pra `bin/iosArm64/`?

---

## Migrando depois pra TestFlight

Quando decidir pagar os $99:
1. Spec `specs/IOS_TESTFLIGHT_SETUP.md` é o caminho
2. Reverte signing pra `match`
3. Bundle ID volta pra `com.futebadosparcas` (Apple Dev Program)
4. Personal Team some, vira Organization Team

Nenhum trabalho do bootstrap free é desperdiçado — todo o KMP, Pods, project.yml são reaproveitados.

---

## Status

**2026-05-11:** Runbook criado, aguardando primeiro run no iPhone real do Renan.
