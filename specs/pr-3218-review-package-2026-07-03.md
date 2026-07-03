# PR #3218 Review Package

Material pronto para atualizar o PR draft `#3218` e comentar nas issues
prioritarias quando a branch remota puder ser sincronizada.

Data de referencia: `2026-07-03`
Branch local: `feat/evidence-game-antifraud`

## 1. PR body sugerido

```md
## Summary

- Hardens the full evidence-based anti-fraud flow for game lifecycle, live events, validation scoring, reward gating, admin review, auto-close review, and validation UX.
- Routes start/finish lifecycle and critical live events through Cloud Functions with App Check, authorization, validation, and audit trails.
- Holds XP/rewards for `REVIEW_REQUIRED` games and adds admin release/reject workflow with auditable decisions.
- Adds complementary location/check-in fraud signals and evidence-oriented auto-close review.
- Exposes validation and review state in Web admin UX and Android game details.
- Removes remaining legacy Web bypasses for direct live event and live score writes.

## Scope delivered

- `#3208` server-side lifecycle for `LIVE` / `FINISHED` with rules hardening
- `#3209` reward gate + admin review callable + audit trail
- `#3211` server-side critical live events / score / derived stats
- `#3213` overlap / impossible travel / location anomaly signals
- `#3214` evidence-oriented auto-close with review state
- `#3215` admin review queue on Web
- `#3216` validation / hold / review UX on Web and Android

## Key local-only follow-up commits not yet reflected in remote PR

- `135ff361` `feat: surface antifraud validation state on android`
- `bc373852` `feat: wire antifraud validation state into android game details`
- `9aa83909` `feat: surface auto-close antifraud reviews in admin queue`
- `0ed4d1ed` `fix: remove legacy live game write bypasses on web`
- `6ea0c4f1` `refactor: align android live game flows with secure repository contract`

## Validation

- `cd functions && npm ci` ✅
- `cd functions && npm run build` ✅
- `cd functions && npm run lint -- --quiet` ✅
- `cd functions && npx jest --no-coverage` ✅ (`66` suites, `1062` testes)
- `cd web && npm run build` ✅
- `cd web && npm run lint` ✅
- `./gradlew :shared:compileKotlinMetadata` ✅
- `./gradlew :app:compileDebugKotlin` blocked only by missing `google-services.json`; no new Kotlin errors before that step ✅

## Known external blockers before final review-readiness claim

- Remote PR is outdated relative to the current local branch and still shows an older failed `Cloud Functions CI / Unit Tests` run.
- Local branch is ahead of `origin/feat/evidence-game-antifraud` and still needs push/re-run of checks.
- Local Firestore emulator rules run is currently blocked by machine environment (`firebase-tools` now requires Java 21+, machine has Java 17).
```

## 2. Comentario sugerido para #3213

```md
Nova etapa consolidada no contexto do PR #3218 para sinais complementares de fraude por evidência.

Entregue agora:
- Detecção complementar de overlap, viagem impossível e anomalias de check-in/localização.
- Registro de sinais auditáveis em `game_validation_signals`.
- Sinais de `impossible travel` e `late check-in` incorporados ao cálculo/agregação de validação.
- Score de validação atualizado para considerar essas evidências no status final do jogo.

Validação executada:
- `cd functions && npm run build && npm run lint -- --quiet && npx jest --no-coverage` ✅

Observação de fechamento:
- A lógica está coberta localmente junto da trilha de auto-close e reward gate.
- A issue deve permanecer aberta até merge do PR e sincronização da branch remota.
```

## 3. Comentario sugerido para #3214

```md
Nova etapa consolidada no PR #3218 para fechamento automático orientado por evidência.

Entregue agora:
- Auto-close passou a persistir `auto_close_review_required`.
- O fechamento automático agora também registra metadados de validação:
  - `auto_close_validation_reason`
  - `auto_close_validation_status`
  - `auto_close_validation_score`
- Jogos auto-fechados com baixa confiança/revisão necessária deixam trilha operacional para revisão posterior.
- O auto-close não vira mais sinônimo automático de jogo confiável para fins de recompensa.

Validação executada:
- `cd functions && npm run build && npm run lint -- --quiet && npx jest --no-coverage` ✅

Follow-up operacional:
- Sincronizar branch remota e checks do PR para refletir os commits locais finais antes de fechamento da issue.
```

## 4. Comentario sugerido para #3215

```md
Atualização complementar do PR #3218 para a fila admin de revisão antifraude.

Entregue agora além da etapa já comentada:
- A fila admin Web também passa a incluir jogos com `auto_close_review_required = true`.
- A tela mostra estado específico de revisão por auto-close, score associado e motivo registrado.
- Casos `FINISHED` e `CANCELLED` com revisão por evidência ficam visíveis em um único fluxo administrativo.

Validação executada:
- `cd web && npm run build && npm run lint` ✅

Observação:
- O que falta para refletir isso no PR/issue remotos é apenas sincronização da branch local e rerun dos checks.
```

## 5. Comentario sugerido para #3216

```md
Atualização complementar do PR #3218 para a UX de validação e recompensas retidas.

Entregue agora além da etapa já comentada:
- Android `GameDetailScreen` ganhou estados visuais para:
  - `HELD_FOR_REVIEW`
  - `REJECTED_BY_ADMIN`
  - `APPROVED`
  - `REVIEW_REQUIRED`
  - `LOW_CONFIDENCE`
  - `VALIDATED`
- Modelos/mappers/shared foram alinhados para carregar `validation_*` e `xp_reward_*` no Android.
- No Web, também foram removidos caminhos legados que ainda permitiam escrita direta em eventos/placar ao vivo, reforçando a coerência da UX com o fluxo validado server-side.

Validação executada:
- `./gradlew :shared:compileKotlinMetadata` ✅
- `./gradlew :app:compileDebugKotlin` bloqueado apenas por `google-services.json` ausente, sem erro novo de Kotlin ✅
- `cd web && npm run build && npm run lint` ✅

Observação:
- A paridade local Web/Android está bem mais próxima do fechamento, restando sincronização remota para review final.
```

## 6. Checklist operacional restante

- Fazer push da branch local quando houver permissao GitHub.
- Rerodar checks do PR `#3218` sobre os commits finais.
- Atualizar body do PR com o resumo acima.
- Postar comentarios finais nas issues `#3213`, `#3214`, `#3215`, `#3216`.
- Reexecutar Firestore rules tests localmente em ambiente com Java 21+ ou confiar no CI remoto apos push.
