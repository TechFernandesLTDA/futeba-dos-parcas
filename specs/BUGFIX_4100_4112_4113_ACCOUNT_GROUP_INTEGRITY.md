# BUGFIX #4100/#4112/#4113 — Integridade de conta e cascata de grupo

> **Status:** `APPROVED`
> **Data:** 2026-09-08
> **Aprovação:** autorização explícita do usuário para implementar todas as issues abertas, incluindo #4100, #4112 e #4113.

## Problema

Três caminhos server-side deixam dados órfãos ou PII após operações irreversíveis:

- `onGroupDeleted` carrega coleções inteiras, não retoma de onde uma tentativa anterior parou e omite `wall_posts` e `group_polls`.
- `completeAccountMerge` desabilita a conta de origem sem migrar `statistics`, `xp_logs`, `user_badges`, `season_participation`, `mvp_votes` e `activities`.
- `onUserDeleted` anonimiza `groups` com campos camelCase que os escritores não gravam, ignora a subcoleção canônica `groups/{id}/members/{uid}` e não limpa `group_invites`.

O levantamento foi feito contra os escritores reais. `statistics` usa o caminho determinístico `statistics/{uid}` e normalmente não grava `user_id`; `user_badges` usa `${uid}_${badgeId}`; `season_participation` usa `${seasonId}_${uid}`; `mvp_votes` usa `${gameId}_${voterId}_${category}`; os IDs canônicos de `xp_logs` são derivados do jogo, tipo de prêmio e uid; `activities` usa o ID global do jogo.

## Escopo

- Endurecer somente os handlers de Functions envolvidos e seus helpers/testes focados.
- Tipar separadamente o documento Firestore de grupo no web, preservando o modelo de domínio camelCase produzido por `snakeToCamel`.
- Não alterar módulos de billing/localização comercial, UI, versionamento, release ou deploy.
- Não mutar produção. A decisão sobre campos legados camelCase de grupo será tomada apenas com evidência; este patch cobre a forma snake_case comprovada pelos escritores, KMP e rules.

## Decisões

### D1 — Cascata de grupo por páginas que estreitam a própria query

Cada página será lida com limite seguro e imediatamente escrita em chunks. Deletes removem o documento da query; jogos atualizados deixam de casar com `group_id == groupId`. Assim, a próxima página pode reler o início sem cursor e cada retry continua apenas com os documentos restantes. Isso limita memória, evita checkpoint externo e mantém as operações idempotentes.

A cascata inclui `members`, `cashbox`, `cashbox_summary`, `join_requests`, `wall_posts`, `group_invites`, `group_polls`, `schedules` e jogos. Para membros, a mesma página remove também `users/{uid}/groups/{groupId}`.

### D2 — Lista canônica de coleções de gamificação por uid

Um helper compartilhado em `functions/src/auth/` descreve as seis coleções e sua identidade (`document-id` ou campo proprietário). `account-cleanup` e `account-merge` importam essa lista, evitando uma segunda enumeração divergente.

### D3 — Merge transacional, paginado e retomável

Depois da lease, coleções por campo são processadas em páginas limitadas. Cada transação relê origem e destino, grava o destino antes de remover ou retargetar a origem e adiciona `merged_from_uid`. Em retry, documentos já concluídos não casam mais com o uid de origem; a contagem auditável é reconstruída pelos marcadores no destino.

- `statistics`: soma contadores; streak atual e recordes usam máximo; campos desconhecidos do destino são preservados.
- `season_participation`: soma pontos, partidas, resultados, gols, assistências, MVP e XP, inclusive em `by_gender`; une `group_ids`; posições/ranks usam o melhor valor positivo; remove o doc da origem.
- `user_badges`: une por `badge_id`; soma `count`, preserva a primeira conquista e a última ocorrência; remove o doc da origem.
- `xp_logs`: recalcula o ID determinístico quando o formato real permite; colisão preserva o log canônico existente e remove a origem.
- `mvp_votes`: votos emitidos são reidentificados pelo jogo/categoria; colisão preserva o voto da conta canônica. Referências em `voted_player_id` também são retargetadas.
- `activities`: mantém o ID global do jogo e retargeta autor/nome/foto para o perfil canônico.

Nenhuma conta é desabilitada antes do fechamento das páginas e da verificação de falhas.

### D4 — Cleanup usa o schema escrito

- `groups.owner_id == uid` atualiza `owner_name`.
- `collectionGroup("members").where("user_id", "==", uid)` atualiza `user_name` e remove as duas formas comprovadas de foto, `user_photo` (Functions) e `user_photo_url` (web).
- O ramo de `members[]` objeto é removido; o array real contém somente strings.
- `group_invites` é removida pelos campos canônicos de convidado/remetente e pelas duas variantes camelCase já tratadas defensivamente pelo merge.
- `statistics/{uid}` é removido por path, corrigindo a query por um campo inexistente.

O índice single-field `members.user_id` com escopo `COLLECTION_GROUP` é adicionado em `firestore.indexes.json`, preservando ASC/DESC do escopo `COLLECTION`. O composto `(status, user_id)` não cobre a consulta sem status. Em rollout, publicar os índices e aguardar READY antes das Functions.

As contagens relevantes são sempre registradas; falhas transitórias continuam acionando retry e falhas permanentes continuam exigindo investigação manual.

### D5 — O tipo web separa transporte e domínio

`Group` continua camelCase porque todos os consumidores recebem dados convertidos. Um novo tipo `FirestoreGroupDocument` declara `owner_id`, `owner_name`, `members: string[]` e os demais campos do writer, e `useCreateGroup` passa a ser compilado contra esse contrato.

## Aceite e validação

- Testes de `onGroupDeleted` cobrem mais de uma página, retomada após falha e remoção de `wall_posts`/`group_polls`.
- Testes de `onUserDeleted` usam o payload real snake_case, subcoleção de membros e convites, incluindo erro transitório.
- Testes de `completeAccountMerge` cobrem origem e destino com histórico, colisões, remoção da origem, manifest e retry após progresso parcial.
- Rodar Jest focado nos três arquivos; build/lint de Functions será coordenado com os demais agentes que editam o módulo em paralelo.
