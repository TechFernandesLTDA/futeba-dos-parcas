# FEAT: iOS — banner de status de recompensas no detalhe do jogo (#4629 follow-up)

> **Status:** `IN_PROGRESS`
> **Severidade:** `LOW`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4629 ("o iOS nem mostra que o jogo está em análise")

---

## Diagnóstico

O `Game` KMP não modela `xp_reward_status` — a leitura `toGameOrNull` descarta o campo, então o iOS/composeApp não exibe nenhum estado de recompensa (HELD_FOR_REVIEW/ELIGIBLE/INELIGIBLE_MIN_PLAYERS/REJECTED) no detalhe do jogo. Web e Android têm banners (#4629 item 8); o iOS mostra nada.

## Solução

1. `Game` (shared/commonMain): `@SerialName("xp_reward_status") val xpRewardStatus: String? = null` (+ `xp_reward_hold_reasons`? — guardar só status; motivos ficam no servidor p/ admin).
2. Mapper `toGameOrNull`: lê `xp_reward_status`/`xpRewardStatus` tolerante.
3. `GameDetailHub` (App.kt): card informativo quando houver status de recompensa pendente ou perdido (textos em composeResources — valores en/es/pt? o iOS segue PT interno + strings existentes; adicionar pt/en/es alinhadas ao Android onde já existirem).

## Verificação

- [ ] `:shared:compileKotlinIosSimulatorArm64` + `:composeApp:` link iOS
- [ ] smoke em Simulador (pendente de reviewer)
