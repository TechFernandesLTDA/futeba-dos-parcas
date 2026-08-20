# BUGFIX: Waitlist com contrato Firestore e ordenação autoritativos

> **Status:** `APPROVED`
> **Severidade:** `CRITICAL`
> **Autor:** OpenCode
> **Data:** 2026-08-20
> **PR:** a criar (refs #4066 #4067)

## 1. Descrição do Bug

### 1.1 Comportamento Atual

- O mapper Android ignora `@SerialName`, gravando camelCase e falhando contra as rules snake_case.
- Android e web calculam `queue_position` com leituras locais não transacionais.
- `added_at` depende do relógio do cliente.
- A fila exibida pode divergir da ordem usada pela promoção server-side.

### 1.2 Comportamento Esperado

Uma callable autenticada deve criar ou reabrir a entrada canônica em uma transação Firestore. O servidor atribui `queue_position` e timestamps; clientes apenas leem o contrato snake_case e removem a própria entrada.

## 2. Solução

1. `joinGameWaitlist` valida o jogo e o payload, lê a entrada e a fila ativa dentro de uma transação e grava `queue_position = max(active.queue_position) + 1`.
2. `added_at` é `Timestamp.now()` no servidor, e a operação é protegida contra concorrência pela transação.
3. Rules negam `create/update` direto da subcoleção; callable/Admin SDK são as únicas superfícies de mutação positiva.
4. Web e Android chamam a mesma callable. A leitura continua ordenada por `queue_position`, que é o mesmo valor usado pela promoção.
5. Android usa DTO com `@PropertyName` e conversor de fronteira tolerante a `Timestamp`, `Date`, `Long` e outros números.

## 3. Não escopo

- Não reordenar posições após saída: posições são monotônicas por jogo e não são reutilizadas.
- Não alterar a máquina server-side de notificação/expiração, exceto para manter a leitura do timestamp compatível.
- Não fazer deploy nesta mudança.

## 4. Critérios de Aceite

- [ ] Android e web não escrevem diretamente `queue_position` ou `added_at`.
- [ ] Joins concorrentes recebem posições distintas e a callable é idempotente para entrada ativa.
- [ ] Documento Firestore usa `game_id`, `user_id`, `queue_position`, `added_at` e timestamps como contrato único.
- [ ] Leitura Android aceita dados legados `Timestamp`, `Date` e `Long` sem default silencioso.
- [ ] Rules, Functions, Android e web têm testes de regressão.

## 5. Verificação

- Android: `:app:compileDebugKotlin` e `:app:testDebugUnitTest`.
- Functions: build, lint e Jest.
- Web: build e lint.
- Rules emulator suite, quando o emulador estiver disponível.
