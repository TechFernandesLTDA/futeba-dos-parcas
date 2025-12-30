# Operacoes Firestore - Futeba dos Parcas

## 1. Deploy de Regras e Indices

### Pre-requisitos
```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar projeto (se ainda nao feito)
firebase init
```

### Deploy
```bash
# Deploy apenas regras do Firestore
firebase deploy --only firestore:rules

# Deploy apenas indices
firebase deploy --only firestore:indexes

# Deploy tudo do Firestore
firebase deploy --only firestore

# Deploy regras do Storage
firebase deploy --only storage
```

---

## 2. Backup e Recuperacao

### 2.1 Ativar Recuperacao Pontual (PITR)

No Console Firebase:
1. Firestore > Recuperacao de desastres
2. Clicar em "Ativar recuperacao pontual"
3. Isso permite recuperar dados dos ultimos 7 dias

**Custo**: ~$0.05/GB/mes adicional

### 2.2 Backup Manual (Exportacao)

```bash
# Exportar todas as colecoes para um bucket do Cloud Storage
gcloud firestore export gs://futebadosparcas-backups/$(date +%Y-%m-%d)

# Exportar colecoes especificas
gcloud firestore export gs://futebadosparcas-backups/$(date +%Y-%m-%d) \
  --collection-ids=games,confirmations,users,statistics
```

### 2.3 Backup Automatico (Cloud Scheduler)

Criar uma Cloud Function para backup diario:

```javascript
// functions/src/scheduledBackup.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const client = new admin.firestore.v1.FirestoreAdminClient();

export const scheduledFirestoreBackup = functions.pubsub
  .schedule('0 3 * * *') // Todo dia as 3:00 AM
  .timeZone('America/Sao_Paulo')
  .onRun(async () => {
    const projectId = process.env.GCP_PROJECT || 'futebadosparcas';
    const databaseName = client.databasePath(projectId, '(default)');
    const bucket = `gs://${projectId}-backups`;
    const timestamp = new Date().toISOString().split('T')[0];

    try {
      const [response] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: `${bucket}/${timestamp}`,
        collectionIds: ['games', 'confirmations', 'users', 'statistics', 'teams'],
      });
      console.log(`Backup iniciado: ${response.name}`);
    } catch (error) {
      console.error('Erro no backup:', error);
      throw error;
    }
  });
```

### 2.4 Restauracao

```bash
# Restaurar de um backup especifico
gcloud firestore import gs://futebadosparcas-backups/2025-12-25

# ATENCAO: Isso sobrescreve dados existentes!
# Para restaurar apenas algumas colecoes, use --collection-ids
```

### 2.5 Recuperacao Pontual (PITR)

No Console Firebase:
1. Firestore > Recuperacao de desastres
2. Clicar em "Recuperar dados"
3. Selecionar o momento exato (ate 7 dias atras)
4. Escolher colecoes a recuperar

---

## 3. Monitoramento

### 3.1 Alertas de Uso

No Console Firebase > Firestore > Uso:
- Configure alertas para:
  - Leituras > 50.000/dia
  - Escritas > 20.000/dia
  - Deletes > 5.000/dia

### 3.2 Metricas Cloud Monitoring

```bash
# Criar alerta de latencia alta
gcloud alpha monitoring policies create \
  --display-name="Firestore High Latency" \
  --condition="resource.type=firestore_instance AND metric.type=firestore.googleapis.com/document/read_count > 1000"
```

### 3.3 Logs de Auditoria

Ativar em: Console GCP > IAM > Audit Logs > Cloud Firestore

---

## 4. Indices - Como Criar Manualmente

Se uma query falhar por falta de indice, o erro incluira um link.
Alternativamente, crie via console:

1. Firestore > Indices > Criar indice
2. Preencher:
   - Colecao: `confirmations`
   - Campos:
     - `game_id` (Ascending)
     - `status` (Ascending)
   - Escopo: Colecao

### Indices Criticos para Este Projeto

| Colecao | Campos | Uso |
|---------|--------|-----|
| `games` | `status` ASC, `date` ASC | Listar jogos proximos |
| `games` | `owner_id` ASC, `date` DESC | Meus jogos criados |
| `confirmations` | `game_id` ASC, `status` ASC | Confirmados por jogo |
| `confirmations` | `user_id` ASC, `status` ASC | Minhas confirmacoes |
| `statistics` | `totalGoals` DESC | Ranking artilheiros |
| `statistics` | `totalSaves` DESC | Ranking goleiros |

---

## 5. Migracao de Dados

### 5.1 Migrar Confirmacoes Legadas para ID Deterministico

```javascript
// Script de migracao (executar uma vez)
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function migrateConfirmations() {
  const confirmations = await db.collection('confirmations').get();
  const batch = db.batch();
  let count = 0;

  for (const doc of confirmations.docs) {
    const data = doc.data();
    const expectedId = `${data.game_id}_${data.user_id}`;

    // Se o ID nao segue o padrao, migrar
    if (doc.id !== expectedId) {
      // Criar documento com ID correto
      batch.set(db.collection('confirmations').doc(expectedId), data);
      // Deletar documento antigo
      batch.delete(doc.ref);
      count++;

      // Commit a cada 500 operacoes (limite do batch)
      if (count % 250 === 0) {
        await batch.commit();
        console.log(`Migrados ${count} documentos`);
      }
    }
  }

  await batch.commit();
  console.log(`Migracao concluida. Total: ${count} documentos`);
}

migrateConfirmations();
```

---

## 6. Limites e Boas Praticas

### Limites do Firestore
- Documento max: 1MB
- Escrita max: 1 doc/segundo por documento
- Transacao max: 500 operacoes
- Batch max: 500 operacoes
- Query max: 10 `in`/`array-contains-any` valores

### Boas Praticas Aplicadas Neste Projeto

1. **ID Deterministico**: `${gameId}_${userId}` para confirmacoes
   - Evita duplicatas
   - Permite leitura direta em transacoes

2. **Contadores Denormalizados**: `players_count`, `goalkeepers_count` no Game
   - Evita count() em cada listagem
   - Atualizado atomicamente na transacao

3. **Dados Denormalizados**: `user_name`, `user_photo` na Confirmation
   - Evita join para exibir lista de confirmados
   - Trade-off: dados podem ficar desatualizados

4. **Subcoleções vs Coleções Raiz**:
   - Usar colecoes raiz quando precisar de queries cross-document
   - Usar subcoleções para dados fortemente acoplados

---

## 7. Custos Estimados

### Plano Spark (Gratuito)
- 50K leituras/dia
- 20K escritas/dia
- 20K deletes/dia
- 1GB armazenamento

### Estimativa para 100 usuarios ativos/semana
- ~5K leituras/dia (listagens, detalhes)
- ~500 escritas/dia (confirmacoes, stats)
- ~50 deletes/dia (cancelamentos)
- ~100MB armazenamento

**Status**: Dentro do plano gratuito

### Para Escalar (1000+ usuarios)
- Migrar para Blaze (pay-as-you-go)
- Custo estimado: $10-50/mes
- Ativar PITR: +$5/mes
