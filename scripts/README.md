# 📜 Scripts - Futeba dos Parças

Ferramentas para análise, população e manutenção do Firestore.

---

## 🐍 Scripts Python

### 1. Análise Completa do Firestore

```bash
python scripts/analyze_firestore.py
```

**O que faz:**
- Analisa todas as 10 collections principais
- Mostra estatísticas detalhadas por collection
- Identifica problemas (locais sem quadras, duplicatas)
- Gera relatório completo em console
- Valida campos obrigatórios

**Quando usar:**
- Antes de implementar features
- Após mudanças estruturais
- Para debugar problemas de dados
- Validação periódica

---

### 2. Popular Dados Reais de Curitiba

```bash
python scripts/populate_real_data.py
```

**O que faz:**
- Cria 12 locais reais de Curitiba
- Adiciona 48 quadras (2-8 por local)
- Informações completas: nome, endereço, telefone, amenidades
- Dados prontos para uso em testes e demos

**Locais incluídos:**
- JB Esportes & Eventos (8 quadras)
- Brasil Soccer (5 quadras)
- Top Sports (6 quadras)
- Goleadores (7 quadras)
- E mais 8 locais

**⚠️ Atenção:** Cria locais com `owner_id = 'mock_admin'`

---

### 3. Enriquecer Locais

```bash
python scripts/enrich_locations.py
```

**O que faz:**
- Adiciona coordenadas GPS reais de Curitiba
- Adiciona fotos de alta qualidade (Unsplash)
- Define horários de abertura/fechamento
- Adiciona handles do Instagram
- Define dias de operação

**Total:** 24 locais com dados completos mapeados

**⚠️ Nota:** Execute APÓS `populate_real_data.py`

---

### 4. Verificar e Limpar Duplicatas

```bash
python scripts/check_duplicates.py
```

**O que faz:**
- Detecta locais duplicados por nome
- Lista todas as cópias encontradas
- Remove duplicatas mantendo a mais recente
- Move quadras antes de deletar local
- Lista todos os locais únicos após limpeza

**Segurança:**
- ✅ Pede confirmação antes de deletar
- ✅ Move quadras para evitar perda de dados
- ✅ Estratégia configurável (newest/oldest)

---

### 5. Adicionar Quadras de Campo

```bash
python scripts/add_campo_fields.py
```

**O que faz:**
- Adiciona quadras do tipo CAMPO nos locais especificados
- Atualmente configurado para: JB Esportes & Eventos (2 quadras)
- Define preço padrão, superfície (grama natural) e dimensões
- Verifica resultado final após adição

**Quando usar:**
- Para completar locais que devem ter quadras de Campo
- Após popular dados iniciais
- Para balancear tipos de quadras (FUTSAL/SOCIETY/CAMPO)

**Segurança:**
- ✅ Pede confirmação antes de adicionar
- ✅ Mostra quais locais serão afetados

---

### 6. Verificar Tipos de Quadras

```bash
python scripts/check_field_types.py
```

**O que faz:**
- Lista distribuição de quadras por tipo (FUTSAL/SOCIETY/CAMPO)
- Mostra total de quadras cadastradas
- Exibe quadras agrupadas por local
- Identifica locais que precisam de mais variedade de tipos

**Quando usar:**
- Antes de adicionar novas quadras
- Para análise de cobertura de tipos
- Planejamento de população de dados

---

### 7. Verificar Enriquecimento

```bash
python scripts/check_enrichment.py
```

**O que faz:**
- Verifica quais locais têm GPS, fotos e horários
- Lista locais incompletos
- Mostra estatísticas de completude
- Recomenda executar enrich_locations.py se necessário

**Quando usar:**
- Após popular dados
- Para validar qualidade dos dados
- Antes de publicar em produção

---

### 8. Verificar Duplicatas (Simples)

```bash
python scripts/check_dupes_simple.py
```

**O que faz:**
- Versão simplificada sem emoji (compatível Windows)
- Agrupa locais por nome normalizado
- Lista todas as duplicatas encontradas
- Mostra quantidade de cópias por local

**Quando usar:**
- Análise rápida de duplicatas
- Antes de executar check_duplicates.py
- Em ambientes Windows com problemas de encoding

---

### 9. Análise Simples

```bash
python scripts/analyze_simple.py
```

**O que faz:**
- Versão simplificada sem emoji (compatível Windows)
- Análise rápida de todas as collections
- Mostra contagem de documentos
- Estatísticas básicas por collection

**Quando usar:**
- Análise rápida do database
- Em ambientes Windows com problemas de encoding
- Verificação após mudanças

---

## 📜 Scripts JavaScript

### 10. Reset Completo do Firestore ⚠️

```bash
node scripts/reset_firestore.js
```

**⚠️ CUIDADO - APAGA TUDO!**

**O que faz:**
- Remove TODAS as collections
- Apaga jogos, confirmações, times, estatísticas
- **Apaga usuários também!**

**Segurança:**
- Requer digitar "RESET" para confirmar
- **APENAS para ambiente de desenvolvimento/teste**
- **NUNCA usar em produção!**

**Collections afetadas:**
- `games`, `confirmations`, `teams`
- `statistics`, `player_stats`
- `live_scores`, `game_events`
- `users` ⚠️

---

### 6. Migrações do Firestore (Referência)

```bash
node scripts/migrate_firestore.js
```

**Status:** 📚 Script histórico - Schema já está atualizado

**Migrações implementadas:**
1. IDs determinísticos para confirmations
2. snake_case → camelCase em statistics
3. Validação de contadores de jogos

**⚠️ Nota:** Não executar - Schema atual já usa camelCase

---

## 🚀 Workflow Completo: Setup Inicial

Execute nesta ordem para popular o Firebase com dados reais:

```bash
# 1. Instalar dependências
pip install -r scripts/requirements.txt
cd scripts && npm install && cd ..

# 2. Popular 12 locais reais de Curitiba
python scripts/populate_real_data.py
# ✅ Output: 12 locais + 48 quadras criados

# 3. Enriquecer com GPS, fotos e horários
python scripts/enrich_locations.py
# ✅ Output: Coordenadas, fotos, horários adicionados

# 4. Verificar duplicatas (se houver)
python scripts/check_duplicates.py
# ✅ Output: Lista duplicatas e opção de limpar

# 5. Analisar resultado final
python scripts/analyze_firestore.py
# ✅ Output: Relatório completo da estrutura
```

**Tempo total:** ~2 minutos
**Resultado:** Firebase pronto para uso com dados reais!

---

## 🔄 Workflows Comuns

### Análise Periódica

```bash
# Antes de implementar feature
python scripts/analyze_firestore.py

# Após mudanças estruturais
python scripts/analyze_firestore.py

# Verificar integridade
python scripts/check_duplicates.py
```

### Reset de Ambiente (DEV ONLY!)

```bash
# ⚠️ CUIDADO - Apaga TUDO!
node scripts/reset_firestore.js
# Digite "RESET" para confirmar
```

### Setup de Dados Fresh

```bash
# 1. Reset (opcional)
node scripts/reset_firestore.js

# 2. Popular + Enriquecer
python scripts/populate_real_data.py
python scripts/enrich_locations.py

# 3. Validar
python scripts/analyze_firestore.py
```

---

## 📦 Setup de Dependências

### Python

```bash
# Opção 1: Via requirements.txt
pip install -r scripts/requirements.txt

# Opção 2: Direto
pip install firebase-admin
```

**Requer:** Python 3.7+

### Node.js

```bash
cd scripts
npm install
cd ..
```

**Requer:** Node.js 14+

---

## 🔒 Credenciais Firebase

### Service Account Key

**Arquivo:** `serviceAccountKey.json`
**Localização:** `scripts/serviceAccountKey.json`

**Como obter:**
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione o projeto "futebadosparcas"
3. Configurações do Projeto → Service Accounts
4. Generate New Private Key
5. Salve como `serviceAccountKey.json` na pasta `scripts/`

### ⚠️ Segurança

- ✅ Arquivo está em `.gitignore`
- ❌ **NUNCA commitar este arquivo!**
- ❌ **NUNCA compartilhar publicamente!**
- ✅ Tem permissões de **FULL ADMIN**

**Backup:** Também existe em:
- `futebadosparcas-firebase-adminsdk-fbsvc-b5fb25775d.json` (raiz)

---

## 📊 Estatísticas dos Scripts

### analyze_firestore.py
- **Linhas:** 192
- **Collections analisadas:** 10
- **Estatísticas:** Roles, tipos, contadores
- **Valor:** ⭐⭐⭐⭐⭐

### populate_real_data.py
- **Linhas:** 288
- **Locais criados:** 12
- **Quadras criadas:** 48
- **Valor:** ⭐⭐⭐⭐⭐

### enrich_locations.py
- **Linhas:** 329
- **Locais mapeados:** 24
- **Enriquecimentos:** GPS, fotos, horários
- **Valor:** ⭐⭐⭐⭐

### check_duplicates.py
- **Linhas:** 199
- **Funcionalidades:** Detectar, listar, remover
- **Segurança:** Confirmação + preservação
- **Valor:** ⭐⭐⭐⭐⭐

---

## 🎯 Casos de Uso

### Para Desenvolvimento
- Use `analyze_firestore.py` antes de implementar features
- Valide estrutura com análise periódica
- Popule dados reais para testes

### Para Testes
- `populate_real_data.py` → Dados instantâneos
- `reset_firestore.js` → Limpar entre testes
- `analyze_firestore.py` → Validar estado

### Para Demos
- Execute workflow completo (5 passos acima)
- Firebase pronto em 2 minutos
- 12 locais reais de Curitiba

### Para Manutenção
- `check_duplicates.py` → Limpeza periódica
- `analyze_firestore.py` → Health check

---

## 🐛 Troubleshooting

### Erro: `ModuleNotFoundError: No module named 'firebase_admin'`

```bash
pip install firebase-admin
```

### Erro: `FileNotFoundError: serviceAccountKey.json`

1. Baixe do Firebase Console
2. Salve em `scripts/serviceAccountKey.json`
3. Verifique que o arquivo existe:
   ```bash
   ls scripts/serviceAccountKey.json
   ```

### Erro: `Permission denied`

Verifique que o Service Account tem permissões de admin no Firebase.

### Script Python não executa

```bash
# Windows
python scripts/analyze_firestore.py

# Linux/Mac
python3 scripts/analyze_firestore.py
```

---

## 📚 Documentação Adicional

- **Estrutura do Firestore:** `.agent/FIRESTORE_STRUCTURE.md`
- **Auditoria de Scripts:** `.agent/AUDITORIA_SCRIPTS.md`
- **Padrões Firebase:** `.agent/FIREBASE_MODERNIZATION.md`
- **Quick Reference:** `.agent/QUICK_REFERENCE.md`

---

## 🎓 Boas Práticas

1. **Sempre analise antes de popular**
   ```bash
   python scripts/analyze_firestore.py
   ```

2. **Execute em ordem**
   - populate → enrich → check → analyze

3. **Backup antes de reset**
   - Firebase tem backup automático
   - Mas sempre confirme antes de deletar

4. **Use em desenvolvimento**
   - Scripts poderosos, use com cuidado
   - Reset apenas em ambiente dev

5. **Valide resultados**
   - Sempre execute analyze após mudanças
   - Verifique duplicatas periodicamente

---

**Última atualização**: 27/12/2024
**Versão**: 1.0
**Maintainer**: Equipe Futeba dos Parças
