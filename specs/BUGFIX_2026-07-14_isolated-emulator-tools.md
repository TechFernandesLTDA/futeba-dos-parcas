# BUGFIX: Ferramentas de emulador isoladas por job

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14

## 1. Problema

`test-harness-ci.yml` e `web-e2e-ci.yml` executavam simultaneamente
`npm install -g firebase-tools tsx` em runners self-hosted. As duas instalações
mutavam o mesmo prefixo global e seus symlinks, permitindo que um job removesse
ou substituísse o executável enquanto o outro o utilizava.

## 2. Solução

- Prefixo sob `RUNNER_TEMP`, único por run, tentativa e job.
- `firebase-tools@15.23.0` e `tsx@4.23.1` pinados, sem instalação global.
- Diretório privado publicado no `GITHUB_PATH`.
- Contrato Node nos dois workflows contra regressões.

## 3. Verificação

- [x] contratos dos workflows
- [x] `actionlint` nos dois workflows
- [x] parse YAML
- [x] instalação isolada real e verificação das versões
- [x] `git diff --check`

## 4. Riscos

Cada job fará download e extração próprios. O cache npm compartilhado continua
reduzindo o custo, sem mutar executáveis globais.
