# SPEC: Suporte a Jogos Masculinos e Femininos (Gênero)

> **Status:** `APPROVED`
> **Autor:** Renan Locatiz Fernandes (via Claude Code)
> **Data:** 2026-06-05
> **PR:** #xxx (preencher quando criar)
> **Plano:** `~/.claude/plans/quero-toda-a-aplicacao-fluffy-pizza.md`

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade
A aplicação não distingue **jogos de homens** de **jogos de mulheres**. O modelo de usuário já tem
`gender` (PII em `users_private`), mas o **jogo** não tem categoria de gênero. Queremos que toda a
aplicação suporte usuários masculinos e femininos e permita criar, filtrar e rankear jogos
Masculinos / Femininos / Mistos.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Dono do Jogo | Cria jogo escolhendo Masculino/Feminino/Misto | Jogo persistido com `gender` |
| UC2 | Dono do Grupo | Define `default_gender` do grupo | Novos jogos do grupo pré-selecionam esse gênero (editável) |
| UC3 | Jogador | Filtra lista de jogos por gênero | Vê só jogos Masculinos, Femininos ou todos |
| UC4 | Jogador | Vê ranking/liga | Pode alternar entre Combinado / Masculino / Feminino |
| UC5 | Jogador (web) | Edita perfil | Pode informar seu gênero (input antes ausente na web) |

### 1.3 Critérios de Aceite

- [ ] CA1: `Game` tem campo `gender` (MALE/FEMALE/MIXED), default `MIXED`, nas 4 plataformas.
- [ ] CA2: `Group` tem `default_gender` opcional; criação de jogo herda mas permite sobrescrever.
- [ ] CA3: Criação de jogo (web + Android) expõe seletor de gênero.
- [ ] CA4: Cards de jogo exibem badge de gênero; listas filtram por gênero.
- [ ] CA5: `season_participation`/liga segmentam por gênero do jogo; UI com toggle Combinado/M/F.
- [ ] CA6: Web ganha input de gênero no perfil, gravando em `users_private`.
- [ ] CA7: Docs legados sem `gender` são lidos como `MIXED` (sem regressão).
- [ ] CA8: Firestore rules validam o valor do gênero; **não** bloqueiam por gênero do usuário (soft).

### 1.4 Fora de Escopo

- **Enforcement rígido**: nenhuma regra impede usuário de confirmar presença em jogo de outro gênero.
- Times balanceados por gênero (o `TeamBalancer` não filtra por gênero nesta versão).
- Segmentar a coleção global `statistics` por gênero (mantida global; segmentação só na liga competitiva).

---

## 2. UX/UI Design

### 2.1 Fluxo

```
[Criar Grupo] --define default_gender--> [Grupo]
[Criar Jogo] --herda default do grupo (editável)--> [Jogo c/ gender]
[Lista de Jogos] --filtro gênero--> [Jogos filtrados]
[Liga/Ranking] --toggle Combinado/M/F--> [Ranking segmentado]
```

### 2.2 Estados obrigatórios
Toda tela alterada mantém `Loading` / `Empty` / `Error` / `Success` já existentes. O filtro/toggle de
gênero não introduz nova tela, apenas controle dentro das telas existentes.

### 2.3 Responsividade / Acessibilidade
- Seletor de gênero: touch target ≥ 48dp, `contentDescription`/`aria-label`.
- Badge de gênero usa tokens de tema (sem cor hardcoded).

---

## 3. Technical Design

### 3.1 Modelo
- Enum `GameGender { MALE, FEMALE, MIXED }` (`@Serializable`+`@SerialName`, padrão de `GameVisibility`).
- `Game.gender: String = "MIXED"` (Firestore `gender`).
- `Group.defaultGender: String? = null` (Firestore `default_gender`).
- `season_participation`: novo campo `gender`; `partId = ${seasonId}_${gender}_${uid}`.
  Combinado = soma client-side das linhas M/F/Misto do usuário.

### 3.2 Camadas
- **Shared (KMP):** `GameGender.kt`, `Game.kt`, `Group.kt`, `GameQueryModels.kt`, `GameQueryRepository.kt`.
- **Android:** `data/model/Game.kt`, `data/model/Group.kt`, criação de jogo/grupo, cards, filtros, rankings.
- **Web:** `types/game.ts`, `types/group.ts`, `CreateGameScreen.tsx`, `useGames.ts`, perfil, discover, liga.
- **Functions:** `constants.ts`, `game/helpers.ts` (updateSeasonParticipation), `index.ts`, `mvp-voting.ts`,
  `league.ts`, `season/index.ts`, `leaderboard-cache.ts`.
- **Rules/índices:** `firestore.rules` (validação), `firestore.indexes.json` (composites).

### 3.3 Compatibilidade / Migração
- Leitura tolerante: ausência de `gender` ⇒ `MIXED`.
- Backfill opcional de `season_participation` (season reseta mensalmente → impacto histórico baixo).

---

## 4. Tasks
Ver fases 1–5 no plano. Entrega faseada; cada fase é PR-able e verificável (build/test/emulador).

---

## 5. Verify
1. Build/test: functions (`npm run build` + jest), Android (`compileDebugKotlin`), web (`build` + vitest).
2. Rules-test no emulador (gênero válido aceito, inválido negado; sem bloqueio por usuário).
3. Playwright web: grupo `default_gender=FEMALE` → jogo herda Feminino → badge → filtro funciona.
4. Ranking: jogo M + jogo F finalizados → docs `..._MALE_..`/`..._FEMALE_..` → toggle reflete.
5. Paridade web↔Android.
