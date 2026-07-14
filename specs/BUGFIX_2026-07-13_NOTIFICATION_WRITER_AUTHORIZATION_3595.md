# BUGFIX: autorização de criação de notificações in-app

> **Status:** `APPROVED`
> **Severidade:** `MEDIUM`
> **Autor:** Codex (time de agentes)
> **Data:** 2026-07-13
> **Issue:** #3595

---

## 1. Descrição do Bug

### 1.1 Comportamento Atual (Errado)

Qualquer usuário autenticado pode criar uma notificação para qualquer outro usuário usando tipos confiáveis como `SYSTEM`, porque a validação de referência retorna `true` para todo tipo que não seja convite.

### 1.2 Comportamento Esperado (Correto)

- Tipos gerados pelo sistema são escritos pelo Admin SDK, que não depende das Security Rules.
- Escritas client-side só são aceitas para fluxos explicitamente autorizados.
- `GAME_SUMMON`, `GAME_RIDE` e o aviso `SYSTEM` de desafio devem provar, por documentos autoritativos, a relação entre remetente, destinatário e jogo/desafio.
- Convites continuam exigindo ownership/administração do jogo ou grupo referenciado.

### 1.3 Autorização

A diretiva do usuário de 2026-07-13 para o time concluir todas as issues, incluindo deploy final, aprova esta correção e seu escopo. O merge administrativo foi liberado condicionado à validação.

## 2. Análise de Causa Raiz

`hasValidActionableInviteReference()` começa aceitando por default qualquer tipo fora da lista de convites. A whitelist de `create` inclui tipos de sistema, portanto autoria e existência do destinatário eram suficientes para injetar conteúdo arbitrário no feed da vítima.

## 3. Solução

1. Substituir o default permissivo por branches fechados por tipo.
2. Manter convites vinculados ao grupo/jogo administrado pelo remetente.
3. Validar `GAME_SUMMON` contra confirmação `PENDING` criada no mesmo batch ou membership ativo no grupo do jogo.
4. Validar `GAME_RIDE` contra caronas `ACTIVE` e opostas do remetente e destinatário no mesmo jogo.
5. Permitir `SYSTEM` client-side somente para participantes do desafio referenciado; demais notificações de sistema ficam exclusivas do Admin SDK/admin.
6. Atualizar o writer KMP de convocação para enviar `created_by`, `game_id` e `group_id`.

## 4. Verificação

- Testes negativos: `SYSTEM` arbitrário, tipo de sistema/achievement arbitrário, summon sem relação, ride sem contraparte.
- Testes positivos: admin/Cloud Functions, convites válidos, summon válido, ride válida e conclusão válida de desafio.
- Gate: `cd firestore-rules-tests && npm test`.
- Writer KMP: compilação do target Android de `shared`.

## 5. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Bloquear writer legítimo antigo | Preservar schemas reais e adicionar somente os campos ausentes no writer KMP |
| Relação forjada | Consultar documentos autoritativos com `get`/`getAfter`, não confiar apenas no payload |
| Regressão futura ao ampliar tipos | Default fechado e testes negativos por classe de tipo |

## Histórico

| Data | Autor | Alteração |
|---|---|---|
| 2026-07-13 | Codex | Spec aprovada e implementação iniciada para #3595 |
