# BUGFIX: Conquistas sem itens e Estatísticas indisponíveis no iPhone (1.10.0, build 29)

> **Status:** `APPROVED`
> **Severidade:** `HIGH` (apontado na revisão da App Store de 11 e 12/11/2026)
> **Autor:** Claude (pedido da sessão principal, autorizado pelo dono)
> **Data:** 2026-11-13

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

- **Conquistas**: a tela (título "Badges") mostra só o cabeçalho. Ela consulta a coleção raiz `badges`
  (`getAvailableBadges()`), que tem 0 documentos em produção. Não há lista nem estado vazio com texto.
- **Estatísticas**: o botão "Estatísticas" do Perfil e o atalho "estatísticas do organizador" no detalhe do jogo
  abrem a rota `owner_stats/{ownerId}`. No iOS essa rota é um aviso fixo: "As estatísticas do organizador ainda não
  estão disponíveis no iPhone".

### 1.2 Comportamento Esperado (Correto)

- Conquistas lê `user_badges` do jogador (onde as Cloud Functions gravam) e junta com o catálogo local
  `BadgeDefinitions`. A tela mostra "Suas conquistas", depois "Para desbloquear". Se o jogador não tiver nenhuma,
  mostra um estado vazio com texto. Erros de leitura mostram uma mensagem e o botão "Tentar novamente".
- Estatísticas lê `statistics/{uid}`, que as Cloud Functions gravam em camelCase e `toStatisticsOrNull` já lê.
  A tela mostra jogos, aproveitamento, V/E/D, gols, assistências, gols por jogo, defesas, craque da partida e
  cartões. Também tem estados de carregando, vazio (0 jogos), erro com nova tentativa e sucesso.
  - Título "Minhas estatísticas" quando o jogador vê os próprios números.
  - Título "Estatísticas do organizador" quando vê os números do dono do jogo.

### 1.3 Passos para Reproduzir

1. iPhone com a build 29, conta com jogos encerrados.
2. Perfil → Conquistas: só o cabeçalho aparece.
3. Perfil → Estatísticas: aparece o aviso fixo.

Dados conferidos em produção por leitura REST somente leitura: `badges` tem 0 documentos, `user_badges` tem 17
(6 usuários) e `statistics` tem 7.

## 2. Correção

- `composeApp/.../ui/core/BadgeCollection.kt` (novo, lógica pura): `buildBadgeCollection(userBadges, catalog)`.
- `composeApp/.../ui/core/PlayerStatsSummary.kt` (novo, lógica pura): `buildPlayerStatsSummary(stats)`.
- `RouteOverviewScreens.kt`:
  - `BadgesRouteScreen(currentUserId, ...)` reescrita.
  - Nova tela `PlayerStatsRouteScreen`.
  - `OverviewBody` ganha o parâmetro `onRetry`.
- `App.kt`: a rota `BADGES` passa o uid atual; a rota `OWNER_STATS` usa `PlayerStatsRouteScreen`.
- Textos novos em `composeResources/values/strings.xml`, em pt-BR.

As regras do Firestore não mudam: `user_badges` e `statistics` já permitem leitura para usuário autenticado.

## 3. Testes

- `BadgeCollectionTest` e `PlayerStatsSummaryTest` (commonTest do composeApp).
- `./gradlew :composeApp:compileKotlinIosSimulatorArm64 :composeApp:testDebugUnitTest`.
- Build do app iOS no Simulador.

## 4. Mobile DoD

- [x] Estados: carregando, vazio, erro com nova tentativa e sucesso.
- [x] Acessibilidade: títulos de seção marcados como heading, conquista bloqueada com stateDescription e
  números agrupados por bloco.
- [x] Largura máxima de 880dp no tablet.
- [ ] Não conferido num iPhone real nem com uma conta que tenha dados (sem login de produção).
