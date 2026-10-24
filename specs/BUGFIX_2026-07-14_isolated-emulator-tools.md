# BUGFIX: Ferramentas de emulador isoladas por job

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14

## 1. Problema

`test-harness-ci.yml` e `web-e2e-ci.yml` executam simultaneamente
`npm install -g firebase-tools tsx` em runners self-hosted. As duas instalações
mutam o mesmo prefixo global e seus symlinks, permitindo que um job remova ou
substitua o executável enquanto o outro o utiliza.

## 2. Comportamento esperado

Cada job instala versões determinísticas de Firebase CLI e `tsx` em seu próprio
diretório temporário e publica somente o `node_modules/.bin` daquele diretório
nos passos seguintes.

## 3. Solução aprovada

- Criar um prefixo sob `RUNNER_TEMP`, único por run, tentativa e job.
- Instalar `firebase-tools@15.23.0` e `tsx@4.23.1` com `npm --prefix`, sem
  `--global`/`-g` e sem lockfile persistente.
- Acrescentar o diretório privado ao `GITHUB_PATH` com `printf`.
- Verificar as duas ferramentas pelo caminho absoluto logo após a instalação.
- Executar um contrato Node nos dois workflows para impedir regressão para
  globais compartilhados ou versões flutuantes.

## 4. Verificação

- [x] contrato dos workflows
- [x] `actionlint` nos dois workflows
- [x] parse YAML
- [x] sintaxe do teste Node
- [x] instalação isolada real e verificação das versões
- [x] `git diff --check`

## 5. Riscos

- Cada job fará download/extração próprios, aumentando alguns segundos e uso
  temporário de disco; o cache npm compartilhado continua seguro e reduz custo.
- Falha de rede no npm continua impedindo o início dos emuladores, como antes.

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-14 | Codex | Requisitos e desenho aprovados antes da implementação |
| 2026-07-14 | Codex | Fix verificado com 92 contratos/testes e instalação real pinada |
