# SPEC: Convite único "Sem anúncios" na Home (Android)

> **Status:** `IN_REVIEW` (item 10 do plano das lojas de 20/11/2026; aprovação final do Renan no PR)
> **Autor:** Claude Code
> **Data:** 2026-11-20
> **PR:** a preencher

---

## 1. Requirements

### 1.1 Problema
A assinatura "Sem anúncios" só aparece em Preferências. Quem não abre essa tela nunca sabe que ela existe. A conversão é hipótese: medir pelos relatórios de Assinaturas do Play.

### 1.2 Casos de uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador com anúncios, depois da primeira vitória | Abre a Home | Vê uma vez o cartão "Jogue sem anúncios" abaixo do cabeçalho |
| UC2 | O mesmo jogador | Toca "Ver a assinatura" | Abre a tela Sem anúncios que já existe (preço, período, renovação) |
| UC3 | O mesmo jogador | Toca "Agora não" | O cartão some e nunca mais volta |
| UC4 | Assinante | Abre a Home | Nunca vê o cartão |

### 1.3 Critérios de aceite
- [x] CA1: aparece uma vez só na vida do app; a marca é gravada quando aparece (matar o app não traz de volta).
- [x] CA2: só depois da primeira vitória (presença confirmada ou jogo criado).
- [x] CA3: nunca para assinante; some se a assinatura for feita com o cartão na tela.
- [x] CA4: só com anúncio configurado no build (`AdsConfig.unitConfigured`, do PR #4604): não vende o que não existe.
- [x] CA5: sem preço no cartão; preço e renovação ficam na tela da assinatura.
- [x] CA6: sem clique acidental: o cartão não é clicável, só os dois botões, separados, com 48 dp; entra junto com o conteúdo da Home, sem empurrar nada para baixo do dedo.

### 1.4 Fora de escopo
- iOS (`:composeApp`): fica para outro PR.
- Variação de texto ou A/B.

## 2. UX/UI
Cartão `surfaceVariant`, título `titleMedium`, texto `bodyMedium`, `TextButton` "Agora não" e `OutlinedButton` "Ver a assinatura" à direita. Textos em pt-BR, en e es (`strings_monetizacao.xml`).

## 3. Technical design
- `AdsGate.shouldShowSubscriptionInvite` (shared, puro).
- `AdsState.takeSubscriptionInvite(unitConfigured)` decide e grava `monetizacao.convite_sem_anuncios`.
- `AdsController.takeSubscriptionInvite()` no Android.
- `AppNavGraph` decide uma vez por entrada na Home (`rememberSaveable`) e passa o cartão por um slot `subscriptionInvite` da `HomeScreen`.

## 4. Verify
- `SubscriptionInviteTest` (shared, 7 casos).
- `:app:compileDebugKotlin`.
- Não conferido no aparelho.
