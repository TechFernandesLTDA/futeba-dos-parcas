# Scripts de Validação - Futeba dos Parças

Scripts Node.js para validação e correção de dados no Firestore.

## Pré-requisitos

```bash
cd scripts
npm install
```

Certifique-se que `serviceAccountKey.json` está presente no diretório `scripts/`.

## Scripts Disponíveis

### 1. validate_users.js

Valida todos os usuários no Firestore.

```bash
# Apenas validar
node validation/validate_users.js

# Validar e corrigir
node validation/validate_users.js --fix

# Dry-run (mostra correções sem aplicar)
node validation/validate_users.js --fix --dry-run
```

**Validações:**
- Email format
- Rating ranges (0-5)
- League rating (0-100)
- Level bounds (0-10)
- Name length (2-100)
- XP non-negative

### 2. validate_games.js

Valida todos os jogos no Firestore.

```bash
# Apenas validar
node validation/validate_games.js

# Validar com verificação de foreign keys (mais lento)
node validation/validate_games.js --check-fk

# Validar e corrigir
node validation/validate_games.js --fix
```

**Validações:**
- Scores non-negative
- Player counts válidos
- Status válido
- GroupId/LocationId existem (com --check-fk)

### 3. validate_financial.js

Valida dados financeiros (Cashbox, Payments, Crowdfunding).

```bash
# Validar todos os grupos
node validation/validate_financial.js

# Validar grupo específico
node validation/validate_financial.js --group=GROUP_ID

# Corrigir problemas
node validation/validate_financial.js --fix
```

**Validações:**
- Amounts positivos
- Status válidos
- Consistência de saldos
- Campos obrigatórios

### 4. repair_orphans.js

Detecta e repara referências órfãs.

```bash
# Apenas detectar
node validation/repair_orphans.js

# Reparar (arquivando)
node validation/repair_orphans.js --fix --archive

# Reparar (deletando)
node validation/repair_orphans.js --fix

# Dry-run
node validation/repair_orphans.js --fix --dry-run
```

**Órfãos detectados:**
- Games com groupId inválido
- Games com locationId inválido
- Confirmations com gameId/userId inválido
- Statistics com userId inválido
- XP Logs com referências inválidas

### 5. report_inconsistencies.js

Gera relatório abrangente de inconsistências.

```bash
# Relatório no console
node validation/report_inconsistencies.js

# Salvar em arquivo texto
node validation/report_inconsistencies.js --output=report.txt

# Formato JSON
node validation/report_inconsistencies.js --output=report.json --json
```

**Análises:**
- Duplicatas
- Valores fora do range
- Foreign keys inválidas
- Timestamps inconsistentes
- Dados obrigatórios faltando

## Fluxo Recomendado

1. **Diagnóstico inicial:**
   ```bash
   node validation/report_inconsistencies.js --output=diagnostico.txt
   ```

2. **Verificar órfãos:**
   ```bash
   node validation/repair_orphans.js
   ```

3. **Validar dados por tipo:**
   ```bash
   node validation/validate_users.js
   node validation/validate_games.js
   node validation/validate_financial.js
   ```

4. **Corrigir problemas (com backup):**
   ```bash
   # Sempre faça backup antes!
   node validation/validate_users.js --fix --dry-run
   node validation/validate_users.js --fix
   ```

## Códigos de Saída

- `0`: Sucesso, sem problemas encontrados
- `1`: Problemas encontrados (em modo validação) ou erro

## Constantes de Validação

As constantes espelham `ValidationHelper.kt`:

| Constante | Valor | Descrição |
|-----------|-------|-----------|
| RATING_MIN | 0.0 | Rating mínimo de posição |
| RATING_MAX | 5.0 | Rating máximo de posição |
| LEAGUE_RATING_MIN | 0.0 | League rating mínimo |
| LEAGUE_RATING_MAX | 100.0 | League rating máximo |
| LEVEL_MIN | 0 | Level mínimo |
| LEVEL_MAX | 10 | Level máximo |
| MAX_GOALS_PER_GAME | 15 | Anti-cheat: gols por jogo |
| MAX_ASSISTS_PER_GAME | 10 | Anti-cheat: assistências |
| MAX_SAVES_PER_GAME | 30 | Anti-cheat: defesas |
| MAX_XP_PER_GAME | 500 | Anti-cheat: XP por jogo |
