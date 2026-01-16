/**
 * Script de Validação de Usuários
 * Futeba dos Parças - v1.4.0
 *
 * Valida todos os usuários no Firestore:
 * - Email format
 * - Rating ranges (0-5)
 * - League rating (0-100)
 * - Level bounds (0-10)
 * - Name length (2-100)
 * - XP non-negative
 *
 * Uso:
 *   node validate_users.js [--fix] [--dry-run]
 *
 * Flags:
 *   --fix      Corrige automaticamente valores inválidos
 *   --dry-run  Mostra o que seria corrigido sem alterar
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

// Constantes de validação (espelhando ValidationHelper.kt)
const VALIDATION = {
  RATING_MIN: 0.0,
  RATING_MAX: 5.0,
  LEAGUE_RATING_MIN: 0.0,
  LEAGUE_RATING_MAX: 100.0,
  LEVEL_MIN: 0,
  LEVEL_MAX: 10,
  XP_MIN: 0,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
};

// Regex para email
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Contadores
let totalUsers = 0;
let validUsers = 0;
let invalidUsers = 0;
let fixedUsers = 0;
const issues = [];

/**
 * Valida um campo de rating (0-5)
 */
function validateRating(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number") {
    return { field: fieldName, issue: "Não é número", value };
  }
  if (value < VALIDATION.RATING_MIN || value > VALIDATION.RATING_MAX) {
    return {
      field: fieldName,
      issue: `Fora do range ${VALIDATION.RATING_MIN}-${VALIDATION.RATING_MAX}`,
      value,
    };
  }
  return null;
}

/**
 * Valida league rating (0-100)
 */
function validateLeagueRating(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number") {
    return { field: fieldName, issue: "Não é número", value };
  }
  if (
    value < VALIDATION.LEAGUE_RATING_MIN ||
    value > VALIDATION.LEAGUE_RATING_MAX
  ) {
    return {
      field: fieldName,
      issue: `Fora do range ${VALIDATION.LEAGUE_RATING_MIN}-${VALIDATION.LEAGUE_RATING_MAX}`,
      value,
    };
  }
  return null;
}

/**
 * Valida level (0-10)
 */
function validateLevel(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { field: fieldName, issue: "Não é inteiro", value };
  }
  if (value < VALIDATION.LEVEL_MIN || value > VALIDATION.LEVEL_MAX) {
    return {
      field: fieldName,
      issue: `Fora do range ${VALIDATION.LEVEL_MIN}-${VALIDATION.LEVEL_MAX}`,
      value,
    };
  }
  return null;
}

/**
 * Valida XP (>= 0)
 */
function validateXP(value, fieldName) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number") {
    return { field: fieldName, issue: "Não é número", value };
  }
  if (value < VALIDATION.XP_MIN) {
    return { field: fieldName, issue: "XP negativo", value };
  }
  return null;
}

/**
 * Valida email
 */
function validateEmail(value) {
  if (!value || value === "") return null;
  if (typeof value !== "string") {
    return { field: "email", issue: "Não é string", value };
  }
  if (!EMAIL_REGEX.test(value)) {
    return { field: "email", issue: "Formato inválido", value };
  }
  return null;
}

/**
 * Valida nome
 */
function validateName(value) {
  if (!value) {
    return { field: "name", issue: "Nome obrigatório", value: null };
  }
  if (typeof value !== "string") {
    return { field: "name", issue: "Não é string", value };
  }
  if (value.length < VALIDATION.NAME_MIN_LENGTH) {
    return {
      field: "name",
      issue: `Muito curto (min ${VALIDATION.NAME_MIN_LENGTH})`,
      value,
    };
  }
  if (value.length > VALIDATION.NAME_MAX_LENGTH) {
    return {
      field: "name",
      issue: `Muito longo (max ${VALIDATION.NAME_MAX_LENGTH})`,
      value,
    };
  }
  return null;
}

/**
 * Valida um usuário completo
 */
function validateUser(userId, data) {
  const userIssues = [];

  // Nome
  const nameIssue = validateName(data.name);
  if (nameIssue) userIssues.push(nameIssue);

  // Email
  const emailIssue = validateEmail(data.email);
  if (emailIssue) userIssues.push(emailIssue);

  // Ratings de posição (0-5)
  const ratingFields = [
    "striker_rating",
    "mid_rating",
    "defender_rating",
    "gk_rating",
    "auto_striker_rating",
    "auto_mid_rating",
    "auto_defender_rating",
    "auto_gk_rating",
  ];

  for (const field of ratingFields) {
    const issue = validateRating(data[field], field);
    if (issue) userIssues.push(issue);
  }

  // League rating (0-100)
  const leagueRatingIssue = validateLeagueRating(
    data.league_rating,
    "league_rating"
  );
  if (leagueRatingIssue) userIssues.push(leagueRatingIssue);

  // Level (0-10)
  const levelIssue = validateLevel(data.level, "level");
  if (levelIssue) userIssues.push(levelIssue);

  // XP (>= 0)
  const xpIssue = validateXP(data.experience_points, "experience_points");
  if (xpIssue) userIssues.push(xpIssue);

  return userIssues;
}

/**
 * Corrige valores inválidos
 */
function calculateFixes(data) {
  const fixes = {};

  // Corrigir ratings
  const ratingFields = [
    "striker_rating",
    "mid_rating",
    "defender_rating",
    "gk_rating",
    "auto_striker_rating",
    "auto_mid_rating",
    "auto_defender_rating",
    "auto_gk_rating",
  ];

  for (const field of ratingFields) {
    if (data[field] !== undefined && data[field] !== null) {
      const clamped = Math.max(
        VALIDATION.RATING_MIN,
        Math.min(VALIDATION.RATING_MAX, data[field])
      );
      if (clamped !== data[field]) {
        fixes[field] = clamped;
      }
    }
  }

  // Corrigir league rating
  if (data.league_rating !== undefined && data.league_rating !== null) {
    const clamped = Math.max(
      VALIDATION.LEAGUE_RATING_MIN,
      Math.min(VALIDATION.LEAGUE_RATING_MAX, data.league_rating)
    );
    if (clamped !== data.league_rating) {
      fixes.league_rating = clamped;
    }
  }

  // Corrigir level
  if (data.level !== undefined && data.level !== null) {
    const clamped = Math.max(
      VALIDATION.LEVEL_MIN,
      Math.min(VALIDATION.LEVEL_MAX, Math.floor(data.level))
    );
    if (clamped !== data.level) {
      fixes.level = clamped;
    }
  }

  // Corrigir XP
  if (data.experience_points !== undefined && data.experience_points !== null) {
    const clamped = Math.max(VALIDATION.XP_MIN, data.experience_points);
    if (clamped !== data.experience_points) {
      fixes.experience_points = clamped;
    }
  }

  return fixes;
}

/**
 * Executa validação
 */
async function validateAllUsers(shouldFix, dryRun) {
  console.log("========================================");
  console.log("     VALIDAÇÃO DE USUÁRIOS - Futeba");
  console.log("========================================");
  console.log(`Modo: ${shouldFix ? (dryRun ? "DRY-RUN" : "FIX") : "VALIDAÇÃO"}`);
  console.log("");

  const usersSnapshot = await db.collection("users").get();
  totalUsers = usersSnapshot.size;

  console.log(`Total de usuários: ${totalUsers}`);
  console.log("");

  for (const doc of usersSnapshot.docs) {
    const userId = doc.id;
    const data = doc.data();

    const userIssues = validateUser(userId, data);

    if (userIssues.length === 0) {
      validUsers++;
    } else {
      invalidUsers++;
      issues.push({
        userId,
        name: data.name || "(sem nome)",
        issues: userIssues,
      });

      if (shouldFix) {
        const fixes = calculateFixes(data);

        if (Object.keys(fixes).length > 0) {
          console.log(`\n[CORRIGINDO] ${data.name || userId}`);
          for (const [field, newValue] of Object.entries(fixes)) {
            console.log(`  ${field}: ${data[field]} -> ${newValue}`);
          }

          if (!dryRun) {
            await db.collection("users").doc(userId).update(fixes);
          }
          fixedUsers++;
        }
      }
    }
  }

  // Relatório final
  console.log("\n========================================");
  console.log("              RELATÓRIO FINAL");
  console.log("========================================");
  console.log(`Total de usuários:   ${totalUsers}`);
  console.log(`Usuários válidos:    ${validUsers}`);
  console.log(`Usuários inválidos:  ${invalidUsers}`);
  if (shouldFix) {
    console.log(
      `Usuários corrigidos: ${fixedUsers}${dryRun ? " (dry-run)" : ""}`
    );
  }

  if (issues.length > 0 && !shouldFix) {
    console.log("\n--- DETALHES DOS PROBLEMAS ---\n");
    for (const item of issues.slice(0, 20)) {
      console.log(`Usuário: ${item.name} (${item.userId})`);
      for (const issue of item.issues) {
        console.log(`  - ${issue.field}: ${issue.issue} (valor: ${issue.value})`);
      }
    }
    if (issues.length > 20) {
      console.log(`\n... e mais ${issues.length - 20} usuários com problemas`);
    }
  }

  console.log("\n========================================");

  return {
    total: totalUsers,
    valid: validUsers,
    invalid: invalidUsers,
    fixed: fixedUsers,
    issues,
  };
}

// Execução principal
const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");
const dryRun = args.includes("--dry-run");

validateAllUsers(shouldFix, dryRun)
  .then((result) => {
    console.log("\nValidação concluída!");
    process.exit(result.invalid > 0 && !shouldFix ? 1 : 0);
  })
  .catch((error) => {
    console.error("Erro na validação:", error);
    process.exit(1);
  });
