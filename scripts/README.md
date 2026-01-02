# 🔧 Scripts - Database Maintenance & Migration

Utilitários para manutenção, migração e auditoria do banco de dados Futeba dos Parças.

## Índice
- [Scripts Node.js](#scripts-nodejs)
- [Scripts Python](#scripts-python)
- [Como Rodar](#como-rodar)
- [Safety & Backups](#safety--backups)

---

## Scripts Node.js

### 1. `seed.js` - Seed Dados de Teste

**Propósito:** Popular banco com dados de exemplo

```bash
node seed.js
```

**O que faz:**
- Cria 10-15 usuários teste
- Cria 5 locais (Parque da Mooca, Cidade Sócrates, etc)
- Cria 10 quadras
- Cria schedules de exemplo (Segunda, Quarta, Sexta)
- Cria 20 games para próximos 30 dias

**Quando usar:**
- Setup inicial de desenvolvimento
- Resetar dados de teste
- Testar novas features com dados realistas

---

### 2. `check_duplicates.js` - Encontrar Duplicatas

**Propósito:** Identificar dados duplicados no banco

```bash
node check_duplicates.js
```

**Verifica:**
- Usuários com mesmo email
- Locais com mesmo nome/endereço
- Quadras duplicadas
- Schedules duplicadas

---

### 3. `deduplicate.js` - Remover Duplicatas

**Propósito:** Limpar dados duplicados

```bash
node deduplicate.js
```

**⚠️ CUIDADO:** Operação destrutiva! Faz backup antes.

**O que faz:**
- Identifica duplicatas
- Mostra quais serão removidos
- Pede confirmação
- Remove dados duplicados
- Atualiza referências

---

### 4. `cleanup_invites.js` - Remover Convites Órfãos

**Propósito:** Deletar convites para games que não existem

```bash
node cleanup_invites.js
```

**O que faz:**
- Encontra invites cujo game foi deletado
- Mostra quantas serão removidas
- Remove com confirmação

---

### 5. `automate_seasons.js` - Criar Seasons Automaticamente

**Propósito:** Gerar seasons para próximos meses

```bash
node automate_seasons.js --months=6
```

**Opções:**
- `--months=6` - Criar próximos 6 meses
- `--start=2024-02-01` - Data de início
- `--dry-run` - Apenas report

---

### 6. `check_user_photos.js` - Verificar Fotos de Usuários

**Propósito:** Validar integridade de fotos de perfil

```bash
node check_user_photos.js
```

**O que faz:**
- Verifica URLs de fotos válidas
- Detecta fotos quebradas
- Relata estatísticas

---

## Scripts Python

### 1. `check_duplicates.py` - Encontrar Duplicatas (Python)

**Propósito:** Validação de duplicatas via Python

```bash
python check_duplicates.py
```

---

### 2. `enrich_locations.py` - Enriquecer Locais

**Propósito:** Adicionar geocodificação (lat/lng) a locais

```bash
python enrich_locations.py
```

**Pré-requisitos:**
```bash
pip install requests geopy
```

**O que faz:**
- Lê endereços dos locais
- Obtém latitude/longitude (ViaCEP ou Google Maps)
- Atualiza banco de dados
- Valida coordenadas

---

### 3. `populate_real_data.py` - Popular com Dados Reais

**Propósito:** Adicionar dados reais de campos em São Paulo

```bash
python populate_real_data.py
```

**Inclui:**
- 50+ campos reais de São Paulo
- Endereços completos
- Coordenadas precisas (geocoded)
- Tipos de quadra corretos

---

### 4. `create_season_and_badges.py` - Setup Gamificação

**Propósito:** Criar seasons e badges iniciais

```bash
python create_season_and_badges.py
```

**Cria:**
- 12 badges (HAT_TRICK, PAREDAO, etc)
- Season atual (mês em andamento)
- Participações iniciais
- Configuração de XP

---

### 5. `analyze_firestore.py` - Analisar Firestore

**Propósito:** Gerar relatório de dados em Firestore

```bash
python analyze_firestore.py
```

**Relatório inclui:**
- Contagem de documentos por coleção
- Tamanho total
- Estrutura de dados
- Campos ausentes

---

### 6. `check_field_types.py` - Verificar Tipos de Quadra

**Propósito:** Validar tipos de quadra (SOCIETY, CAMPO, FUTEBOL)

```bash
python check_field_types.py
```

---

### 7. `create_test_game.py` - Criar Jogo de Teste

**Propósito:** Criar jogo individual para testes

```bash
python create_test_game.py --date=2024-01-15 --time=19:00
```

---

### 8. `add_campo_fields.py` - Adicionar Quadras de CAMPO

**Propósito:** Adicionar campos tipo CAMPO específicos

```bash
python add_campo_fields.py
```

---

## Como Rodar

### 1. Verificar Pré-requisitos

**Node.js:**
```bash
cd scripts
npm install  # Se não tiver node_modules

node --version  # v18+
```

**Python:**
```bash
python --version  # 3.8+
pip install -r requirements.txt
```

### 2. Configurar Ambiente

**Backend deve estar rodando:**
```bash
cd backend
npm run dev
# Ou ter .env configurado corretamente
```

**Variáveis de ambiente (.env):**
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=futeba_db

GOOGLE_MAPS_API_KEY=your-key-here
USE_VIACEP=true
```

### 3. Rodar Scripts

**Dry-run (seguro):**
```bash
node check_duplicates.js  # Apenas report
```

**Com confirmação:**
```bash
node deduplicate.js
# Mostra o que vai deletar, pede confirmação
```

---

## Safety & Backups

### Sempre Fazer Backup Antes!

```bash
# PostgreSQL backup
pg_dump -h localhost -U postgres futeba_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar:
psql -h localhost -U postgres futeba_db < backup_20240101_120000.sql
```

### Script Audit Trail

Todos os scripts registram em `scripts/logs/`:

```
logs/
├── 2024-01-15_14-30-seed.log
├── 2024-01-15_14-35-deduplicate.log
└── 2024-01-15_14-40-migration.log
```

### Rollback

Se algo der errado:

```bash
# 1. Restaurar backup
psql futeba_db < backup_20240101_before_migration.sql

# 2. Check logs
tail -f scripts/logs/latest.log

# 3. Report issue
```

---

## Execução Operacional Recomendada

| Script | Frequência | Comando | Risco |
|--------|-----------|---------|-------|
| check_duplicates.js | Semanal | `node check_duplicates.js` | ✅ Baixo |
| validate_data.py | Semanal | `python check_duplicates.py` | ✅ Baixo |
| cleanup_invites.js | Quinzenal | `node cleanup_invites.js` | ⚠️ Médio |
| deduplicate.js | Mensal | `node deduplicate.js --dry-run` | 🔴 Alto |

---

## Veja Também

- [../SETUP_GUIDE.md](../SETUP_GUIDE.md) - Setup ambiente
- [../DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) - Schema do banco
- [../backend/README.md](../backend/README.md) - Como rodar backend

---

**Última atualização:** Dezembro 2025
**Status:** Todos scripts testados ✓
