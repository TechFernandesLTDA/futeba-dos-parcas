# BUGFIX: iOS — tolerância do Firestore e paridade da aba Jogos

> **Status:** `IN_PROGRESS`
> **Severidade:** `MEDIUM`
> **Autor:** opencode
> **Data:** 2026-11-25
> **PR:** (a abrir)
> **Issue:** #4595 (itens 1-4; item 5 — tela de convites no iOS — fica em follow-up)

---

## 1. Riscos (itens 1-4 da #4595)

1. **Um documento com campo de tipo errado derruba a lista inteira** — `FirebaseMappingExtensions.kt` usa `get<Tipo?>` cru; `mapNotNull { it.toGameOrNull() }` falha inteira se um doc lançar (ex.: `daily_price` como texto).
2. **Jogos com presença confirmada somem se um deles não puder mais ser lido** — `getConfirmedGamesForUser` faz `documentId inArray chunk` com um único try/catch: um `permission-denied` descarta o bloco de 10 (reproduzido no emulador: `jogador13` perde tudo). O Android usa a mesma função em `StatisticsRepositoryImpl.getGoalsHistory`.
3. **Aba Jogos do iOS não lista `GROUP_ONLY` sem presença confirmada** — soma só públicos + confirmados; web (#4588) e Android já listam por `group_id`.
4. **Erros viram lista vazia / crash nativo** — `.catch { emit(emptyList()) }` mascara falhas; `data<Map<String, Any?>>()` no `FirebaseFinanceDataSource` lança no Kotlin/Native ("Serializer for class 'Any' is not found", mesmo problema documentado em `FirebaseSafeReads.kt`).

Item 5 — **sub-issue aberta no follow-up**: `InviteRepository` sem registro no iOS (requer impl KMP nova; `shared/` só tem a interface). Fora deste PR: — requer impl KMP nova + `UserRepository`/`GroupRepository` no iOS, complexity 4-5). Requer spec própria.

---

## 2. Solução

### Item 1 — leitura tolerante por campo (todos os mappers)
`get<T?>("x")` → `tryGet<T>("x")` (helper que nunca lança, já existe em `FirebaseSafeReads.kt`, mesmo pacote). Campo de tipo errado vira `null`/default no lugar de derrubar a lista.

### Item 2 — bloco a bloco + fallback por documento
`getConfirmedGamesForUser`: cada chunk `whereIn` em runCatching; se falhar, `document(id).get()` por ID, descartando o que for negado. `Result.success` com o parcial coletado; `Result.failure` só se toda leitura falhar.

### Item 3 — jogos por grupo na aba Jogos
`gamesForList` (iOS): `getUserGroups(userId)` + `getGamesByGroup(groupId)` por grupo, somados a públicos + confirmados (distinctBy id). Tipos de failure de grupo não derrubam a lista.

### Item 4 — callable finance via `JsonElement`
`.data<Map<String, Any?>>()` → `.data<JsonElement>()` + leitura tolerante de `jsonObject` (padrão já usado em `exportMyData`). Observes que emitem `emptyList()` ganham `println` de diagnóstico (trocar `Flow<List>` por `Flow<Result>` quebraria todos os consumidores — fora de escopo).

---

## 3. Verificação

- [x] `:shared:compileKotlinIosSimulatorArm64` + `:app:compileDebugKotlin` (ver PR)
- [ ] Emulador da bateria: `games/bat-jogo-publico` com `daily_price: "dez"` não derruba a aba Jogos (pendente de reviewer)
- [ ] Regra real: `jogador13` mantém os demais jogos confirmados (pendente de reviewer)

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-11-25 | Spec criada (itens 1-4) |
