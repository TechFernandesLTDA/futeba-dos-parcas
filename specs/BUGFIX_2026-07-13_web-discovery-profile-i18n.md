# BUGFIX: i18n completo em descoberta de grupos e configuração de perfil

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Data:** 2026-07-13
> **Issues:** #3614, #3616

## Problema

`DiscoverGroupsScreen` e `ProfileSetupScreen` misturam textos traduzidos com
literais PT-BR. Usuários em inglês ou espanhol recebem títulos, filtros,
estados de erro/vazio e campos do onboarding em outro idioma.

## Invariantes

- A troca de idioma altera todo texto estático visível nas duas telas sem
  alterar dados vindos do Firestore, nomes próprios ou valores persistidos.
- Labels e nomes acessíveis continuam descrevendo corretamente seus controles.
- Estados loading, error, empty e success mantêm a mesma lógica e ações.
- Os enums persistidos (`preferred_position` e `preferred_field_types`) não são
  traduzidos; somente seus rótulos de apresentação mudam.
- PT-BR, inglês e espanhol têm o mesmo conjunto de chaves novas.

## Solução aprovada

1. Usar o namespace `groups.matchmaking` para título, tabs, categorias, erro,
   vazios e contagem já pluralizada da descoberta de grupos.
2. Usar `onboarding.profileSetup` para labels e ajuda específicos da etapa de
   perfil, reutilizando `common` e `auth` onde a semântica já é idêntica.
3. Remover o uso de labels de categoria PT-BR fixos apenas nessa UI; o tipo de
   domínio e os valores canônicos permanecem inalterados.
4. Adicionar testes de renderização em PT-BR e inglês e cobrir erro/vazio da
   descoberta, garantindo que o fallback também seja traduzido.

## Critérios de aceitação

- Nenhum literal PT-BR estático permanece nos dois componentes.
- Título, abas, categorias, contagem de membros, erro e vazios da descoberta
  respondem ao locale ativo.
- Título, campos, legendas, tipos de campo, ajuda e CTA do setup respondem ao
  locale ativo.
- Acessibilidade e comportamento de salvamento permanecem iguais.
- Catálogos PT-BR/en/es continuam JSON válido e com chaves equivalentes.

## Verificação

- `cd web && npm run test -- src/pages/group/DiscoverGroupsScreen.test.tsx src/pages/onboarding/ProfileSetupScreen.test.tsx`
- `cd web && npm run build`
- `cd web && npm run lint`
- `git diff --check`

## Risco e release

Mudança exclusivamente Web e de apresentação. Não altera schema, Rules,
Functions nem payloads de perfil/grupo. Requer nota na próxima release Web e
inclusão no próximo deploy consolidado de Hosting.
