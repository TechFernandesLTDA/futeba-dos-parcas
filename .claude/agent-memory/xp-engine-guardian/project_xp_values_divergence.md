---
name: XP values divergence — JSON vs documentation
description: xp-constants.json backend values differ significantly from CLAUDE.md table and agent system prompt
type: project
---

Backend source of truth is `functions/src/_constants/xp-constants.json` (and `shared/xp-constants.json`). Values: GOAL=10, ASSIST=7, MVP=30, STREAK_3=20, STREAK_10=100. CLAUDE.md Quick Reference table shows GOAL=5, ASSIST=3, MVP=50, STREAK_3=10, STREAK_10=30 — completely different.

**Why:** Likely documentation was written from an earlier design spec and never updated when JSON was changed.

**How to apply:** When writing new XP-related code or documentation, always read `functions/src/_constants/xp-constants.json` first — do NOT use values from CLAUDE.md XP table. Issue #439 tracks the fix.
