# BUGFIX: Timeout e isolamento do Web E2E agendado

> **Status:** `VERIFIED`
> **Severidade:** `HIGH`
> **Autor:** Codex
> **Data:** 2026-07-14
> **Run:** #29322971549

## 1. Problema

O Web E2E concluiu build, emuladores, seeds e `globalSetup`, anunciou 57 testes
com um worker e não emitiu outro resultado até o cancelamento externo de 60
minutos. As três execuções agendadas mais recentes tiveram o mesmo cancelamento.

No mesmo horário, o Test Harness concorrente falhou com `ENOTEMPTY` ao instalar
globalmente `firebase-tools` no mesmo toolcache. Ambos usam os mesmos labels,
portas e processos de cleanup, portanto não são seguros para execução paralela
no host compartilhado.

## 2. Comportamento esperado

- O Playwright encerra toda a suíte em até 15 minutos com falha explícita.
- O passo E2E permanece autoritativo; timeout ou teste vermelho não é tolerado.
- Relatório HTML é produzido no CI e enviado best-effort mesmo após falha.
- Web E2E e Test Harness nunca disputam emuladores, toolcache ou cleanup.
- Um limite externo do passo cobre travas antes do Playwright.

## 3. Solução aprovada

1. Definir `globalTimeout` de 15 minutos no CI e manter os timeouts por teste.
2. Usar reporters GitHub + HTML no CI para log imediato e artifact navegável.
3. Limitar o passo de emulador/seed/E2E a 20 minutos e manter o job como safety
   net de 30 minutos.
4. Compartilhar um concurrency group entre Web E2E e Test Harness, sem cancelar
   a execução em andamento.
5. Alinhar ambos os workflows ao Node 22 obrigatório no repositório.
6. Tornar apenas o upload de diagnóstico best-effort, com retenção curta.
7. Proteger essas invariantes com contrato Node executado nos dois workflows.

## 4. Verificação

- [x] Contrato de workflow (2/2)
- [x] `actionlint` nos dois workflows
- [x] Parse YAML local
- [x] Carregamento/listagem da configuração Playwright (57 testes)
- [x] `git diff --check`

## 5. Riscos

- O limite de 15 minutos pode revelar uma suíte que legitimamente cresceu além
  do orçamento; nesse caso o relatório deve orientar redução/sharding, não aumento
  silencioso para 60 minutos.
- A serialização aumenta tempo de fila quando ambos disparam juntos, mas elimina
  corrupção do toolcache e interferência de portas/processos.
- O diagnóstico não identifica qual operação interna bloqueou o worker antigo;
  ele transforma o travamento ilimitado em falha limitada e observável.
