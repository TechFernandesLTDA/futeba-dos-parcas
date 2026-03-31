# Firestore Users Reference - Futeba dos Parças

**Data de Extração:** 14 de Janeiro de 2026
**Total de Usuários:** 4

## Lista Completa de Usuários

| Document ID | Nome | Apelido | Email |
|------------|------|---------|-------|
| `8CwDeOLWw3Ws3N5qQJfY07ZFtnS2` | ricardo gonçalves | (sem apelido) | ricardogf2004@gmail.com |
| `EN2fwT9y6ndVyKETQthCDg83DSL2` | Rafael Boumer | (sem apelido) | rafaboumer@gmail.com |
| `FOlvyYHcZWPNqTGHkbSytMUwIAz1` | Renan Locatiz Fernandes | (sem apelido) | renankakinho69@gmail.com |
| `LmclkYXROATUAvg4Ah0ZXcgcRCF2` | Renan Fernandes | Tech Fernandes | techfernandesltda@gmail.com |

## Formatos para Uso em Scripts

### Objeto JavaScript (USERS)

```javascript
const USERS = {
  RICARDO: '8CwDeOLWw3Ws3N5qQJfY07ZFtnS2',
  RAFAEL: 'EN2fwT9y6ndVyKETQthCDg83DSL2',
  RENAN_ADMIN: 'FOlvyYHcZWPNqTGHkbSytMUwIAz1',
  TECH_FIELD_OWNER: 'LmclkYXROATUAvg4Ah0ZXcgcRCF2'
};
```

### Array de IDs

```javascript
const userIds = [
  '8CwDeOLWw3Ws3N5qQJfY07ZFtnS2',
  'EN2fwT9y6ndVyKETQthCDg83DSL2',
  'FOlvyYHcZWPNqTGHkbSytMUwIAz1',
  'LmclkYXROATUAvg4Ah0ZXcgcRCF2'
];
```

### Mapeamento Email → ID

```javascript
const usersByEmail = {
  'ricardogf2004@gmail.com': '8CwDeOLWw3Ws3N5qQJfY07ZFtnS2',
  'rafaboumer@gmail.com': 'EN2fwT9y6ndVyKETQthCDg83DSL2',
  'renankakinho69@gmail.com': 'FOlvyYHcZWPNqTGHkbSytMUwIAz1',
  'techfernandesltda@gmail.com': 'LmclkYXROATUAvg4Ah0ZXcgcRCF2'
};
```

## Script de Atualização

O script `populate_historical_games.js` já foi atualizado com os IDs corretos.

## Scripts Disponíveis

- **`list_all_users.js`** - Lista todos os usuários em formato de tabela e JSON
- **`users_id_list.js`** - Gera formatos prontos para copiar/colar em scripts
- **`populate_historical_games.js`** - Script de jogos históricos (já atualizado)

## Como Regenerar Esta Lista

```bash
cd "C:\Projetos\Futeba dos Parças"
node scripts/list_all_users.js
```

## Observações

- Todos os usuários têm role `PLAYER` por padrão
- Para verificar roles de admin, use: `node scripts/check_admin_role.js`
- IDs do Firestore são diferentes dos Auth UIDs
- Esses IDs são usados em todas as coleções (statistics, xp_logs, confirmations, etc.)
