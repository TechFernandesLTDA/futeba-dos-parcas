# BUGFIX: reconciliar role Firestore com Custom Claims (#3938)

> **Status:** `APPROVED`
> **Severidade:** `HIGH`
> **Data:** 2026-08-01

## 1. Descrição do Bug

As rules da fase 2 autorizam por Custom Claims, mas alterações diretas em
`users/{uid}.role` não atualizam a claim. Um rebaixamento pode manter privilégios
administrativos até uma reconciliação manual.

## 2. Causa Raiz

`setUserRole` sincroniza Auth, mas console, CRM e Admin SDK podem alterar o
espelho Firestore sem passar pelo callable. Não havia trigger para essas mudanças.

## 3. Solução Proposta

Adicionar trigger `onDocumentUpdated` que reage apenas a mudanças de `role`,
normaliza valores inválidos para `PLAYER`, espelha a claim, revoga refresh tokens
e registra auditoria. Não escreve no documento observado, evitando loop.

## 4. Verificação

- [x] Testes de upgrade, downgrade, valor inválido, usuário inexistente e no-op
- [x] `functions`: build, lint e Jest completo
- [ ] Revisão de segurança e deploy de Functions

## 5. Riscos

O token ID atual pode permanecer válido até seu TTL; `revokeRefreshTokens` segue o
contrato já usado pelo callable. Drift preexistente requer regravação ou migração.
