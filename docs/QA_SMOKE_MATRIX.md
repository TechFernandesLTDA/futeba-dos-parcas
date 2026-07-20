# QA Smoke Matrix

Last updated: 2026-06-29

This matrix is the repeatable checklist for Plato or any QA/E2E pass. Keep it focused: it should catch regressions in real user flows without becoming a full release certification every time.

## Test Inventory

Current test surface:

| Area | Location | Count / Shape |
| --- | --- | --- |
| Web unit/integration | `web/src/**/*.test.*` | 85 files |
| Web E2E | `web/e2e/*.spec.ts` | 6 specs |
| Functions Jest | `functions/test/**/*.test.ts` | 57 files |
| Firestore rules | `firestore-rules-tests/src/*.test.ts` | 31 specs |
| Android JVM | `app/src/test/**/*` | 47 files |
| Android instrumented | `app/src/androidTest/**/*` | 12 files |
| Android perf | `baselineprofile/`, `macrobenchmark/` | startup/navigation/perf flows |

## Fast Commands

### Web smoke

```bash
cd web
nvm use
npm run build
npm run lint
npm test
```

### Web E2E

```bash
cd web
nvm use
npm run test:e2e
```

For the new admin, field-owner and locations screens, run the dedicated visual
contract on both Playwright projects (`chromium` and `mobile-chrome`):

```bash
cd web
nvm use
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
VITE_USE_EMULATOR=true \
npx playwright test e2e/visual-new-screens.spec.ts
```

For local production-like route testing:

```bash
cd web
nvm use
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

### Functions

```bash
cd functions
nvm use
npm run build
npm run lint
npx jest --no-coverage
```

### Android

```bash
./gradlew :app:compileDebugKotlin
./gradlew :app:testDebugUnitTest
./gradlew lint
./gradlew detekt
```

## Viewport Matrix

| Context | Size / Device | Why |
| --- | --- | --- |
| Desktop | `1440x900` | Full navigation, tables, dense dashboards |
| Tablet / narrow desktop | `768x1024` | Breakpoint and drawer/top bar behavior |
| iPhone web | around `390x844` | Safari-style mobile width, auth/onboarding/forms |
| Small Android web | around `360x780` | Tight text, bottom nav, keyboard and scroll pressure |

When validating production, use `https://futebadosparcas.web.app`. When validating local preview, rebuild first so `dist/` exists.

## Auth And Onboarding

| Flow | Minimum Checks | Automation Target |
| --- | --- | --- |
| Login | empty submit does not advance, invalid credentials show error, valid credentials redirect correctly | Vitest + Playwright |
| Register | required fields, CPF input behavior, Google button present, invalid inputs stay on page | Vitest + Playwright |
| Google login | popup-cancel is silent, incomplete Google user goes to onboarding | Playwright mock/emulator plus manual smoke |
| CPF | valid/invalid/duplicate CPF, callable error surfaced, ID token refresh after verification | Functions Jest + Web test + Rules |
| Phone/SMS | reCAPTCHA renders, preflight fallback does not blank screen, SMS/captcha/quota errors visible | Web test + Android JVM + manual controlled smoke |
| Protected onboarding deep links | anonymous user redirects to `/login`, verified user is not trapped | Playwright |
| First login | profile incomplete users land in correct next step | Playwright + AuthContext tests |

Real SMS should be a controlled manual smoke or staging-only run. Do not consume production quota casually.

## Web Navigation And Visual

| Flow | Minimum Checks | Automation Target |
| --- | --- | --- |
| Route-to-route navigation | new page starts at top, top bar does not cover header content | Playwright |
| Mobile top bar / bottom nav | no overlap, no horizontal overflow, touch targets at least 44px | Playwright screenshot/a11y assertions |
| New admin/locations/owner screens | `/locations`, `/location/create`, `/owner/dashboard`, `/owner/onboarding`, `/admin/users`, `/admin/performance` render on desktop and mobile with no overflow, no offscreen content and 44px mobile actions | `web/e2e/visual-new-screens.spec.ts` |
| Monetized venue discovery | public lists only show active, verified, published, commercially eligible venues with active fields; filters/rankings use denormalized field stats instead of full client scans | Vitest helpers + Playwright mobile/desktop smoke |
| Venue admin/owner parity | admin CRM, venue detail/edit, owner dashboard and public discovery show the same publication, billing and venue-account status labels on desktop and mobile | Component tests + manual production smoke |
| Forms on mobile | inputs visible with keyboard pressure, submit/loading states do not shift layout | Playwright manual-assisted |
| Loading/error/empty/success | all screens touched by the change expose the four states | Component tests + visual smoke |
| Release notes/changelog | latest version appears in app surface and fallback JSON | Vitest + production smoke |
| Cache/prefetch | no stale redirect or blank page after login/logout | Playwright |

## Games, League And Demo Data

| Flow | Minimum Checks | Automation Target |
| --- | --- | --- |
| Public games list | past/stale games do not remain as active | Functions Jest + Web smoke |
| Create game | validates fields, writes server timestamps, navigates safely after save | Web/Android tests |
| Game detail | loading/error/empty/success, participants, confirmations and status transitions | Playwright + Functions |
| Realized games | 6-month history renders without layout overflow or slow blank states | Playwright + seeded emulator |
| League standings | 40+ players render, sort rules stable, season filters correct | Functions Jest + Web smoke |
| XP/ranking | suspicious overlap, breakdown agregado, bônus/caps, retry dedup, virada mensal BRT e season isolation enforced | Functions Jest + Web/Android contract tests |
| Financeiro mensal | 3/4/5 ocorrências, valor fixo/por jogo, subconjunto de mensalistas, feriado, custo por ocorrência e soma exata em centavos | Functions + Web + Rules |
| Baixa/estorno mensal concorrente | duas sessões não finalizam snapshot obsoleto; retry é idempotente; caixa, pagador e período convergem em tempo real | Functions Jest + Emulator + smoke multi-sessão |
| Realtime 10/100/1000 | listeners convergem entre sessões; p95/p99, erro, invariantes e orçamento read/write ficam dentro do perfil; hot-document é diagnóstico explícito | `npm run test:load:realtime -- --profile <10|100|1000>` + Firestore Emulator |
| Mural mídia 10/100/1000 | reserva, retry idempotente e corrida do mesmo request mantêm post/path únicos, zero erro e p95 do perfil | `npm run test:load:wall-media -- --vus <10|100|1000>` + Firestore Emulator |
| Mural mídia móvel/reload | stall não cria fallback concorrente; offline/aba oculta pausa watchdog; IndexedDB restaura arquivo+UUID; MP4 e poster respondem 206 e o player renova uma URL 403 no máximo uma vez | Vitest (`storageUpload`, `groupWallMediaOutbox`, `useGroupWall`, `WallPostVideoPlayer`) + Storage Emulator + smoke com MP4 real |

## Firebase And Security

| Area | Minimum Checks | Automation Target |
| --- | --- | --- |
| Firestore rules | ownership, admin/field-owner/player roles, onboarding grace, verified profile | Rules tests |
| App Check | callables enforce where expected; emulator bypass remains explicit | Functions Jest |
| Custom claims | role/profile/verification claims refresh when server state changes | Functions Jest + Auth tests |
| Rate limits | CPF/SMS anti-abuse returns useful client errors and does not consume tokens incorrectly | Functions Jest |
| PII | CPF/phone not logged in clear text in audit/error paths | Static audit + Jest |

## Android

| Flow | Minimum Checks | Automation Target |
| --- | --- | --- |
| Compile smoke | `:app:compileDebugKotlin` passes | Gradle |
| Onboarding phone | Activity is resolved from context, recoverable SMS errors surface | JVM/Compose test where possible |
| Theme/layout | small screens scroll, no clipped primary controls | Instrumented/manual screenshot |
| Games/lists | adaptive layouts do not crash on narrow/wide screens | JVM + macrobenchmark when touched |
| Venue monetization parity | `Location` Android model, KMP `Location`, Android<->KMP mappers and Firestore deserializer preserve commercial, venue-account and aggregate fields | `:app:compileDebugKotlin` + shared compile/tests |
| Create-game venue selection | unavailable monetized venues are not selectable; legacy verified venues still follow documented fallback until backfill is complete | JVM/ViewModel test or manual device smoke |
| Performance | startup/list navigation not materially worse after large UI changes | baseline profile / macrobenchmark |

## iOS Accessibility

| Flow | Minimum Checks | Automation Target |
| --- | --- | --- |
| VoiceOver pass | interactive icons named, decorative icons skipped, focus order follows visual order | Manual device/simulator using `docs/IOS_ACCESSIBILITY_QA.md` |
| Dynamic Type | key screens remain usable at Larger Text >= 200%, with no clipped primary controls | Manual device/simulator |
| Contrast | text reaches 4.5:1 and non-text controls/indicators reach 3:1 in light and dark mode | Manual audit |

## Release Gate

Before production deploy or PR ready-for-review:

- Web build and lint pass.
- Functions build/lint and targeted Jest pass for touched areas.
- Android compile passes if Android/shared files changed.
- Firestore rules tests pass if rules or auth/role behavior changed.
- Plato or coordinator runs mobile-web smoke for auth/onboarding when login, CPF, SMS, top bar, route navigation or cache changed.
- Changelog/release notes/version files are synchronized when user-facing behavior changed.

## Known Gaps

- Pixel-perfect visual snapshot baselines are still not used; current coverage is a visual contract focused on layout breakage, viewport overflow and mobile touch targets.
- Google login and real SMS need a controlled strategy: emulator/mock in CI, manual smoke in staging/production only when necessary.
- Some older docs mention Node 20; current repo rule is Node 22.
- Macrobenchmark documentation and workflow gates may not fully match; verify before treating perf upload as a hard pass/fail gate.

## Recommended Next Automation

Create a Playwright smoke spec that covers:

- `/login`, `/register`, `/forgot-password`, `/welcome`, `/onboarding/phone`, `/onboarding/cpf`;
- desktop, iPhone-width and Android-width viewports;
- no horizontal overflow;
- top-of-page scroll on navigation;
- protected onboarding redirect behavior;
- visible error on empty submit.
