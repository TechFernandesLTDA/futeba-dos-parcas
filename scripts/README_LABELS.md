# 🏷️ GitHub Labels Setup

Este script cria automaticamente todas as labels necessárias para o sistema de issue templates do Futeba dos Parças.

## 📋 Labels Criadas

### Issue Types
- `bug` - Algo não está funcionando
- `enhancement` - Nova funcionalidade ou solicitação
- `improvement` - Melhoria técnica ou refatoração
- `documentation` - Melhorias ou adições à documentação

### Triage Status
- `needs-triage` - Precisa de análise inicial
- `needs-discussion` - Precisa de discussão antes de implementar
- `ready` - Pronto para ser implementado
- `in-progress` - Sendo trabalhado ativamente
- `blocked` - Bloqueado por dependência externa

### Priority (Auto-aplicadas pelo workflow)
- `priority: critical` 🔴 - Resolver imediatamente
- `priority: high` 🟠 - Resolver em breve
- `priority: medium` 🟡 - Resolver quando possível
- `priority: low` 🟢 - Resolver eventualmente

### Modules (Auto-aplicadas pelo workflow)
- `module: auth` 🔐 - Autenticação
- `module: home` 🏠 - Home
- `module: games` ⚽ - Jogos
- `module: groups` 👥 - Grupos
- `module: stats` 📊 - Estatísticas
- `module: live-game` 🎮 - Live Game
- `module: profile` 👤 - Perfil
- `module: cashbox` 💰 - Caixa
- `module: gamification` 🎯 - Gamificação
- `module: notifications` 🔔 - Notificações

### Platform (Auto-aplicadas pelo workflow)
- `platform: android` 📱 - Específico do Android
- `platform: ios` 🍎 - Específico do iOS (futuro)
- `platform: web` 🌐 - Específico da Web (futuro)

### Technical Areas
- `technical` 🔧 - Tarefa técnica
- `ui/ux` 🎨 - Interface/Experiência
- `backend` ⚙️ - Backend/Firestore/Functions
- `performance` ⚡ - Performance e otimização
- `security` 🔒 - Segurança
- `testing` 🧪 - Testes

### Special
- `good first issue` 👋 - Bom para iniciantes
- `help wanted` 🙋 - Precisa de ajuda da comunidade
- `duplicate` ❌ - Issue duplicada
- `wontfix` ❌ - Não será resolvido
- `invalid` ❌ - Issue inválida

## 🚀 Como Usar

### 1. Instalar Dependências

```bash
npm install @octokit/rest
```

### 2. Criar GitHub Personal Access Token

1. Acesse: https://github.com/settings/tokens/new
2. Dê um nome: `Create Labels Script`
3. Selecione escopo: `repo` (acesso total ao repositório)
4. Clique em **Generate token**
5. **Copie o token** (você não vai vê-lo novamente!)

### 3. Executar Script

**Windows (PowerShell):**
```powershell
$env:GITHUB_TOKEN="seu_token_aqui"
node scripts/create_github_labels.js
```

**Windows (CMD):**
```cmd
set GITHUB_TOKEN=seu_token_aqui
node scripts/create_github_labels.js
```

**Linux/Mac:**
```bash
GITHUB_TOKEN=seu_token_aqui node scripts/create_github_labels.js
```

### 4. Verificar Resultado

Você verá um resumo:

```
🏷️  Criando labels para TechFernandesLTDA/futeba-dos-parcas...

✅ Criada: bug
✅ Criada: enhancement
🔄 Atualizada: documentation
...

📊 Resumo:
  ✅ Criadas: 30
  🔄 Atualizadas: 5
  ❌ Erros: 0
  📝 Total: 35

✨ Concluído!
```

## 🤖 Automação com GitHub Actions

Após criar as labels, o workflow `.github/workflows/issue-automation.yml` irá:

✅ **Auto-aplicar labels** quando issues forem criadas:
- Detecta tipo de issue pelo prefixo no título (`[BUG]`, `[FEATURE]`, etc.)
- Detecta severidade/prioridade pelo corpo da issue
- Detecta módulo afetado
- Detecta plataforma

✅ **Adicionar comentários automáticos** em bugs críticos

✅ **Organizar no backlog** automaticamente

## 📝 Notas

- O script pode ser executado **múltiplas vezes** sem problemas
- Labels existentes serão **atualizadas** com novas cores/descrições
- Nenhuma label será deletada, apenas criadas/atualizadas
- O token precisa ter permissão `repo` para criar labels

## 🔐 Segurança

⚠️ **NUNCA** commite seu GitHub token no código!

- Use variáveis de ambiente
- Adicione `.env` ao `.gitignore` se usar arquivo `.env`
- Revogue o token após usar se necessário

## ✅ Checklist

- [ ] Instalei `@octokit/rest`
- [ ] Criei Personal Access Token no GitHub
- [ ] Executei o script com sucesso
- [ ] Verifiquei labels no GitHub: https://github.com/TechFernandesLTDA/futeba-dos-parcas/labels
- [ ] Revoquei o token (se não for mais usar)
