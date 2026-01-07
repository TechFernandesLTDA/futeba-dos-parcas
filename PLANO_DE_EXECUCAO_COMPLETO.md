# PLANO DE EXECUCAO COMPLETO
**Futeba dos Parcas - v1.4.2**  
**Auditoria Finalizada**: 2026-01-06

---

## FASE 0: PREPARACAO (1h)

### 0.1 Setup do Ambiente
```bash
# Executar script de setup
cd "C:\Projetos\Futeba dos Parcas"
chmod +x scripts/setup_audit_environment.sh
./scripts/setup_audit_environment.sh
```

### 0.2 Validacao Inicial
```bash
# Executar validacao
./scripts/validate_all.sh

# Resultado esperado:
# X erros criticos
# Y warnings
```

### 0.3 Leitura Obrigatoria
- SECURITY_AUDIT_REPORT.md (5 min)
- QUICK_FIX_GUIDE.md (10 min)
- AUDITORIA_COMPLETA_README.md (5 min)

---

## FASE 1: CORRECOES P0 (16h - 2 dias)

### DIA 1 - MANHA (4h)

**Task 1.1: Backup Firestore Rules**
```bash
firebase firestore:rules get > firestore.rules.backup
git add firestore.rules.backup
git commit -m "backup: rules antes P0"
```

**Task 1.2: Corrigir Firestore Rules**

Editar `firestore.rules` linha 83-92:
- REMOVER permissao de XP/Level para FIELD_OWNER
- ADICIONAR fieldUnchanged para campos criticos

```bash
# Validar
firebase firestore:rules validate

# Deploy
firebase deploy --only firestore:rules
```

**Task 1.3: Testar Rules**
```bash
node scripts/test_firestore_rules.js

# Esperado:
# TESTE 1: XP bloqueado ✅
# TESTE 2: Perfil OK ✅
```

### DIA 1 - TARDE (6h)

**Task 1.4: Backup Functions**
```bash
cd functions/src
cp index.ts index.ts.backup
git add index.ts.backup
git commit -m "backup: functions antes P0"
```

**Task 1.5: Adicionar Auth Validation**

Editar `functions/src/index.ts` linha 238+:
- ADICIONAR validacao de owner_id
- ADICIONAR verificacao de user exists
- ADICIONAR logging de seguranca

**Task 1.6: Build e Deploy Functions**
```bash
cd functions
npm install
npm run build

# Verificar erros TypeScript
# Se OK:
cd ..
firebase deploy --only functions
```

**Task 1.7: Verificar Logs**
```bash
firebase functions:log --only onGameStatusUpdate --limit 20

# Deve conter: [AUTH] validacao mensagens
```

### DIA 2 - MANHA (4h)

**Task 1.8: Deploy Storage Rules**
```bash
# Arquivo storage.rules ja criado
firebase deploy --only storage
```

**Task 1.9: Testar Storage**
- Upload comprovante > 5MB → deve falhar
- Upload comprovante < 5MB → deve funcionar
- Acesso URL de outro grupo → 403

**Task 1.10: Teste End-to-End**
1. Criar jogo
2. Finalizar jogo
3. Verificar XP via Function (nao client)
4. Tentar editar XP → PERMISSION_DENIED

### DIA 2 - TARDE (2h)

**Task 1.11: Validacao Final P0**
```bash
./scripts/validate_all.sh
./gradlew clean build
```

**Task 1.12: Commit e Tag**
```bash
git add .
git commit -m "fix(P0): corrigir vulnerabilidades criticas
- Firestore rules: bloquear XP client-side
- Functions: adicionar auth validation
- Storage: adicionar rules completas"

git tag audit-p0-complete
git push origin master --tags
```

---

## FASE 2: CORRECOES P1 (36h - 1 semana)

### Sprint 2 - Tasks

**2.1 Paginacao GameRepository (6h)**
- Criar GameRepository.getGamesPaginated()
- Atualizar GamesViewModel
- Testar com 1000+ jogos

**2.2 Paginacao UserRepository (4h)**
- Aplicar CachedRepository base
- Implementar cursor pagination
- Testar cache hit rate

**2.3 Memory Leaks (6h)**
- Auditar todos ViewModels
- Adicionar Job cancellation
- Testar com LeakCanary

**2.4 Team Balancing (8h)**
- Adicionar validacao de posicao minima
- Considerar forma recente
- Testar 100 times aleatorios

**2.5 Votacao MVP Time Window (4h)**
- Implementar janela 24h
- Testar votacao expirada
- Testar votacao valida

**2.6 Liga para Function (8h)**
- Mover LeagueService para Functions
- Atualizar Firestore Rules
- Testar promocao/rebaixamento

---

## FASE 3: CORRECOES P2 (113h - 2 semanas)

### Sprint 3 - Prioridades

**Semana 1:**
- Design System (16h)
- Upload com retry (8h)
- Otimizar recomposicoes (8h)
- Cache global (6h)
- Testes unitarios (16h)

**Semana 2:**
- Migrar 3 telas Compose (24h)
- Responsive layout (12h)
- Accessibility (8h)
- Error handling (4h)
- ProGuard optimization (4h)

---

## FASE 4: VALIDACAO E RELEASE (8h)

### 4.1 Testes Completos
- [ ] Unit tests > 70% coverage
- [ ] Integration tests (Firestore Emulator)
- [ ] UI tests (critical flows)
- [ ] Manual QA (full regression)

### 4.2 Performance Benchmarks
- [ ] APK < 30MB
- [ ] Build < 3min
- [ ] Tela load < 2s
- [ ] Memory < 150MB
- [ ] 0 leaks detectados

### 4.3 Security Audit Final
- [ ] 0 vulnerabilidades P0
- [ ] 0 vulnerabilidades P1
- [ ] Penetration test basico
- [ ] LGPD compliance check

### 4.4 Deploy Production
```bash
# Build release
./gradlew assembleRelease

# Deploy Firebase
firebase deploy

# Tag version
git tag v1.5.0-audited
git push origin master --tags

# Upload Google Play (Internal Testing)
# ... manual upload ...
```

---

## METRICAS DE SUCESSO

### Antes vs Depois

| Metrica | Antes | Depois | Status |
|---------|-------|--------|--------|
| Scorecard Geral | 5.6/10 | 8.5/10 | ⏳ |
| Vulnerabilidades P0 | 3 | 0 | ⏳ |
| Build Success | ❌ | ✅ | ⏳ |
| APK Size | >50MB | <30MB | ⏳ |
| Tests Coverage | 0% | 70% | ⏳ |
| Memory Leaks | >5 | 0 | ⏳ |
| Firestore Reads | Alto | -70% | ⏳ |

---

## CHECKLIST MASTER

### P0 (Bloqueadores)
- [ ] Firestore Rules corrigidas
- [ ] Functions com auth
- [ ] Storage rules deployadas
- [ ] Build compilando
- [ ] XP via Function apenas

### P1 (Criticos)
- [ ] Paginacao implementada
- [ ] Memory leaks corrigidos
- [ ] Team balancing melhorado
- [ ] MVP time window
- [ ] Liga server-side

### P2 (Importantes)
- [ ] Design System completo
- [ ] 14 telas migradas
- [ ] Testes 70%
- [ ] Responsive layout
- [ ] Accessibility OK

---

## CONTATOS E SUPORTE

- Documentacao: Ver pasta raiz (*.md)
- Scripts: `scripts/`
- Issues: Criar GitHub Issue
- Deploy: Firebase Console

---

**PLANO APROVADO**  
**Inicio**: Imediato  
**Conclusao Estimada**: 4 semanas  
**Responsavel**: Time de Dev + QA
