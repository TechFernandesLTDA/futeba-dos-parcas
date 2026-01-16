/**
 * Script de Relatório de Inconsistências
 * Futeba dos Parças - v1.4.0
 *
 * Gera relatório abrangente de inconsistências no Firestore:
 * - Duplicatas
 * - Valores fora do range
 * - Foreign keys inválidas
 * - Timestamps inconsistentes
 * - Dados obrigatórios faltando
 *
 * Uso:
 *   node report_inconsistencies.js [--output=FILE] [--json]
 *
 * Flags:
 *   --output=FILE  Salva relatório em arquivo
 *   --json         Formato JSON em vez de texto
 */

const admin = require("firebase-admin");
const fs = require("fs");
const serviceAccount = require("../serviceAccountKey.json");

// Inicializar Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Estrutura do relatório
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    totalDocuments: 0,
    totalIssues: 0,
    criticalIssues: 0,
    warningIssues: 0,
  },
  collections: {},
  issues: [],
};

// Constantes de validação
const VALIDATION = {
  RATING_MIN: 0.0,
  RATING_MAX: 5.0,
  LEAGUE_RATING_MIN: 0.0,
  LEAGUE_RATING_MAX: 100.0,
  LEVEL_MIN: 0,
  LEVEL_MAX: 10,
};

/**
 * Adiciona issue ao relatório
 */
function addIssue(collection, docId, field, issue, severity = "warning") {
  report.issues.push({
    collection,
    docId,
    field,
    issue,
    severity,
  });

  if (severity === "critical") {
    report.summary.criticalIssues++;
  } else {
    report.summary.warningIssues++;
  }
  report.summary.totalIssues++;
}

/**
 * Analisa coleção de usuários
 */
async function analyzeUsers() {
  console.log("Analisando usuários...");
  const snapshot = await db.collection("users").get();

  const stats = {
    total: snapshot.size,
    withIssues: 0,
    duplicateEmails: new Map(),
    ratingIssues: 0,
    levelIssues: 0,
    missingName: 0,
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let hasIssue = false;

    // Verificar nome
    if (!data.name || data.name.trim().length < 2) {
      addIssue("users", doc.id, "name", "Nome ausente ou muito curto", "warning");
      stats.missingName++;
      hasIssue = true;
    }

    // Verificar ratings
    const ratingFields = [
      "striker_rating",
      "mid_rating",
      "defender_rating",
      "gk_rating",
    ];
    for (const field of ratingFields) {
      if (data[field] !== undefined && data[field] !== null) {
        if (
          data[field] < VALIDATION.RATING_MIN ||
          data[field] > VALIDATION.RATING_MAX
        ) {
          addIssue(
            "users",
            doc.id,
            field,
            `Fora do range (${data[field]})`,
            "warning"
          );
          stats.ratingIssues++;
          hasIssue = true;
        }
      }
    }

    // Verificar league_rating
    if (data.league_rating !== undefined && data.league_rating !== null) {
      if (
        data.league_rating < VALIDATION.LEAGUE_RATING_MIN ||
        data.league_rating > VALIDATION.LEAGUE_RATING_MAX
      ) {
        addIssue(
          "users",
          doc.id,
          "league_rating",
          `Fora do range (${data.league_rating})`,
          "critical"
        );
        hasIssue = true;
      }
    }

    // Verificar level
    if (data.level !== undefined && data.level !== null) {
      if (data.level < VALIDATION.LEVEL_MIN || data.level > VALIDATION.LEVEL_MAX) {
        addIssue(
          "users",
          doc.id,
          "level",
          `Fora do range (${data.level})`,
          "warning"
        );
        stats.levelIssues++;
        hasIssue = true;
      }
    }

    // Verificar emails duplicados
    if (data.email && data.email.trim() !== "") {
      const email = data.email.toLowerCase().trim();
      if (stats.duplicateEmails.has(email)) {
        stats.duplicateEmails.get(email).push(doc.id);
      } else {
        stats.duplicateEmails.set(email, [doc.id]);
      }
    }

    if (hasIssue) stats.withIssues++;
  }

  // Verificar duplicatas
  for (const [email, ids] of stats.duplicateEmails) {
    if (ids.length > 1) {
      addIssue(
        "users",
        ids.join(", "),
        "email",
        `Email duplicado: ${email}`,
        "critical"
      );
    }
  }

  report.collections.users = stats;
  report.summary.totalDocuments += stats.total;
}

/**
 * Analisa coleção de jogos
 */
async function analyzeGames() {
  console.log("Analisando jogos...");
  const snapshot = await db.collection("games").get();

  const stats = {
    total: snapshot.size,
    withIssues: 0,
    negativeScores: 0,
    invalidStatus: 0,
    missingGroup: 0,
    futureFinishedGames: 0,
  };

  const now = new Date();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let hasIssue = false;

    // Verificar scores negativos
    if (
      (data.team1_score !== undefined && data.team1_score < 0) ||
      (data.team2_score !== undefined && data.team2_score < 0)
    ) {
      addIssue(
        "games",
        doc.id,
        "score",
        `Score negativo: ${data.team1_score} x ${data.team2_score}`,
        "critical"
      );
      stats.negativeScores++;
      hasIssue = true;
    }

    // Verificar status
    const validStatuses = [
      "SCHEDULED",
      "CONFIRMATION",
      "TEAMS_DEFINED",
      "IN_PROGRESS",
      "FINISHED",
      "CANCELLED",
    ];
    if (data.status && !validStatuses.includes(String(data.status).toUpperCase())) {
      addIssue(
        "games",
        doc.id,
        "status",
        `Status inválido: ${data.status}`,
        "warning"
      );
      stats.invalidStatus++;
      hasIssue = true;
    }

    // Verificar grupo obrigatório
    if (!data.group_id) {
      addIssue("games", doc.id, "group_id", "Jogo sem grupo", "warning");
      stats.missingGroup++;
      hasIssue = true;
    }

    // Verificar jogo finalizado no futuro
    if (data.status === "FINISHED" && data.date) {
      let gameDate;
      if (data.date.toDate) {
        gameDate = data.date.toDate();
      } else if (typeof data.date === "string") {
        gameDate = new Date(data.date);
      }

      if (gameDate && gameDate > now) {
        addIssue(
          "games",
          doc.id,
          "date",
          "Jogo finalizado com data no futuro",
          "critical"
        );
        stats.futureFinishedGames++;
        hasIssue = true;
      }
    }

    if (hasIssue) stats.withIssues++;
  }

  report.collections.games = stats;
  report.summary.totalDocuments += stats.total;
}

/**
 * Analisa coleção de grupos
 */
async function analyzeGroups() {
  console.log("Analisando grupos...");
  const snapshot = await db.collection("groups").get();

  const stats = {
    total: snapshot.size,
    withIssues: 0,
    missingName: 0,
    missingOwner: 0,
    emptyGroups: 0,
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let hasIssue = false;

    // Verificar nome
    if (!data.name || data.name.trim().length < 3) {
      addIssue("groups", doc.id, "name", "Nome ausente ou muito curto", "warning");
      stats.missingName++;
      hasIssue = true;
    }

    // Verificar owner
    if (!data.owner_id) {
      addIssue("groups", doc.id, "owner_id", "Grupo sem dono", "critical");
      stats.missingOwner++;
      hasIssue = true;
    }

    // Verificar membros
    const memberCount = data.member_count || (data.members ? data.members.length : 0);
    if (memberCount === 0) {
      addIssue("groups", doc.id, "members", "Grupo sem membros", "warning");
      stats.emptyGroups++;
      hasIssue = true;
    }

    if (hasIssue) stats.withIssues++;
  }

  report.collections.groups = stats;
  report.summary.totalDocuments += stats.total;
}

/**
 * Analisa coleção de estatísticas
 */
async function analyzeStatistics() {
  console.log("Analisando estatísticas...");
  const snapshot = await db.collection("statistics").get();

  const stats = {
    total: snapshot.size,
    withIssues: 0,
    negativeValues: 0,
    impossibleStats: 0,
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let hasIssue = false;

    // Verificar valores negativos
    const numericFields = [
      "games_played",
      "wins",
      "draws",
      "losses",
      "goals",
      "assists",
      "saves",
    ];
    for (const field of numericFields) {
      if (data[field] !== undefined && data[field] < 0) {
        addIssue(
          "statistics",
          doc.id,
          field,
          `Valor negativo: ${data[field]}`,
          "critical"
        );
        stats.negativeValues++;
        hasIssue = true;
      }
    }

    // Verificar inconsistência wins + draws + losses > games_played
    if (data.games_played !== undefined) {
      const total = (data.wins || 0) + (data.draws || 0) + (data.losses || 0);
      if (total > data.games_played) {
        addIssue(
          "statistics",
          doc.id,
          "games_played",
          `Soma W/D/L (${total}) > games_played (${data.games_played})`,
          "critical"
        );
        stats.impossibleStats++;
        hasIssue = true;
      }
    }

    if (hasIssue) stats.withIssues++;
  }

  report.collections.statistics = stats;
  report.summary.totalDocuments += stats.total;
}

/**
 * Analisa XP logs
 */
async function analyzeXPLogs() {
  console.log("Analisando XP logs...");
  const snapshot = await db.collection("xp_logs").limit(5000).get();

  const stats = {
    total: snapshot.size,
    withIssues: 0,
    negativeXP: 0,
    excessiveXP: 0,
    missingUser: 0,
  };

  const MAX_XP_PER_GAME = 500;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let hasIssue = false;

    // Verificar XP negativo
    if (data.amount !== undefined && data.amount < 0) {
      addIssue(
        "xp_logs",
        doc.id,
        "amount",
        `XP negativo: ${data.amount}`,
        "warning"
      );
      stats.negativeXP++;
      hasIssue = true;
    }

    // Verificar XP excessivo
    if (data.amount !== undefined && data.amount > MAX_XP_PER_GAME) {
      addIssue(
        "xp_logs",
        doc.id,
        "amount",
        `XP excessivo: ${data.amount} (max: ${MAX_XP_PER_GAME})`,
        "warning"
      );
      stats.excessiveXP++;
      hasIssue = true;
    }

    // Verificar user_id
    if (!data.user_id) {
      addIssue("xp_logs", doc.id, "user_id", "Log sem usuário", "critical");
      stats.missingUser++;
      hasIssue = true;
    }

    if (hasIssue) stats.withIssues++;
  }

  report.collections.xp_logs = stats;
  report.summary.totalDocuments += stats.total;
}

/**
 * Analisa temporadas
 */
async function analyzeSeasons() {
  console.log("Analisando temporadas...");
  const snapshot = await db.collection("seasons").get();

  const stats = {
    total: snapshot.size,
    withIssues: 0,
    multipleActive: 0,
    invalidDates: 0,
  };

  let activeCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let hasIssue = false;

    // Contar ativas
    if (data.is_active === true || data.status === "ACTIVE") {
      activeCount++;
    }

    // Verificar datas
    if (data.start_date && data.end_date) {
      let startDate, endDate;

      if (data.start_date.toDate) startDate = data.start_date.toDate();
      else startDate = new Date(data.start_date);

      if (data.end_date.toDate) endDate = data.end_date.toDate();
      else endDate = new Date(data.end_date);

      if (startDate > endDate) {
        addIssue(
          "seasons",
          doc.id,
          "dates",
          "Data início > data fim",
          "critical"
        );
        stats.invalidDates++;
        hasIssue = true;
      }
    }

    if (hasIssue) stats.withIssues++;
  }

  // Verificar múltiplas temporadas ativas
  if (activeCount > 1) {
    addIssue(
      "seasons",
      "GLOBAL",
      "is_active",
      `${activeCount} temporadas ativas simultaneamente`,
      "critical"
    );
    stats.multipleActive = activeCount;
  }

  report.collections.seasons = stats;
  report.summary.totalDocuments += stats.total;
}

/**
 * Gera o relatório
 */
async function generateReport(outputFile, jsonFormat) {
  console.log("========================================");
  console.log("  RELATÓRIO DE INCONSISTÊNCIAS - Futeba");
  console.log("========================================");
  console.log("");

  // Executar análises
  await analyzeUsers();
  await analyzeGames();
  await analyzeGroups();
  await analyzeStatistics();
  await analyzeXPLogs();
  await analyzeSeasons();

  // Gerar saída
  let output;

  if (jsonFormat) {
    output = JSON.stringify(report, null, 2);
  } else {
    output = generateTextReport();
  }

  // Salvar ou exibir
  if (outputFile) {
    fs.writeFileSync(outputFile, output);
    console.log(`\nRelatório salvo em: ${outputFile}`);
  } else {
    console.log(output);
  }

  return report;
}

/**
 * Gera relatório em formato texto
 */
function generateTextReport() {
  let text = "";

  text += "\n========================================\n";
  text += "              RESUMO GERAL\n";
  text += "========================================\n\n";

  text += `Gerado em: ${report.generatedAt}\n`;
  text += `Total de documentos analisados: ${report.summary.totalDocuments}\n`;
  text += `Total de issues encontradas: ${report.summary.totalIssues}\n`;
  text += `  - Críticas: ${report.summary.criticalIssues}\n`;
  text += `  - Warnings: ${report.summary.warningIssues}\n`;

  text += "\n========================================\n";
  text += "           POR COLEÇÃO\n";
  text += "========================================\n";

  for (const [collection, stats] of Object.entries(report.collections)) {
    text += `\n--- ${collection.toUpperCase()} ---\n`;
    text += `Total: ${stats.total}\n`;
    text += `Com issues: ${stats.withIssues}\n`;

    for (const [key, value] of Object.entries(stats)) {
      if (key !== "total" && key !== "withIssues" && typeof value === "number") {
        text += `  ${key}: ${value}\n`;
      }
    }
  }

  if (report.issues.length > 0) {
    text += "\n========================================\n";
    text += "        ISSUES CRÍTICAS (primeiras 30)\n";
    text += "========================================\n\n";

    const criticalIssues = report.issues.filter((i) => i.severity === "critical");
    for (const issue of criticalIssues.slice(0, 30)) {
      text += `[${issue.collection}] ${issue.docId}\n`;
      text += `  ${issue.field}: ${issue.issue}\n`;
    }

    if (criticalIssues.length > 30) {
      text += `\n... e mais ${criticalIssues.length - 30} issues críticas\n`;
    }
  }

  text += "\n========================================\n";
  text += "                FIM DO RELATÓRIO\n";
  text += "========================================\n";

  return text;
}

// Execução principal
const args = process.argv.slice(2);
const outputArg = args.find((a) => a.startsWith("--output="));
const outputFile = outputArg ? outputArg.split("=")[1] : null;
const jsonFormat = args.includes("--json");

generateReport(outputFile, jsonFormat)
  .then((result) => {
    console.log("\nRelatório gerado com sucesso!");
    process.exit(result.summary.criticalIssues > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error("Erro ao gerar relatório:", error);
    process.exit(1);
  });
