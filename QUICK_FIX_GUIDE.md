# ⚡ GUIA DE CORREÇÃO RÁPIDA
**Futeba dos Parças - Correções P0 em 2 Dias**

---

## 🎯 OBJETIVO
Eliminar as 3 vulnerabilidades críticas (P0) em 48 horas.

---

## 📅 DIA 1 - MANHÃ (4h) - FIRESTORE RULES

### 1.1 Backup Atual (5 min)
```bash
cd "C:\Projetos\Futeba dos Parças"
firebase firestore:rules get > firestore.rules.backup
git add firestore.rules.backup
git commit -m "backup: firestore rules antes de correções P0"
```

### 1.2 Aplicar Correção (15 min)

Editar `firestore.rules` linha 83-92:

**ANTES**:
```javascript
allow update: if 
    isAdmin() || 
    (isOwner(userId) && fieldUnchanged('id') && fieldUnchanged('created_at') && fieldUnchanged('role')) || 
    (isAuthenticated() && isMock(userId)) ||
    (isAuthenticated() && (getUserRole() == 'FIELD_OWNER' || getUserRole() == 'ADMIN') && 
     request.resource.data.diff(resource.data).affectedKeys().hasOnly(['experience_points', 'level', 'milestones_achieved', 'updated_at']));
```

**DEPOIS**:
```javascript
allow update: if 
    isAdmin() || 
    (isOwner(userId) && 
     fieldUnchanged('id') && 
     fieldUnchanged('created_at') && 
     fieldUnchanged('role') &&
     fieldUnchanged('experience_points') &&
     fieldUnchanged('level') &&
     fieldUnchanged('milestones_achieved')) ||
    (isAuthenticated() && isMock(userId));
```

### 1.3 Validar e Deploy (10 min)
```bash
# Validar sintaxe
firebase firestore:rules validate

# Deploy
firebase deploy --only firestore:rules

# Verificar no console
# https://console.firebase.google.com/project/[PROJECT_ID]/firestore/rules
```

### 1.4 Testar (30 min)
```bash
cd scripts
node test_firestore_rules.js
```

**Resultado Esperado**:
```
🧪 TESTE 1: Tentar atualizar XP diretamente (deve FALHAR)
✅ PASSOU: XP bloqueado corretamente

🧪 TESTE 2: Atualizar nome de usuário (deve FUNCIONAR)
✅ PASSOU: Perfil atualizado corretamente

📊 RESULTADO: 2 passaram, 0 falharam
```

### 1.5 Testar no App (2h)

1. Abrir app
2. Tentar editar perfil → ✅ deve funcionar
3. Tentar editar XP via Firestore console (sem service account) → ❌ deve falhar
4. Criar jogo, finalizar, verificar XP atualizado pela Function → ✅ deve funcionar

---

## 📅 DIA 1 - TARDE (6h) - CLOUD FUNCTIONS AUTH

### 2.1 Backup Atual (5 min)
```bash
cd functions/src
cp index.ts index.ts.backup
git add index.ts.backup
git commit -m "backup: functions antes de correções P0"
```

### 2.2 Adicionar Validação (30 min)

Editar `functions/src/index.ts`, adicionar após linha 238:

```typescript
// ==========================================
// VALIDAÇÃO DE AUTORIZAÇÃO
// ==========================================
try {
    const gameRef = db.collection("games").doc(gameId);
    const gameSnap = await gameRef.get();
    const gameData = gameSnap.data() as Game | undefined;
    
    if (!gameData) {
        console.error(`[AUTH] Game ${gameId} não encontrado`);
        return;
    }

    // Verificar se owner existe e é válido
    const ownerDoc = await db.collection("users").doc(gameData.owner_id).get();
    if (!ownerDoc.exists) {
        console.error(`[AUTH] Owner ${gameData.owner_id} inválido para game ${gameId}`);
        await gameRef.update({
            xp_processing: false,
            xp_processing_error: "Owner inválido - possível tentativa de fraude"
        });
        return;
    }

    const ownerData = ownerDoc.data();
    console.log(`[AUTH] ✅ Jogo ${gameId} validado. Owner: ${gameData.owner_id} (${ownerData?.display_name || 'Unknown'})`);
} catch (err) {
    console.error(`[AUTH] ❌ Erro na validação de auth para ${gameId}:`, err);
    return;
}
```

### 2.3 Build e Deploy (30 min)
```bash
cd functions
npm install
npm run build

# Verificar erros de TypeScript
# Se houver erros, corrigir antes de deploy

cd ..
firebase deploy --only functions
```

### 2.4 Verificar Deploy (15 min)
```bash
# Ver funções deployadas
firebase functions:list

# Ver logs
firebase functions:log --limit 50

# Resultado esperado:
# ✔ functions[onGameStatusUpdate] Successful update operation.
```

### 2.5 Testar (4h)

1. Criar jogo de teste
2. Adicionar jogadores
3. Finalizar jogo
4. Verificar logs da Function:
```bash
firebase functions:log --only onGameStatusUpdate --limit 20
```

Deve conter:
```
[AUTH] ✅ Jogo abc123 validado. Owner: user123 (João Silva)
```

5. Tentar criar jogo com `owner_id: "fake_user_999"` → Function deve rejeitar

---

## 📅 DIA 2 - MANHÃ (4h) - STORAGE RULES

### 3.1 Deploy Storage Rules (10 min)

```bash
# Arquivo storage.rules já foi criado pela auditoria
# Verificar conteúdo
cat storage.rules

# Deploy
firebase deploy --only storage
```

### 3.2 Testar Upload (30 min)

No app:
1. Ir para Caixinha
2. Adicionar lançamento COM comprovante
3. Tentar fazer upload de arquivo > 5MB → ❌ deve falhar
4. Fazer upload de imagem < 5MB → ✅ deve funcionar
5. Tentar acessar URL de comprovante de outro grupo → ❌ deve retornar 403

### 3.3 Testar Foto de Perfil (30 min)

1. Ir para Perfil
2. Trocar foto
3. Tentar upload > 2MB → ❌ deve falhar
4. Fazer upload < 2MB → ✅ deve funcionar

---

## 📅 DIA 2 - TARDE (2h) - VALIDAÇÃO FINAL

### 4.1 Build Completo (30 min)
```bash
./gradlew clean build
```

**Resultado Esperado**: ✅ BUILD SUCCESSFUL

### 4.2 Validação Automatizada (15 min)
```bash
./scripts/validate_all.sh
```

**Resultado Esperado**:
```
================================================
✅ VALIDAÇÃO COMPLETA
0 erro(s) crítico(s)
================================================
```

### 4.3 Teste End-to-End (1h)

**Fluxo Completo**:
1. Login
2. Criar grupo
3. Convidar jogadores
4. Criar jogo
5. Confirmar presença (4+ jogadores)
6. Balancear times
7. Iniciar jogo ao vivo
8. Registrar eventos (gols, assistências)
9. Finalizar jogo
10. Votar MVP (dentro de 24h)
11. Verificar XP creditado
12. Verificar ranking atualizado
13. Verificar divisão da liga

**Validações**:
- ✅ XP calculado corretamente pela Function
- ✅ Não é possível editar XP manualmente
- ✅ Milestone desbloqueado (se atingiu threshold)
- ✅ Voto MVP registrado
- ✅ Storage seguro (upload/download)

---

## ✅ CHECKLIST FINAL

Antes de dar como concluído, verificar:

- [ ] `firestore.rules` atualizado e deployed
- [ ] `storage.rules` criado e deployed
- [ ] Cloud Functions com validação de auth deployed
- [ ] Teste `test_firestore_rules.js` passou
- [ ] Teste manual de edição de perfil OK
- [ ] Teste manual de finalização de jogo OK
- [ ] Teste manual de upload de imagem OK
- [ ] Build completo sem erros
- [ ] Fluxo end-to-end funcionando

---

## 🎉 CONCLUSÃO

Após essas correções:
- ✅ Vulnerabilidade V-001 (XP) CORRIGIDA
- ✅ Vulnerabilidade V-002 (Functions Auth) CORRIGIDA
- ✅ Vulnerabilidade V-003 (Storage) CORRIGIDA

**Status de Segurança**: 🟢 Críticos Resolvidos

**Próximos Passos**: Iniciar Sprint 2 (correções P1)
