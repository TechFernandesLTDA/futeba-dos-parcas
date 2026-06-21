# SPEC — Adotar ListDetailPaneScaffold em Games/Groups/Locations — #2686

- **Status:** APPROVED (piloto Games; Groups/Locations como follow-up incremental)
- **Tipo:** Feature / Refactor adaptativo (alto custo arquitetural)
- **Épico:** #2680 (Android — Material 3 Expressive, color engine e layouts adaptativos)
- **Data:** 2026-06-20

---

## 1. REQUIREMENTS

### Problema
Games/Groups/Locations são fluxos list→detail clássicos, mas hoje são **rotas separadas** (`GamesScreen`+`GameDetailScreen`, etc.) navegadas via `navController.navigate()` em `AppNavGraph.kt`. Em telas largas (tablet/landscape/expanded) o app mantém **single-pane** centralizado via `adaptiveContentWidth()` (cap 840/1040dp), desperdiçando espaço. O padrão Material 3 adaptativo é `ListDetailPaneScaffold` (duas panes em expanded, auto-colapso para single em compact).

### Critérios de aceite
1. Em **expanded** (tablet/desktop/landscape largo): lista + detalhe lado-a-lado.
2. Em **compact** (phone portrait): comportamento single-pane atual preservado (sem regressão).
3. Predictive-back funcionando (`BackHandler(navigator.canNavigateBack())`).
4. ViewModels de detalhe continuam corretamente escopados pela seleção (gameId/groupId/locationId).
5. `:app:compileDebugKotlin` + `detekt` + testes verdes; macrobenchmark sem regressão.
6. Compose UI tests: assert two-pane em expanded e single-pane em compact (piloto Games).

### Escopo faseado
- **FASE 1 (esta spec, piloto):** Games (`GamesListDetailScreen`).
- **FASE 2 (follow-up):** Groups.
- **FASE 3 (follow-up):** Locations (tem mapa — cuidado extra com a pane de lista=mapa).

---

## 2. TECHNICAL DESIGN

### Dependências (adicionar em `app/build.gradle.kts`)
- `androidx.compose.material3.adaptive:adaptive`
- `androidx.compose.material3.adaptive:adaptive-layout`
- `androidx.compose.material3.adaptive:adaptive-navigation`
(versão ~1.4.x, alinhada ao `material3-adaptive-navigation-suite:1.4.0` já presente). NÃO depende do bump de BOM #2681 (família adaptive versiona à parte). Validar `:app:dependencies`.

### Host composable (piloto Games)
```kotlin
@Composable
fun GamesListDetailScreen(...) {
    val navigator = rememberListDetailPaneScaffoldNavigator<String>() // key = gameId
    BackHandler(navigator.canNavigateBack()) { scope.launch { navigator.navigateBack() } }
    ListDetailPaneScaffold(
        directive = navigator.scaffoldDirective,
        value = navigator.scaffoldValue,
        listPane = { AnimatedPane { /* conteúdo de GamesScreen; onGameClick -> navigator.navigateTo(Detail, gameId) */ } },
        detailPane = { AnimatedPane { navigator.currentDestination?.contentKey?.let { /* GameDetailScreen(gameId=it) */ } } },
    )
}
```

### Pontos de atenção (o custo real)
- `adaptiveContentWidth()` centralizador deve ser removido/condicionalizado DENTRO do host (expanded usa 2 panes, não coluna centrada).
- VM de detalhe hoje keyed por nav-arg de rota; no host passa a ser keyed pela `contentKey` da pane. Garantir recriação/scoping correto ao trocar seleção.
- Manter rotas antigas (`GameDetailScreen` standalone) como entrada de **deep-link**/back-compat OU dobrar no host. Decisão: manter rota de deep-link apontando para o host com seleção inicial.
- `GameDetailScreen` (1022 LOC) e `GamesScreen` permanecem como CONTEÚDO das panes — não reescrever, apenas extrair o corpo para ser embutível (sem Scaffold/TopBar duplicado dentro da pane).

---

## 3. TASKS (FASE 1 — Games)
1. Branch `feat/listdetail-games-2686` a partir de master atualizado (pós-#2681 idealmente, p/ validar contra BOM final — mas não bloqueante).
2. Add deps adaptive em `app/build.gradle.kts`; `:app:dependencies` confirma resolução.
3. Extrair corpo embutível de `GamesScreen`/`GameDetailScreen` (remover chrome duplicado quando dentro de pane).
4. Criar `GamesListDetailScreen` host com navigator + predictive-back.
5. Religar `AppNavGraph.kt`: rota Games → host; manter deep-link de detalhe.
6. Compose UI test: two-pane@expanded, single-pane@compact.
7. `:app:compileDebugKotlin detekt testDebugUnitTest` verdes.

## 4. ROLLBACK
Reverter o commit restaura as rotas separadas (mudança aditiva: host novo + religação de 1 rota). Telas de conteúdo intactas.

## 5. VERIFY (Mobile DoD)
- [ ] Phone portrait: single-pane idêntico ao atual
- [ ] Tablet/landscape: duas panes
- [ ] Predictive-back OK
- [ ] Acessibilidade: foco move para detail pane ao selecionar; touch targets >=48dp
- [ ] compile + detekt + UI test verdes
- [ ] Sem regressão macrobenchmark

## NOTA
Triagem recomenda piloto Games antes de Groups/Locations. Fechar #2686 ao concluir as 3 fases; se só FASE 1 mergear, manter #2686 aberta com checklist de fases e abrir sub-issues para Groups/Locations.
