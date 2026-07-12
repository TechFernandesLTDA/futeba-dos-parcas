# IMPROVEMENT (Web/UX): Limitar total visível do FirstStepsChecklist

> **Status:** `TRIAGED`
> **Tipo:** UX improvement / follow-up
> **Plataforma:** Web (`web/`)
> **Autor:** SDD research
> **Data:** 2026-07-12
> **Origem:** Handoff issue #3556 — "Avaliar limitar o total visível do `FirstStepsChecklist`; `maxIncomplete` hoje limita só pendentes."
> **PR:** (a definir)

---

## 1. Contexto e Descrição

### 1.1 Comportamento Atual

O componente `FirstStepsChecklist` expõe uma prop `maxIncomplete` que limita apenas a
quantidade de itens **pendentes (incompletos)** exibidos. Itens **concluídos** são
**sempre** renderizados, independentemente do limite. Conforme o usuário avança no
onboarding, o total visível cresce (concluídos sempre na tela + pendentes até o
limite), deixando o card progressivamente mais longo.

### 1.2 Comportamento Esperado (a avaliar)

Avaliar se devemos introduzir um limite no **total visível** (concluídos + pendentes)
para manter o card compacto, sem perder o reforço positivo de mostrar progresso
recente.

### 1.3 Localização do componente

| Item | Valor |
|------|-------|
| Componente | `web/src/components/onboarding/FirstStepsChecklist.tsx` |
| Testes | `web/src/components/onboarding/FirstStepsChecklist.test.tsx` |
| Spec original | `specs/feat-2026-05-16-modern-onboarding-tour.md` §2.3 |

### 1.4 Definição dos passos (origem dos dados)

Os passos **NÃO** são checkboxes manuais — são derivados de dados de domínio (perfil,
grupos, jogos, membros, caixa). Não há timestamp de conclusão, apenas o boolean
`completed`.

- **Player checklist** (`web/src/pages/home/tabs/HomeTab.tsx:799`): **4 passos**
  (`complete_profile`, `join_or_create_group`, `confirm_presence`, `play_first_game`).
- **Owner checklist** (`web/src/pages/group/GroupDetailScreen.tsx:761`): **5 passos**
  (`configure_group`, `invite_players`, `reach_min_members`, `create_first_game`,
  `open_cashbox`).

> Observação importante: ambos os call sites escondem o card inteiro quando **todos**
> os passos estão concluídos (`checklistVisible` / `ownerChecklistVisible` exigem
> `.some(s => !s.completed)`). Logo, o problema do "total crescendo" manifesta-se
> apenas nos **estados intermediários** (parte concluída, parte pendente).

---

## 2. Análise da Lógica Atual (`maxIncomplete`)

### 2.1 Código atual (quote exato)

`web/src/components/onboarding/FirstStepsChecklist.tsx:60-97`:

```tsx
  /** Max incomplete items shown before truncation (default: all). */
  maxIncomplete?: number;
```

```tsx
export function FirstStepsChecklist({ steps, visible, onDismiss, title, progressLabel, maxIncomplete }: FirstStepsChecklistProps) {
  // ...
  const visibleSteps: ChecklistStep[] = [];
  const hiddenSteps: ChecklistStep[] = [];
  let incompleteShown = 0;
  const limit = maxIncomplete ?? steps.length;

  for (const step of steps) {
    if (step.completed) {
      visibleSteps.push(step);          // <-- concluídos SEMPRE visíveis (sem limite)
    } else if (incompleteShown < limit) {
      visibleSteps.push(step);
      incompleteShown++;
    } else {
      hiddenSteps.push(step);           // <-- apenas pendentes são truncados
    }
  }
  const truncated = hiddenSteps.length > 0;
```

- Concluídos: `visibleSteps.push(step)` incondicionalmente.
- Pendentes: contados até `limit`; excedentes vão para `hiddenSteps` (exibidos no
  `Collapse` "mostrar mais").

### 2.2 Call sites e valores atuais de `maxIncomplete`

| # | Arquivo | Linha | Contexto | `maxIncomplete` |
|---|---------|-------|----------|-----------------|
| 1 | `web/src/pages/home/tabs/HomeTab.tsx` | 1113 | Player checklist — layout desktop (md+) em `Grid` | `2` |
| 2 | `web/src/pages/home/tabs/HomeTab.tsx` | 1149 | Player checklist — layout mobile (`xs`) | `2` |
| 3 | `web/src/pages/group/GroupDetailScreen.tsx` | 967 | Owner checklist (admin/owner) | `3` |

### 2.3 Evolução do total visível (simulação)

Player checklist (4 passos, `maxIncomplete=2`):

| Estado | Concluídos | Pendentes | Itens visíveis | Notas |
|--------|-----------|-----------|----------------|-------|
| Inicial | 0 | 4 | 2 | 2 pendentes escondidos (Collapse) |
| Meio | 2 | 2 | 4 | 2 concluídos + 2 pendentes |
| Meio | 3 | 1 | 4 | 3 concluídos + 1 pendente |

Owner checklist (5 passos, `maxIncomplete=3`):

| Estado | Concluídos | Pendentes | Itens visíveis |
|--------|-----------|-----------|----------------|
| Inicial | 0 | 5 | 3 |
| Meio | 2 | 3 | 5 |
| Meio | 4 | 1 | 5 |

**Conclusão:** o total visível cresce até o número total de passos nos estados
intermediários. Para os checklists atuais (4–5 passos) o impacto é **moderado**, mas a
tendência piora se novos passos forem adicionados no futuro.

---

## 3. Avaliação: precisamos de um `maxVisible`?

### 3.1 Trade-offs de UX

| Abordagem | Prós | Contras |
|-----------|------|---------|
| **Manter como está** (sem cap total) | Reforço positivo máximo: usuário vê tudo o que já conquistou; sentido de jornada | Card cresce; em telas pequenas empurra conteúdo abaixo da dobra |
| **Cap total (`maxVisible`)** | Card sempre compacto; altura previsível; melhor densidade informativa | Esconde conclusões → pode parecer que "não tem progresso" se sumirem todas |
| **Cap total + resumo "X de Y"** | Compacto + reforço via contador e barra de progresso (já existe `LinearProgress`) | Requer texto auxiliar / affordance de "ver mais" |

### 3.2 Recomendação

**Sim, vale a pena adicionar um `maxVisible` opcional**, combinado com o resumo de
progresso já existente (`progressLabel` + `LinearProgress`). A barra de progresso e o
contador (`checklistProgress`: `{{completed}}/{{total}}`) já comunicam o avanço geral,
então esconder conclusões antigas não prejudica a percepção de progresso — pelo
contrário, reduz ruído visual e mantém o foco nos **próximos passos**.

### 3.3 É breaking change?

**NÃO.** A proposta é adicionar uma **nova prop opcional** `maxVisible?: number` com
default `undefined` (= sem cap total, comportamento atual preservado). Call sites só
precisam passar o novo valor se quiserem o comportamento compacto. Nenhuma assinatura
existente muda; nenhum consumidor quebra.

---

## 4. Solução Proposta

### 4.1 Abordagem

Adicionar `maxVisible?: number` ao componente. Regra de priorização dos itens visíveis:

1. **Todos os pendentes** primeiro, até `maxIncomplete` (comportamento atual).
2. **Concluídos** preenchem o orçamento restante até `maxVisible`, **em ordem de array
   inversa** (mais "recentes" no sentido de jornada — último passo concluído aparece
   primeiro). Como **não há `completedAt`**, usamos a ordem do array como proxy
   (mantém compatibilidade com a derivação atual de dados de domínio).
3. Excedentes (concluídos antigos que não cabem) ficam ocultos, **sem** botão "mostrar
   mais" individual por concluído (eles já não têm ação); o resumo
   `{{completed}}/{{total}}` + a barra de progresso comunicam o total.
4. Se `maxVisible` não for informado → comportamento atual (concluídos sempre visíveis).

### 4.2 Mudança na API

```tsx
interface FirstStepsChecklistProps {
  steps: ChecklistStep[];
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  progressLabel?: string;
  /** Max incomplete items shown before truncation (default: all). */
  maxIncomplete?: number;
  /** Max TOTAL items shown (completed + pending). Default: no total cap. */
  maxVisible?: number;
}
```

### 4.3 Lógica de filtragem (antes/depois)

```tsx
// ANTES — concluídos sempre visíveis
const visibleSteps: ChecklistStep[] = [];
const hiddenSteps: ChecklistStep[] = [];
let incompleteShown = 0;
const limit = maxIncomplete ?? steps.length;

for (const step of steps) {
  if (step.completed) {
    visibleSteps.push(step);
  } else if (incompleteShown < limit) {
    visibleSteps.push(step);
    incompleteShown++;
  } else {
    hiddenSteps.push(step);
  }
}
const truncated = hiddenSteps.length > 0;
```

```tsx
// DEPOIS — cap total opcional
const incompleteLimit = maxIncomplete ?? steps.length;
const totalLimit = maxVisible ?? Number.POSITIVE_INFINITY;

const incomplete = steps.filter(s => !s.completed);
const completed = steps.filter(s => s.completed);

const visibleIncomplete = incomplete.slice(0, incompleteLimit);
const hiddenIncomplete = incomplete.slice(incompleteLimit);

// Orçamento restante para concluídos (ordem inversa = conclusão mais "recente" primeiro)
const remainingBudget = Math.max(0, totalLimit - visibleIncomplete.length);
const visibleCompleted = completed.slice(-remainingBudget); // últimos N do array
const hiddenCompleted = completed.slice(0, completed.length - remainingBudget);

const visibleSteps = steps.filter(
  s => visibleIncomplete.includes(s) || visibleCompleted.includes(s),
); // preserva ordem original para renderização estável
const hiddenSteps = hiddenIncomplete; // apenas pendentes têm affordance "mostrar mais"
const truncated = hiddenSteps.length > 0 || hiddenCompleted.length > 0;

// (opcional) badge de resumo quando há concluídos ocultos
const hiddenCompletedCount = hiddenCompleted.length;
```

> **Nota sobre ordem:** como não há `completedAt`, "mais recente" é interpretado como
> "último do array". Se no futuro quisermos precisão, adicionamos `completedAt?:`
> a `ChecklistStep` e ordenamos por data — **fora do escopo** deste improvement.

### 4.4 Call sites sugeridos (pós-implementação)

| Call site | `maxIncomplete` | `maxVisible` sugerido | Justificativa |
|-----------|-----------------|----------------------|---------------|
| HomeTab (desktop + mobile) | `2` | `3` | Foco em próximos passos; barra de progresso já mostra avanço |
| GroupDetailScreen (owner) | `3` | `4` | Lista maior (5 passos); permite 1 concluído de reforço |

> Valores finais a confirmar com design/QA durante implementação.

### 4.5 Acessibilidade / i18n

- Manter `aria-label` da barra de progresso (`X de Y passos concluídos`).
- Se adicionarmos texto de resumo de concluídos ocultos, incluir chave nova em
  `pt-BR.json`, `en.json`, `es.json` (ex.: `onboarding.hiddenCompleted`).

### 4.6 Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Usuário perde noção de progresso ao esconder concluídos | Barra `LinearProgress` + contador `{{completed}}/{{total}}` já presentes |
| Ordem "recente" imprecisa sem timestamp | Documentar proxy (ordem do array); opcional: adicionar `completedAt` depois |
| Regressão no comportamento de "mostrar mais" existente | Novo `maxVisible` default = sem cap total; testes cobrem ambos os modos |
| Conflito visual entre `hiddenIncomplete` (Collapse) e `hiddenCompleted` (oculto puro) | Concluídos ocultos não têm ação; não entra no Collapse — apenas não renderiza |

---

## 5. Critérios de Aceitação

- [ ] Nova prop opcional `maxVisible?: number` adicionada a `FirstStepsChecklistProps`.
- [ ] Default `undefined` preserva comportamento atual (concluídos sempre visíveis).
- [ ] Quando `maxVisible` informado: total de itens visíveis (concluídos + pendentes)
      ≤ `maxVisible`.
- [ ] Prioridade: **todos os pendentes (até `maxIncomplete`) primeiro**, depois
      concluídos até completar o orçamento.
- [ ] Pendentes excedentes continuam acessíveis via botão "mostrar mais" (Collapse).
- [ ] Concluídos excedentes ficam ocultos (sem ação), com progresso refletido na
      barra/contador.
- [ ] Ordem de renderização dos itens visíveis permanece estável (ordem original).
- [ ] Sem regressões nos 3 call sites existentes (HomeTab desktop, HomeTab mobile,
      GroupDetailScreen owner).
- [ ] `npm run lint` e `npm run build` (tsc + vite) passam em `web/`.
- [ ] Novas chaves de i18n (se houver) adicionadas em PT-BR, EN e ES.

---

## 6. Plano de Testes

Arquivo: `web/src/components/onboarding/FirstStepsChecklist.test.tsx` (Vitest +
Testing Library).

### 6.1 Testes novos a adicionar

- [ ] **Sem `maxVisible` (default):** com 3 concluídos + 2 pendentes, renderiza os 3
      concluídos (comportamento atual preservado).
- [ ] **Com `maxVisible=3` e `maxIncomplete=2`:** com 3 concluídos + 2 pendentes,
      renderiza exatamente 3 itens (2 pendentes + 1 concluído); concluídos excedentes
      não aparecem.
- [ ] **Prioridade pendentes:** com `maxVisible=2`, `maxIncomplete=2`, 1 concluído + 3
      pendentes → renderiza 2 pendentes, 0 concluídos.
- [ ] **Botão "mostrar mais"** aparece apenas quando há pendentes ocultos (não quando
      apenas concluídos estão ocultos).
- [ ] **`truncated` correto:** quando `maxVisible` oculta só concluídos, o affordance
      de "mostrar mais" **não** aparece (não há nada expansível com ação).
- [ ] **Barra de progresso** continua refletindo `completed/total` global (não o total
      visível).
- [ ] **Estabilidade de ordem:** itens visíveis mantêm ordem original do array `steps`.

### 6.2 Testes de regressão

- [ ] Call sites HomeTab (desktop e mobile) continuam renderizando corretamente sem
      passar `maxVisible`.
- [ ] Call site GroupDetailScreen (owner) idem.
- [ ] Fluxo de `onAction` customizado e navegação continuam funcionando (testes
      existentes).

### 6.3 Checklist QA manual

- [ ] Testar em viewport mobile (xs) e desktop (md+) no HomeTab.
- [ ] Simular estados: 0, metade e quase-tudo concluído.
- [ ] Validar contraste e altura do card nos dois breakpoints.
- [ ] Confirmar que fechar (dismiss) continua persistindo estado de onboarding.

---

## 7. Fora de Escopo

- Adicionar `completedAt` a `ChecklistStep` (futuro: ordenação real por data de
  conclusão).
- Redesenho visual do card / nova animação.
- Aplicar `maxVisible` em outros componentes de checklist/onboarding.
- Mobile (Android/iOS): componente é exclusivo do web.

---

## 8. Referências

- Componente: `web/src/components/onboarding/FirstStepsChecklist.tsx`
- Spec original do onboarding: `specs/feat-2026-05-16-modern-onboarding-tour.md` §2.3
- Hook de estado de onboarding: `web/src/hooks/useOnboarding.ts`
- Call sites: `web/src/pages/home/tabs/HomeTab.tsx:799,1105,1141` e
  `web/src/pages/group/GroupDetailScreen.tsx:761,962`
- Issue de origem: #3556

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-12 | SDD research | Spec criada a partir de pesquisa de codebase + handoff #3556 |
