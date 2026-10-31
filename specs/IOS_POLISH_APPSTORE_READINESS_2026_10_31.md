# SPEC: Polimento do app iOS e prontidão para a App Store

> **Status:** APPROVED
> **Épico:** #4401 (relacionados: #4395 publicação, #4391 exclusão de conta)
> **Plataforma:** iOS (`composeApp/` Compose Multiplatform + `iosApp/` XcodeGen/CocoaPods)
> **Versão alvo:** iOS 1.8.0 (build 24), alinhada a `versions.json`
> **Data:** 2026-10-31
> **Branch:** `fix/ios-polish-2026-10-31`

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O app de iPhone não chegava a abrir no simulador: o build quebrava no Xcode 27.1
(runtime do Kotlin/Native duplicado) e, depois de linkado, fechava na primeira tela
(recursos do Compose fora do bundle e Firebase instanciado sem configuração). Além
disso faltavam itens obrigatórios da App Store: exclusão de conta dentro do app
(diretriz 5.1.1(v)), manifesto de privacidade e um Info.plist sem permissões órfãs.
Hoje o iOS é só de consulta: várias rotas caem em `UnavailableRouteScreen`.

### 1.2 Casos de Uso

1. Como jogador no iPhone, abro o app e vejo boas-vindas, permissões e login sem crash.
2. Como jogador, excluo minha conta dentro do app, com confirmação dupla, e saio da sessão.
3. Como jogador, saio da conta pelo Perfil com confirmação.
4. Como revisor da Apple, encontro manifesto de privacidade, textos de permissão claros
   e exclusão de conta acessível em até 3 toques a partir do Perfil.

### 1.3 Critérios de Aceite

- [x] `:composeApp:compileKotlinIosSimulatorArm64` e `:composeApp:linkDebugFrameworkIosSimulatorArm64` verdes.
- [x] `xcodebuild` para simulador (`CODE_SIGNING_ALLOWED=NO`) verde, sem warnings novos do projeto.
- [x] App abre no simulador sem `GoogleService-Info.plist` (modo smoke) sem crash.
- [x] `PrivacyInfo.xcprivacy` dentro do `.app`, com as APIs de motivo obrigatório usadas.
- [x] Exclusão de conta com o contrato da callable `deleteAccount` (#4391).
- [x] Nenhuma string ou cor hardcoded nova; IDs internos do Firestore fora da tela.
- [ ] Capturas em claro, escuro e Dynamic Type AX3 de todas as telas (parcial, ver §5.3).

### 1.4 Fora de Escopo

- Assinatura, TestFlight, certificados e envio à App Store.
- Telas de escrita no iOS (confirmar presença, lista de espera, votação, criar jogo):
  ficam no plano de paridade (§4.2) com issues filhas.
- `app/`, `web/`, `functions/`, `firestore.rules`.

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
Perfil (hub) ─┬─ Sair da conta → diálogo "Sair?" → Welcome (pilha limpa)
              └─ Excluir conta → DeleteAccountScreen
                     ├─ marca "Entendi" (confirmação 1)
                     ├─ botão destrutivo → diálogo final (confirmação 2, haptic)
                     ├─ sucesso → logout → Welcome (pilha limpa)
                     ├─ failed-precondition / unauthenticated → "Sair e entrar de novo" → Login
                     ├─ not-found (callable sem deploy) → abre a página web de exclusão
                     └─ erro genérico → "Tentar de novo"
```

### 2.2 Telas e Estados

| Tela | Loading | Empty | Error | Success |
|------|---------|-------|-------|---------|
| DeleteAccountScreen | spinner no botão, voltar desabilitado | n/a (Idle = explicação) | cartão `errorContainer` com ação por motivo, `liveRegion` | navega para Welcome |
| Rotas indisponíveis | `RouteLoadingScreen` | n/a | mensagem amigável + tentar de novo/voltar (FlowRow) | conteúdo |
| Welcome | n/a | n/a | n/a | rola quando não cabe |

### 2.3 Responsividade

iPhone apenas no lançamento (`TARGETED_DEVICE_FAMILY = 1`, DECISIONS 2026-10-31).
A tela de boas-vindas usa `BoxWithConstraints` + `verticalScroll` + `heightIn(min = maxHeight)`:
centraliza quando cabe e rola quando não cabe (Dynamic Type grande).

### 2.4 Acessibilidade

- Exclusão: título com `heading()`, checkbox com `toggleable(role = Checkbox)` e alvo ≥ 48dp,
  erro anunciado por `liveRegion`, botão destrutivo com descrição própria.
- `UnavailableRouteScreen`: mensagem com `liveRegion`, botões em `FlowRow` (não cortam com AX3).
- Ícone de voltar com `cd_back` em vez de texto fixo.

### 2.5 Animações e Micro-interações

Haptic `LongPress` ao abrir a confirmação final da exclusão.

---

## 3. Technical Design

### 3.1 Arquitetura

- `DeleteAccountViewModel(deleteAccount: suspend () -> Result<Unit>, authRepository)` em
  `composeApp/.../ui/account/`. A operação entra como lambda para testar sem Firebase.
- `FirebaseDataSource.deleteAccount()` (mudança mínima no `:shared`): chama a callable
  `deleteAccount` em `southamerica-east1`, sem payload. Erros do GitLive viram
  `CallableException(code)` (`shared/commonMain`), para o `composeApp` reagir ao código.
- Classificação: `failed-precondition`/`unauthenticated` → reautenticar; `not-found` →
  fallback web; resto → genérico.
- Logout só depois do sucesso da callable; a pilha de navegação é limpa
  (`popUpTo(graph.id) { inclusive = true }`) para o gesto de voltar não reabrir a sessão.

### 3.2 Build iOS

- Só o `ComposeApp.framework` é linkado (ele embute o `:shared`). Linkar também o
  `shared.framework` estático duplicava o runtime do Kotlin/Native (1152 símbolos).
- Nova fase "Copiar recursos do Compose" no `project.yml`: roda
  `assembleIos{SimulatorArm64,Arm64}MainResources` e copia para
  `iosApp.app/compose-resources`. Sem ela o app fechava no 1º `stringResource()`.
- Sem `GoogleService-Info.plist`, o Koin do iOS não registra nada que toque o Firebase
  (`isFirebaseConfigured()`), inclusive o repositório de Novidades.

### 3.3 API / Firestore

Callable `deleteAccount` (implementada em paralelo por #4391): sem payload, retorno
`{ success: true }`; erros `unauthenticated`, `failed-precondition`, `not-found`.

### 3.4 Cache e Offline

Sem rede, a callable falha com erro genérico; a tela oferece "Tentar de novo".

### 3.5 Segurança

O ID interno do jogo/grupo não aparece mais na tela nem no texto de compartilhamento.
Mensagens técnicas de exceção não chegam ao usuário.

### 3.6 Performance

Sem impacto mensurável. A fase de recursos é incremental (Gradle up-to-date).

### 3.7 Analytics e Observabilidade

Nada novo neste ciclo.

---

## 4. Achados e plano

### 4.1 Achados

| # | Sev. | Arquivo:linha | Problema | Status |
|---|------|---------------|----------|--------|
| 1 | P0 | `iosApp/project.yml` (dependências) | Link de `shared` + `ComposeApp` estáticos: 1152 símbolos duplicados no Xcode 27.1 | Corrigido (c155c12b) |
| 2 | P0 | `iosApp/project.yml` (fase de recursos) | `MissingResourceException` no 1º `stringResource()`: `.cvr` fora do bundle | Corrigido (5aeffe69) |
| 3 | P0 | `PlatformComposeAppModule.ios.kt` | `FIRIllegalStateException` sem plist (NSException não capturável) | Corrigido (a56db6d9) |
| 4 | P0 | `ReleaseNotesModule.ios.kt:26` | Mesmo crash pelo pop-up de Novidades | Corrigido (5aeffe69) |
| 5 | P0 | App Store 5.1.1(v) | Sem exclusão de conta no app | Corrigido (48b70484), depende do deploy de #4391 |
| 6 | P1 | `iosApp/iosApp/PrivacyInfo.xcprivacy` | Manifesto de privacidade ausente | Corrigido (d7af08fe) |
| 7 | P1 | `iosApp/iosApp/Info.plist` | Permissões órfãs (fotos-adicionar, localização sempre, contatos), chave inexistente, Dynamic Links | Corrigido (d7af08fe) |
| 8 | P1 | `App.kt` (`UnavailableRouteScreen`) | Mostrava "Contexto: <id do Firestore>" e a mensagem bruta da exceção | Corrigido (48b70484) |
| 9 | P1 | `App.kt` | ~20 strings fixas em português fora do `strings.xml` | Corrigido (48b70484) |
| 10 | P1 | `WelcomeScreen.kt:55` | Botão "Começar" cortado; sem rolagem | Corrigido (5aeffe69) |
| 11 | P2 | `strings.xml` (`welcome_onboarding_app_name`, `fcm_channel_name`, `app_guide_start`) | "Parcas"/"Comecar" sem cedilha | Corrigido (5aeffe69) |
| 12 | P2 | `AppleSignInService.swift` (`presentationAnchor`) | Force unwrap e API de janela obsoleta | Corrigido (c155c12b) |
| 13 | P1 | `BlockedPlayersScreen.kt:273`, `InvitePlayersScreen.kt:130` | `AsyncImage` com URL não carrega no iOS: só existe `coil-network-okhttp` (androidMain, `composeApp/build.gradle.kts:98`) | Aberto (issue filha) |
| 14 | P1 | `App.kt:1328` | Bloqueio de jogadores só em preferências locais; diretriz 1.2 pede bloquear e denunciar com efeito no servidor | Aberto (issue filha) |
| 15 | P1 | `App.kt:346` | `onNavigateToRegister` do Login vai para `PROFILE_SETUP`; `RegisterScreen` órfão | Aberto (issue filha) |
| 16 | P2 | `HomeScreen.kt` / `App.kt` | Barra inferior empilha destinos em vez de trocar abas (voltar percorre abas) | Aberto (issue filha) |
| 17 | P2 | (sem arquivo) | Sem universal links: AASA inexistente no hosting e sem handler no app | Aberto (paridade) |
| 18 | P2 | `.github/workflows/ios-build.yml:138-142` | CI ainda linka o `shared.framework` (inofensivo, gasta tempo); job vermelho/cancelado desde 01/10 | Aberto (issue filha) |
| 19 | P3 | `ComposeAppModule.kt:31,35`, `PostGameReportScreen.kt:171`, `WhatsNewContent.kt:95-97` | Deprecações (DSL `viewModel`, `Icons.Filled.Chat`, `kotlinx.datetime.Instant`) | Aberto (issue filha) |
| 20 | P3 | `Info.plist:10` | Nome "Futeba dos Parças" não cabe sob o ícone: o iOS mostra "FutebadosParças" | Aberto (decisão de produto) |
| 21 | P3 | `PostGameReportScreen.kt:63-65` | Cores de medalha fixas (exceção de gamificação permitida) | Aceito |
| 22 | P1 | `iosApp/project.yml` (preBuildScript e `FRAMEWORK_SEARCH_PATHS[sdk=iphoneos*]`) | Archive/Release nunca gera framework de device em Release: o script só roda `linkDebugFrameworkIosSimulatorArm64` e o caminho de device aponta para `iosArm64/debugFramework` | Aberto (#4395) |

### 4.2 Plano de paridade (iOS)

| Item | Esforço | Dependências |
|------|---------|--------------|
| Confirmar/cancelar presença no jogo | M (2-3 d) | `FirebaseDataSource` já tem confirmações; tela + VM + rules existentes |
| Lista de espera (entrar/sair, posição) | M (2 d) | mesma base da presença; Cloud Function de promoção já existe |
| Votação MVP / Bola Murcha | M (3 d) | `voting/mvp-voting.ts`; rota hoje em `UnavailableRouteScreen` |
| Criar jogo (organizador) | G (5-8 d) | formulário, local, horário, validações; maior tela |
| Exclusão de conta | Feito no app (P) | deploy da callable #4391 |
| Universal links + AASA | P/M (1-2 d) | associated domains no entitlements, AASA no hosting (`web/`), handler no `iosApp` |
| Imagens de rede no iOS (coil ktor) | P (0,5 d) | `coil-network-ktor3` + engine Darwin em `iosMain` |
| Bloquear e denunciar no servidor | M (2-3 d) | coleção/rules + callable de denúncia (fora do escopo iOS) |

---

## 5. Verification (Verificação)

### 5.1 Testes

- `./gradlew --max-workers=3 :shared:compileKotlinIosSimulatorArm64 :composeApp:compileKotlinIosSimulatorArm64` verde.
- `./gradlew :shared:compileDebugKotlinAndroid :shared:compileNativeAndAndroidMainKotlinMetadata` verde (o actual é compartilhado com o Android).
- `./gradlew :composeApp:linkDebugFrameworkIosSimulatorArm64` verde.
- `xcodebuild ... CODE_SIGNING_ALLOWED=NO SKIP_KMP_BUILD=YES build` → `BUILD SUCCEEDED`.
- `composeApp` não tem source set de teste; o `classify` do VM fica coberto pela issue de testes.
- **A exclusão de conta foi verificada só por compilação.** Sem `GoogleService-Info.plist`
  a rota `delete_account` cai no estado "indisponível" e o Perfil exige login; as duas
  confirmações, o mapeamento de erros e o logout com pilha limpa ainda não rodaram.
  QA com Firebase real fica para depois do deploy de #4391.
- O `ComposeApp.framework` é estático (`ar archive`) e entra no binário do app no link.
  O `embed: true` copiava um stub vazio de 33 KB para `Frameworks/`; agora `embed: false`
  (24a23688). Build verde depois da troca; não reaberto no simulador (travado), mas o
  `otool -L` do app já não listava o ComposeApp, então nada em runtime dependia da cópia.
- O `xcodebuild` final avisou "CoreSimulator is out of date (1174.9.2 < 1174.21.0)": o
  serviço do simulador ficou desatualizado em relação ao Xcode, provável causa dos travamentos.

### 5.2 Checklist de Revisão

- [x] Sem cores hardcoded novas (usa `colorScheme.error/onError/errorContainer`)
- [x] Sem strings hardcoded novas
- [x] Comentários em PT-BR
- [x] Touch targets ≥ 48dp nas ações novas
- [x] Estados loading/error/success na exclusão

### 5.3 Demo

Capturas no scratchpad da sessão (`shots/`): boas-vindas em claro antes e depois da
correção do botão. **Escuro e Dynamic Type AX3 não foram entregues:** o
`simctl io screenshot` travou logo depois de trocar a aparência, e nem `simctl shutdown`
respondeu após reiniciar o CoreSimulatorService (RAM do Mac em ~128 MB livres com outros
builds rodando). Ficam para a issue de QA visual.

---

## 6. Checklist da App Store

| Item | Estado |
|------|--------|
| Exclusão de conta no app (5.1.1(v)) | Feito no app; depende do deploy de `deleteAccount` (#4391). Enquanto `not-found`, a tela abre a página web |
| `PrivacyInfo.xcprivacy` (APIs de motivo obrigatório + dados coletados) | Feito |
| Textos de uso de câmera, fotos, localização | Feito (formato "O Futeba dos Parças usa ... para ...") |
| `ITSAppUsesNonExemptEncryption = false` | Feito |
| ATS sem exceções | OK (`NSAllowsArbitraryLoads = false`) |
| Ícone 1024 e AppIcon iPhone | OK; iPad fora (iPhone-only) |
| Launch screen | OK (`UILaunchScreen` com `AccentColor`) |
| Versão 1.8.0 (24) = `versions.json` | OK |
| Push (aps-environment por config) | OK |
| Associated domains / universal links | Pendente (§4.2) |
| Sign in with Apple (exigido por haver Google Sign-In) | Presente (`AppleSignInService`) |
| Bloquear e denunciar conteúdo de usuários (1.2) | Pendente (achado 14) |
| Assinatura, TestFlight, metadados e capturas da loja | Fora do escopo (#4395) |

---

## Histórico de Alterações

| Data | Autor | Mudança |
|------|-------|---------|
| 2026-10-31 | Agente iOS (#4401) | Criação, status APPROVED |
