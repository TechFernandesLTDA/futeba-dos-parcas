# BUGFIX: Projeção sanitizada de disponibilidade de quadra

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Issue:** #3688

---

## 1. Requisitos

### Comportamento atual

`useFieldGames` executa uma consulta cliente em `games` por `field_id` e data.
Como regras do Firestore não filtram resultados, um único jogo `GROUP_ONLY` de
outro grupo ou um documento soft-deleted faz a operação `list` inteira falhar
com `permission-denied`.

### Comportamento esperado

- Usuários autenticados recebem somente os intervalos ocupados necessários para
  montar a agenda da quadra.
- A projeção não expõe ID, título, grupo, dono, visibilidade ou qualquer outro
  metadado do jogo.
- Jogos `GROUP_ONLY` continuam ilegíveis ao não-membro, mas ainda bloqueiam o
  intervalo da agenda sem derrubar a timeline.
- Jogos cancelados, finalizados ou soft-deleted não bloqueiam a agenda.
- O intervalo consultado é validado e limitado a 60 dias.

### Reprodução

1. Criar um jogo `GROUP_ONLY` em uma quadra.
2. Autenticar como jogador que não pertence ao grupo.
3. Abrir a timeline de disponibilidade da mesma quadra.
4. Observar `permission-denied` na consulta direta de `games`.

## 2. UX/UI

Não há alteração visual. A timeline preserva os estados loading, error, empty e
success já existentes. Em sucesso, um jogo privado é apresentado apenas como
intervalo ocupado, sem conteúdo identificável.

## 3. Design técnico

### Abordagem aprovada

Criar o callable autenticado `getFieldAvailability`, protegido por App Check em
produção. A função usa Admin SDK para consultar o intervalo e devolve somente:

```ts
{ slots: [{ date: "yyyy-MM-dd", startMinutes: 1140, endMinutes: 1200 }] }
```

O backend filtra status não bloqueantes, soft-delete e registros malformados.
O hook deixa de abrir listener direto em `games` e passa a consumir essa
projeção. A validação de overlap no submit reutiliza o callable para uma leitura
fresca do dia selecionado. Isso evita usar regras como filtro e mantém o
documento privado fora do cliente.

### Arquivos previstos

- `functions/src/games/field-availability.ts`
- `functions/src/index.ts`
- `functions/test/field-availability.test.ts`
- `web/src/services/cloudFunctions.ts`
- `web/src/hooks/useFieldGames.ts`
- `web/src/hooks/useFieldGames.test.ts`
- `web/src/pages/game/CreateGameScreen.tsx`
- `web/src/pages/game/CreateGameScreen.test.tsx`
- `web/src/utils/fieldAvailability.ts`
- metadados de versão, release notes e decisão arquitetural

### Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Enumeração/abuso | Autenticação, App Check, IDs/datas estritos e janela máxima de 60 dias |
| Vazamento de jogo privado | Resposta allowlist com somente data e minutos do intervalo |
| Registro legado inválido | Ignorar datas/horas/status que não formem slot seguro |
| Resultado aplicado após troca de quadra | Cancelamento lógico no `useEffect` |

## 4. Tarefas

- [x] Registrar spec `APPROVED` e decisão.
- [x] Implementar projeção callable sanitizada.
- [x] Integrar o hook e o submit Web sem consulta direta a `games`.
- [x] Adicionar testes de Functions, do hook e do overlap no submit.
- [x] Executar testes focais, rules, lint e builds de Functions/Web.
- [x] Deixar bump/notas para o release coordenado Web+Functions após o merge.

## 5. Verificação

- Callable rejeita anônimo e payloads inválidos.
- Mistura de `PUBLIC_OPEN` + `GROUP_ONLY` retorna dois slots indistinguíveis.
- Soft-deleted e status não bloqueantes não retornam slot.
- Resposta não contém metadados privados.
- Hook processa slots, calcula conflitos/lotação e trata erro/cancelamento.

### Evidência local

- Functions: 5 testes focais, lint e build aprovados.
- Web: 48 testes focais, lint e build aprovados.
- Firestore Rules: 52 testes de `games`, incluindo outsider sem acesso ao
  `GROUP_ONLY` e player sem acesso ao soft-deleted, aprovados no emulator.

## Histórico

| Data | Autor | Alteração |
| --- | --- | --- |
| 2026-07-14 | Codex | Spec aprovada para implementação da #3688 |
