# SPEC: Cobertura de testes de funcionalidades e permissões

> **Status:** `APPROVED`
> **Autor:** sessão Claude Code (Haiku 5.5), pedido do Renan
> **Data:** 2026-11-16
> **PR:** a preencher após abrir o PR

---

## 1. Requirements

### 1.1 Problema / Oportunidade

O app tem regras de permissão espalhadas por três camadas (Firestore Security Rules, Cloud Functions callables e
ViewModels/UseCases do Android e da web). Hoje não há um conjunto único que cubra, de ponta a ponta, convites, criação
e saída de grupo, papéis (ADMIN, dono, membro, visitante, usuário de outro grupo), caixa, marcação de jogo, lista de
espera e votação pós-jogo. Este trabalho adiciona testes automatizados **novos** nessas áreas, sem alterar o comportamento
do app.

### 1.2 Casos de Uso (cobertura obrigatória)

| ID | Área | Cenários cobertos |
|----|------|-------------------|
| UC1 | Convites | criar, aceitar, recusar, expirar, convite inválido/inexistente, convite de outro grupo, reuso de convite |
| UC2 | Criação de grupo | criar por usuário autenticado, anônimo bloqueado, contador de membros inicial, dono vira membro ADMIN |
| UC3 | Entrada e saída | entrar em grupo público/privado, pedido de entrada, sair como membro, dono tentando sair, último ADMIN |
| UC4 | Papéis | ADMIN, dono, membro, visitante (sem vínculo), usuário de outro grupo tentando agir |
| UC5 | Caixa (`cashbox`) | lançamento por ADMIN e dono, membro comum bloqueado, visitante bloqueado, saldo, valores inválidos |
| UC6 | Marcação de jogo | criar jogo, confirmar presença, lista de espera, limite de vagas, jogo cancelado/finalizado, não-membro |
| UC7 | Votação pós-jogo | MVP, Bola Murcha, voto duplicado, voto de quem não jogou, voto fora da janela |
| UC8 | XP e temporada | XP só processado em jogo finalizado; ações de voto/presença que tocam XP (regra de caps já existente) |

### 1.3 Critérios de Aceite

- [ ] CA1: 300 a 400 testes **novos** passam localmente, contados por camada e reportados com o comando exato.
- [ ] CA2: cada UC acima tem pelo menos um teste positivo e um negativo (permissão negada) em pelo menos uma camada.
- [ ] CA3: há uma matriz funcionalidade × papel no relatório final (seção 6).
- [ ] CA4: defeitos reais encontrados ficam listados com arquivo e linha, **sem correção** no código do app.
- [ ] CA5: nenhum workflow novo em `.github/workflows`; nenhum acesso a produção (somente emulador).
- [ ] CA6: nenhum arquivo é editado por dois agentes (divisão por área, seção 4).

### 1.4 Fora de Escopo

- Correção de qualquer defeito encontrado (pedido separado, com autorização do Renan).
- Testes E2E de navegador e testes instrumentados (`connectedAndroidTest`).
- Alterações em `firestore.rules`, `functions/src/**`, `app/src/main/**` e `web/src/**` que não sejam arquivos de teste.
- Publicação de release e criação de tags.

---

## 2. Padrão de defeito real

Um teste que descreve o comportamento **correto** e falha por defeito real do app **não é deixado vermelho** (a suíte
precisa passar), e **não é removido**. Ele usa a forma de "falha esperada" da camada:

| Camada | Forma | Como aparece no relatório |
|--------|-------|---------------------------|
| Firestore rules (Vitest) | `it.fails("... [DEFEITO: arquivo:linha]")` | passa enquanto o defeito existir |
| Functions (Jest) | `test.failing("... [DEFEITO: arquivo:linha]")` | passa enquanto o defeito existir |
| Web (Vitest) | `it.fails("... [DEFEITO: arquivo:linha]")` | passa enquanto o defeito existir |
| Android (JUnit) | `@Ignore("DEFEITO: arquivo:linha")` | ignorado, contado à parte |

Quando o defeito for corrigido, o `it.fails` / `test.failing` passa a falhar e deve ser trocado por `it`. Cada agente
reporta a lista completa: arquivo, linha do teste, arquivo:linha do código defeituoso e o motivo em uma frase.

Contagem: testes em `it.fails`/`test.failing`/`@Ignore` **não** entram no total de "passando" do CA1; são contados à
parte no relatório.

---

## 3. Design

### 3.1 Camadas e comandos

| Camada | Diretório (arquivos novos) | Comando local |
|--------|----------------------------|---------------|
| Firestore rules | `firestore-rules-tests/src/permissions-*.test.ts` | `cd firestore-rules-tests && npm run test:ci` (usa emulador) |
| Functions (callables e regras de negócio) | `functions/test/permissions/*.test.ts` | `cd functions && npx jest test/permissions` |
| Web (Vitest) | `web/src/test/permissions/*.test.ts` | `cd web && npx vitest run src/test/permissions` |
| Android (JUnit, unitário) | `app/src/test/java/com/futebadosparcas/permissions/*Test.kt` | `./gradlew :app:testDebugUnitTest --tests "com.futebadosparcas.permissions.*"` |

Em `functions/` os testes de callable usam `jest.mock("../src/middleware/rate-limiter")` conforme `CLAUDE.md`.

### 3.2 Regras de escrita

- Haiku 5.5 nos agentes de desenvolvimento (regra do Renan, 05/11).
- Não escrever nem ler produção. Firestore e Auth de produção são somente leitura; os testes só usam emulador.
- Nada de segredo, token ou e-mail real em fixture. UIDs e e-mails são fictícios (`user-owner`, `@example.test`).
- Comentários e nomes de teste em português (PT-BR), conforme `CLAUDE.md`.
- Nomes: `methodName_condition_expectedResult` no Kotlin; descrições claras no Jest/Vitest.

---

## 4. Divisão por área (sem arquivo compartilhado)

| Agente | Camada | Arquivos que pode criar | Não toca |
|--------|--------|--------------------------|----------|
| A | Firestore rules | `firestore-rules-tests/src/permissions-*.test.ts` | qualquer outro arquivo |
| B | Functions (Jest) | `functions/test/permissions/*.test.ts` | `functions/src`, outros testes |
| C | Web (Vitest) | `web/src/test/permissions/*.test.ts` | `web/src` fora desse diretório |
| D | Android (JUnit) | `app/src/test/java/com/futebadosparcas/permissions/*Test.kt` | `app/src/main`, outros testes |

Este arquivo de spec, `specs/DECISIONS.md` e o relatório final são escritos só pela sessão principal.

---

## 5. Metas de contagem

| Camada | Meta de testes passando |
|--------|-------------------------|
| Firestore rules | 90 a 110 |
| Functions (Jest) | 120 a 140 |
| Web (Vitest) | 50 a 60 |
| Android (JUnit) | 60 a 80 |
| **Total** | **300 a 400** |

---

## 6. Matriz funcionalidade × permissão

Preenchida no relatório final a partir das respostas dos agentes. Cada célula: `✔` (coberto e passando), `✖` (coberto,
defeito real, ver seção 7), `—` (não aplicável), `?` (não coberto).

Legenda: ✔ coberto e passando · ✖ defeito real (teste de falha esperada, seção 7) · ? não coberto nesta rodada.
Camadas: R = Firestore rules · F = Functions (Jest) · W = web (Vitest) · A = Android (JUnit).

**Convites**

| Funcionalidade | Papel | Esperado | Resultado |
|---|---|---|---|
| Criar convite | dono | permitido; negado se alvo já é membro ativo/banido ou auto-convite | ✔ R, F, A |
| Criar convite | ADMIN ativo (não dono) | negado: só o dono convida, como nas rules (#4589; o repositório recusa antes de gravar) | ✔ R; sem teste Android do `createInvite` (o use case ainda deixa passar ADMIN) |
| Criar convite | membro, visitante, ADMIN de outro grupo, anônimo | negado | ✔ R, F, W |
| Aceitar / recusar | destinatário | aceita pendente | ✔ R, F, A |
| Aceitar / recusar | terceiro | negado | ✔ R |
| Convite expirado, reusado, inexistente, grupo inativo ou bloqueado | destinatário | não cria vínculo; convite volta a `used=false` com motivo | ✔ R, F, A |
| Código de convite: colisão e exaustão | sistema | retry; falha após 8 tentativas | ✔ F |
| Apadrinhamento inválido ou auto-convite | usuário | `valid=false` | ✔ F |

**Criação de grupo**

| Funcionalidade | Papel | Esperado | Resultado |
|---|---|---|---|
| Criar grupo | usuário autenticado completo | permitido | ✔ R |
| Criar grupo | anônimo, sem perfil, dono alheio | negado | ✔ R |
| Contador de membros | criação, saída, exclusão | +1 / −1, sem dupla contagem | ✔ F |
| Criar grupo | admin global | permitido | ? |

**Entrada e saída**

| Funcionalidade | Papel | Esperado | Resultado |
|---|---|---|---|
| Entrar em grupo público | visitante | permitido | ✔ R |
| Entrar em grupo privado, bloqueado ou banido | visitante | negado | ✔ R |
| Pedido de entrada: aprovar | dono, ADMIN | aprova | ✔ R, F |
| Pedido de entrada: aprovar | membro, solicitante | negado | ✔ R, F |
| Saída voluntária | membro, visitante | sai; visitante negado | ✔ R, A |
| Dono saindo sem transferir titularidade | dono | negado | ✔ R |
| Último ADMIN saindo | ADMIN | — | ? |

**Papéis e permissões**

| Funcionalidade | Papel | Esperado | Resultado |
|---|---|---|---|
| Editar grupo, promover, transferir titularidade | dono | permitido | ✔ R, A |
| Gerenciar membros, banir, finalizar jogo | ADMIN ativo | permitido | ✔ R, A, W |
| Editar grupo, convidar, promover | membro | negado | ✔ R, A, W |
| Qualquer ação de gestão | visitante | negado | ✔ R, F |
| Qualquer ação de gestão | membro de outro grupo | negado | ✔ R, F |
| Banir | FIELD_OWNER | negado | ✔ A |
| Papel de ADMIN com status REMOVED no cliente | ADMIN removido | sem papel no cliente | ✖ A (D5, sem efeito no servidor) |

**Caixa (`cashbox`)**

| Funcionalidade | Papel | Esperado | Resultado |
|---|---|---|---|
| Lançar receita ou despesa, atualizar saldo, estornar uma vez | dono, ADMIN | permitido; estorno duplo recusado | ✔ F, A |
| Lançar | membro, visitante, ADMIN de outro grupo, não verificado | permission-denied | ✔ F |
| Escrita direta no Firestore | qualquer | negada (só callable escreve) | ✔ R |
| Leitura de caixa | membro ativo, dono | permitido | ✔ R |
| Leitura de caixa | visitante, membro inativo, dono de outro grupo | negado | ✔ R |
| Valor zero, negativo, 3 casas, saldo insuficiente, resumo não reconciliado | qualquer | erro esperado | ✔ F, W, A |
| Lançar pela UI do web | membro comum | botão oculto | ? (exige render) |

**Marcação de jogo, lista de espera e confirmação**

| Funcionalidade | Papel | Esperado | Resultado |
|---|---|---|---|
| Criar jogo | dono de grupo com 5+ membros | permitido | ✔ R |
| Criar jogo | dono pequeno, membro, visitante | negado | ✔ R |
| Confirmar presença | membro, convidado | confirma e conta | ✔ F, R, A |
| Confirmar presença | PENDING, bloqueado, não-membro | permission-denied | ✔ F |
| Confirmar presença | jogo finalizado, cancelado ou com horário passado | failed-precondition | ✔ F, A |
| Lotação e goleiros | jogador | vai à fila ao lotar; goleiros contam | ✔ F, A |
| Jogo público | de fora | entra se `PUBLIC_OPEN`; negado se restrito | ✔ F, R |
| Lista de espera | membro, público, admin global | entra na posição; bloqueia no limite de 200 | ✔ F |
| Lista de espera | jogador bloqueado, jogo público | permission-denied | ✖ F (D1) |
| Gestor confirma convidado | dono, admin global | confirma | ✔ F |
| Gestor confirma convidado | membro, ADMIN sem organizar | negado | ✔ F |
| Gestor confirma convidado | jogador bloqueado no grupo | permission-denied | ✖ F (D2) |
| Status, contadores e exclusão do jogo | dono, membro, visitante, admin | transições válidas; `FINISHED` não apagado | ✔ R |
| Jogo com `coOrganizers` ausente, `canManageGame` | membro comum | negado | ✖ W (D6, latente) |

**Votação pós-jogo**

| Funcionalidade | Papel | Esperado | Resultado |
|---|---|---|---|
| Votar MVP e Bola Murcha | jogador confirmado | cédula completa aceita | ✔ F, A |
| Voto duplicado, contraditório, em lote, fora da janela, votação encerrada | jogador | recusado | ✔ F, W |
| Voto de quem não jogou, jogo cancelado | qualquer | permission-denied / ignorado | ✔ F, A |
| Votar por escrita direta no Firestore | jogador | negado | ✔ R |
| Encerrar votação | dono, admin global | apura MVP e Bola Murcha | ✔ F |
| Encerrar votação | membro | negado | ✔ F |
| `mvp_id` gravado direto pelo dono em jogo `FINISHED` | dono | negado (MVP só via `mvp_votes`) | ✖ R (D3) |
| Reações no resultado | confirmado dentro de 72 h / fora da janela / visitante | só o confirmado na janela | ✔ R |
| Janela de votação consultada no cliente | — | fechada na UI | ? (o servidor cobre) |

**XP e temporada**

| Funcionalidade | Papel | Esperado | Resultado |
|---|---|---|---|
| XP de votação: MVP, Bola Murcha, idempotência, dedup, piso de −100 | sistema | valores certos, sem repetição | ✔ F |
| XP só em jogo que virou `FINISHED`; dono ausente ou trocado | sistema | processa só o caso válido | ✔ F |
| Teto de gols, assistências e performance | sistema | limites aplicados | ✔ A |
| Temporada (`season_participation`, congelamento) | sistema | — | ? |

---

## 7. Defeitos reais encontrados

Verificados por um workflow adversarial (cada defeito com um verificador que tentou refutá-lo, lendo o código e as
regras completas). Nenhum foi corrigido.

| ID | Teste (arquivo:linha) | Código apontado | Status | Motivo |
|---|---|---|---|---|
| D1 | `functions/test/permissions/game-presence-waitlist.test.ts:278` | `functions/src/waitlist/join-game-waitlist.ts:126` | confirmado, alta confiança | No ramo de jogo público, só checa gestor, membro ativo e aberto ao público; não consulta `groups/{g}/blocked_players`. `join-public-game.ts:336-341` faz essa checagem. Nenhuma outra camada bloqueia (`allow create: if false` nas rules deixa a callable como única via). |
| D2 | `functions/test/permissions/game-presence-waitlist.test.ts:336` | `functions/src/games/confirm-player-as-manager.ts:175` | confirmado, alta confiança | O gestor confirma convidado bloqueado. Além disso, `GroupRepository.kt:1190-1210` não remove confirmações PENDING existentes, então um bloqueado com PENDING prévio pode ser elevado a CONFIRMED. |
| D3 | `firestore-rules-tests/src/permissions-voting.test.ts:170` | `firestore.rules:1285` | confirmado no emulador (o teste `it.fails` passou porque a escrita foi permitida) | O dono grava o próprio uid em `mvp_id` de jogo `FINISHED`. O ramo do dono não valida o valor. Nenhum cliente grava `mvp_id` (o MVP vem de `mvp_votes`, `mvp-voting.ts:1450`). |
| D6 | `web/src/test/permissions/marcacao-espera-votacao.test.ts:141` | `web/src/types/game.ts:454` | confirmado, latente | `canManageGame` lança `TypeError` sem `coOrganizers`. A função exportada não tem chamador de produção; as telas usam checagens próprias com `?.`. |
| D4 | `app/src/test/java/com/futebadosparcas/permissions/InviteToGroupPermissionsTest.kt:156` | `InviteToGroupUseCase.kt:72-73` | defeito de código, sem efeito observado | Se a checagem "já é membro" falha, o use case segue e cria o convite. Mas `firestore.rules:3094-3098` (`inviteTargetCanBeInvited`) nega o `create` quando o alvo é membro ativo, e a transação falha sem efeito. Teste em `@Disabled`. |
| D5 | `app/src/test/java/com/futebadosparcas/permissions/GroupMemberStatusRoleTest.kt:69` | `app/src/main/java/**/GroupRepository.kt:405` (`getMyRoleInGroup`) | defeito de código, sem efeito no servidor | `getMyRoleInGroup` só checa `exists()`, então um ADMIN removido mantém o papel na tela. As rules (`firestore.rules:3108-3121`, `isGroupOwnerById`; e `isGroupAdmin`, que exige `ACTIVE`) bloqueiam a ação no servidor. Teste em `@Disabled`. |

Como cada defeito foi provado: D1, D2 e D6 pelo próprio teste de falha esperada (o caso roda e tem sucesso onde deveria
negar); D3 pelo emulador (`it.fails` passa porque a escrita é permitida); D4 e D5 por reativação temporária do `@Disabled`
(o teste falhou), e o efeito no servidor por leitura das rules, sem reproduzir no emulador.
