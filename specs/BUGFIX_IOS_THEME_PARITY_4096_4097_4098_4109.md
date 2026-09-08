# BUGFIX: iOS Compose theme parity and resource cleanup (#4096, #4097, #4098, #4109)

> **Status:** `APPROVED`
> **Severity:** `HIGH` (#4096), `MEDIUM` (#4097), `LOW` (#4098, #4109)
> **Author:** Codex
> **Date:** 2026-09-08
> **Authorization:** The user explicitly authorized implementation of all open issues in this task. The parent task assigned these four issues and the scoped iOS/ComposeApp ownership.

## Requirements

1. The post-game-report podium number must meet WCAG AA contrast against every opaque medal background; sibling hardcoded foregrounds must use theme tokens with adequate light and dark contrast.
2. iOS must expose Light, Dark, and System choices, default new installs to System, persist the choice through restart, and preserve automatic high-contrast behavior. The contrast-level control itself is out of scope because its system accessibility override remains automatic.
3. Dead ComposeApp color palettes must be removed rather than adopted, because no current CMP caller needs a theme-aware semantic palette.
4. iOS intentionally uses the system SF family per HIG. It must not construct a Poppins family; platform resource packaging will be measured before/after and Poppins assets will move out of the iOS resource graph if Compose source-set packaging permits it.

## Design and tasks

| Issue | Change | Primary files |
| --- | --- | --- |
| #4096 | Use `DynamicThemeEngine.onColorFor` for medals and `MaterialTheme.colorScheme` semantic tokens for report foregrounds. | `PostGameReportScreen.kt`, `DynamicThemeEngine.kt` |
| #4097 | Provide a common settings route/UI backed by `ThemeRepository`; iOS stores enum-safe values in `NSUserDefaults`, exposes Koin binding, and App collects the config. | `App.kt`, `AppRoutes.kt`, theme settings/repository/DI source sets |
| #4098 | Delete unused static palette declarations. | `Color.kt` |
| #4109 | Move Poppins construction behind a platform `expect`/`actual`; iOS returns `FontFamily.Default` without accessing resources. | `Typography.kt` and target actuals/build resources |

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Saved invalid preference breaks startup | Parse enum names defensively and fall back to `AppThemeConfig.DEFAULT`. |
| Theme changes do not recompose | Collect the repository StateFlow at the root theme composition. |
| Token contrast varies by dynamic scheme | Use `onColorFor` for opaque medals and choose established semantic colors for report data. |
| Font resources remain in iOS framework | Record framework size before/after and retain the asset move only if the generated framework confirms removal. |

## Verification

- [x] `:composeApp:linkDebugFrameworkIosSimulatorArm64` passed on 2026-09-08 after all changes.
- [x] Source checks found no CMP consumer of removed palettes and no `Res.font.poppins_` reference in `iosMain`.
- [x] Generated iOS framework contains no Poppins filename/resource reference (`find` and binary `rg -a`); the processed iOS resource directory has no `.ttf` files, while Android and wasm each retain five Poppins assets.
- [x] Framework measurement recorded: 189,228 KB baseline; 189,236 KB after. This 8 KB directory-size change is not a reliable payload-savings measurement. Resource inspection, rather than `du`, proves that iOS no longer receives the 794,136 B font assets.
- [x] `ThemePreferenceAndContrastTest` compiled for `iosSimulatorArm64`; it covers persisted-value fallback to System and all three podium medal foreground choices.
- [ ] Native test execution is blocked by the local Xcode linker: `ld: framework 'FirebaseCore' not found`. The failure occurs at `linkDebugTestIosSimulatorArm64` after main and test Kotlin compilation, before assertions run.
- [ ] Manual iOS simulator smoke: default System, Light/Dark override, persistence after host restart, and OS-following behavior in System.

## Decision record for parent consolidation

- #4098 chooses removal, not a new palette API: all five objects have zero live ComposeApp consumers and lack a concrete adoption plan.
- #4109 keeps iOS system/SF typography intentional; it removes wasted Poppins construction and attempts target-scoped font resource packaging.
- #4097 keeps `ContrastLevel` UI out of scope. `FutebaTheme` still upgrades to high contrast from the iOS accessibility setting automatically.
