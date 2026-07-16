# BUGFIX: ciclo seguro do token FCM no iOS (#3741)

> **Status:** `VERIFIED` (escopo automatizado; smoke físico listado como gate operacional)
> **Severidade:** `CRITICAL`
> **Data:** 2026-07-16
> **Issue:** #3741

## 1. Problema

O token FCM do iOS podia permanecer apenas no perfil legado, ser restaurado
por chamadas concorrentes após rotação/logout e ser entregue à conta errada
quando um aparelho trocava de usuário. O logout também podia aguardar rede sem
limite. Tokens privados não tinham teto, expiração ou cleanup LGPD próprio.

## 2. Resultado esperado

- Cada instalação mantém uma sequência monotônica persistente.
- O backend aplica somente a operação com sequência mais nova e mantém um
  tombstone temporário no logout.
- A propriedade canônica global vence qualquer campo legado, inclusive quando
  o proprietário atual não está entre os destinatários.
- Falha temporária mantém tokens já lidos do registro privado e bloqueia
  candidatos legados cuja propriedade não pôde ser verificada.
- Logout conclui em tempo limitado, mesmo offline.
- Token fica no Keychain; identificador estável e sequência não sensível podem
  permanecer em UserDefaults.
- Máximo de 10 instalações ativas por usuário, TTL de 90 dias e coleta diária.
- Exclusão da conta remove `push_tokens` e `push_token_devices` paginadamente.
- Registro transacional exige `users/{uid}` existente; a exclusão desse perfil
  é commitada antes da varredura, bloqueando escritas tardias após onDelete.
- Clientes Firestore nunca acessam as coleções privadas.

## 3. Arquitetura

`push_tokens/{sha256(token)}` é o índice global de propriedade e
`push_token_devices/{sha256(deviceId)}` é a barreira de ordenação entre contas.
Registro e remoção rodam em transação. Uma remoção grava estado
`unregistered`, sequência e expiração de 30 dias, impedindo um registro antigo
em voo de recriar a credencial.

Antes de enviar por caminho direto, multicast ou batch, todo token candidato é
resolvido globalmente pelo hash. Um proprietário canônico diferente elimina o
token legado. Erros nessa consulta falham fechados somente para legados;
tokens canônicos já confiáveis continuam.

## 4. Segurança e privacidade

- Payload exige App Check, autenticação e rate limit.
- Tokens/IDs não aparecem em document IDs ou logs.
- Rules têm negação explícita para as duas coleções.
- Cleanup de Auth onDelete e TTL limitam retenção.
- Cleanup TTL usa precondição `lastUpdateTime`, sem apagar token renovado entre
  a consulta e o commit.
- APNs e App Attest são declarados nos entitlements; assinatura e chave APNs
  continuam sendo pré-requisitos administrativos para validação em aparelho.

## 5. Verificação obrigatória

- [x] A→B com apenas A como destino: sem entrega direta.
- [x] A→B com apenas A como destino: sem entrega multicast.
- [x] A→B com apenas A como destino: sem entrega batch.
- [x] Registro A/B fora de ordem mantém B.
- [x] Registro seguido de logout fora de ordem mantém tombstone.
- [x] Logout Swift e KMP conclui por timeout offline.
- [x] Limite de instalações e TTL/cleanup cobertos.
- [x] onUserDeleted consulta/remove as duas coleções privadas.
- [x] Rules negam leitura/escrita a jogador e admin.
- [x] Functions lint, build e testes passam.
- [x] Shared Android testa e Shared iOS compila.
- [x] CI gera projeto com XcodeGen e exige build simulator sem assinatura.
- [ ] Build iOS local completo (CoreSimulator local precisa ser atualizado).
- [ ] Teste físico confirma APNs/App Attest com chave de produção.

## 6. Riscos

| Risco | Mitigação |
|---|---|
| Indisponibilidade do índice privado | canônicos seguem; legados fail-closed |
| Operações fora de ordem | sequência persistente e transação global |
| Retenção/abuso | teto, TTL, cleanup diário e cleanup LGPD |
| Build CI confundido com assinatura | simulator sem signing; validação física explícita |

## Histórico

| Data | Alteração |
|---|---|
| 2026-07-16 | análise adversarial e implementação iniciadas |
| 2026-07-16 | P0/P1 resolvidos; 68 testes focados e 976 testes de Rules aprovados; revisão final APPROVE |
