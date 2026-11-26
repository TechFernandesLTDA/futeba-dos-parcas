# CHORE: Android — código sem chamador, leituras frágeis e botão de convite

> **Status:** `IN_PROGRESS`
> **Severidade:** `LOW`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4596 (itens 1-3 + 5; item 4 — textos fora do strings.xml — em PR seguinte)

---

## 1. Resumo (verificação feita em 25/11/2026 sobre `origin/master`)

### Item 1 — código sem chamador (verificado por grep, sem lançamentos)
| Código | Verificação | Ação |
|--------|-------------|------|
| `FirebaseDataSourceImpl` + interface `FirebaseDataSource` (Android, 773+254 linhas) | Ligados no Koin (`single<AndroidFirebaseDataSource>`), mas nunca injetados fora dos 5 use cases abaixo | Apagar (classe + interface + Koin + `GetUsersByIdsPublicProjectionTest`) |
| `GetUpcomingGamesUseCase`, `ConfirmPresenceUseCase`, `CalculateTeamBalanceUseCase`, `GetLeagueRankingUseCase`, `GetPlayerStatisticsUseCase` (domain/usecase) | Registrados no Koin, zero injetores/chamadores em produção | Apagar (classe + Koin) |
| `InviteToGroupUseCase` + `GroupRepository.createGroupInvite` | Único chamador é o próprio use case; teste `#4586` só existe para eles | Apagar (classe + método + `InviteToGroupPermissionsTest`) |
| `getUpcomingGames`/`getUpcomingGamesFlow` (shared KMP: interface comum + `FirebaseDataSource` actual + `FirebaseGamesDataSource`) | Zero chamadores em composeApp/shared | Remover (3 arquivos) |
| `getConfirmedUpcomingGamesForUser` (GameQueryRepository + GameRepository + impls + Fake) | Só a fachada `GameRepositoryImpl` chama a query; zero ViewModels | Remover cadeia |
| `GamesPagingSource`, `CachedGamesPagingSource`, `CachedGameRepository` | Zero chamadores; `CachedGameRepository` registrado no Koin sem injetor | Apagar (arquivos + Koin + `CachedGamesPagingSourceTest`) |
| `GameRepositoryImpl.clearAll` | **VIVO** (`ProfileViewModel:361`) — **não apagar** (a issue listava, mas o chamador existe) | Manter |

### Item 2 — leituras que funcionam por coincidência
| Código | Ação |
|--------|------|
| `LiveGameRepository` (`teams[n].id` do campo `id` gravado por `GameTeamRepositoryImpl`, linhas 129/212 do shared) | Iterar documentos e usar `doc.id` (escritor segue gravando `id`, mas a leitura não depende mais disso) |
| `ConfirmationUseCase.updateAttendanceRate` | **VERIFICADO VIVO** em 25/11: escreve `attendance_rate`/`total_*` em `users/{uid}` (cálculo manual do stub `#2294`) — remover seria remover feature. Mantido. |
| `PublicGamesMapViewModel:151` (`toObject`) | `toObjectTolerant` (mapeamento tolerante do #4569) |
| `SocialFeedRepository:329` (`toObject`) | `toObjectTolerant` |

### Item 3 — modelos com `id` e sem `@DocumentId`
Verificado um a um: `AndroidGameWaitlist` usa `toDomain(doc.id)`; `DraftPlayer` é modelo de tela; `LocationReview`/`PlayerStats` sem leitura pelo mapper; `GameConfirmation`/`Team` cobertos no item 2. **Sem defeito, sem ação.**

### Item 5 — convite de grupo: botão para administrador
`InviteRepositoryImpl:86` responde "Só o dono do grupo pode enviar convites" (regra de `group_invites`), mas a UI mostra o botão para o administrador. **Esconde o botão para quem não é dono** (decisão segura; dar poder de convidar a admin mudaria as rules — escopo de spec própria).

### Item 4 — textos fora do `strings.xml`
**Fora deste PR** (verificar em 25/11: `ValidationHelper` em 2 arquivos + textos fixos em repositórios). Mecânico e grande — PR seguinte, para o review desta deleção ser legível.

---

## 2. Verificação

- [x] `./gradlew :app:compileDebugKotlin` (ver PR)
- [x] `./gradlew :shared:compileKotlinIosSimulatorArm64` (item shared)
- [ ] `./gradlew :app:testDebugUnitTest` (testes dos arquivos apagados removidos junto)
- [ ] Smoke em emulador (item 5) — pendente de reviewer

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-11-25 | Spec criada; inventário verificado por grep |
