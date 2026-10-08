## Descrição

<!-- O que muda e por quê. Impacto para o usuário, se houver. -->

## Issue relacionada

refs #

## Tipo de mudança (label `type:*`)

- [ ] `type:bug` — correção
- [ ] `type:feature` / `type:enhancement` — funcionalidade ou melhoria
- [ ] `type:refactor` / `type:test`
- [ ] `type:docs`
- [ ] `type:chore` — CI, dependências, tooling
- [ ] `type:security`

## Áreas afetadas (label `area:*`)

- [ ] web · [ ] android · [ ] ios · [ ] functions · [ ] rules · [ ] shared · [ ] ci · [ ] docs · [ ] release

## Validação (cole comandos e resultados reais)

```text
# ex.: cd web && npm run lint && npm test && npm run build   -> exit 0
```

- [ ] Testes/lint/build das áreas afetadas passaram localmente (ver tabela de validação no README)
- [ ] Mudança user-visible: `versions.json` + `release-notes/<plataforma>/<versão>.md` atualizados
- [ ] Regras/índices Firestore: `firestore-rules-tests` e contrato de índices executados
- [ ] Workflows: `actionlint` limpo e `node --test scripts/ci/*.test.js scripts/*.test.js`

## Checklists por superfície (marque o que se aplica)

**Mobile (Android/iOS):** [ ] responsivo (retrato/paisagem/tablet) · [ ] acessibilidade (contentDescription, alvos ≥ 48dp) · [ ] estados loading/empty/error/success

**Web:** [ ] mobile-first · [ ] a11y (aria, foco, contraste) · [ ] estados loading/empty/error/success · [ ] build sem `VITE_*` de emulador

**Geral:** [ ] sem strings/cores hardcoded · [ ] sem segredos/credenciais · [ ] spec em `/specs/` quando houver decisão de produto/arquitetura

## Screenshots / vídeos

| Antes | Depois |
|-------|--------|
|       |        |
