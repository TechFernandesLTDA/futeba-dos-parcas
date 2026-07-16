# BUGFIX: Contexto visual e nomes reais nas rotas web

> **Status:** `VERIFIED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex
> **Data:** 2026-07-16
> **Issues:** #3777, #3781

---

## 1. Requisitos

- Rotas de lista, artigo, formulário e dashboard devem usar skeleton compatível com o conteúdo final.
- Breadcrumbs dinâmicos devem exibir o nome real da entidade assim que a própria tela carregar os dados.
- A resolução de nomes não pode criar leituras Firestore nem depender de chaves internas do TanStack Query.
- Deep links sem metadados disponíveis devem manter fallback traduzido, acessível e sem expor IDs.
- Metadados já vistos na sessão devem ser reaproveitados entre perfil e rotas de evolução, resumo e jornada.

## 2. UX/UI

- Preservar a hierarquia e os links das rotas.
- Evitar flash de grid em telas cujo conteúdo final é lista, artigo, formulário ou dashboard.
- Preservar breadcrumbs manuais de jogo/grupo enquanto forem mais ricos (atalhos por aba e grupo ancestral), ocultando o global para evitar duplicidade.
- Manter PT-BR, inglês e espanhol pelo fallback já traduzido.

## 3. Design técnico

- Criar um provider de metadados de entidades acima das superfícies desktop/mobile.
- Publicar `kind + id + label` a partir dos dados já carregados pelas telas.
- Manter o cache em memória durante a sessão de React, limitado às entidades visitadas.
- Resolver IDs pelo tipo inferido da rota; se não houver metadado, usar `breadcrumbs.details`.
- Adicionar matches explícitos em `RouteFallback` antes do fallback genérico.

## 4. Tarefas

- [x] Implementar provider/hook de metadados e integrar ao auto-breadcrumb.
- [x] Publicar nomes nas telas que já carregam jogo, grupo, local e usuário.
- [x] Auditar overrides de jogo/grupo e preservá-los por manterem hierarquia e destinos mais ricos.
- [x] Mapear skeletons específicos de #3781.
- [x] Adicionar testes de provider, breadcrumbs, telas e contrato de fallback.
- [x] Rodar testes direcionados, suíte completa quando viável, lint e build.

## 5. Verificação

- [x] Nenhuma nova chamada Firebase foi adicionada.
- [x] Nenhum acesso a `queryClient.getQueryData` foi adicionado.
- [x] IDs técnicos nunca aparecem como rótulo.
- [x] Nomes reais substituem o fallback após publicação de metadado.
- [x] Skeletons específicos cobrem todas as rotas listadas em #3781.

### Evidências

- Testes direcionados: 4 arquivos, 51 testes aprovados.
- Suíte web completa: 212 arquivos aprovados, 1 ignorado; 1.366 testes aprovados, 15 ignorados.
- `npm run lint`: aprovado sem avisos.
- `npm run build`: aprovado com TypeScript e bundle de produção.
- Varredura visual estática: concluída; nenhuma nova cor rígida, dimensão fixa ou overflow foi introduzido pelo lote.

## 6. Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Metadado indisponível em deep link | Fallback traduzido até a tela publicar o nome. |
| Cache crescer durante sessão longa | Apenas strings curtas de entidades efetivamente visitadas. |
| Duplicidade após remover overrides | Teste de integração garante um único breadcrumb. |
