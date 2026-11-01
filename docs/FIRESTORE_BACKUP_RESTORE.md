# Backup e restauração do Firestore

Procedimento do banco `(default)` do projeto `futebadosparcas` (região `southamerica-east1`). Criado na #4397.

## Proteções ativas

| Proteção | Estado | Como conferir |
|---|---|---|
| Backup diário | retenção de 14 dias | `gcloud firestore backups schedules list --project=futebadosparcas --database='(default)'` |
| Backup semanal (domingo) | retenção de 98 dias | mesmo comando |
| Point-in-time recovery | ligado (7 dias) | `gcloud firestore databases describe --project=futebadosparcas --database='(default)' --format='value(pointInTimeRecoveryEnablement)'` |
| Proteção contra exclusão | ligada | mesmo comando, campo `deleteProtectionState` |
| Soft delete do bucket do Storage | 7 dias | `gcloud storage buckets describe gs://futebadosparcas.firebasestorage.app --format='value(soft_delete_policy)'` |

Os agendamentos foram criados em 31/10/2026; o primeiro backup saiu em 01/11/2026 às 07:49 UTC.

## Restaurar

A restauração sempre cria um banco **novo**. Ela nunca sobrescreve o `(default)`.

1. Escolha o backup:

   ```bash
   gcloud firestore backups list --project=futebadosparcas --format="table(name.basename(),state,snapshotTime)"
   ```

2. Restaure num banco com nome novo:

   ```bash
   gcloud firestore databases restore --project=futebadosparcas \
     --source-backup=projects/futebadosparcas/locations/southamerica-east1/backups/<ID> \
     --destination-database=restore-<aaaammdd>
   ```

3. Espere a operação terminar (cerca de 15 minutos para ~82 mil documentos):

   ```bash
   gcloud firestore operations list --project=futebadosparcas --database=restore-<aaaammdd> --format="value(done,error)"
   ```

4. Confira os dados. Pelo Admin SDK, `getFirestore(app, 'restore-<aaaammdd>')` abre o banco restaurado. Compare a contagem por coleção (`collection(id).count()`) com o `(default)`.

5. Para recuperar dados, copie do banco restaurado para o `(default)` só os documentos afetados, com um script revisado. Não troque o banco que os apps usam.

6. Apague o banco restaurado. Ele herda a proteção contra exclusão, então desligue-a **só nele** antes:

   ```bash
   gcloud firestore databases update --project=futebadosparcas --database=restore-<aaaammdd> --no-delete-protection
   gcloud firestore databases delete --project=futebadosparcas --database=restore-<aaaammdd>
   ```

   Confira o `--database` duas vezes: nunca rode esses comandos no `(default)`.

Para perdas dos últimos 7 dias, o PITR dá um ponto mais preciso que o backup diário: `gcloud firestore databases clone` cria um banco novo a partir do `(default)` num instante escolhido (veja `gcloud firestore databases clone --help`), e `gcloud firestore export --snapshot-time` exporta esse instante para um bucket.

## Teste de 01/11/2026

- Backup `936cda02-b1ec-4e03-b838-78be87a6aefe` (snapshot 07:49:57 UTC) restaurado em `restore-test-20261101` em 15 minutos.
- 52 coleções raiz e 81.652 documentos restaurados.
- 48 coleções com a mesma contagem do `(default)`. As 4 diferentes (`alerts`, `metrics`, `notifications`, `realtime_slo_rollups`) são séries temporais escritas ou limpas por cron depois do snapshot.
- `users`, `groups`, `games`, `seasons` e `release_notes`: conteúdo idêntico, documento a documento.
- Banco temporário apagado às 08:11 UTC.
