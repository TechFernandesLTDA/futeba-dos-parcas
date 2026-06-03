# SPEC: Paridade de Validação na Criação de Jogo (Android) — maxGoalkeepers + numberOfTeams

> **Status:** `APPROVED`
> **Autor:** Renan (via Claude)
> **Data:** 2026-06-03
> **PR:** #xxx (preencher quando criar)
> **Épico:** #2400

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O formulário de criação de jogo do **Web** coleta e valida dois campos que o **Android NÃO expõe**, gerando divergência de produto entre plataformas:

- `maxGoalkeepers` — Web valida máximo 4 (`web/src/utils/validationConstants.ts:5` `MAX_GOALKEEPERS: 4`, aplicado em `CreateGameScreen.tsx:464-465`).
- `numberOfTeams` — Web valida intervalo 2..4 (`validationConstants.ts:6-7` `MIN_TEAMS: 2, MAX_TEAMS: 4`, aplicado em `CreateGameScreen.tsx:467-469`).

No Android, `CreateGameViewModel.kt` não coleta nem valida nenhum dos dois. Os defaults existem no modelo compartilhado (`shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/Game.kt`: `maxGoalkeepers: Int = 3`, `numberOfTeams: Int = 2`) mas a UI **nunca os seta** — todo jogo criado no Android herda o default silenciosamente, sem controle do organizador.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Dono do Jogo (Android) | Define quantos goleiros no máximo o jogo aceita | Valor salvo em `game.maxGoalkeepers`, validado 1..4 |
| UC2 | Dono do Jogo (Android) | Define em quantos times o jogo será dividido | Valor salvo em `game.numberOfTeams`, validado 2..4 |
| UC3 | Dono do Jogo (Android) | Tenta salvar valor fora do range | Erro inline no campo, criação bloqueada |

### 1.3 Critérios de Aceite

- [ ] CA1: Form de criação Android expõe campo **Máximo de goleiros** (range 1..4, default 3), espelhando web.
- [ ] CA2: Form de criação Android expõe campo **Número de times** (range 2..4, default 2), espelhando web.
- [ ] CA3: Validação client-side bloqueia salvar fora do range, com mensagem em `strings.xml`.
- [ ] CA4: Constantes de validação alinhadas entre web (`validationConstants.ts`) e Android — fonte única documentada (ver §3.2).
- [ ] CA5: Jogo criado no Android persiste os valores escolhidos (não o default) no Firestore.
- [ ] CA6: Sem regressão na criação web; firestore.rules aceita os campos (verificar se já valida range).

### 1.4 Fora de Escopo

- iOS (CMP Fase 3 — paridade tratada lá).
- Edição dos campos pós-criação (apenas fluxo de criação).
- Mudança da lógica de geração de times (apenas o input do número).

---

## 2. UX/UI Design

### 2.1 Fluxo de Navegação

```
[CreateGameScreen] --preenche maxGoalkeepers/numberOfTeams--> validação inline
                   --valores OK + submit--> [Jogo criado] --> [GameDetail]
                   --valores inválidos--> erro inline no campo (sem navegar)
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| CreateGameScreen (Configurações) | Success | Dois campos numéricos (stepper +/- ou dropdown) na seção ⚙️ Configurações |
| CreateGameScreen | Error | Mensagem inline abaixo do campo quando fora do range |

Posicionar na mesma seção onde já fica `maxPlayers` (seção de configurações do jogo). Preferir **stepper (+/-)** ou **ExposedDropdownMenu** para ranges pequenos, evitando teclado.

### 2.3 Responsividade

| Configuração | Comportamento |
|--------------|---------------|
| Phone Portrait | Campos empilhados na seção Configurações |
| Phone Landscape / Tablet | Campos podem ficar lado a lado (Row) se houver espaço |

### 2.4 Acessibilidade

- [ ] `contentDescription` nos botões +/- do stepper ("Aumentar goleiros", "Diminuir times")
- [ ] Touch targets >= 48dp
- [ ] Labels via `strings.xml`
- [ ] TalkBack anuncia valor atual e range válido

---

## 3. Technical Design

### 3.1 Arquitetura

```
[CreateGameScreen.kt: Composable]
    ↓ onMaxGoalkeepersChange / onNumberOfTeamsChange
[CreateGameViewModel.kt: StateFlow<CreateGameUiState>]
    ↓ validação (mesmos ranges do web)
[GameRepository.createGame] → Firestore games/
```

### 3.2 Modelos de Dados

Modelo já existe (`Game.kt`): `maxGoalkeepers`, `numberOfTeams`. **Não alterar o modelo.** Adicionar ao state do ViewModel:

```kotlin
// shared/src/commonMain/kotlin/com/futebadosparcas/domain/validation/GameValidation.kt
object GameValidation {
    const val MIN_GOALKEEPERS = 1
    const val MAX_GOALKEEPERS = 4
    const val DEFAULT_MAX_GOALKEEPERS = 3
    const val MIN_NUMBER_OF_TEAMS = 2
    const val MAX_NUMBER_OF_TEAMS = 4
    const val DEFAULT_NUMBER_OF_TEAMS = 2

    fun isGoalkeepersValid(v: Int) = v in MIN_GOALKEEPERS..MAX_GOALKEEPERS
    fun isNumberOfTeamsValid(v: Int) = v in MIN_NUMBER_OF_TEAMS..MAX_NUMBER_OF_TEAMS
}

// CreateGameViewModel.kt — consome do KMP (não redeclara)
private val _maxGoalkeepers = MutableStateFlow(GameValidation.DEFAULT_MAX_GOALKEEPERS) // 3
private val _numberOfTeams = MutableStateFlow(GameValidation.DEFAULT_NUMBER_OF_TEAMS)   // 2
```

**Decisão APROVADA (2026-06-03):** constantes vão para **`shared/commonMain`** (KMP) como fonte-única cross-platform. Criar `GameValidation` (object) em `shared/src/commonMain/kotlin/com/futebadosparcas/domain/validation/` com `MIN_GOALKEEPERS=1`, `MAX_GOALKEEPERS=4`, `DEFAULT_MAX_GOALKEEPERS=3`, `MIN_NUMBER_OF_TEAMS=2`, `MAX_NUMBER_OF_TEAMS=4`, `DEFAULT_NUMBER_OF_TEAMS=2`. `CreateGameViewModel` consome essas constantes (não redeclara). Web `validationConstants.ts` deve receber comentário apontando o KMP como fonte canônica (alinhamento manual até futura geração de código compartilhado).

### 3.3 API / Firestore

| Operação | Collection | Método | Payload |
|----------|-----------|--------|---------|
| Criar jogo | `games` | POST | `{..., maxGoalkeepers: Int, numberOfTeams: Int}` |

Verificar `firestore.rules` para `games` create: se já valida ranges de outros campos numéricos, adicionar `maxGoalkeepers` 1..4 e `numberOfTeams` 2..4 para consistência server-side (defesa em profundidade — não confiar só no client).

### 3.4 Cache e Offline

Sem mudança no comportamento offline — criação já enfileira via repository existente.

### 3.5 Segurança

- [ ] Validação no client E (idealmente) nas firestore.rules
- [ ] Sem secrets

### 3.6 Performance

- [ ] Campos simples, sem impacto em recomposição (usar `remember` para o stepper local se necessário)

### 3.7 Analytics

| Evento | Quando | Parâmetros |
|--------|--------|------------|
| `game_created` (existente) | Ao criar | adicionar `max_goalkeepers`, `number_of_teams` |

---

## 4. Tasks (Breakdown)

| # | Task | Estimativa | Status |
|---|------|------------|--------|
| 1 | Adicionar constantes + state ao `CreateGameViewModel` | 0.5h | ⬜ |
| 2 | Lógica de validação (range) + mensagens em `strings.xml` | 1h | ⬜ |
| 3 | UI: dois campos (stepper/dropdown) na seção Configurações | 2h | ⬜ |
| 4 | Wire dos valores no `createGame` (substituir default) | 0.5h | ⬜ |
| 5 | Atualizar firestore.rules (range server-side) | 1h | ⬜ |
| 6 | Testes unitários ViewModel (boundary: 0,1,4,5 goleiros / 1,2,4,5 times) | 1.5h | ⬜ |
| 7 | Teste UI Compose (campos visíveis + erro fora range) | 1h | ⬜ |

**Total estimado:** ~7.5h

---

## 5. Verification

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Unit (ViewModel) | Boundaries de range, default, persistência | ⬜ |
| UI (Compose) | Campos exibidos, erro inline | ⬜ |
| Rules (emulator) | Reject fora do range | ⬜ |

### 5.2 Checklist de Revisão

- [ ] `:app:compileDebugKotlin` passa
- [ ] `:app:testDebugUnitTest` passa
- [ ] Strings em `strings.xml`
- [ ] Paridade visual/comportamental com web confirmada
- [ ] Sem regressão na criação web

---

## 6. Notas e Referências

- Issue/Épico: #2400
- Paridade web: `web/src/utils/validationConstants.ts`, `web/src/pages/game/CreateGameScreen.tsx:464-469`
- Modelo: `shared/src/commonMain/kotlin/com/futebadosparcas/domain/model/Game.kt`
- Memory: `project_epics_2397_2401_worklist`

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-06-03 | Claude | Criação inicial (DRAFT) |
