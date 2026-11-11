# Monetização: anúncios e assinatura "Sem anúncios"

Decisão de 11/11/2026 (Renan): todos os apps TECHFERNANDES saem em Android, web e iOS com monetização. No Futeba dos Parças: **banner AdMob + assinatura anual `sem_anuncios_anual`** (R$ 9,90 por ano, mesmo modelo do Cuidia, Repia e Rotia) e **AdSense na web**. Este documento descreve o que está no código (fase 1, branch `feat/admob-sem-anuncios`) e o que falta para ligar (fase 2).

Nada disso está publicado: sem envio às lojas, sem deploy da web, sem merge.

## Como funciona

| Regra | Onde | Teste |
|---|---|---|
| Banner só em telas da **lista de permissão** (raízes: home, games, players, league, groups, ranking, profile). Tela nova nasce sem banner. Segunda trava: rota com `payment`, `pix`, `cashbox`, `login`, `onboarding`, `live`, `admin`, `owner`, `delete`, `error`... nunca mostra | `shared/.../domain/monetization/AdsPolicy.kt` | `MonetizationTest`, `app/.../AdsRoutesPolicyTest` (rotas reais do Android) |
| Assinante: SDK nem inicia, sem UMP, sem ATT, banner some | `AdsGate.shouldStartAds` | `MonetizationTest`, `MonetizationControllerTest` |
| **Primeira vitória** antes de qualquer SDK/consentimento/ATT: primeira presença confirmada ou primeiro jogo criado (Android: `MonetizationEvents.firstWin()` nos ViewModels; iOS: `MonetizationHolder.onFirstWin()` no `App.kt`) | `AdsState` | idem |
| Sem ID de unidade na config de build: nada inicia | `AdsConfig.unitConfigured` / `AdsBridge.unitConfigured` | idem |
| Direito "Sem anúncios": **só a loja respondendo "não há assinatura nossa" revoga**. Loja indisponível, pendente ou erro nunca revoga; pagamento suspenso revoga | `AdsFreeEntitlement` (porte do `compras.ts` do Cuidia) | `AdsFreeEntitlementTest` |
| Anúncios **sempre não personalizados** (`ALLOW_PERSONALIZED_ADS = false`), ver "Decisão para o Renan" | `MonetizationConfig` | `MonetizationTest` |

Código: regras em `shared/src/commonMain/kotlin/com/futebadosparcas/domain/monetization/`; Android em `app/src/main/java/com/futebadosparcas/monetization/` (AdMob + UMP + Play Billing, `AdBannerHost` dentro do `MainScreen`, tela `RemoveAdsScreen` aberta por Preferências); iOS em `composeApp/.../compose/monetization/` (Kotlin: controller, tela, ponte) e `iosApp/iosApp/Services/AdsService.swift` + `StoreService.swift` (Google Mobile Ads, UMP, ATT, StoreKit 2).

### Primeira vitória no iOS e no Android
O app nativo Android e o app iOS (Compose Multiplatform) são telas diferentes; cada um chama o mesmo gatilho. O estado fica no aparelho (`PreferencesService`: SharedPreferences no Android, NSUserDefaults no iOS) e não guarda dado pessoal.

### Ordem no iOS (depois da primeira vitória, sem assinatura)
1. Formulário de consentimento do Google (UMP), só onde a região exige (no Brasil o Google costuma responder "não exigido").
2. Pedido de rastreamento (ATT), com folga de 0,5 s e só com o app ativo.
3. `MobileAds.start`. Recusar o ATT: anúncios não personalizados (já são, sempre).

## IDs e config de build (a preencher na fase 2)

O app **ainda não existe no AdMob**. IDs não são segredo, mas ficam fora do código até existirem.

| | Debug | Release |
|---|---|---|
| Android | IDs de TESTE do Google (app `ca-app-pub-3940256099942544~3347511713`, banner adaptativo `.../9214589741`) | `ADMOB_APP_ID` e `ADMOB_BANNER_UNIT_ID` em `local.properties` ou variável de ambiente. Vazio: usa o ID de app de teste (evita o crash do SDK sem `APPLICATION_ID`) e **sem unidade, sem SDK e sem banner**. Não há trava de release que falhe sem eles (isso derrubaria os workflows `self-hosted` existentes) |
| iOS | IDs de TESTE do Google (`ca-app-pub-3940256099942544~1458002511`, banner `.../2435281174`) no `project.yml` | `ADMOB_APP_ID` e `ADMOB_BANNER_UNIT_ID` na linha de comando do archive ou num xcconfig local. Vazio: nada inicia |
| Web | `VITE_ADSENSE_PUBLISHER_ID`, `VITE_ADSENSE_SLOT_BANNER`, `VITE_ADSENSE_NON_PERSONALIZED` (padrão 1) em `web/.env.example`; sem valor, nenhum script do AdSense carrega | idem |

Nunca clique nos próprios anúncios reais (o AdMob pode suspender a conta). Em aparelho de teste use os IDs de teste.

## Assinatura `sem_anuncios_anual`

- Produto de assinatura com o mesmo ID no Google Play e na App Store, plano básico `anual` no Play, R$ 9,90 por ano, renovação automática. O preço mostrado na tela é sempre o que a loja devolve.
- Android: Play Billing 9.1.0. Compra, "Restaurar compra" (relê as assinaturas da conta), confirmação (acknowledge) da compra paga e não confirmada (senão o Google estorna em 3 dias), "Gerenciar assinatura" (abre a tela de assinaturas do Play), conferência na abertura.
- iOS: StoreKit 2 (`Product`, `Transaction.currentEntitlements`, `Transaction.updates`, `AppStore.sync`, `showManageSubscriptions`).
- Textos da diretriz 3.1.2 da Apple na tela: nome e duração, preço por ano, cobrança na conta Apple, renovação automática, cancelamento até 24 h antes, onde cancelar, link de Termos de uso (EULA padrão da Apple) e Política de privacidade, mais "Restaurar compra".
- A assinatura é local à loja: **não há validação no servidor**. Assinante do celular ainda vê anúncio na web (limitação; ver o ponto de extensão `useAdsFree()` em `web/src/config/ads.ts`). Validar no servidor exigiria Cloud Function com a Play Developer API e a App Store Server API, com credenciais: fica para depois.

### Apple 3.1.1: a cobrança B2B de quadras
Conclusão: **não é atingida**, sob duas condições que valem hoje:
1. A mensalidade da quadra (`docs/VENUE_MONETIZATION.md`) é um contrato comercial com uma empresa (dono da quadra), cobrado e faturado **fora do app**, pelo CRM e pelo admin; o app não vende nem desbloqueia nada por pagamento dentro dele (regras do Firestore negam escrita de cliente em `venue_accounts`). É o caso de serviços para empresas, diretriz 3.1.3(c), e o que se consome fora do app, 3.1.3(e).
2. O Pix entre jogadores e a caixa do grupo pagam a **quadra e a pelada**, um serviço físico consumido fora do app (3.1.3(e)); não é conteúdo digital.

Se o iOS passar a exibir **preço, botão ou link para pagar** a mensalidade da quadra, ou se desbloquear no app um recurso digital pago, a conclusão muda: aí a compra tem de ser pelo app (IAP) ou usar o enquadramento 3.1.3(c) com cuidado. Hoje o iOS não tem nenhuma tela de cobrança de quadra. O Android pode manter a cobrança como está.

## Decisão para o Renan: anúncios não personalizados

O app aceita contas de **13 a 17 anos** e a política de privacidade promete "sem publicidade direcionada" para menores (LGPD art. 14; Estatuto Digital da Criança e do Adolescente, Lei 15.211/2025). A data de nascimento é opcional e a idade não é verificada. Por isso `ALLOW_PERSONALIZED_ADS = false`: todo pedido de anúncio é não personalizado (Android: `npa=1`; iOS: `npa=1`; web: `requestNonPersonalizedAds = 1`). Reduz o valor do anúncio. Liberar personalizado exige verificação de idade e revisão jurídica. O pedido de ATT continua como combinado (depois da primeira vitória), mesmo sem personalização.

## Privacidade e declarações das lojas (rascunho, para a fase 2)

### Política de privacidade
`web/public/privacy_policy.html` está em **rascunho v2.1** (anúncios, AdSense, assinatura, Google/lojas como operadores, "sempre não personalizados"). Só vale quando a web for implantada (fase 2): conferir a redação e atualizar a data de vigência no topo.

### Google Play: segurança dos dados (Data safety)
Acrescentar ao que já está declarado:
- **Identificadores do dispositivo ou outros IDs**: coletado e **compartilhado** (Google AdMob). Finalidade: publicidade ou marketing; prevenção de fraude. Não opcional (o SDK usa), criptografado em trânsito.
- **Informações do app e desempenho / interações com o app**: já declaradas por Analytics e Crashlytics; incluir "publicidade" na finalidade se o Google AdMob usar.
- **Compras**: o app **não** coleta histórico de compras (a Play processa o pagamento); não marcar como dado coletado.
- Aviso: se o AdMob compartilha o ID de publicidade com terceiros, declarar "compartilhado".

### Google Play: declarações
- **Anúncios**: "O app contém anúncios: Sim".
- **ID de publicidade (AD_ID)**: a permissão `com.google.android.gms.permission.AD_ID` agora **está no manifesto** (antes era removida). Declarar "o app usa o ID de publicidade", finalidade "publicidade ou marketing". Sem a declaração a Play rejeita o envio.
- Público-alvo: já exclui crianças (13+). Não marcar como "para crianças".
- Produto de assinatura `sem_anuncios_anual` (plano `anual`, R$ 9,90) criado e ativado.

### App Store Connect: privacidade (rótulos)
Acrescentar:
- **Identificadores > ID do dispositivo**: usado para **publicidade de terceiros**, **vinculado a você: não**, **usado para rastreamento: sim** (o SDK do Google; por isso o ATT).
- **Dados de uso > Interação com o produto / Dados de publicidade**: publicidade de terceiros, não vinculado, rastreamento: sim.
- **Compras**: não declarar como coletado (StoreKit; a Tech Fernandes não recebe histórico).
- `PrivacyInfo.xcprivacy` do app: `NSPrivacyTracking` continua `false` e sem `NSPrivacyTrackingDomains` (o SDK do Google se declara; listar domínios faria o iPhone bloqueá-los para quem recusa o ATT). Mesma decisão do Cuidia.
- Assinatura `sem_anuncios_anual` no grupo "Sem anúncios", ID idêntico ao do Play, anexada à versão que sai com ela.

## iOS: o que falta para o TestFlight (levantado em 11/11/2026)

Conferido no repositório:

| Item | Situação |
|---|---|
| Bundle `com.futebadosparcas` | `project.yml` e `Info.plist` ok |
| Team ID `8HMZ5L98YQ` | **Ajustado neste PR**: `DEVELOPMENT_TEAM` estava vazio no `project.yml` |
| Push | `aps-environment` no `.entitlements` (`APS_ENVIRONMENT` por configuração), `UIBackgroundModes` não necessário para push visível. **Falta**: chave APNs (.p8) enviada ao Firebase (fase 2, Renan) |
| Sign in with Apple | **Não é exigido hoje**: o login do iOS é só e-mail e senha (o botão Google responde "indisponível", `onGoogleSignInUnavailable`). O `AppleSignInService.swift` existe mas **não está ligado** a nenhuma tela e o `.entitlements` não tem `com.apple.developer.applesignin`. Se o login Google for habilitado no iOS, a diretriz 4.8 exige Sign in with Apple: ligar o serviço, acrescentar o entitlement e a capability no App ID. Já o Google Sign-In também precisa do esquema reverso do client ID em `CFBundleURLTypes` (hoje só há o bundle ID) |
| Anúncios/assinatura | `GADApplicationIdentifier`, `NSUserTrackingUsageDescription`, `SKAdNetworkItems` (50, mesma lista do Cuidia) no `Info.plist`; pod `Google-Mobile-Ads-SDK ~> 13.11` no `Podfile` |
| Assinatura de código | Archive sem assinar (`CODE_SIGNING_ALLOWED=NO`) e assinar na exportação com `-allowProvisioningUpdates`, `method app-store-connect`, `teamID 8HMZ5L98YQ`, como no `docs/app-store.md` do Cuidia; o Xcode cria o certificado Apple Distribution e o perfil. A conta da empresa precisa estar logada no Xcode |
| `GoogleService-Info.plist` | **Ausente do repositório** (modo smoke-test: Firebase desligado). O build para TestFlight precisa dele (Bitwarden, `futeba / web env` e config do Firebase), senão login, Firestore e push não funcionam |
| Versão | iOS 1.10.0 (26) neste PR; conferir que o build não repete número já enviado |
| Fastlane | `fastlane/Fastfile` e `Appfile` só têm lanes **Android** (Play); não há lane iOS. O envio ao TestFlight é pelo Xcode/`xcodebuild -exportArchive`. Se quiser lane: `build_app` + `upload_to_testflight` com chave da API da App Store Connect (segredo no Bitwarden; não criado aqui) |
| Specs | `specs/IOS_TESTFLIGHT_SETUP.md` segue válido para os passos de conta e certificados; este documento acrescenta o que mudou com a monetização |
| Simulador | Fase 2: a compra só funciona com StoreKit configurado (arquivo `.storekit` no Run do Xcode) ou no TestFlight com testador sandbox |

## Fase 2: ligar de verdade

Ver o relatório do PR: criar app e unidades no AdMob (Android e iOS), preencher os IDs, produto de assinatura na Play e na App Store, declarações, AdSense (site, bloco, `ads.txt`), deploy da web e envios às lojas. Nada disso foi feito nesta fase.

## Como testar sem publicar
- Android debug: `./gradlew :app:assembleDebug`; o banner de teste aparece depois de confirmar presença ou criar um jogo; compra só em build instalada pela Play (faixa de teste interno).
- Regras: `./gradlew :shared:testDebugUnitTest --tests "*monetization*" :app:testDebugUnitTest --tests "*AdsRoutesPolicyTest*" :composeApp:testDebugUnitTest --tests "*monetization*"`.
- Web: `cd web && npx vitest run src/components/ads`.
