# BUGFIX: `androidTest` não compilava (10 arquivos de teste de tela)

> **Status:** `APPROVED` → `FIXED`
> **Severidade:** `MEDIUM` (só testes; nenhum código do app muda)
> **Autor:** Claude Code (issue #4575, aberta pela bateria de testes)
> **Data:** 2026-11-15
> **PR:** #4581

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

`./gradlew :app:compileDebugAndroidTestKotlin` falhava na `master` com 211 erros em 10 arquivos de
`app/src/androidTest`. Para a bateria rodar, o PR #4577 tirou os 10 arquivos da compilação com um bloco no fim
de `app/build.gradle.kts`, sem apagar nenhum.

### 1.2 Comportamento Esperado (Correto)

O `androidTest` compila inteiro, sem exclusão, e os testes de tela passam contra as telas atuais.

### 1.3 Passos para Reproduzir

1. Remover o bloco `androidTestsQueNaoCompilam` de `app/build.gradle.kts`.
2. `./gradlew :app:compileDebugAndroidTestKotlin`.

---

## 2. Análise de Causa Raiz

Os testes ficaram para trás quando as telas mudaram, e nada os compilava no CI (não há emulador Android no CI):

| Arquivo | Erros | O que mudou |
|---------|-------|-------------|
| `ui/auth/LoginScreenTest.kt` | 90 | A tela ganhou login por e-mail (`onEmailPasswordSignIn`, `onForgotPassword`, `onNavigateToRegister`); o erro virou `@StringRes`; o teste lia textos de `Res` do `:composeApp` |
| `ui/profile/ProfileScreenTest.kt` | 38 | Novos callbacks e `ProfileUiState.Success` com outros campos |
| `ui/games/GameDetailScreenTest.kt` | 28 | Modelos de domínio no estado; novos callbacks |
| `ui/game_experience/MVPVoteScreenTest.kt` | 15 | Estados com `isOwner`; `GameConfirmation` de domínio |
| `ui/locations/LocationFlowTest.kt` | 15 | Modelos |
| `ui/groups/GroupsScreenTest.kt` | 8 | `UserGroup` |
| `ui/statistics/RankingScreenTest.kt` | 8 | `RankingUiState` único no lugar de estados selados |
| `ui/auth/RegisterScreenComposeTest.kt` | 6 | A tela passou a receber o estado e os callbacks |
| `ui/home/HomeScreenTest.kt` | 2 | `Game` e `Statistics` de domínio |
| `ui/games/GamesScreenTest.kt` | 1 | Modelos |

Além de não compilar, parte deles não testava a tela:

- `GamesScreenTest` (29 casos) e `LocationFlowTest` (15 casos) chamavam composables escritos dentro do próprio
  arquivo de teste (`TestGamesScreenContent`, `TestManageLocationsScreen`, `TestLocationDetailScreen`), cópias da
  interface. Passavam ou falhavam sem relação com `GamesScreen`, `ManageLocationsScreen` ou `LocationDetailScreen`.
- `RegisterScreenComposeTest` tinha 2 casos sem nenhuma verificação.
- `HomeScreenTest` tinha `verify(atLeast = 0)` (sempre verdadeiro) e textos da interface antiga.

---

## 3. Solução

### 3.1 Apagados (2)

`ui/games/GamesScreenTest.kt` e `ui/locations/LocationFlowTest.kt`: testavam uma cópia da tela, não a tela.
Consertar a compilação manteria 44 casos que não pegam regressão nenhuma. A lógica dessas telas tem teste
unitário (`GamesViewModelTest`, `LocationSelectorViewModelTest`, `LocationsMapViewModelPaginationTest`); teste de
tela de verdade para elas fica como pendência (5.2).

### 3.2 Reescritos contra a tela atual (8)

Todos montam a tela real com o ViewModel substituído por mock (ou, em login e cadastro, com o estado passado
direto) e conferem o que o usuário vê e o que cada toque dispara.

| Arquivo | Casos antes | Casos agora |
|---------|-------------|-------------|
| `ui/auth/LoginScreenTest.kt` | 18 | 13 (entram o formulário de e-mail, esqueci a senha e ir para o cadastro) |
| `ui/auth/RegisterScreenComposeTest.kt` | 2 (sem verificação) | 8 |
| `ui/profile/ProfileScreenTest.kt` | 4 | 7 |
| `ui/games/GameDetailScreenTest.kt` | 4 | 7 |
| `ui/game_experience/MVPVoteScreenTest.kt` | 5 | 7 |
| `ui/statistics/RankingScreenTest.kt` | 4 | 6 |
| `ui/groups/GroupsScreenTest.kt` | 4 | 9 |
| `ui/home/HomeScreenTest.kt` | 20 | 16 (casos repetidos foram unidos; puxar para atualizar passou a verificar a chamada) |

Regras usadas, registradas em `specs/DECISIONS.md`:

- o texto esperado vem do `strings.xml` do app (`appString`), não de literal no teste;
- todo `StateFlow` que a tela lê é declarado no mock (um fluxo esquecido num mock relaxado vira
  `ClassCastException` em tempo de execução, como aconteceu com `HomeViewModel.isRefreshing`);
- item de lista preguiçosa abaixo da dobra é alcançado rolando, não presumido.

`util/ComposeTestExtensions.kt` ganhou `appString`, `assertTextoVisivel` e `assertTextoAusente`.

### 3.3 Exclusão removida

O bloco `androidTestsQueNaoCompilam` saiu de `app/build.gradle.kts`.

### 3.4 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Teste de tela abrir listener no Firebase de produção | As telas testadas recebem ViewModel mock. No detalhe do jogo, chat, comentários e vídeos criam ViewModel próprio pelo Koin: a lista de presença do teste é longa o bastante para eles não entrarem na tela |
| Testes voltarem a ficar para trás | Não há emulador no CI. A compilação do `androidTest` passa a acontecer em toda rodada de `scripts/bateria/rodar.sh android` |

---

## 4. Verificação

- [x] `./gradlew :app:compileDebugAndroidTestKotlin` sem exclusão.
- [x] `androidTest` inteiro (fora a bateria) no AVD API 34, com o app apontado para o projeto demo: 95 casos, 92 verdes. Os 73 casos dos 8 arquivos reescritos passam; os 3 vermelhos são de outros arquivos (5.2).
- [x] `./gradlew :app:testDebugUnitTest detekt`: 1427 testes, 0 falhas.
- [x] `scripts/bateria/rodar.sh android`: 10 testes verdes.
- [ ] Rodada em tablet ou tela larga (não feita: `GroupsScreen` e o cabeçalho da Home têm layout próprio nesse caso).

---

## 5. Prevenção Futura

### 5.1 Por que não foi pego antes?

Nenhum passo do CI compila o `androidTest`, e o bloco de exclusão escondia o problema.

### 5.2 Pendências (fora deste PR)

- [x] Três testes de outros arquivos, que já compilavam, falhavam no mesmo AVD: `AppTopBarBadgeFontScaleTest.badgeLimitadoEm99NaoRecortaComFontScale2_0`, `GroupWallScreenTest.compositorPermaneceVisivelQuandoMuralEstaVazio` e `WallPostComposerTest.draftPermaneceAteConfirmacaoDeSucesso`. Investigados em 16/11/2026, os três eram defeito do teste:
  - os dois do mural comparavam com texto em português escrito no teste; o AVD está em inglês e o app tem `values-en`. Passaram a usar `appString(R.string...)`;
  - o do badge exigia ao mesmo tempo o rótulo inteiro e o badge dentro do alvo de 48dp. Com "99+" em fontScale 2,0 o rótulo mede cerca de 55dp, então as duas condições não cabem juntas. O teste passou a aceitar, só nesse caso, os 4dp do deslocamento à esquerda, que ficam na margem do botão vizinho. O app não muda.
- [ ] Teste de tela real para `GamesScreen`, `ManageLocationsScreen` e `LocationDetailScreen`.
- [ ] `ValidationHelper` devolve mensagens em texto fixo, fora do `strings.xml`; os testes de login e cadastro comparam com esses textos.

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-11-15 | Bateria de testes | Issue #4575; exclusão provisória no #4577 |
| 2026-11-15 | Claude Code | 8 arquivos reescritos, 2 apagados, exclusão removida |
