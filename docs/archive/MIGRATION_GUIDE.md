# 🚀 Guia de Migração - Custom Claims

**Data:** 2026-02-03
**Versão:** 1.8.0
**Status:** ✅ Pronto para Execução

---

## 📋 PRÉ-REQUISITOS

- ✅ Cloud Functions deployed (já feito)
- ✅ Firestore Rules deployed (já feito)
- ✅ Usuário admin autenticado no Firebase Console
- ⚠️ **IMPORTANTE:** Execute em horário de baixo tráfego (madrugada)

---

## 🎯 OBJETIVO

Migrar **TODOS os usuários existentes** para Custom Claims, movendo o campo `role` de Firestore para JWT tokens.

**Benefícios:**
- ⬇️ Firestore Reads: -40% (~20k reads/dia eliminados)
- 💰 Economia: $7/mês
- ⚡ Performance: +20ms de latência reduzida

---

## 📊 OPÇÃO 1: VIA FIREBASE CONSOLE (RECOMENDADO)

### Passo 1: Acessar Firebase Console Functions

1. Abra: https://console.firebase.google.com/project/futebadosparcas/functions
2. Localize a função: `migrateAllUsersToCustomClaims`
3. Clique em **"Logs"** (abra em outra aba para monitorar)

### Passo 2: Testar com Emulador de Requisição

1. Clique na função `migrateAllUsersToCustomClaims`
2. Vá para aba **"Testing"**
3. **Request body:** (vazio - não precisa de parâmetros)
   ```json
   {}
   ```
4. **Auth:** Selecione seu usuário admin
5. Clique em **"Run Test"**

### Passo 3: Monitorar Logs em Tempo Real

Abra os logs em tempo real:
```
https://console.firebase.google.com/project/futebadosparcas/functions/logs
```

**Logs esperados:**
```
[MIGRATION] Starting Custom Claims migration by USER_ADMIN_ID
[MIGRATION] Processed 100 users...
[MIGRATION] Processed 200 users...
[MIGRATION] Complete: 523 users migrated, 0 errors
```

### Passo 4: Validar Migração

Execute no Firebase Console > Firestore > Query:

```javascript
// Verificar quantos usuários têm Custom Claims
// (todos devem ter após migração)
db.collection('users')
  .where('claims_updated_at', '>', new Date('2026-02-03'))
  .count()
  .get()
```

**Esperado:** Número igual ao total de usuários

---

## 📊 OPÇÃO 2: VIA HTTPS REQUEST (Avançado)

### Passo 1: Obter ID Token Admin

```bash
# Via Firebase CLI
firebase login
firebase apps:sdkconfig WEB

# Copiar o ID Token do console
```

### Passo 2: Chamar Function via cURL

```bash
curl -X POST \
  https://southamerica-east1-futebadosparcas.cloudfunctions.net/migrateAllUsersToCustomClaims \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_ID_TOKEN_ADMIN" \
  -d '{}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "processed": 523,
  "errors": 0,
  "message": "Migration complete. 523 users updated."
}
```

---

## 📊 OPÇÃO 3: VIA FIREBASE CLI (Mais Simples)

### Passo 1: Instalar Firebase CLI (se não tiver)

```bash
npm install -g firebase-tools
firebase login
```

### Passo 2: Executar Migration

```bash
cd C:\Projetos\FutebaDosParcas

# Deploy functions (se ainda não fez)
firebase deploy --only functions:migrateAllUsersToCustomClaims

# Executar migration via Firebase Shell
firebase functions:shell

# No shell, execute:
> migrateAllUsersToCustomClaims()
```

---

## ✅ VALIDAÇÃO PÓS-MIGRAÇÃO

### 1. Verificar Custom Claims Aplicados

**Via Firebase Console:**
```javascript
// Authentication > Users > Selecione um usuário > Custom claims
// Deve mostrar: { "role": "PLAYER" } ou "ADMIN" ou "FIELD_OWNER"
```

**Via Cloud Functions Logs:**
```
[MIGRATION] Complete: X users migrated, Y errors
```

### 2. Testar Autenticação

**Teste 1: Player NÃO pode mudar roles**
```javascript
// Via Firebase Console > Functions > setUserRole
{
  "uid": "PLAYER_USER_ID",
  "role": "ADMIN"
}
// Esperado: Error "permission-denied"
```

**Teste 2: Admin PODE mudar roles**
```javascript
// Logado como admin
{
  "uid": "PLAYER_USER_ID",
  "role": "FIELD_OWNER"
}
// Esperado: { "success": true }
```

### 3. Monitorar Métricas (24 horas)

**Firebase Console > Analytics > Custom Analytics:**

- Firestore Reads: Deve reduzir ~40%
- Authentication success rate: Deve permanecer >99%
- Function errors: Deve permanecer <1%

---

## 🚨 ROLLBACK PLAN (Se algo der errado)

### Cenário: Migração falhou ou causou problemas

**Não se preocupe!** O sistema tem **dual-source fallback**:

1. **Security Rules já têm fallback:**
   ```javascript
   function isAdmin() {
     return request.auth != null && (
       request.auth.token.role == 'ADMIN' ||  // Custom Claim (novo)
       getUserRole() == 'ADMIN'                // Firestore (fallback)
     );
   }
   ```

2. **Sistema continua funcionando normalmente:**
   - Custom Claims ausentes? → Usa Firestore
   - Custom Claims presentes? → Usa Custom Claims (mais rápido)

3. **Para reverter Custom Claims (se necessário):**
   ```bash
   # Criar script de remoção
   firebase functions:shell
   > // Código para remover Custom Claims de todos os usuários
   ```

---

## 📊 MÉTRICAS ESPERADAS

### Antes da Migração

- Firestore Reads/dia: **~50,000**
- Custo mensal: **$18**
- Latência média autenticação: **150ms**

### Após Migração (24h)

- Firestore Reads/dia: **~30,000** (-40%)
- Custo mensal: **$11** (-$7)
- Latência média autenticação: **130ms** (-20ms)

### Após 2 Semanas (95% usuários migrados)

- **Remover fallback** `getUserRole()` das Security Rules
- Firestore Reads/dia: **~20,000** (-60%)
- Custo mensal: **$8** (-$10)

---

## 🎯 TIMELINE RECOMENDADO

| Dia | Ação | Resultado Esperado |
|-----|------|-------------------|
| **Dia 1** | Executar migration | 100% usuários migrados |
| **Dia 1-7** | Monitorar métricas | -40% reads, 0 errors |
| **Dia 7** | Habilitar App Check | Bot protection ativo |
| **Dia 14** | Remover fallback | -60% reads total |
| **Dia 30** | Relatório final | Economia $7-10/mês |

---

## 📞 CONTATO & SUPORTE

**Em caso de problemas:**

1. **Check Logs:** https://console.firebase.google.com/project/futebadosparcas/functions/logs
2. **Check Firestore Rules:** https://console.firebase.google.com/project/futebadosparcas/firestore/rules
3. **Rollback:** Sistema tem fallback automático (seguro)

**Spec Completa:** `specs/PERF_001_SECURITY_RULES_OPTIMIZATION.md`

---

**Última Atualização:** 2026-02-03
**Status:** ✅ Pronto para Execução
**Risco:** 🟢 Baixo (dual-source fallback)
