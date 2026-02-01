# Próximos Passos - iOS Development

**Status Atual:** FASE 1 Completa ✅
**Data:** 2026-02-01

---

## ✅ FASE 1 - Completa (Windows)

### O que foi feito:

1. **Estrutura iOS criada**
   - iosApp/ com Swift files
   - Firebase bridges (Auth, Firestore, Storage)
   - Serviços nativos (Location, Apple Sign-In, Push)

2. **Módulo Compose Multiplatform**
   - composeApp/ com targets Android + iOS
   - UI compartilhada (Theme, SplashScreen)
   - Build.gradle.kts configurado

3. **CI/CD Configurado**
   - GitHub Actions workflow para build iOS
   - Builds automáticos em cada push
   - Artefatos disponíveis para download

4. **Shared Framework iOS**
   - Compilado e testado no Windows
   - Localização: `shared/build/bin/iosSimulatorArm64/debugFramework/`

### Comandos úteis:

```bash
# Build shared framework
./gradlew :shared:linkDebugFrameworkIosSimulatorArm64  # Simulator
./gradlew :shared:linkDebugFrameworkIosArm64           # Device

# Verificar compilação
./gradlew :composeApp:compileDebugKotlinIosSimulatorArm64
```

---

## 🎯 FASE 2 - Próxima (Mac/Cloud)

### Opções para Build iOS:

#### Opção A: GitHub Actions (Grátis - RECOMENDADO)
- ✅ Já configurado no repositório
- ✅ Builds automáticos a cada commit
- ✅ 2000 minutos/mês grátis (repos públicos)
- ⚠️ Não permite rodar/debug interativo

**Como usar:**
1. Fazer push para master/feature branch
2. Ver progresso em: https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions
3. Baixar artefatos (frameworks compilados)

#### Opção B: MacinCloud Trial (30 dias grátis)
- Site: https://www.macincloud.com
- Plano: Managed Server (Free Trial)
- Permite: Xcode completo, simuladores, testes

**Setup:**
1. Criar conta gratuita
2. Acessar Mac via VNC
3. Clonar repo: `git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git`
4. Seguir `iosApp/SETUP.md`

#### Opção C: Mac Emprestado/Lab
- Universidade, coworking, amigo
- Apenas para setup inicial do Xcode
- Depois manter via CI/CD

---

## 📋 Setup no Mac (Quando Disponível)

### 1. Pré-requisitos

```bash
# Instalar Xcode da App Store (versão 15.4+)
# Instalar CocoaPods
sudo gem install cocoapods

# Instalar Homebrew (se não tiver)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Clone e Setup

```bash
# Clone do repositório
git clone https://github.com/TechFernandesLTDA/futeba-dos-parcas.git
cd futeba-dos-parcas

# Build shared framework
./iosApp/build_shared.sh

# Instalar pods Firebase
cd iosApp
pod install
```

### 3. Firebase Setup

1. Ir para [Firebase Console](https://console.firebase.google.com)
2. Abrir projeto "Futeba dos Parças"
3. Adicionar app iOS:
   - Bundle ID: `com.futebadosparcas.ios`
   - Nickname: "Futeba iOS"
4. Baixar `GoogleService-Info.plist`
5. Arrastar para `iosApp/iosApp/` no Xcode

### 4. Xcode Configuration

Seguir instruções detalhadas em `iosApp/SETUP.md`:
- Build settings
- Capabilities (Push, Sign in with Apple, Location)
- Provisioning profiles
- Signing certificates

### 5. Primeiro Build

```bash
# Abrir workspace (NÃO o .xcodeproj!)
open iosApp/iosApp.xcworkspace

# No Xcode:
# 1. Selecionar target "iosApp"
# 2. Selecionar simulador (iPhone 15 Pro)
# 3. Cmd+R para rodar
```

---

## 🚀 Publicação na App Store

### Requisitos:

- [ ] Apple Developer Account ($99/ano)
- [ ] App Store Connect configurado
- [ ] Certificados de distribuição
- [ ] Screenshots (6.7", 5.5", iPad)
- [ ] Ícones do app (todos os tamanhos)
- [ ] Privacy Policy URL: https://futebadosparcas.web.app/privacy_policy.html
- [ ] Terms of Service URL: https://futebadosparcas.web.app/terms_of_service.html

### Checklist Pré-Publicação:

- [ ] Testar em iPhone real
- [ ] Testar em iPad
- [ ] Testar Dark Mode
- [ ] Testar Login com Apple
- [ ] Testar Push Notifications
- [ ] Verificar vazamentos de memória
- [ ] TestFlight beta (10-20 testadores)
- [ ] Aprovação no App Review

### Comando para Build de Release:

```bash
# Via Xcode
# Product → Archive
# Distribute App → App Store Connect

# Via CLI (para CI/CD)
xcodebuild -workspace iosApp/iosApp.xcworkspace \
           -scheme iosApp \
           -configuration Release \
           -archivePath build/iosApp.xcarchive \
           archive

xcodebuild -exportArchive \
           -archivePath build/iosApp.xcarchive \
           -exportPath build/ \
           -exportOptionsPlist ExportOptions.plist
```

---

## 🔧 Troubleshooting

### Erro: "shared.framework not found"
```bash
# Rebuild framework
./iosApp/build_shared.sh
```

### Erro: "No such module 'FirebaseCore'"
```bash
# Reinstalar pods
cd iosApp
pod deintegrate
pod install
```

### Erro: "Code signing required"
```bash
# No Xcode: Signing & Capabilities
# Selecionar seu Team
# Ou desabilitar signing para testes locais
```

### Build CI/CD falhando
```bash
# Ver logs em:
https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions

# Verificar se Xcode version match
# Verificar se pods estão atualizados
```

---

## 📊 Monitoramento

### GitHub Actions
- Ver builds: https://github.com/TechFernandesLTDA/futeba-dos-parcas/actions
- Baixar frameworks compilados em "Artifacts"

### Firebase Console
- Analytics iOS: https://console.firebase.google.com
- Crashlytics (quando ativo)
- Performance Monitoring

### App Store Connect
- TestFlight: https://appstoreconnect.apple.com
- Crash reports
- User reviews

---

## 💡 Dicas

1. **Desenvolvimento incremental**: Testar features no Android primeiro, depois adaptar para iOS
2. **Usar simulador**: 90% do desenvolvimento pode ser feito no simulador
3. **TestFlight**: Beta test antes de produção
4. **CI/CD**: Deixar GitHub Actions validar builds
5. **Shared code**: Máximo de código em `shared/commonMain/`

---

## 📞 Suporte

- **Spec detalhada**: `/specs/SPEC_IOS_KMP_DEVELOPMENT.md`
- **Setup Xcode**: `/iosApp/SETUP.md`
- **Decisions log**: `/specs/DECISIONS.md`
- **Issues**: https://github.com/TechFernandesLTDA/futeba-dos-parcas/issues

---

**Última Atualização:** 2026-02-01
**Versão:** 1.7.2 (Android) | 1.0.0 (iOS - em desenvolvimento)
