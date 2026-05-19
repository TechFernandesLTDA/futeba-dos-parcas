# SPEC: Web — Lista de Espera (Waitlist) com paridade Android

> **Status:** `DRAFT`
> **Autor:** Claude (auditoria web 2026-05-18)
> **Data:** 2026-05-18
> **PR:** #xxx (preencher quando criar)
> **Issues:** #1336 (umbrella), #1344 (epic auditoria web)

---

## 1. Requirements (Requisitos)

### 1.1 Problema / Oportunidade

A versão **web** não implementa lista de espera. Quando um jogo está lotado:
- `HomeTab.tsx` exibe stub literal: `"Jogo lotado! Entre na lista de espera (em breve)"`.
- `GameDetailScreen.tsx` não promove ninguém automaticamente quando um confirmado cancela.

O Android já tem waitlist + auto-promote. Usuários web ficam sem fluxo para entrar
em jogo lotado, e vagas liberadas não são preenchidas — perda de engajamento e de
paridade de plataforma (regra do projeto: paridade total web/Android/iOS).

### 1.2 Casos de Uso

| ID | Ator | Ação | Resultado esperado |
|----|------|------|-------------------|
| UC1 | Jogador | Toca "Entrar na lista de espera" em jogo lotado | Entra na waitlist; vê posição na fila |
| UC2 | Jogador confirmado | Cancela presença | 1º da waitlist é promovido a CONFIRMED automaticamente |
| UC3 | Jogador promovido | — | Recebe notificação "você foi promovido"; jogo aparece em "confirmados" |
| UC4 | Jogador na waitlist | Sai da lista de espera | Removido; fila reindexada |
| UC5 | Dono do jogo | Vê lista de confirmados + waitlist | Waitlist visível e ordenada por entrada |

### 1.3 Critérios de Aceite

- [ ] CA1: Jogo lotado mostra botão funcional "Entrar na lista de espera" (sem "em breve")
- [ ] CA2: Cancelamento de confirmado promove 1º da waitlist (transação atômica, sem race)
- [ ] CA3: Promoção dispara notificação para o promovido
- [ ] CA4: Posição na fila exibida ao jogador na waitlist
- [ ] CA5: Comportamento idêntico ao Android (mesma collection/schema, doc id determinístico)
- [ ] CA6: Estados loading/empty/error/success na UI de waitlist
- [ ] CA7: Promoção feita server-side (Cloud Function) para evitar race entre clientes

### 1.4 Fora de Escopo

- Waitlist com prioridade/ranking (FIFO simples nesta versão)
- Limite configurável de tamanho da waitlist
- Auto-promote em massa (apenas 1 vaga por cancelamento)

---

## 2. UX/UI Design

### 2.1 Fluxo

```
[Jogo lotado] --tap "Entrar na lista de espera"--> [Waitlist, posição N]
[Confirmado cancela] --CF onPresenceCancelled--> [Promove waitlist[0]] --notif--> [Promovido CONFIRMED]
```

### 2.2 Telas e Estados

| Tela | Estado | Descrição |
|------|--------|-----------|
| HomeTab card | Success | Botão "Entrar na lista de espera" ativo quando `isFull` |
| GameDetailScreen | Success | Seção "Lista de espera (N)" com nomes ordenados |
| GameDetailScreen | Loading | Skeleton enquanto carrega waitlist |
| GameDetailScreen | Error | Mensagem + retry |
| Qualquer | Action pending | Botão desabilitado + spinner inline durante join/leave |

### 2.3 Responsividade
Mobile e desktop: seção waitlist abaixo de confirmados; sem barra fixa sobrepondo.

### 2.4 Acessibilidade
- [ ] Botão waitlist com `aria-label`; estado (na fila / posição) anunciado
- [ ] Touch target ≥ 48px

---

## 3. Technical Design

### 3.1 Arquitetura
Reuso do padrão Android: server-side promote via Cloud Function (idempotente,
transação) para evitar race entre clientes concorrentes. Cliente web só faz
join/leave; promoção NUNCA no cliente.

### 3.2 Modelos / Firestore

| Operação | Collection | Método | Notas |
|----------|-----------|--------|-------|
| Join waitlist | `games/{id}/waitlist/{userId}` | set | doc id determinístico `{userId}`; `joinedAt: serverTimestamp()` |
| Leave waitlist | `games/{id}/waitlist/{userId}` | delete | reindex via query orderBy joinedAt |
| Auto-promote | Cloud Function `onPresenceCancelled` (ou trigger em confirmations) | transaction | lê waitlist orderBy joinedAt limit 1 → cria confirmation → deleta waitlist doc → notifica |

Conferir schema/collection exata usada no Android (paridade obrigatória) antes de implementar.

### 3.3 Segurança
- [ ] `firestore.rules`: `games/{id}/waitlist/{userId}` — create/delete só pelo próprio user autenticado e membro do grupo; promote só por CF (service account)
- [ ] Validação server-side: não promover se jogo não está SCHEDULED/CONFIRMED

### 3.4 Performance / Race
- [ ] Promoção em `runTransaction` server-side — único ponto de verdade, sem race entre N clientes cancelando simultaneamente
- [ ] Idempotência: se waitlist vazia, no-op; se já promovido, no-op

---

## 4. Tasks (Breakdown)

| # | Task | Est. | Status |
|---|------|------|--------|
| 1 | Auditar schema waitlist do Android (paridade) | 1h | ⬜ |
| 2 | firestore.rules p/ subcollection waitlist + testes emulador | 2h | ⬜ |
| 3 | Cloud Function auto-promote (transação, idempotente) + Jest | 4h | ⬜ |
| 4 | Hook web `useWaitlist` (join/leave/position) | 3h | ⬜ |
| 5 | UI HomeTab + GameDetailScreen (estados) | 4h | ⬜ |
| 6 | Notificação de promoção (reuso de notifications.ts) | 2h | ⬜ |
| 7 | Testes (Vitest + E2E) + paridade Android | 3h | ⬜ |

**Total estimado:** ~19h

---

## 5. Verification

- [ ] Rules testadas no emulador (skill `/futeba-firestore-rules`)
- [ ] CF testada com Jest (concorrência: 2 cancels simultâneos → 1 promoção)
- [ ] Build/lint/test web verdes
- [ ] Paridade verificada vs Android (mesmo schema/fluxo)
- [ ] Sem regressão em confirm/cancel presence existente

---

## 6. Notas e Referências

- Issues: #1336, #1344
- Stub atual: `web/src/pages/home/tabs/HomeTab.tsx` ("(em breve)"), `web/src/pages/game/GameDetailScreen.tsx`
- Decisão: promoção SEMPRE server-side (race entre clientes) — registrar em `/specs/DECISIONS.md` ao aprovar
- **Bloqueador:** requer aprovação de produto (status DRAFT) e wave dedicada — NÃO implementar nesta sessão

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-05-18 | Claude | Criação inicial (gate SDD Regra #1; impl adiada) |
