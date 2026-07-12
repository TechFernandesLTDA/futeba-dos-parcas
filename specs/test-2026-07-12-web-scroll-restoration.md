# TEST: useScrollRestoration no scroller `#main-content` (PUSH/POP)

> **Status:** `TRIAGED`
> **Tipo:** Teste (follow-up de cobertura)
> **Severidade:** `MEDIUM`
> **Autor:** Agent (handoff issue #3556)
> **Data:** 2026-07-12
> **Issue de origem:** #3556
> **PR:** (a definir)

---

## 1. Contexto

Follow-up de teste derivado da issue #3556. A nota do handoff pede:

> Testar `useScrollRestoration` no scroller `#main-content` em navegação PUSH/POP.

O hook **já possui testes** (`web/src/hooks/useScrollRestoration.test.ts`), porém esses
testes cobrem **apenas o path de fallback `window`** — eles não criam o elemento
`#main-content`, então `getScrollContainer()` cai no branch `window` e o código
específico do container de elemento (`container.scrollTop`, listener no elemento)
**nunca é exercitado**.

### 1.1 Lacuna atual (comportamento não coberto)

| Comportamento | Coberto hoje? |
|---------------|---------------|
| `window.scrollTo(0, N)` no fallback de janela | ✅ (6 testes) |
| `getScrollContainer()` selecionando `#main-content` por `overflowY` | ❌ |
| `writeScrollTop()` escrevendo em `element.scrollTop` (não `window.scrollTo`) | ❌ |
| Listener de `scroll` anexado ao **elemento** (não à `window`) salvando posição | ❌ |
| Navegação PUSH restaurando para topo (0) no container de elemento | ❌ |
| Navegação POP restaurando posição salva no container de elemento | ❌ |

---

## 2. Artefatos sob teste

### 2.1 Hook — `web/src/hooks/useScrollRestoration.ts`

**Localização:** `web/src/hooks/useScrollRestoration.ts:69`
**Uso em produção:** `web/src/App.tsx:406` — chamado **sem argumentos** dentro de
`AppRoutes()` (portanto usa detecção automática de `#main-content`).

**Lógica-chave (resumo):**

1. **Seleção de container** (`getScrollContainer`, linhas 41-55):
   - Se `scrollContainerId` for passado, usa `getElementById(id) ?? window`.
   - Senão, procura `document.getElementById('main-content')`; se for `HTMLElement`
     **e** `getComputedStyle(main).overflowY` for `'auto'` ou `'scroll'`, usa o elemento.
   - Caso contrário, cai para `window`.

2. **Modo manual** (effect #1, linhas 74-81): seta
   `window.history.scrollRestoration = 'manual'` no mount e restaura o valor original
   no unmount. Early-return se a propriedade não existir.

3. **Restauração + listener** (effect #2, linhas 83-104): a cada mudança de
   `location.pathname`/`location.search`/`navigationType`:
   - Calcula `scrollKey = pathname + search`.
   - Se `restored.current === false`: lê posição salva **apenas em POP**
     (`getScrollPosition(scrollKey)`); `top = saved ?? 0`. Aplica com **duplo
     `requestAnimationFrame`** (double rAF para aguardar paint/layout).
   - Marca `restored.current = true`.
   - Anexa listener `scroll` (passivo) no container que chama
     `saveScrollPosition(scrollKey, readScrollTop(container))`.

4. **Reset de flag** (effect #3, linhas 106-108): zera `restored.current` quando
   `pathname`/`search` mudam, garantindo que a próxima rota dispare restauração.

5. **Persistência:** `sessionStorage['scroll-positions']` = JSON
   `{ [pathname+search]: number }`.

### 2.2 Container — `web/src/components/layout/AppLayout.tsx:38`

```tsx
<Box component="main" role="main" id="main-content" tabIndex={-1}
  sx={{ overflow: 'auto', height: { md: '100dvh' }, ... }}>
```

O `Box` com `id="main-content"` tem `overflow: 'auto'` — condição que faz
`getScrollContainer()` **selecionar o elemento** (e não `window`) em produção.
É o container real de scroll vertical da aplicação.

### 2.3 Teste atual — `web/src/hooks/useScrollRestoration.test.ts`

**Localização:** `web/src/hooks/useScrollRestoration.test.ts` (75 linhas, 6 testes).
**Padrão:** Vitest + `@testing-library/react` `renderHook` + `vi.mock('react-router-dom')`
mockando `useLocation`/`useNavigationType` + `vi.useFakeTimers()` para avançar o
double-rAF com `vi.advanceTimersByTime(20)` + `window.scrollTo = vi.fn()` para spy.
**Cobre:** somente o fallback `window`.

---

## 3. Padrão de teste a seguir

Replicar o padrão do teste existente (`useScrollRestoration.test.ts`), que por sua vez
espelha `useDocumentTitle.test.ts` (`renderHook` + mocks de router). Os novos testes
devem ser **acrescentados no mesmo arquivo** `useScrollRestoration.test.ts`, num novo
`describe('container #main-content', ...)` para isolar o setup de DOM.

### 3.1 Stack e ambiente

| Item | Valor |
|------|-------|
| Runner | Vitest (`npm run test` → `vitest run`) |
| Environment | `jsdom` (default do projeto, `vite.config.ts:119`) |
| Setup global | `web/src/test/setup.ts` (i18n, QueryClient wrapper, matchMedia, crypto) |
| Render hook | `renderHook` de `@testing-library/react` |
| Mock router | `vi.mock('react-router-dom', ...)` com `useLocation`/`useNavigationType` mutáveis |
| Timers | `vi.useFakeTimers()` + `vi.advanceTimersByTime(20)` para o double-rAF |

### 3.2 Limitação do jsdom e como contornar (CRÍTICO)

O **jsdom não implementa layout real**. Consequentemente:

- `getComputedStyle(el).overflowY` **não reflete** CSS real (retorna string vazia ou
  valor default, nunca `'auto'`/`'scroll'`).
- `element.scrollTop` é **sempre 0** e ignorado em setters sem efeito visual.
- Não há `scrollHeight`/layout/scroll de verdade.

Portanto, para exercitar o branch `#main-content`, o teste **precisa mockar a detecção
de overflow**. Estratégia recomendada:

1. **Criar o elemento real no DOM** (jsdom cria um `HTMLElement` válido que responde a
   `addEventListener`/getter/setter de `scrollTop`):
   ```ts
   const mainEl = document.createElement('div');
   mainEl.id = 'main-content';
   document.body.appendChild(mainEl);
   ```
2. **Mockar `window.getComputedStyle`** para retornar `overflowY: 'auto'` quando
   chamado sobre o `main-content` (faz `getScrollContainer()` selecionar o elemento):
   ```ts
   const realGetComputedStyle = window.getComputedStyle;
   vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
     if (el === mainEl) return { overflowY: 'auto' } as CSSStyleDeclaration;
     return realGetComputedStyle(el);
   });
   ```
3. **Spy no setter de `scrollTop`** para asserção (jsdom respeita o setter, embora não
   aplique layout):
   ```ts
   const scrollTopSpy = vi.spyOn(mainEl, 'scrollTop', 'set');
   // OU usar Object.defineProperty(mainEl, 'scrollTop', { ... })
   ```
4. **Disparar `scroll` manualmente** para validar o listener no elemento:
   ```ts
   Object.defineProperty(mainEl, 'scrollTop', { configurable: true, value: 250 });
   mainEl.dispatchEvent(new Event('scroll'));
   // então validar sessionStorage['scroll-positions']
   ```
5. **Cleanup:** remover `mainEl` do DOM, restaurar `getComputedStyle` e limpar
   `sessionStorage` no `afterEach` (o teste atual já limpa `sessionStorage`).

---

## 4. Plano de teste (casos)

Novo bloco `describe('container #main-content', ...)` com setup de DOM + mock de
`getComputedStyle` conforme seção 3.2. **PUSH** = `mockNavigationType = 'PUSH'`;
**POP** = `mockNavigationType = 'POP'`.

### 4.1 PUSH (navegação avançar)

- [ ] **PUSH.1** — Sem posição salva: `mainEl.scrollTop` é setado para `0`.
- [ ] **PUSH.2** — Com posição salva de outra rota: ainda seta `0` (PUSH ignora o salvo).
- [ ] **PUSH.3** — `window.scrollTo` **não** é chamado (confirma que usou o elemento, não window).

### 4.2 POP (navegação voltar)

- [ ] **POP.1** — Com posição salva (ex.: `250`): `mainEl.scrollTop` é setado para `250`.
- [ ] **POP.2** — Com posição salva `0`: seta `0` (edge do `saved ?? 0`).
- [ ] **POP.3** — Sem posição salva (chave inexistente): seta `0` (`null ?? 0`).

### 4.3 Listener de scroll no elemento

- [ ] **LIST.1** — Após montar, despachar `scroll` no `mainEl` (com `scrollTop = 300`)
      persiste `sessionStorage['scroll-positions'][key] = 300`.
- [ ] **LIST.2** — O listener é anexado ao `mainEl`, **não** à `window` (dispatch de
      `scroll` em `window` não dispara o save).
- [ ] **LIST.3** — Ao desmontar (`unmount`), o listener é removido (dispatch posterior
      não altera `sessionStorage`).

### 4.4 Persistência por chave (pathname + search)

- [ ] **KEY.1** — Posições são guardadas sob chave `pathname+search` (ex.: `/grupo/1`
      distinto de `/grupo/1?tab=membros`).
- [ ] **KEY.2** — Navegar PUSH de `/a` → `/b` (rerender com novo pathname) reseta
      `restored.current` e a próxima POP restaura a posição correta de `/a`.

### 4.5 Edge cases

- [ ] **EDGE.1** — **Navegação rápida** (múltiplas mudanças de pathname antes do rAF
      rodar): cada advance de timer restaura para a posição esperada sem crash.
- [ ] **EDGE.2** — **Salvar antes da primeira restauração**: se o listener dispara
      entre o mount e o rAF, o valor salvo não corrompe a restauração subsequente.
- [ ] **EDGE.3** — `main-content` **ausente** no DOM: cai para `window`
      (`window.scrollTo` chamado) — regressão do path de fallback.
- [ ] **EDGE.4** — `main-content` presente **mas sem overflow scrollable** (`overflowY`
      retorna `'hidden'`): cai para `window`.
- [ ] **EDGE.5** — JSON corrompido no `sessionStorage` durante POP: `getScrollPositions`
      retorna `{}` e restaura `0` (já coberto p/ window; replicar p/ elemento).
- [ ] **EDGE.6** — `history.scrollRestoration` é setado para `'manual'` no mount e
      restaurado ao valor original no unmount (independente do container).

---

## 5. Critérios de aceitação

- [ ] Todos os casos das seções 4.1–4.5 implementados em
      `web/src/hooks/useScrollRestoration.test.ts`.
- [ ] Setup de DOM (`#main-content` + mock de `getComputedStyle`) isolado num
      `describe` próprio com `beforeEach`/`afterEach` que **não** quebra os 6 testes
      existentes do path `window`.
- [ ] `npm run test` (Vitest) passa **verde** para o arquivo.
- [ ] `npm run lint` e `npm run build` (tsc) sem erros/regressões.
- [ ] Cobertura do branch `element.scrollTop` (linhas 61-66 e 97-103 do hook) > 0.
- [ ] Nenhum teste depende de layout real (tudo via mocks/spies conforme seção 3.2).

---

## 6. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Mock de `getComputedStyle` vazar e quebrar testes do path `window` | Isolar num `describe` separado com `afterEach` restaurando o spy |
| `requestAnimationFrame` não ser controlado por fake timers no jsdom | Confirmar com `vi.advanceTimersByTime`; o teste atual já valida este comportamento |
| Listener de `scroll` acumular entre testes (leak) | Sempre chamar `unmount()` e/ou `cleanup()` no `afterEach` |
| Asserção em `scrollTop` setter pode não existir como spy em alguns runtimes | Preferir `Object.defineProperty` para forçar getter/setter controlável |

---

## 7. Comandos de verificação

```bash
cd web
npx vitest run src/hooks/useScrollRestoration.test.ts   # teste isolado
npm run test                                            # suite completa
npm run lint                                            # ESLint
npm run build                                           # tsc + vite build (type-check)
```

---

## Histórico

| Data | Autor | Alteração |
|------|-------|-----------|
| 2026-07-12 | Agent (issue #3556) | Spec criada — análise do hook + plano de teste p/ container `#main-content` |
