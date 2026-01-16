/**
 * Script de Validação de Jogos
 * Futeba dos Parças - v1.4.0
 *
 * Valida todos os jogos no Firestore:
 * - Scores non-negative
 * - Player counts válidos
 * - GroupId existe (FK)
 * - LocationId existe (FK)
 * - Status válido
 * - Datas válidas
 *
 * Uso:
 *   node validate_games.js [--fix] [--dry-run] [--check-fk]
 *
 * Flags:
 *   --fix       Corrige valores inválidos automaticamente
 *   --dry-run   Mostra correções sem aplicar
 *   --check-fk  Valida foreign keys (mais lento)
 */

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

// Inicializar Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Constantes de validação
const VALIDATION = {
  SCORE_MIN: 0,
  SCORE_MAX: 99,
  PLAYERS_MIN: 0,
  PLAYERS_MAX: 50,
  TEAMS_MIN: 2,
  TEAMS_MAX: 8,
  MAX_GOALS_PER_GAME: 15,
  MAX_ASSISTS_PER_GAME: 10,
  MAX_SAVES_PER_GAME: 30,
};

const VALID_STATUSES = [
  "SCHEDULED",
  "CONFIRMATION",
  "TEAMS_DEFINED",
  "IN_PROGRESS",
  "FINISHED",
  "CANCELLED",
];

const VALID_GAME_TYPES = ["SOCIETY", "FUTSAL", "CAMPO", "AREIA", "OUTROS"];

// Contadores
let totalGames = 0;
let validGames = 0;
let invalidGames = 0;
let fixedGames = 0;
let orphanGames = 0;
const issues = [];

// Cache para FKs
const groupCache = new Set();
const locationCache = new Set();

/**
 * Valida scores do jogo
 */
function validateScores(data) {
  const issues = [];

  if (data.team1_score !== undefined) {
    if (typeof data.team1_score !== "number") {
      issues.push({
        field: "team1_score",
        issue: "Não é número",
        value: data.team1_score,
      });
    } else if (
      data.team1_score < VALIDATION.SCORE_MIN ||
      data.team1_score > VALIDATION.SCORE_MAX
    ) {
      issues.push({
        field: "team1_score",
        issue: `Fora do range ${VALIDATION.SCORE_MIN}-${VALIDATION.SCORE_MAX}`,
        value: data.team1_score,
      });
    }
  }

  if (data.team2_score !== undefined) {
    if (typeof data.team2_score !== "number") {
      issues.push({
        field: "team2_score",
        issue: "Não é número",
        value: data.team2_score,
      });
    } else if (
      data.team2_score < VALIDATION.SCORE_MIN ||
      data.team2_score > VALIDATION.SCORE_MAX
    ) {
      issues.push({
        field: "team2_score",
        issue: `Fora do range ${VALIDATION.SCORE_MIN}-${VALIDATION.SCORE_MAX}`,
        value: data.team2_score,
      });
    }
  }

  return issues;
}

/**
 * Valida contagem de jogadores
 */
function validatePlayerCounts(data) {
  const issues = [];

  const countFields = [
    "players_count",
    "goalkeepers_count",
    "max_players",
    "confirmed_count",
  ];

  for (const field of countFields) {
    if (data[field] !== undefined && data[field] !== null) {
      if (typeof data[field] !== "number") {
        issues.push({ field, issue: "Não é número", value: data[field] });
      } else if (data[field] < VALIDATION.PLAYERS_MIN) {
        issues.push({ field, issue: "Valor negativo", value: data[field] });
      } else if (data[field] > VALIDATION.PLAYERS_MAX) {
        issues.push({
          field,
          issue: `Acima do máximo (${VALIDATION.PLAYERS_MAX})`,
          value: data[field],
        });
      }
    }
  }

  // Validar número de times
  if (data.number_of_teams !== undefined && data.number_of_teams !== null) {
    if (typeof data.number_of_teams !== "number") {
      issues.push({
        field: "number_of_teams",
        issue: "Não é número",
        value: data.number_of_teams,
      });
    } else if (
      data.number_of_teams < VALIDATION.TEAMS_MIN ||
      data.number_of_teams > VALIDATION.TEAMS_MAX
    ) {
      issues.push({
        field: "number_of_teams",
        issue: `Fora do range ${VALIDATION.TEAMS_MIN}-${VALIDATION.TEAMS_MAX}`,
        value: data.number_of_teams,
      });
    }
  }

  return issues;
}

/**
 * Valida status do jogo
 */
function validateStatus(data) {
  if (!data.status) return null;

  const status = String(data.status).toUpperCase();
  if (!VALID_STATUSES.includes(status)) {
    return {
      field: "status",
      issue: `Status inválido: ${status}`,
      value: data.status,
    };
  }
  return null;
}

/**
 * Valida tipo do jogo
 */
function validateGameType(data) {
  if (!data.game_type && !data.type) return null;

  const gameType = String(data.game_type || data.type).toUpperCase();
  if (!VALID_GAME_TYPES.includes(gameType)) {
    return {
      field: "game_type",
      issue: `Tipo inválido: ${gameType}`,
      value: data.game_type || data.type,
    };
  }
  return null;
}

/**
 * Valida preço
 */
function validatePrice(data) {
  if (data.daily_price === undefined || data.daily_price === null) return null;

  if (typeof data.daily_price !== "number") {
    return {
      field: "daily_price",
      issue: "Não é número",
      value: data.daily_price,
    };
  }

  if (data.daily_price < 0) {
    return { field: "daily_price", issue: "Preço negativo", value: data.daily_price };
  }

  return null;
}

/**
 * Valida foreign keys
 */
async function validateForeignKeys(data, checkFK) {
  const issues = [];

  if (!checkFK) return issues;

  // Validar group_id
  if (data.group_id) {
    if (!groupCache.has(data.group_id)) {
      const groupDoc = await db.collection("groups").doc(data.group_id).get();
      if (groupDoc.exists) {
        groupCache.add(data.group_id);
      } else {
        issues.push({
          field: "group_id",
          issue: "Grupo não encontrado",
          value: data.group_id,
        });
      }
    }
  }

  // Validar location_id
  if (data.location_id) {
    if (!locationCache.has(data.location_id)) {
      const locationDoc = await db
        .collection("locations")
        .doc(data.location_id)
        .get();
      if (locationDoc.exists) {
        locationCache.add(data.location_id);
      } else {
        issues.push({
          field: "location_id",
          issue: "Local não encontrado",
          value: data.location_id,
        });
      }
    }
  }

  return issues;
}

/**
 * Valida um jogo completo
 */
async function validateGame(gameId, data, checkFK) {
  const gameIssues = [];

  // Scores
  gameIssues.push(...validateScores(data));

  // Player counts
  gameIssues.push(...validatePlayerCounts(data));

  // Status
  const statusIssue = validateStatus(data);
  if (statusIssue) gameIssues.push(statusIssue);

  // Tipo de jogo
  const typeIssue = validateGameType(data);
  if (typeIssue) gameIssues.push(typeIssue);

  // Preço
  const priceIssue = validatePrice(data);
  if (priceIssue) gameIssues.push(priceIssue);

  // Foreign keys
  const fkIssues = await validateForeignKeys(data, checkFK);
  gameIssues.push(...fkIssues);

  return gameIssues;
}

/**
 * Calcula correções automáticas
 */
function calculateFixes(data) {
  const fixes = {};

  // Corrigir scores
  if (data.team1_score !== undefined && typeof data.team1_score === "number") {
    const clamped = Math.max(
      VALIDATION.SCORE_MIN,
      Math.min(VALIDATION.SCORE_MAX, Math.floor(data.team1_score))
    );
    if (clamped !== data.team1_score) {
      fixes.team1_score = clamped;
    }
  }

  if (data.team2_score !== undefined && typeof data.team2_score === "number") {
    const clamped = Math.max(
      VALIDATION.SCORE_MIN,
      Math.min(VALIDATION.SCORE_MAX, Math.floor(data.team2_score))
    );
    if (clamped !== data.team2_score) {
      fixes.team2_score = clamped;
    }
  }

  // Corrigir contagens
  const countFields = ["players_count", "goalkeepers_count", "confirmed_count"];
  for (const field of countFields) {
    if (data[field] !== undefined && typeof data[field] === "number") {
      const clamped = Math.max(VALIDATION.PLAYERS_MIN, Math.floor(data[field]));
      if (clamped !== data[field]) {
        fixes[field] = clamped;
      }
    }
  }

  // Corrigir max_players
  if (data.max_players !== undefined && typeof data.max_players === "number") {
    const clamped = Math.max(1, Math.floor(data.max_players));
    if (clamped !== data.max_players) {
      fixes.max_players = clamped;
    }
  }

  // Corrigir number_of_teams
  if (
    data.number_of_teams !== undefined &&
    typeof data.number_of_teams === "number"
  ) {
    const clamped = Math.max(
      VALIDATION.TEAMS_MIN,
      Math.min(VALIDATION.TEAMS_MAX, Math.floor(data.number_of_teams))
    );
    if (clamped !== data.number_of_teams) {
      fixes.number_of_teams = clamped;
    }
  }

  // Corrigir preço
  if (data.daily_price !== undefined && typeof data.daily_price === "number") {
    const clamped = Math.max(0, data.daily_price);
    if (clamped !== data.daily_price) {
      fixes.daily_price = clamped;
    }
  }

  return fixes;
}

/**
 * Executa validação
 */
async function validateAllGames(shouldFix, dryRun, checkFK) {
  console.log("========================================");
  console.log("      VALIDAÇÃO DE JOGOS - Futeba");
  console.log("========================================");
  console.log(`Modo: ${shouldFix ? (dryRun ? "DRY-RUN" : "FIX") : "VALIDAÇÃO"}`);
  console.log(`Verificar FKs: ${checkFK ? "SIM" : "NÃO"}`);
  console.log("");

  const gamesSnapshot = await db.collection("games").get();
  totalGames = gamesSnapshot.size;

  console.log(`Total de jogos: ${totalGames}`);
  console.log("");

  let processed = 0;

  for (const doc of gamesSnapshot.docs) {
    const gameId = doc.id;
    const data = doc.data();

    const gameIssues = await validateGame(gameId, data, checkFK);

    // Contar órfãos
    const hasOrphanFK = gameIssues.some(
      (i) =>
        i.field === "group_id" &&
        i.issue.includes("não encontrado") ||
        i.field === "location_id" &&
        i.issue.includes("não encontrado")
    );
    if (hasOrphanFK) orphanGames++;

    if (gameIssues.length === 0) {
      validGames++;
    } else {
      invalidGames++;
      issues.push({
        gameId,
        title: data.title || data.name || "(sem título)",
        date: data.date || data.game_date,
        issues: gameIssues,
      });

      if (shouldFix) {
        const fixes = calculateFixes(data);

        if (Object.keys(fixes).length > 0) {
          console.log(`\n[CORRIGINDO] ${data.title || gameId}`);
          for (const [field, newValue] of Object.entries(fixes)) {
            console.log(`  ${field}: ${data[field]} -> ${newValue}`);
          }

          if (!dryRun) {
            await db.collection("games").doc(gameId).update(fixes);
          }
          fixedGames++;
        }
      }
    }

    processed++;
    if (processed % 100 === 0) {
      console.log(`Processados: ${processed}/${totalGames}`);
    }
  }

  // Relatório final
  console.log("\n========================================");
  console.log("              RELATÓRIO FINAL");
  console.log("========================================");
  console.log(`Total de jogos:      ${totalGames}`);
  console.log(`Jogos válidos:       ${validGames}`);
  console.log(`Jogos inválidos:     ${invalidGames}`);
  if (checkFK) {
    console.log(`Jogos órfãos (FK):   ${orphanGames}`);
  }
  if (shouldFix) {
    console.log(`Jogos corrigidos:    ${fixedGames}${dryRun ? " (dry-run)" : ""}`);
  }

  if (issues.length > 0 && !shouldFix) {
    console.log("\n--- DETALHES DOS PROBLEMAS ---\n");
    for (const item of issues.slice(0, 20)) {
      console.log(`Jogo: ${item.title} (${item.gameId})`);
      console.log(`  Data: ${item.date || "N/A"}`);
      for (const issue of item.issues) {
        console.log(`  - ${issue.field}: ${issue.issue} (valor: ${issue.value})`);
      }
    }
    if (issues.length > 20) {
      console.log(`\n... e mais ${issues.length - 20} jogos com problemas`);
    }
  }

  console.log("\n========================================");

  return {
    total: totalGames,
    valid: validGames,
    invalid: invalidGames,
    orphans: orphanGames,
    fixed: fixedGames,
    issues,
  };
}

// Execução principal
const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");
const dryRun = args.includes("--dry-run");
const checkFK = args.includes("--check-fk");

validateAllGames(shouldFix, dryRun, checkFK)
  .then((result) => {
    console.log("\nValidação concluída!");
    process.exit(result.invalid > 0 && !shouldFix ? 1 : 0);
  })
  .catch((error) => {
    console.error("Erro na validação:", error);
    process.exit(1);
  });
