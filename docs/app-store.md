# App Store Connect: Futeba dos Parças (iOS)

Registro de 11/11/2026. Só iPhone, família desligada, Team ID `8HMZ5L98YQ`. Nada foi enviado para revisão.

## Identificadores

| Item | Valor |
|---|---|
| App na App Store Connect | **Futeba dos Parças**, Apple ID `6833514168`, SKU `futeba-dos-parcas-ios`, idioma principal pt-BR, acesso total |
| Bundle ID | `com.futebadosparcas` (App ID `3Z36H3ULL2`, nome "XC com futebadosparcas", criado pelo Xcode na exportação) |
| Capacidades do App ID (ligadas em 11/11) | Push Notifications, Associated Domains, App Attest (In-App Purchase já vem ligado) |
| Versão / build | 1.10.0 (26), enviado em 11/11/2026 11:39; em "Processando" na hora do registro |
| Grupo de assinaturas | "Sem anúncios", ID `22568565` |
| Assinatura | "Sem anúncios anual", Apple ID `6833515836`, produto `futeba_sem_anuncios_anual`, 1 ano, R$ 9,90 (Brasil, 1 ano antecipado), nome de exibição "Sem anúncios", descrição "Tire os banners do app por 1 ano", família desligada |

O primeiro envio leva **3 itens no mesmo rascunho**: grupo "Sem anúncios", assinatura e versão 1.10.0.

## Como o build foi feito

1. PR #4536 mesclado (`a85f2fd9`); antes, correção do `aria-label` do banner do AdSense via i18n (o contrato `i18nAriaLabelContract` falhava na CI).
2. `GoogleService-Info.plist` baixado com `firebase apps:sdkconfig IOS <appId>` (projeto `futebadosparcas`) para `iosApp/iosApp/GoogleService-Info.plist` (ignorado pelo git). O Bitwarden não foi necessário.
3. `xcodegen generate`, `pod install` (com `LANG=en_US.UTF-8`, senão o CocoaPods quebra), `xcodebuild archive` Release, `DEVELOPMENT_TEAM=8HMZ5L98YQ CODE_SIGNING_ALLOWED=NO`.
4. **Armadilha**: arquivar sem assinar descarta os entitlements (o app tem `aps-environment`, App Attest e `associated-domains`). O ad hoc do Xcode não é permitido no SDK iOS 27.2. Solução: gerar o `ent.plist` com `APS_ENVIRONMENT` e `APP_ATTEST_ENVIRONMENT` = `production`, rodar `codesign --force --sign - --entitlements ent.plist <app>` dentro do `.xcarchive` e só então exportar com `-allowProvisioningUpdates`, `method app-store-connect`, `destination upload`. Conferir antes de enviar: `codesign -d --entitlements :- Payload/iosApp.app` precisa mostrar `aps-environment=production`, o App Attest e os 3 domínios.
5. O Xcode registrou o App ID sozinho; as capacidades acima foram ligadas depois no portal (Salvar e Confirmar).

## O que o build Release faz hoje

- `GADApplicationIdentifier` é o ID **de teste** do Google e `ADMOB_BANNER_UNIT_ID` está **vazio**: o app não inicia o SDK nem mostra banner. Para anúncios reais: criar o app iOS e a unidade de banner no AdMob e arquivar de novo (build 27) com `ADMOB_APP_ID` e `ADMOB_BANNER_UNIT_ID` na linha de comando.
- O PR **pede o ATT** depois da primeira vitória (`AdsService.swift`), mesmo com anúncios sempre não personalizados. O texto do pedido ("anúncios mais relevantes") não bate com isso. Decidir: tirar o ATT (e o rótulo de rastreamento) ou manter e ajustar o texto.

## Ficha preenchida (rascunho, não publicada)

Versão 1.10.0, texto promocional, descrição (com os textos da diretriz 3.1.2 e links de Termos e Privacidade), palavras-chave, URL de suporte e de marketing `https://futebadosparcas.com.br`, copyright "© 2026 R L Fernandes LTDA", política de privacidade `https://futebadosparcas.com.br/privacy_policy.html`, notas para a revisão, usuário de revisão `techfernandesltda+futeba-revisor@gmail.com` (**sem senha**), "Início de sessão obrigatório" mantido (o app exige login).

## Conferência no Simulador (iPhone 17 Pro, iOS 26.4, build Debug do PR)

- Abre, boas-vindas, permissões e login funcionam. Notificação: o diálogo do sistema aparece ao tocar "Começar".
- Microfone: a linha marca "concedido" sem pedir permissão ao sistema (não há `NSMicrophoneUsageDescription` no Info.plist) e o app não fecha. Se algum recurso passar a gravar áudio, a chave é obrigatória.
- **"Entrar com Google" mostra "O login com Google ainda não está configurado no iOS"** (risco 2.1, botão que não funciona; se funcionar, a 4.8 exige Sign in with Apple).
- Rodapé do login mostra **"versão %s"** (texto sem substituição).
- Na base da tela o conteúdo é cortado (botão "Começar" e cartão do login aparecem cortados perto da borda inferior).
- Não foi possível ver a tela "Sem anúncios", a assinatura nem o banner: ficam atrás do login e a conta de revisão não tem senha cadastrada.

## Conteúdo de terceiros

Nomes e fotos de jogadores, nomes de grupos, jogos, locais e convites criados por outros usuários; ranking e conquistas. Sem chat. Há **bloqueio de jogadores** (`BlockedPlayersScreen`) e exclusão de conta (`DeleteAccountScreen`). Não foi encontrada ação de **denunciar** conteúdo ou usuário no iOS: a diretriz 1.2 pede filtro/denúncia, bloqueio e contato do desenvolvedor.

## Rótulos de privacidade (a preencher no questionário; ainda não preenchido)

Pelo `PrivacyInfo.xcprivacy` e por `docs/MONETIZACAO.md`: Nome, E-mail, Foto ou vídeo, Local aproximado/preciso (check-in), ID do usuário, ID do dispositivo, Conteúdo do usuário, Interação com o produto, Dados de falhas e de desempenho. Funcionalidades do app e análise. Acrescentar publicidade de terceiros para ID do dispositivo e dados de uso (AdMob), não vinculados, **rastreamento: sim** só se o ATT continuar. Compras: não declarar.

## Fica para o Renan

1. Senha da conta de revisão: cadastrar `futeba / revisor google play` no Bitwarden e digitar a senha no campo da ficha (e telefone de contato da revisão).
2. Direitos de conteúdo (não respondido), contratos, banco e fiscal da conta.
3. Chave APNs (`.p8`) no Firebase, se quiser push no iOS.
4. Decidir login Google no iOS (esconder o botão ou Sign in with Apple), ATT, e criar o app e a unidade no AdMob (build 27 com IDs reais).
5. Capturas de tela do iPhone e captura de revisão da assinatura (exigem login).
6. Anexar o build 1.10.0 (26) à versão assim que sair de "Processando" e enviar os 3 itens juntos para revisão.
7. Questionário de privacidade, classificação etária e categoria.
