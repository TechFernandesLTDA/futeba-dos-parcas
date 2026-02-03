# Cloud Functions Scripts

Scripts utilitários para manutenção e migração do Firebase.

---

## Custom Claims Migration (PERF_001)

**Arquivo**: `migrate-custom-claims.ts`
**Spec**: `specs/PERF_001_SECURITY_RULES_OPTIMIZATION.md`

### Quando Executar

Execute **UMA VEZ** após deploy das novas Security Rules otimizadas.

### Pré-requisitos

1. Deploy das Cloud Functions com `auth/custom-claims.ts`
2. Security Rules atualizadas (Fase 1 - backward compatible)
3. Permissão de ADMIN no Firestore

### Opção 1: Via Cloud Function (RECOMENDADO)

```bash
# 1. Fazer chamada HTTP autenticada
curl -X POST https://us-central1-futebadosparcas.cloudfunctions.net/migrateAllUsersToCustomClaims \
  -H "Authorization: Bearer $(firebase login:ci)" \
  -H "Content-Type: application/json"

# OU via Firebase Admin SDK no app
const migrate = httpsCallable(functions, 'migrateAllUsersToCustomClaims');
const result = await migrate();
console.log(result); // { processed: 1234, errors: 0 }
```

### Opção 2: Via Firebase Functions Shell (LOCAL)

```bash
cd functions
npm run build
firebase functions:shell

# No shell interativo:
> migrateAllUsersToCustomClaims()
```

### Opção 3: Script Node Standalone (DESENVOLVIMENTO)

```bash
cd functions
npm run build

# Executar diretamente
node lib/scripts/migrate-custom-claims.js
```

---

## Verificar Status da Migração

```typescript
import { checkMigrationStatus } from './scripts/migrate-custom-claims';

const status = await checkMigrationStatus();
console.log(status);
// {
//   totalUsers: 1500,
//   migratedUsers: 1425,
//   percentComplete: 95.0
// }
```

**Quando 95%+ migrado**: Proceder para FASE 2 (remover fallback `getUserRole()` das Security Rules).

---

## Rollback

Se houver problemas após a migração:

1. **Reverter Security Rules** para versão anterior (via Firebase Console)
2. **Manter Custom Claims** (não fazem mal, podem ser reutilizados)
3. Investigar erros em `migration_errors` collection

```javascript
// Firestore query para ver erros
db.collection("migration_errors")
  .where("type", "==", "CUSTOM_CLAIMS_MIGRATION")
  .orderBy("timestamp", "desc")
  .limit(10)
  .get()
```

---

## Logs & Monitoramento

- **Cloud Functions Logs**: Firebase Console > Functions > Logs
- **Migration Stats**: `migration_logs` collection no Firestore
- **Errors**: `migration_errors` collection

**Alertas**:
- Se `errors > 5%` do total, pausar e investigar
- Verificar Firebase Auth rate limits (max 10 requests/segundo)

---

## Troubleshooting

### Erro: "User not found in Auth"

**Causa**: Usuário existe no Firestore mas não no Firebase Auth.
**Solução**: Limpar usuário órfão do Firestore ou criar conta Auth.

### Erro: "Rate limit exceeded"

**Causa**: Muitos requests para Firebase Auth em curto período.
**Solução**: Script já tem delay de 1s entre batches. Aumentar se necessário.

### Erro: "Permission denied"

**Causa**: Usuário executando não é ADMIN.
**Solução**: Verificar `users/{uid}.role == 'ADMIN'` no Firestore.

---

## Outras Migrações

Para adicionar novos scripts de migração:

1. Criar arquivo `migrate-{feature}.ts`
2. Seguir estrutura similar (batch processing, error handling)
3. Adicionar documentação aqui
4. Registrar execução em `migration_logs` collection
