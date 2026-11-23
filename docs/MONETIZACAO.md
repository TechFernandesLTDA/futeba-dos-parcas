# Monetização: anúncios e assinatura "Sem anúncios"

Decisão de 11/11/2026 (Renan): todos os apps TECHFERNANDES saem em Android, web e iOS com monetização. No Futeba dos Parças: banner AdMob no Android e no iOS, assinatura anual "Sem anúncios" e, no futuro, AdSense na web.

Situação em 22/11/2026 (horário de Brasília):

| Frente | Estado |
|---|---|
| iOS | 1.11.0 (build 31) na App Store, publicada em 22/11/2026, 15:30. A ficha já cita banners e a assinatura por R$ 9,90. |
| Android em produção | 1.43.6. Ainda não tem banners nem assinatura. A ficha pública do Play, de propósito, não cita os dois. |
| Android na trilha interna | 1.45.0 (build 96), com as artes da pelada, AdMob e a assinatura. Subiu em 21/11/2026. Falta testar a compra com conta Google testadora e o rollout para produção (5%, 20%, 50% e 100%). |
| Assinatura no Play | Produto `sem_anuncios_anual`, plano básico `anual`, criado e ativado em 21/11/2026. No Brasil: R$ 9,99. |
| Assinatura na App Store | Produto `futeba_sem_anuncios_anual`. No Brasil: R$ 9,90. |
| Web | Sem AdSense no ar. A política de privacidade v2.1 (em vigor desde 14/11/2026) diz que a versão web não mostra anúncios. |
| Política de privacidade | https://futebadosparcas.com.br/privacy_policy.html, v2.1, já cita AdMob e a assinatura. |

A ficha do Google Play só deve passar a citar anúncios e a assinatura quando a 1.45.0 estiver em produção. O texto proposto para a ficha fica em `docs/lojas/google-play/ficha.md` e em `docs/lojas/google-play/textos/descricao-completa.txt`, quando o Renan autorizar o commit.

## Como funciona

| Regra | Onde | Teste |
|---|---|---|
| Banner só em telas da lista de permissão (raízes: home, games, players, league, groups, ranking, profile). Tela nova nasce sem banner. Segunda trava: rota com `payment`, `pix`, `cashbox`, `login`, `onboarding`, `live`, `admin`, `owner`, `delete`, `error` nunca mostra | `shared/.../domain/monetization/AdsPolicy.kt` | `MonetizationTest`, `app/.../AdsRoutesPolicyTest` (rotas reais do Android) |
| Assinante: SDK nem inicia, sem UMP, sem ATT, banner some | `AdsGate.shouldStartAds` | `MonetizationTest`, `MonetizationControllerTest` |
| Primeira vitória antes de qualquer SDK, consentimento ou ATT: primeira presença confirmada ou primeiro jogo criado (Android: `MonetizationEvents.firstWin()` nos ViewModels; iOS: `MonetizationHolder.onFirstWin()` no `App.kt`) | `AdsState` | idem |
| Sem ID de unidade na config de build: nada inicia | `AdsConfig.unitConfigured` / `AdsBridge.unitConfigured` | idem |
| Direito "Sem anúncios": só a loja respondendo "não há assinatura nossa" revoga. Loja indisponível, pendente ou erro nunca revoga; pagamento suspenso revoga | `AdsFreeEntitlement` (porte do `compras.ts` do Cuidia) | `AdsFreeEntitlementTest` |
| Anúncios sempre não personalizados (`ALLOW_PERSONALIZED_ADS = false`), ver a seção "Decisão para o Renan" | `MonetizationConfig` | `MonetizationTest` |

Código: regras em `shared/src/commonMain/kotlin/com/futebadosparcas/domain/monetization/`; Android em `app/src/main/java/com/futebadosparcas/monetization/` (AdMob, UMP e Play Billing, `AdBannerHost` dentro do `MainScreen`, tela `RemoveAdsScreen` aberta por Preferências); iOS em `composeApp/.../compose/monetization/` (Kotlin: controller, tela, ponte) e `iosApp/iosApp/Services/AdsService.swift` e `StoreService.swift` (Google Mobile Ads, UMP, StoreKit 2; sem ATT).

### Primeira vitória no iOS e no Android

O app nativo Android e o app iOS (Compose Multiplatform) são telas diferentes; cada um chama o mesmo gatilho. O estado fica no aparelho (`PreferencesService`: SharedPreferences no Android, NSUserDefaults no iOS) e não guarda dado pessoal.

### Ordem no iOS (depois da primeira vitória, sem assinatura)

1. Formulário de consentimento do Google (UMP), só onde a região exige (no Brasil o Google costuma responder "não exigido").
2. `MobileAds.start`. O iOS não pede ATT (decisão de 11/11/2026): sem `NSUserTrackingUsageDescription` usada para rastreamento, sem pedido de App Tracking Transparency. Os anúncios são sempre não personalizados (`npa=1`).

## IDs e config de build

Os IDs de app e de unidade do AdMob não são segredo, mas ficam na config de build, não neste documento.

| | Debug | Release |
|---|---|---|
| Android | IDs de teste do Google (app `ca-app-pub-3940256099942544~3347511713`, banner adaptativo `.../9214589741`) | `ADMOB_APP_ID` e `ADMOB_BANNER_UNIT_ID` em `local.properties` ou variável de ambiente. Vazio: usa o ID de app de teste (evita o crash do SDK sem `APPLICATION_ID`) e, sem unidade, sem SDK e sem banner. A task `checkAdmobReleaseConfig` (antes de `preReleaseBuild`) falha o release sem os dois IDs. Os workflows `deploy-production`, `deploy-beta` e `release` leem as variáveis do repositório `ADMOB_APP_ID` e `ADMOB_BANNER_UNIT_ID`; para gerar de propósito um release sem anúncios, defina `ADMOB_ALLOW_EMPTY=true`. Sem unidade configurada, a entrada "Remover anúncios" some das Preferências (só o assinante continua vendo, para gerenciar), regra `AdsGate.shouldOfferRemoveAds` |
| iOS | IDs de teste do Google (`ca-app-pub-3940256099942544~1458002511`, banner `.../2435281174`) no `project.yml` | `ADMOB_APP_ID` e `ADMOB_BANNER_UNIT_ID` na linha de comando do archive ou num xcconfig local. Vazio: nada inicia |
| Web | `VITE_ADSENSE_PUBLISHER_ID`, `VITE_ADSENSE_SLOT_BANNER`, `VITE_ADSENSE_NON_PERSONALIZED` (padrão 1) em `web/.env.example`; sem valor, nenhum script do AdSense carrega | idem |

Nunca clique nos próprios anúncios reais (o AdMob pode suspender a conta). Em aparelho de teste, use os IDs de teste.

## Assinatura "Sem anúncios"

- Google Play: produto `sem_anuncios_anual`, plano básico `anual`, renovação automática. No Brasil: R$ 9,99 por ano.
- App Store: produto `futeba_sem_anuncios_anual` (a App Store Connect não deixa reusar, na mesma conta Apple, o ID `sem_anuncios_anual` que já é do Cuidia). No Brasil: R$ 9,90 por ano.
- O preço mostrado na tela é sempre o que a loja devolve. Constante de referência no código: `MonetizationConfig.PRECO_REFERENCIA_BRL = "R$ 9,90"`. Isso não substitui o valor da loja.
- Android: Play Billing 9.1.0. Compra, "Restaurar compra" (relê as assinaturas da conta), confirmação (acknowledge) da compra paga e não confirmada (senão o Google estorna em 3 dias), "Gerenciar assinatura" (abre a tela de assinaturas do Play), conferência na abertura.
- iOS: StoreKit 2 (`Product`, `Transaction.currentEntitlements`, `Transaction.updates`, `AppStore.sync`, `showManageSubscriptions`).
- Textos da diretriz 3.1.2 da Apple na tela: nome e duração, preço por ano, cobrança na conta Apple, renovação automática, cancelamento até 24 horas antes, onde cancelar, link de Termos de uso (EULA padrão da Apple) e Política de privacidade, mais "Restaurar compra".
- A assinatura é local à loja: não há validação no servidor. Assinante do celular ainda vê anúncio na web, quando o AdSense for ligado (limitação; ver o ponto de extensão `useAdsFree()` em `web/src/config/ads.ts`). Validar no servidor exigiria Cloud Function com a Play Developer API e a App Store Server API, com credenciais: fica para depois.

### Por que R$ 9,99 no Play e R$ 9,90 no iOS

Cada loja tem a sua tabela de preços. A Apple aceita R$ 9,90. Ao criar o produto do Futeba no Play em 21/11/2026, a loja arredondou e não aceitou R$ 9,90; o valor no Brasil ficou R$ 9,99.

Decisão de 22/11/2026 (Renan): a diferença de 9 centavos foi aceita. Os preços ficam R$ 9,99 no Google Play e R$ 9,90 na App Store, sem alteração. Tentar de novo o R$ 9,90 no Play já foi recusado. Subir o iOS para R$ 9,99 deixaria a App Store mais cara. Cada ficha deve citar o preço daquela loja.

### Apple 3.1.1: a cobrança B2B de quadras

Conclusão: não é atingida, sob duas condições que valem hoje:

1. A mensalidade da quadra (`docs/VENUE_MONETIZATION.md`) é um contrato comercial com uma empresa (dono da quadra), cobrado e faturado fora do app, pelo CRM e pelo admin; o app não vende nem desbloqueia nada por pagamento dentro dele (regras do Firestore negam escrita de cliente em `venue_accounts`). É o caso de serviços para empresas, diretriz 3.1.3(c), e o que se consome fora do app, 3.1.3(e).
2. O Pix entre jogadores e a caixa do grupo pagam a quadra e a pelada, um serviço físico consumido fora do app (3.1.3(e)); não é conteúdo digital.

Se o iOS passar a exibir preço, botão ou link para pagar a mensalidade da quadra, ou se desbloquear no app um recurso digital pago, a conclusão muda: aí a compra tem de ser pelo app (IAP) ou usar o enquadramento 3.1.3(c) com cuidado. Hoje o iOS não tem nenhuma tela de cobrança de quadra. O Android pode manter a cobrança como está.

## Decisão para o Renan: anúncios não personalizados

O app aceita contas de 13 a 17 anos e a política de privacidade promete "sem publicidade direcionada" para menores (LGPD art. 14; Estatuto Digital da Criança e do Adolescente, Lei 15.211/2025). A data de nascimento é opcional e a idade não é verificada. Por isso `ALLOW_PERSONALIZED_ADS = false`: todo pedido de anúncio é não personalizado (Android: `npa=1`; iOS: `npa=1`; web: `requestNonPersonalizedAds = 1`). Isso reduz o valor do anúncio. Liberar anúncio personalizado exige verificação de idade e revisão jurídica. No iOS não há pedido de ATT.

## Privacidade e declarações das lojas

### Política de privacidade

`web/public/privacy_policy.html` é a v2.1 (vigência 14/11/2026) e já está no ar em https://futebadosparcas.com.br/privacy_policy.html: anúncios do AdMob no Android e no iPhone (sem ATT, sempre não personalizados), assinatura, Google e lojas como operadores. A política diz que a versão web não mostra anúncios. Quando o AdSense da web for ligado, a política precisa ser atualizada antes do deploy.

### Google Play: segurança dos dados (Data safety)

Acrescentar ao que já está declarado, se ainda não estiver, quando a 1.45.0 for para produção:

- Identificadores do dispositivo ou outros IDs: coletado e compartilhado (Google AdMob). Finalidade: publicidade ou marketing; prevenção de fraude. Não opcional (o SDK usa), criptografado em trânsito.
- Informações do app e desempenho / interações com o app: já declaradas por Analytics e Crashlytics; incluir "publicidade" na finalidade se o Google AdMob usar.
- Compras: o app não coleta histórico de compras (a Play processa o pagamento); não marcar como dado coletado.
- Aviso: se o AdMob compartilha o ID de publicidade com terceiros, declarar "compartilhado".

A página pública da 1.43.6, em 22/11/2026, ainda declara identificadores do dispositivo compartilhados, e diz que os dados não são criptografados. Isso precisa ser conferido no Play Console na hora de publicar a 1.45.0, porque a seção de monetização pede "criptografado em trânsito" para o AdMob.

### Google Play: declarações

- Anúncios: "O app contém anúncios: Sim", quando a 1.45.0 estiver em produção (hoje a 1.43.6 não tem).
- ID de publicidade (AD_ID): a permissão `com.google.android.gms.permission.AD_ID` está no manifesto da 1.45.0. Declarar "o app usa o ID de publicidade", finalidade "publicidade ou marketing". Sem a declaração a Play rejeita o envio.
- Público-alvo: já exclui crianças (13+). Não marcar como "para crianças".
- Produto de assinatura `sem_anuncios_anual` (plano básico `anual`, renovação automática anual) ativo desde 21/11/2026. No Brasil custa R$ 9,99.

### App Store Connect: privacidade (rótulos)

- Identificadores, ID do dispositivo: usado para publicidade de terceiros, vinculado a você: não, usado para rastreamento: não (sem ATT e só anúncio não personalizado; decisão de 11/11/2026).
- Dados de uso, interação com o produto / dados de publicidade: publicidade de terceiros, não vinculado, rastreamento: não.
- Compras: não declarar como coletado (StoreKit; a Tech Fernandes não recebe histórico).
- `PrivacyInfo.xcprivacy` do app: `NSPrivacyTracking` continua `false` e sem `NSPrivacyTrackingDomains` (o SDK do Google se declara; listar domínios faria o iPhone bloqueá-los). Mesma decisão do Cuidia.
- Assinatura no grupo "Sem anúncios", ID `futeba_sem_anuncios_anual`, já anexada à versão publicada.

## O que ainda falta

1. Testar a compra da assinatura no Android com testador de licença, no teste interno da 1.45.0, num aparelho com conta Google testadora (o emulador não basta).
2. Promover a 1.45.0 à produção em rollout gradual e, no mesmo passo, atualizar a ficha do Play com anúncios e a assinatura por R$ 9,99. Sem a 1.45.0 no ar, esse texto não deve ser publicado.
3. Conferir no Play Console, na 1.45.0, as declarações de anúncios, ID de publicidade e Segurança dos dados (inclusive a criptografia em trânsito).
4. AdSense na web: site, bloco, `ads.txt` e atualização da política de privacidade, só com aprovação do Renan.
5. Fastlane: `fastlane/Fastfile` e `Appfile` só têm lanes Android (Play); não há lane iOS. O envio ao TestFlight segue pelo Xcode ou `xcodebuild -exportArchive`.
6. Validação da assinatura no servidor, se um dia for preciso que a web também tire o anúncio de quem assinou no celular.

Nada disso (publicação, alteração de preço, declaração no Console ou rollout) foi feito neste documento.

## Como testar sem publicar

- Android debug: `./gradlew :app:assembleDebug`; o banner de teste aparece depois de confirmar presença ou criar um jogo; compra só em build instalada pela Play (faixa de teste interno).
- Regras: `./gradlew :shared:testDebugUnitTest --tests "*monetization*" :app:testDebugUnitTest --tests "*AdsRoutesPolicyTest*" :composeApp:testDebugUnitTest --tests "*monetization*"`.
- Web: `cd web && npx vitest run src/components/ads`.
