# SPEC: Sugestão Inteligente de Horário na Criação (Web)

> **Status:** `APPROVED`
> **Autor:** Renan (via Claude)
> **Data:** 2026-06-03
> **PR:** #xxx (preencher quando criar)
> **Épico:** #2397

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

O épico #2397 (paridade web de criação) está **5/6 completo**: auto-save de rascunho (`useGameDraft`), auto-convite de membros (`useAutoInviteMembers`, wired com default true) e form single-page já existem. Sobra **um gap menor**: a **sugestão inteligente de horário** não está ligada.

Os hooks `usePopularTimes` e `useHabitualTime` **já estão importados** em `web/src/pages/game/CreateGameScreen.tsx:69-70` mas **não são usados** para pré-popular o horário — os slots são hardcoded (`CreateGameScreen.tsx:49-54`) e o valor vem só do input manual. Resultado: o organizador digita o horário do zero toda vez, mesmo o grupo jogando sempre no mesmo dia/horário.

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Dono do Jogo | Seleciona um grupo ao criar jogo | Horário/dia pré-preenchido com o mais habitual do grupo |
| UC2 | Dono do Jogo | Vê sugestões de horários populares | Chips/atalhos com os horários mais usados pelo grupo |
| UC3 | Dono do Jogo | Ignora a sugestão e digita outro | Input manual sobrepõe a sugestão sem fricção |

### 1.3 Critérios de Aceite

- [ ] CA1: Ao escolher o grupo, o campo de horário é pré-preenchido com o horário habitual (`useHabitualTime`) se houver histórico.
- [ ] CA2: Horários populares (`usePopularTimes`) aparecem como atalhos/chips clicáveis.
- [ ] CA3: Pré-preenchimento é **sugestão, não trava** — o usuário pode sobrescrever livremente.
- [ ] CA4: Sem histórico → comportamento atual (slots padrão), sem erro nem campo vazio quebrado.
- [ ] CA5: Não há regressão no auto-save de rascunho (a sugestão não deve sobrescrever um rascunho restaurado).

### 1.4 Fora de Escopo

- Android/iOS (este gap é específico do web; avaliar paridade depois).
- Machine learning / previsão — apenas agregação simples do histórico (moda de dia/horário).
- Sugestão de local (escopo de outro épico).

---

## 2. UX/UI Design

### 2.1 Fluxo

```
[Seleciona grupo] --tem histórico--> horário pré-preenchido + chips de horários populares
                  --sem histórico--> slots padrão (comportamento atual)
[Restaura rascunho] --> rascunho tem prioridade sobre a sugestão
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| CreateGameScreen (seção Data/Horário) | Success c/ histórico | Campo pré-preenchido + linha de chips "Horários comuns: 19h, 20h…" |
| CreateGameScreen | Success s/ histórico | Slots padrão atuais |
| CreateGameScreen | Loading sugestão | Skeleton leve no espaço dos chips enquanto `usePopularTimes` carrega |

### 2.3 Acessibilidade

- [ ] Chips com role de botão e label ("Sugerir 19:00")
- [ ] Contraste via tokens MUI (`theme.palette.*`)
- [ ] Foco navegável por teclado

---

## 3. Technical Design

### 3.1 Arquitetura

```
[CreateGameScreen.tsx]
  selectedGroupId muda → usePopularTimes(groupId), useHabitualTime(groupId)
  → se !draftRestaurado && habitualTime → setFormData(time = habitualTime)
  → render chips de popularTimes
```

### 3.2 Pontos de Integração

- `web/src/pages/game/CreateGameScreen.tsx:69-70` — hooks já importados; **wire** seus retornos.
- Efeito: `useEffect([selectedGroupId, draftRestored])` que só pré-preenche se NÃO veio de rascunho restaurado (CA5).
- Não remover os slots hardcoded (`:49-54`) — viram fallback.

### 3.3 Dados

`usePopularTimes`/`useHabitualTime` já existem — verificar a fonte (provável agregação de `games` do grupo). Se fizerem reads pesados, garantir cache (TanStack Query já em uso) e `enabled: !!groupId`.

### 3.4 Performance

- [ ] Query habilitada só com `groupId` (`enabled`)
- [ ] Sem recomputar chips a cada render (`useMemo`)
- [ ] Skeleton leve, não bloquear o form

### 3.7 Analytics

| Evento | Quando | Parâmetros |
|--------|--------|------------|
| `game_create_time_suggested` | Sugestão exibida | `group_id`, `had_history: bool` |
| `game_create_time_suggestion_used` | Usuário clica chip | `time` |

---

## 4. Tasks (Breakdown)

| # | Task | Estimativa | Status |
|---|------|------------|--------|
| 1 | Wire `useHabitualTime` → pré-preencher (guardando contra rascunho) | 1.5h | ⬜ |
| 2 | Render chips de `usePopularTimes` + clique preenche | 1.5h | ⬜ |
| 3 | Estados loading/empty (sem histórico = fallback) | 1h | ⬜ |
| 4 | Analytics | 0.5h | ⬜ |
| 5 | Testes Vitest (com/sem histórico, rascunho tem prioridade) | 1.5h | ⬜ |

**Total estimado:** ~6h

---

## 5. Verification

### 5.1 Testes

| Tipo | Cobertura | Status |
|------|-----------|--------|
| Web (Vitest) | pré-preenche c/ histórico; fallback s/ histórico; rascunho prioritário | ⬜ |

### 5.2 Checklist

- [ ] `npm run test` (web) verde
- [ ] `npm run lint` verde
- [ ] i18n: textos novos em pt-BR/en/es (passar `i18n-key-parity.test.ts`)
- [ ] Tokens MUI (sem cor hardcoded)
- [ ] Sem regressão no auto-save de rascunho

---

## 6. Notas e Referências

- Épico: #2397
- Hooks: `usePopularTimes`, `useHabitualTime` (já importados em `CreateGameScreen.tsx:69-70`)
- Memory: `project_epics_2397_2401_worklist`

---

## Histórico de Alterações

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-06-03 | Claude | Criação inicial (DRAFT) |
