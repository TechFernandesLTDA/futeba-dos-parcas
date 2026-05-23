# BUGFIX: Admin Role Confirmation

**Status**: APPROVED
**Issues**: #1680, #1682
**Data**: 2026-05-23

## Requirements

- Garantir que a UI de roles exponha apenas roles aceitos pela Cloud Function `setUserRole`.
- Exigir confirmacao antes de alterar role de usuario.
- Alertar sobre auto-rebaixamento de admin e revogacao de sessao do usuario alvo.

## UX/UI

- Dialog de gerenciamento continua oferecendo `PLAYER`, `FIELD_OWNER` e `ADMIN`.
- Alteracoes individuais abrem dialog de confirmacao com resumo da mudanca.
- Auto-rebaixamento de admin usa aviso mais forte e botao destrutivo.
- Operacao em lote informa que usuarios alterados precisarao fazer login novamente.

## Technical Design

- Ajustar `web/src/pages/admin/UserManagementScreen.tsx`.
- Reutilizar o dialog de confirmacao existente para toda alteracao individual.
- Nao implementar role `MODERATOR`; manter paridade com roles aceitos por `functions/src/auth/custom-claims.ts`.

## Tasks

1. Verificar roles aceitos pela Cloud Function.
2. Verificar UI atual de roles.
3. Alterar fluxo individual para sempre confirmar antes de executar callable.
4. Adicionar mensagens de risco/re-auth.
5. Validar build web.

## Implementation

- Alteracoes individuais de role agora sempre abrem confirmacao antes da callable.
- Confirmacao destaca auto-rebaixamento, promocao para admin e re-auth obrigatoria.
- Operacao em lote informa re-auth e continua ignorando o usuario atual.
- A UI web nao expoe `MODERATOR`; mantem apenas `PLAYER`, `FIELD_OWNER` e `ADMIN`.

## Verify

- [x] `npm run build` em `web/`
- [x] Sem botao/opcao `MODERATOR` na web admin
- [x] Alteracao individual de role exige confirmacao
