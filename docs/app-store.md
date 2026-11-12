# App Store Connect: Futeba dos Parças (iOS)

Registro de 11/11/2026. Só iPhone, família desligada, Team ID `8HMZ5L98YQ`. Nada foi enviado para revisão.

## Identificadores

| Item | Valor |
|---|---|
| App na App Store Connect | **Futeba dos Parças**, Apple ID `6833514168`, SKU `futeba-dos-parcas-ios`, idioma principal pt-BR, acesso total |
| Bundle ID | `com.futebadosparcas` (App ID `3Z36H3ULL2`, nome "XC com futebadosparcas", criado pelo Xcode na exportação) |
| Capacidades do App ID (ligadas em 11/11) | Push Notifications, Associated Domains, App Attest (In-App Purchase já vem ligado) |
| Versão / build | 1.10.0 (27) enviado e ligado à versão em 11/11/2026 à tarde, **não enviado à revisão**. O build 26 foi enviado às 11:39 (registro da manhã) |
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

## Atualização de 11/11/2026 (tarde): build 27

- **Código** no PR #4542 (squash automático quando a CI obrigatória passar): sem "Entrar com Google" e sem ATT no iOS; denúncia de jogador e de grupo (coleção `abuse_reports`: ID `{uid}_{tipo}_{alvo}`, só criar, ninguém lê pelo cliente); rodapé com a versão real; insets duplicados removidos; `NSMicrophoneUsageDescription` em pt-BR com permissão real; strings `%s` convertidas para `%1$s`.
- **AdMob** (conta techfernandesltda@gmail.com, `pub-8024776729932634`, conferida em Configurações): app iOS "Futeba dos Parças" `ca-app-pub-8024776729932634~1964846913`; banner "Banner inferior" `ca-app-pub-8024776729932634/6586297402`. Passados na linha de comando do archive (`ADMOB_APP_ID`, `ADMOB_BANNER_UNIT_ID`). Não foi ligado à loja (o app ainda não está publicado). Por engano foram criados um app e um banner na conta `pub-3911701036052819` (rlocatizfernandes): o Renan apaga.
- **Archive Release 1.10.0 (27)** feito e conferido (Info.plist: build 27, IDs reais, sem `NSUserTrackingUsageDescription`; `codesign` mostra `aps-environment=production`, App Attest e os 3 domínios). **Upload não feito**: o Xcode perdeu a sessão da conta Apple ("App Store Connect access for 8HMZ5L98YQ is required"). O Renan entra de novo no Xcode (Ajustes > Contas) e roda `xcodebuild -exportArchive` com `destination upload`. **Resolvido à tarde:** o upload saiu pela linha de comando com a chave da API (seção abaixo).
- **Privacidade (a responder, sem publicar):** rastreamento NÃO; ID do dispositivo e interação com o produto para publicidade de terceiros, não vinculados.
- **Simulador (iPhone 17 Pro Max, iOS 26.4):** conferidos sem Google no login, nenhum pedido de ATT, rodapé "versão 1.10.0", área segura e o diálogo real de microfone em pt-BR. Não conferidos: denúncia, tela "Sem anúncios" e capturas logadas, porque a senha do item `futeba / revisor google play` deu `ERROR_INVALID_CREDENTIAL` no Firebase (a senha do Bitwarden não bate com a conta).
- **Estado às 11/11/2026, à tarde:** build 27 enviado e ligado à versão 1.10.0; **não enviado à revisão**. Dependem do Renan: senha da conta de revisão (o Firebase recusou a do Bitwarden, `ERROR_INVALID_CREDENTIAL`); direitos de conteúdo (UGC); publicar a privacidade; telefone de contato da revisão; chave APNs `.p8` no Firebase. Ainda sem confirmação posterior, da manhã: capturas de 6,3" e de revisão da assinatura, classificação etária e categoria (Esportes).

## Upload por linha de comando com a chave da API (11/11/2026, tarde)

Usado para o build 27 porque o Xcode 27 não expõe a conta da empresa à CLI. Arquive sem assinar (`DEVELOPMENT_TEAM=8HMZ5L98YQ CODE_SIGNING_ALLOWED=NO archive`) e exporte com `xcodebuild -exportArchive -archivePath <arquivo>.xcarchive -exportPath <pasta> -exportOptionsPlist <plist> -allowProvisioningUpdates -authenticationKeyPath ~/.config/techfernandes/asc/AuthKey_X9RJ3A672K.p8 -authenticationKeyID X9RJ3A672K -authenticationKeyIssuerID b181f3f1-0f4a-43e2-8f8c-2781023f11e2`, com o `export.plist` (`method` `app-store-connect`, `destination` `upload`, `signingStyle` `automatic`, `teamID` `8HMZ5L98YQ`). Key ID e Issuer ID não são segredo; o conteúdo do `.p8` é, e fica fora do repositório e fora deste doc.

## Build 28 (PR #4543, merge `3a876500`, 11/11/2026 à noite)

Resposta à rejeição por diretriz 1.2 (conteúdo de usuários) e 5.1.1 (permissão sem uso): denúncia de jogador com motivo (inclui "Perfil falso") e texto opcional até 500 caracteres, com confirmação "Recebemos sua denúncia. Vamos analisar em até 24 horas."; depois de denunciar, a tela oferece bloquear a pessoa; onboarding sem cartões de microfone e câmera e sem `NSMicrophoneUsageDescription`/`NSCameraUsageDescription` (o Android não muda). Regras do `abuse_reports` aceitam `fake_profile` e `details`.

Problemas achados no Simulador (iPhone 17 Pro Max) e corrigidos no build 29: aba Jogos mostrava "Dados de jogos indisponíveis neste ambiente"; erro "Serializer for class 'Any' is not found" depois do login; abrir Locais fechava o app; erros brutos do Firebase na tela de login; data padrão do Criar jogo vencida (2026-11-10); selo "Ao vivo" fixo no Início.

## Build 29 (PR #4544, merge `a71d4a75`, 12/11/2026)

- **Locais fechava o app**: `PlatformLogger` iOS passava a `String` do Kotlin ao `NSLog` como argumento variádico (SIGSEGV em `objc_opt_respondsToSelector`). Agora usa `println`; não há mais `NSLog(` no código.
- **"Serializer for class 'Any'"**: `get<Any?>`, `get<List<*>?>` e `get<Map<*, *>?>` do GitLive não têm serializador no Kotlin/Native. Leituras tolerantes em `shared/.../FirebaseSafeReads.kt` (`getScalar`, `getStringList`, `getIntList`, `getLooseMap`) e `update` de mapa heterogêneo por pares (`updateLoose`). Criação do documento do usuário sem `set` de mapa misto.
- **Jogos no iOS**: não havia `GameRepository` no iOS. `GamesViewModel` passou a receber a fonte de jogos; no iOS vem do Firestore (próximos jogos públicos, que as regras exigem filtrados por visibilidade, mais os jogos confirmados da pessoa) e está no módulo Koin do iOS.
- **Login**: erros do Firebase Auth traduzidos (`friendlyAuthError`, com testes): e-mail inválido, credencial incorreta, e-mail já usado, senha fraca, muitas tentativas, sem rede, conta desativada.
- Criar jogo: data padrão é amanhã. Início: removido o selo "Ao vivo" fixo.
- **Archive** Release 1.10.0 (29), AdMob real (`~6586297402` banner), sem `NSUserTrackingUsageDescription` e sem `NSMicrophoneUsageDescription`; `codesign` com `aps-environment=production`, App Attest e os 3 domínios. O primeiro `exportArchive` falhou com "The request expected results but none were found" (assinatura em nuvem da Apple, `RESULTS_UNAVAILABLE`); repetir o mesmo comando funcionou.
- **Simulador (build Debug do mesmo código):** Jogos abre (estado vazio, sem erro), Locais lista locais reais do Firestore (o App Check não bloqueou), Conquistas abre sem erro, Criar jogo com data de amanhã, login mostra "Esse e-mail não parece válido. Confira e tente de novo.", onboarding sem microfone/câmera. **Não conferido:** login com a conta de revisor (não foi possível colar a senha no campo do Simulador sem digitá-la) e a denúncia logada.
- Observações sem correção: a primeira tela fica branca por uns 10 s na partida a frio; o card de login fica cortado na base até rolar; "Estatísticas do organizador" mostra "ainda não estão disponíveis no iPhone".
