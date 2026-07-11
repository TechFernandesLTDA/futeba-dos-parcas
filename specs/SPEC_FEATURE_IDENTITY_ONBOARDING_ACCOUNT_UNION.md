# Identidade única no onboarding e união segura de contas

**Status:** em implementação  
**Data:** 2026-07-10  
**Superfícies:** Web, Firebase Auth, Cloud Functions, Firestore

## Problema

Uma pessoa pode iniciar cadastros com provedores diferentes antes de concluir
telefone e CPF. O Firebase Auth garante que um telefone esteja ligado a apenas
um UID, e `cpf_index` protege CPFs novos, mas contas legadas podem não possuir o
documento privado/indexado. O fluxo atual prova as duas sessões e cria
`account_merge_requests`, porém termina em `pending_review` e não consolida a
identidade.

## Invariantes

1. Um CPF normalizado pertence a exatamente uma identidade canônica.
2. Um telefone E.164 pertence a exatamente uma identidade canônica.
3. E-mail, Google, senha e telefone são métodos de acesso, não identidades
   independentes.
4. Semelhança de nome, foto ou e-mail nunca autoriza uma união.
5. A união exige prova recente de controle das duas contas.
6. Dois CPFs existentes e diferentes bloqueiam a união automática.
7. CPF e telefone não aparecem em logs, respostas, IDs de documento ou issues.
8. Toda união é idempotente, auditável e preserva um alias do UID anterior.
9. Nenhum dado da conta origem é apagado antes de existir manifesto de união.

## Fluxo de produto

1. Usuário confirma o SMS.
2. Se o telefone estiver livre, ele é vinculado ao UID atual e o onboarding
   segue para CPF.
3. Se já estiver ligado a outra conta, a tela informa apenas uma indicação
   mascarada e oferece: entrar na conta existente, usar outro número ou unir as
   contas.
4. Para unir, o cliente guarda o token recente da conta origem, entra na conta
   dona do telefone e envia as duas provas à Cloud Function.
5. A Function cruza CPF privado, telefone do Auth, estado das contas e
   solicitações anteriores. CPF divergente interrompe o fluxo.
6. Se a conta canônica ainda não tem CPF privado (legado), ela volta à etapa de
   CPF. Depois da verificação, a solicitação pode ser concluída.
7. A reconciliação preserva o UID canônico, cria `account_aliases/{oldUid}` e
   move documentos de identidade direta. Referências históricas continuam
   resolvíveis pelo alias e são migradas de forma idempotente.
8. Provedores que exigem credencial do usuário são vinculados pelo SDK cliente;
   o backend nunca tenta fabricar credenciais OAuth ou senha.

## Modelo privado

- `cpf_index/{hash}`: CPF -> UID canônico (já existente; acesso negado a cliente).
- `phone_index/{hmac}`: telefone E.164 -> UID canônico (novo; acesso negado a cliente).
- `account_merge_requests/{sourceUid}_{targetUid}`: provas, relação de CPF,
  estado e manifesto da reconciliação.
- `account_aliases/{sourceUid}`: `canonicalUid`, `mergeRequestId`, timestamps.
- `audit_logs/{id}`: eventos solicitada, bloqueada, iniciada e concluída.

O índice de telefone usa HMAC-SHA-256 com segredo do projeto e prefixo de
domínio (`phone:`). O número puro não é usado como ID nem armazenado no índice.

## Estados da solicitação

- `pending_cpf`: conta canônica precisa verificar CPF.
- `pending_review`: prova suficiente, mas há dado legado/inconsistente.
- `ready`: ambas as sessões foram provadas e não há conflito de CPF.
- `processing`: reconciliação em execução.
- `completed`: alias e manifesto gravados; operação idempotente.
- `blocked`: CPF divergente, conta desabilitada ou prova inválida.

## Critérios de aceite

- Duas chamadas concorrentes para o mesmo CPF ou telefone produzem um único
  proprietário canônico.
- Repetir conclusão da mesma união retorna o mesmo resultado sem duplicar dados.
- Conta com CPF diferente recebe bloqueio e nenhuma mutação de dados.
- Conta legada sem `users_private` precisa reverificar CPF antes da conclusão.
- O cliente nunca recebe CPF, telefone completo, hash privado ou UID da outra
  conta.
- Regras negam leitura e escrita cliente em todos os índices e aliases.
- Testes cobrem colisão, concorrência, idempotência, CPF divergente e legado.

