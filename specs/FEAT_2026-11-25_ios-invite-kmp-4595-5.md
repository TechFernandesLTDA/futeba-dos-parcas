# FEAT: iOS — InviteRepository KMP (tela de convites, #4595 item 5)

> **Status:** `IN_PROGRESS`
> **Severidade:** `MEDIUM`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4595 (item 5) + #4401

---

## Problema
Sem `InviteRepository` registrado no iOS, `koinViewModelOrNull<InviteViewModel>()` (`composeApp/App.kt:671`) devolve null e a tela de convites de grupo não abre no iPhone.

## Solução
1. `InviteRepositoryImpl` novo em `shared/nativeAndAndroidMain` (GitLive), porte fiel do `InviteRepositoryImpl` do app Android: só o dono convida, mapa snake_case com datas (`serverTimestamp` + `expires_at`), mapper tolerante `toGroupInviteOrNull()`. Cancelamento exige papel OWNER/ADMIN (leitura do doc de membro).
2. Registro no módulo iOS (`PlatformComposeAppModule.ios.kt`): `FutebaDatabase`, `UserRepository` (impl compartilhada, já existia), `GroupRepository` (compartilhada, já existia), `InviteRepository` e `InviteViewModel`.

## Verificação

- [x] `:shared:compileKotlinIosSimulatorArm64`
- [x] `:composeApp:linkDebugFrameworkIosSimulatorArm64`
- [x] `:app:compileDebugKotlin` + `:shared:testDebugUnitTest`
- [ ] Smoke em Simulador: convidar como dono/admin (pendente de reviewer)
