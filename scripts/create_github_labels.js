#!/usr/bin/env node

/**
 * Script para criar labels do GitHub automaticamente
 *
 * Uso:
 * 1. Instalar dependências: npm install @octokit/rest
 * 2. Criar Personal Access Token no GitHub com permissão 'repo'
 * 3. Executar: GITHUB_TOKEN=seu_token node scripts/create_github_labels.js
 */

const { Octokit } = require("@octokit/rest");

const OWNER = "TechFernandesLTDA";
const REPO = "futeba-dos-parcas";

const LABELS = [
  // Issue Types
  { name: "bug", color: "d73a4a", description: "Algo não está funcionando" },
  { name: "enhancement", color: "a2eeef", description: "Nova funcionalidade ou solicitação" },
  { name: "improvement", color: "84b6eb", description: "Melhoria técnica ou refatoração" },
  { name: "documentation", color: "0075ca", description: "Melhorias ou adições à documentação" },

  // Triage Status
  { name: "needs-triage", color: "fbca04", description: "Precisa de análise inicial" },
  { name: "needs-discussion", color: "d4c5f9", description: "Precisa de discussão antes de implementar" },
  { name: "ready", color: "0e8a16", description: "Pronto para ser implementado" },
  { name: "in-progress", color: "1d76db", description: "Sendo trabalhado ativamente" },
  { name: "blocked", color: "b60205", description: "Bloqueado por dependência externa" },

  // Priority
  { name: "priority: critical", color: "b60205", description: "🔴 Crítico - Resolver imediatamente" },
  { name: "priority: high", color: "d93f0b", description: "🟠 Alta - Resolver em breve" },
  { name: "priority: medium", color: "fbca04", description: "🟡 Média - Resolver quando possível" },
  { name: "priority: low", color: "0e8a16", description: "🟢 Baixa - Resolver eventualmente" },

  // Modules
  { name: "module: auth", color: "5319e7", description: "🔐 Módulo de Autenticação" },
  { name: "module: home", color: "5319e7", description: "🏠 Módulo Home" },
  { name: "module: games", color: "5319e7", description: "⚽ Módulo de Jogos" },
  { name: "module: groups", color: "5319e7", description: "👥 Módulo de Grupos" },
  { name: "module: stats", color: "5319e7", description: "📊 Módulo de Estatísticas" },
  { name: "module: live-game", color: "5319e7", description: "🎮 Módulo Live Game" },
  { name: "module: profile", color: "5319e7", description: "👤 Módulo de Perfil" },
  { name: "module: cashbox", color: "5319e7", description: "💰 Módulo de Caixa" },
  { name: "module: gamification", color: "5319e7", description: "🎯 Módulo de Gamificação" },
  { name: "module: notifications", color: "5319e7", description: "🔔 Módulo de Notificações" },

  // Platform
  { name: "platform: android", color: "3ddc84", description: "📱 Específico do Android" },
  { name: "platform: ios", color: "000000", description: "🍎 Específico do iOS (futuro)" },
  { name: "platform: web", color: "1e90ff", description: "🌐 Específico da Web (futuro)" },

  // Technical Areas
  { name: "technical", color: "bfdadc", description: "🔧 Tarefa técnica" },
  { name: "ui/ux", color: "e99695", description: "🎨 Interface do usuário / Experiência" },
  { name: "backend", color: "c5def5", description: "⚙️ Backend/Firestore/Functions" },
  { name: "performance", color: "f9d0c4", description: "⚡ Performance e otimização" },
  { name: "security", color: "ee0701", description: "🔒 Segurança" },
  { name: "testing", color: "128a0c", description: "🧪 Testes" },

  // Special
  { name: "good first issue", color: "7057ff", description: "👋 Bom para iniciantes" },
  { name: "help wanted", color: "008672", description: "🙋 Precisa de ajuda da comunidade" },
  { name: "duplicate", color: "cfd3d7", description: "❌ Esta issue já existe" },
  { name: "wontfix", color: "ffffff", description: "❌ Não será resolvido" },
  { name: "invalid", color: "e4e669", description: "❌ Issue inválida ou mal formatada" },
];

async function createLabels() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    console.error("❌ Erro: GITHUB_TOKEN não definido!");
    console.log("\n📝 Como obter um token:");
    console.log("1. Acesse: https://github.com/settings/tokens/new");
    console.log("2. Dê um nome (ex: 'Create Labels Script')");
    console.log("3. Selecione escopo 'repo'");
    console.log("4. Clique em 'Generate token'");
    console.log("5. Execute: GITHUB_TOKEN=seu_token node scripts/create_github_labels.js");
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });

  console.log(`\n🏷️  Criando labels para ${OWNER}/${REPO}...\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const label of LABELS) {
    try {
      // Tentar criar a label
      await octokit.rest.issues.createLabel({
        owner: OWNER,
        repo: REPO,
        name: label.name,
        color: label.color,
        description: label.description,
      });
      console.log(`✅ Criada: ${label.name}`);
      created++;
    } catch (error) {
      if (error.status === 422) {
        // Label já existe, tentar atualizar
        try {
          await octokit.rest.issues.updateLabel({
            owner: OWNER,
            repo: REPO,
            name: label.name,
            color: label.color,
            description: label.description,
          });
          console.log(`🔄 Atualizada: ${label.name}`);
          updated++;
        } catch (updateError) {
          console.error(`❌ Erro ao atualizar ${label.name}:`, updateError.message);
          errors++;
        }
      } else {
        console.error(`❌ Erro ao criar ${label.name}:`, error.message);
        errors++;
      }
    }
  }

  console.log(`\n📊 Resumo:`);
  console.log(`  ✅ Criadas: ${created}`);
  console.log(`  🔄 Atualizadas: ${updated}`);
  console.log(`  ❌ Erros: ${errors}`);
  console.log(`  📝 Total: ${LABELS.length}`);
  console.log(`\n✨ Concluído!`);
}

createLabels().catch((error) => {
  console.error("❌ Erro fatal:", error);
  process.exit(1);
});
