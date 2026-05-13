# Spec: Paridade Android↔Web — Audit 2026-05-13

**Status:** APPROVED
**Tipo:** AUDIT + BUG WAVE
**Origem:** 30 agents paralelos auditando paridade feature-by-feature; 26 retornaram (4 rate-limited: P02, P22, P23, P27)
**Models:** Sonnet/general-purpose + validação Ollama (gpt-oss:20b, qwen2.5-coder:14b, phi4:14b)

---

## Resumo executivo

Web está **MUITO atrás** do Android em várias features core. Catálogo de **26 reports** consolidados em **18 issues HIGH/CRITICAL** + 4 umbrella issues p/ feature gaps grandes.

## Bugs CRÍTICOS abertos como issues

### Real bugs (não feature gaps)

| Issue | Severity | Plataforma | Resumo |
|---|---|---|---|
| #1136 | high | android | GameDetailScreen nunca renderiza waitlist (VM expõe, Screen ignora) |
| #1137 | high | android | ConfirmationCard/TeamCard passa `teamId=null` hardcoded (favoriteTeam invisível) |
| #1138 | critical | web/android | MVP voting schema divergente (web `mvp_votes/{gameId}_{voterId}` vs Android multi-doc) — votos web podem não agregar no CF tally |
| #1139 | medium | web | About + DevTools versão hardcoded (1.21.3/1.10.7 vs real 1.22.0) |
| #1141 | high | android | UserManagement `updateUserRole` write direto (não usa callable PERF_001) |
| #1142 | critical | android | Sem fluxo in-app delete account (LGPD art.18) |
| #1163 | medium | web | GameDetailScreen edit button é TODO comentado |
| #1167 | critical | android | PublicGamesMapScreen é placeholder hardcoded |
| #1168 | high | android | Login só Google (sem email/password) — RegisterScreen "descontinuada" |
| #1169 | high | web | ProfileSetup data loss (nickname/position/fieldTypes hardcoded null) |
| #1170 | high | web | Sem `persistentLocalCache` Firestore (sem offline cache) |
| #1171 | high | web | GroupSettings sem promote/demote/kick/transferOwnership (4 actions) |
| #1172 | high | web/android | Badge catalog divergente (Android 11 enum vs Web 16 IDs) |
| #1173 | critical | web | EditProfile avatar upload FAKE (nunca chama Firebase Storage) |

### Outros achados HIGH não issued (umbrella nas seções abaixo)

- **P09 LiveGame**: Web add-event Dialog sem team selector, sem campo minuto, ASSIST como event standalone (vs Android assist como campo do GOAL)
- **P07 CreateGame**: Web sem group selector dropdown, sem recurrence, visibility 2-tier (Android 3-tier), conflito horário só on-submit
- **P12 TeamFormation**: Web ~10% das features Android (sem auto-balance real, sem captain picks, sem saved formations, sem GK enforcement, sem pairs, sem colors)
- **P11 PostGameReport**: Web sem XP earned, level-up celebration, badges unlocked, share WhatsApp, resumo financeiro, listas presentes/ausentes/devedores
- **P26 Cashbox**: Web ~30% Android (sem 9 categorias, sem upload recibo, sem relatórios totals_by_category, sem void, sem filtros)
- **P04 Home/Tabs**: Web sem Challenges, RecentBadgesCarousel, PublicGamesSuggestions, OnboardingCard CTAs, deep link FCM
- **P19 Statistics**: Web sem chart library (Android tem Vico+MPAndroidChart instalados), WeeklyRecap minimalista vs Android stories-style
- **P18 Players**: Divergência conceitual — Android é índice global com filtros/sort/compare/invite; Web é group-scoped sem filtros
- **P29 DevTools/Admin**: Versão hardcoded, sem Firestore inspector/FCM tester/Force XP recalc em ambos
- **P28 Settings**: Android sem theme selector funcional, sem language switcher, sem notif UI, sem delete account in-app
- **P05 Profile**: Web Edit sem gender/birthDate/height/weight/dominantFoot/secondaryPosition/playStyle/experienceYears/preferredFieldTypes/4 position ratings
- **P30 FCM**: Token schema divergente (Android `fcmToken` campo vs Web `fcmTokens` array) — CFs precisam ler ambos OU migrar
- **P30 LGPD**: Android sem in-app delete (#1142)
- **P20 Badges**: Sem detail modal no Web, sem category filter, sem unlock animation, sem badges section no ProfileScreen
- **P21 Rankings**: Web sem filtros período (week/month/year), sem categorias ASSISTS/SAVES/GAMES/WINS, sem pódio top-3 visual
- **P15 Group**: Web sem add-block-player (só remove), permission inconsistente
- **P14 Group**: Web Edit sem photo upload, Android sem isPublic toggle, web sem archive group
- **P13 Groups**: Web CreateGroup upload de logo FAKE (IconButton sem handler) [duplica P05 padrão]
- **P25 Maps**: Web sem marker clustering, ambos sem my-location functional, sem filters reais
- **P24 FieldOwner**: Ambos sem booking system real, dashboards com KPIs fake
- **P16 InvitePlayers**: Android sem share-link/QR na tela, deep link domain diverge web/android
- **P17 Discover**: Android sem JoinByInviteScreen (DeepLink parseado mas não consumido)

## Recomendação de execução

**Crítico (fix imediato):**
- #1138 schema MVP (votos perdidos), #1142 LGPD Android, #1167 PublicGamesMap, #1173 avatar upload fake

**HIGH (1-2 semanas):**
- #1136, #1137, #1141, #1168, #1169, #1170, #1171, #1172 + LiveGame add-event, CreateGame group selector + recurrence

**Feature gaps (spec separada por epic):**
- Spec PostGameReport completion → traz XP/level-up/badges/share/financial pro web
- Spec TeamFormation completion → traz auto-balance/captain/saved/colors pro web
- Spec Cashbox completion → traz categorias/recibo/relatórios pro web
- Spec Statistics completion → adiciona chart library no web
- Spec FCM token schema unification → migra para schema único
- Spec Badge catalog unification → mover pra shared/xp-constants.json

## Não fazer

- Não criar issues separadas por feature gap (explodiria 100+ issues). Usar specs/epics.
- Não bulk-fix sem spec aprovada (Regra #1 SDD)
- Não tocar package-lock.json em fixes que não adicionam deps
