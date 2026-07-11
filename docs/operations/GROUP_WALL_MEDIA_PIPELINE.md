# Pipeline de mídia do Mural

O pipeline v1 publica fotos e vídeos apenas depois de validação server-side. Web e Android reservam um `postId` idempotente no callable `createGroupWallMediaDraft`, enviam exatamente um objeto para `wall_media_staging` e observam `wall_post_drafts/{postId}` até `READY`, `REJECTED` ou `EXPIRED`.

## Contrato e limites

- Autenticação e App Check com token de uso limitado são obrigatórios; o token é consumido no callable.
- O callable limita cada usuário a 20 reservas por minuto.
- Imagens: JPEG, PNG ou WebP, menos de 10 MiB, até 8192 px por eixo e 40 MP.
- Vídeos: MP4, H.264, áudio AAC opcional, menos de 25 MiB, no máximo 30 segundos e os mesmos limites de resolução.
- O servidor confirma magic bytes, MIME, tamanho, container, codecs e duração. Imagens são normalizadas para WebP; vídeos compatíveis não são transcodificados.
- Originais e posters usam paths content-addressed imutáveis. Clientes anteriores à 1.53.0/Android build 72 usam uma compatibilidade temporária, limitada ao path `__draft__` do próprio autor, MIME/extensão/tamanho exatos e grupo ativo.
- O post social só é criado em `wall_posts` na transação que muda o draft para `READY`; Mural e Feed nunca consultam drafts.

## Estados, retry e limpeza

`AWAITING_UPLOAD → PROCESSING → READY|REJECTED`. `EXPIRED` é terminal durante a limpeza. O `clientRequestId` permanece estável em falhas de rede/timeout e muda depois de rejeição terminal. Reentregas do mesmo evento usam geração do Storage, lease transacional e paths imutáveis; falhas transitórias liberam o lease e são reprocessadas até cinco tentativas.

Drafts `READY` viram tombstones mínimos permanentes: retêm apenas identidade/hash/paths necessários à idempotência, sem texto, perfil ou URL-capability. Assim, repetir o UUID nunca sobrescreve reações, comentários, pin ou soft-delete. O janitor roda a cada dez minutos, percorre até 2.000 drafts por execução em páginas de 200 e concorrência 10, remove apenas paths exatos registrados antes do upload e publica backlog/idade do mais antigo nas métricas.

## Compatibilidade de clientes anteriores

O documento `system_config/group_wall_media_compat` é um kill switch fail-closed compartilhado por Firestore e Storage Rules. Em produção ele foi criado com:

- `enabled: true`;
- `target_web_version: 1.53.0`;
- `target_android_build: 72`;
- `disable_after: 2026-08-15T03:00:00Z`;
- `migration_issue: 3519`.

O gate deve ser desligado assim que a adoção do Android build 72 estiver comprovada, ou automaticamente na data limite. Não prorrogue sem registrar adoção, motivo e nova data. A compatibilidade não aceita paths flat, bucket externo, MIME divergente, extensão enganosa, overwrite nem delete client-side de staging.

## Runtime nativo e isolamento

- Todo parser usa FFmpeg `8.1.2-22-g94138f6973`, build Linux LGPL pinado do BtbN indicado pela página oficial do FFmpeg.
- O archive controlado está em `system-artifacts/ffmpeg/8.1.2/` no bucket do projeto, sob event-based hold. SHA-256 do archive: `0102dad4a83b266f740a50db7cd5131a8e5266cde8f0937ec3f3cb4a8c3641fa`; SHA-256 do executável: `13c2088bdbf4f1baa529d537c37872c810872b8ffab4fa74d39aea4d0332a9b7`.
- O predeploy instala o artefato Linux x64 em qualquer host antes de empacotar as Functions. macOS valida os hashes do archive e do ELF; Linux também executa o binário e exige versão mínima 8.1.2. `gcp-build` mantém a mesma validação como defesa adicional quando a plataforma o executa, mas o bundle não depende desse hook. Produção não usa `PATH` nem fallback de pacote.
- O input força demuxer MOV/MP4, whitelist de decoders, `file` como único protocolo, stdin desligado, limites de probe/análise/alocação e uma thread. O poster mapeia somente `0:v:0`, sem áudio, legenda ou data stream.
- `onGroupWallMediaStaged`, o janitor e `generateGameVideoThumbnail` usam `futeba-wall-media@futebadosparcas.iam.gserviceaccount.com`, sem `roles/editor`: apenas Datastore User, Eventarc Receiver, Run Invoker, Logging Writer e Object Admin no bucket. O bucket Firebase ainda usa ACL legada e não aceita IAM por prefixo sem migração para uniform access; separar mídia não confiável em bucket/worker sem IAM é o hardening seguinte.
- O job `FFmpeg 8.1.2 Linux Security Gate` executa o binário Linux real e um fixture H.264 em todo PR de Functions. Deploy não prossegue se esse job não passar.

## Validação local

```bash
cd functions
npm run build
npx jest --runInBand test/group-wall-media-contract.test.ts test/group-wall-media-pipeline.test.ts

cd ..
node --test scripts/load/group-wall-media.test.js
npx firebase emulators:exec --only firestore --project futebadosparcas \
  "npm run test:load:wall-media -- --vus 10"
npx firebase emulators:exec --only firestore --project futebadosparcas \
  "npm run test:load:wall-media -- --vus 100"
npx firebase emulators:exec --only firestore --project futebadosparcas \
  "npm run test:load:wall-media -- --vus 1000"
```

O gate mede reserva única, retry idêntico e corrida do mesmo request. Ele falha com qualquer erro, invariantes quebradas, p95 acima de 10 s para reservas únicas ou 5 s para retries. O teste usa obrigatoriamente `FIRESTORE_EMULATOR_HOST` e recusa produção.

Baseline local de 11/07/2026 (Firestore Emulator, zero erro e invariantes aprovadas):

| Usuários | reserva única p95 | retry idêntico p95 |
|---:|---:|---:|
| 10 | 31,1 ms | 26,4 ms |
| 100 | 132,7 ms | 102,6 ms |
| 1.000 | 897,5 ms | 611,2 ms |

No perfil de 1.000 usuários, 10 retries simultâneos do mesmo request tiveram p95 de 3.444,9 ms, sem duplicar o draft.

## Operação e observabilidade

Métricas sem IDs, nomes, paths ou URLs são gravadas em `metrics`: evento, tipo de mídia, buckets de latência/tamanho/duração, bytes de entrada/saída, tentativa, código de erro, órfãos, falhas de cleanup, possível backlog e idade do expirado mais antigo. Alertar para crescimento de `PROCESSING_RETRY`, `REJECTED`, drafts expirados, p95 acima de 60 s ou backlog de `PROCESSING` com lease vencido.

Deploy seguro: mirror/hold + IAM + documento de compatibilidade → índice → Functions → regras → Web → Android. Verifique no deploy que ambos os triggers nativos usam a service account dedicada e FFmpeg 8.1.2 antes de desligar a compatibilidade. Em rollback, reverta clientes e Functions, mas mantenha leitura dos paths finais, tombstones e triggers de janitor/soft-delete.
