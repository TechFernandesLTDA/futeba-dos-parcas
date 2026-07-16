# BUGFIX: Navegação web acessível e internacionalizável

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-16
> **Issues:** #3766, #3767, #3774, #3784, #3785, #3788

---

## 1. Requisitos

- O foco deve alcançar o conteúdo da nova rota no próximo frame, sem atraso fixo de 320 ms.
- O anúncio de rota deve ser derivado da rota/breadcrumb atual, reagir a `pathname` e `search` e não repetir o nome do app.
- A navegação inferior escondida não pode permanecer exposta a leitores de tela nem à ordem de tabulação; movimento reduzido deve eliminar a transição.
- O sino de notificações pode chamar atenção por no máximo três ciclos e deve continuar respeitando movimento reduzido.
- As superfícies de navegação devem usar propriedades CSS lógicas nos pontos auditados.
- Os comandos rápidos devem usar identificadores estáveis, textos traduzidos e comportamento independente do idioma.

## 2. UX/UI

- Preservar a aparência e os destinos atuais.
- Manter PT-BR, inglês e espanhol com paridade de chaves.
- Não introduzir movimento novo nem remover o badge de notificações.
- Manter foco visível e sem elementos interativos fora da tela.

## 3. Design técnico

- Substituir o `setTimeout(320)` por `requestAnimationFrame`, pois o React já remove a rota anterior antes de montar a nova árvore.
- Derivar o texto de `RouteAnnouncer` do último breadcrumb e, na raiz, do item ativo de navegação.
- Aplicar `aria-hidden`, `tabIndex=-1`, `mountOnEnter` e `unmountOnExit` ao estado escondido do bottom nav; usar timeout zero com movimento reduzido.
- Modelar comandos rápidos com `id`, `labelKey`, `subtitleKey`, `route` e `shortcut`; nunca usar o texto localizado como chave de lookup.
- Trocar propriedades físicas auditadas por equivalentes lógicos.

## 4. Tarefas

- [x] Corrigir foco e anúncio de rota em `web/src/App.tsx`.
- [x] Corrigir estado oculto e RTL nos componentes de layout.
- [x] Internacionalizar e estabilizar comandos rápidos.
- [x] Limitar a animação do sino.
- [x] Adicionar testes de regressão e validar paridade i18n.
- [x] Executar testes, scan visual, lint e build.

## 5. Verificação

- [x] Testes direcionados passam: 22/22.
- [x] Suíte completa passa: 1.344 testes, 15 ignorados.
- [x] Testes de paridade PT-BR/en/es passam.
- [x] `npm run lint` passa.
- [x] `npm run build` passa.
- [x] Nenhum elemento do bottom nav escondido permanece tabulável.
- [x] Trocas `/?tab=N` produzem anúncio coerente e sem sufixo da marca.

## 6. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Conflito com a centralização de tokens do PR #3811 | Alterações pequenas e sem copiar tokens; integrar sobre o resultado do PR. |
| Regressão na navegação por teclado do Command Palette | Testar IDs, rotas, atalhos e tradução em todos os idiomas. |
| Regressão visual no bottom nav | Preservar `Slide` e remover a árvore apenas após a saída. |
