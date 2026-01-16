/**
 * Script de Validação Financeira
 * Futeba dos Parças - v1.4.0
 *
 * Valida dados financeiros no Firestore:
 * - Cashbox entries (amounts positivos)
 * - Payments (amounts positivos, status válido)
 * - Crowdfunding (target/current amounts)
 * - Balances consistentes
 *
 * Uso:
 *   node validate_financial.js [--fix] [--dry-run] [--group=GROUP_ID]
 *
 * Flags:
 *   --fix            Corrige valores inválidos
 *   --dry-run        Mostra correções sem aplicar
 *   --group=ID       Valida apenas um grupo específico
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

// Constantes
const VALID_CASHBOX_TYPES = ["INCOME", "EXPENSE"];
const VALID_CASHBOX_CATEGORIES = [
  "MONTHLY_FEE",
  "WEEKLY_FEE",
  "SINGLE_PAYMENT",
  "DONATION",
  "FIELD_RENTAL",
  "EQUIPMENT",
  "CELEBRATION",
  "REFUND",
  "OTHER",
];
const VALID_PAYMENT_STATUSES = ["PENDING", "PAID", "OVERDUE", "CANCELLED"];
const VALID_PAYMENT_TYPES = ["MONTHLY", "DAILY", "EXTRA"];
const VALID_CROWDFUNDING_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED"];

// Contadores
const stats = {
  cashboxEntries: { total: 0, valid: 0, invalid: 0, fixed: 0 },
  payments: { total: 0, valid: 0, invalid: 0, fixed: 0 },
  crowdfunding: { total: 0, valid: 0, invalid: 0, fixed: 0 },
  balanceInconsistencies: 0,
};
const issues = [];

/**
 * Valida uma entrada de caixa
 */
function validateCashboxEntry(entryId, data) {
  const entryIssues = [];

  // Amount deve ser positivo
  if (data.amount === undefined || data.amount === null) {
    entryIssues.push({
      field: "amount",
      issue: "Valor obrigatório",
      value: null,
    });
  } else if (typeof data.amount !== "number") {
    entryIssues.push({
      field: "amount",
      issue: "Não é número",
      value: data.amount,
    });
  } else if (data.amount <= 0) {
    entryIssues.push({
      field: "amount",
      issue: "Deve ser positivo",
      value: data.amount,
    });
  }

  // Tipo válido
  if (data.type) {
    const type = String(data.type).toUpperCase();
    if (!VALID_CASHBOX_TYPES.includes(type)) {
      entryIssues.push({
        field: "type",
        issue: `Tipo inválido: ${type}`,
        value: data.type,
      });
    }
  }

  // Categoria válida
  if (data.category) {
    const category = String(data.category).toUpperCase();
    if (!VALID_CASHBOX_CATEGORIES.includes(category)) {
      entryIssues.push({
        field: "category",
        issue: `Categoria inválida: ${category}`,
        value: data.category,
      });
    }
  }

  // created_by_id obrigatório
  if (!data.created_by_id || data.created_by_id.trim() === "") {
    entryIssues.push({
      field: "created_by_id",
      issue: "Responsável obrigatório",
      value: data.created_by_id,
    });
  }

  // Descrição max 500 chars
  if (data.description && data.description.length > 500) {
    entryIssues.push({
      field: "description",
      issue: "Descrição muito longa (max 500)",
      value: `${data.description.length} chars`,
    });
  }

  return entryIssues;
}

/**
 * Valida um pagamento
 */
function validatePayment(paymentId, data) {
  const paymentIssues = [];

  // Amount deve ser positivo
  if (data.amount === undefined || data.amount === null) {
    paymentIssues.push({
      field: "amount",
      issue: "Valor obrigatório",
      value: null,
    });
  } else if (typeof data.amount !== "number") {
    paymentIssues.push({
      field: "amount",
      issue: "Não é número",
      value: data.amount,
    });
  } else if (data.amount <= 0) {
    paymentIssues.push({
      field: "amount",
      issue: "Deve ser positivo",
      value: data.amount,
    });
  }

  // Status válido
  if (data.status) {
    const status = String(data.status).toUpperCase();
    if (!VALID_PAYMENT_STATUSES.includes(status)) {
      paymentIssues.push({
        field: "status",
        issue: `Status inválido: ${status}`,
        value: data.status,
      });
    }
  }

  // Tipo válido
  if (data.type) {
    const type = String(data.type).toUpperCase();
    if (!VALID_PAYMENT_TYPES.includes(type)) {
      paymentIssues.push({
        field: "type",
        issue: `Tipo inválido: ${type}`,
        value: data.type,
      });
    }
  }

  // user_id obrigatório
  if (!data.user_id || data.user_id.trim() === "") {
    paymentIssues.push({
      field: "user_id",
      issue: "Usuário obrigatório",
      value: data.user_id,
    });
  }

  return paymentIssues;
}

/**
 * Valida uma vaquinha
 */
function validateCrowdfunding(crowdfundingId, data) {
  const cfIssues = [];

  // target_amount deve ser positivo
  if (data.target_amount !== undefined && data.target_amount !== null) {
    if (typeof data.target_amount !== "number") {
      cfIssues.push({
        field: "target_amount",
        issue: "Não é número",
        value: data.target_amount,
      });
    } else if (data.target_amount <= 0) {
      cfIssues.push({
        field: "target_amount",
        issue: "Deve ser positivo",
        value: data.target_amount,
      });
    }
  }

  // current_amount deve ser não-negativo
  if (data.current_amount !== undefined && data.current_amount !== null) {
    if (typeof data.current_amount !== "number") {
      cfIssues.push({
        field: "current_amount",
        issue: "Não é número",
        value: data.current_amount,
      });
    } else if (data.current_amount < 0) {
      cfIssues.push({
        field: "current_amount",
        issue: "Não pode ser negativo",
        value: data.current_amount,
      });
    }
  }

  // Status válido
  if (data.status) {
    const status = String(data.status).toUpperCase();
    if (!VALID_CROWDFUNDING_STATUSES.includes(status)) {
      cfIssues.push({
        field: "status",
        issue: `Status inválido: ${status}`,
        value: data.status,
      });
    }
  }

  // organizer_id obrigatório
  if (!data.organizer_id || data.organizer_id.trim() === "") {
    cfIssues.push({
      field: "organizer_id",
      issue: "Organizador obrigatório",
      value: data.organizer_id,
    });
  }

  // Título obrigatório (3-100 chars)
  if (!data.title || data.title.trim().length < 3) {
    cfIssues.push({
      field: "title",
      issue: "Título obrigatório (min 3 chars)",
      value: data.title,
    });
  } else if (data.title.length > 100) {
    cfIssues.push({
      field: "title",
      issue: "Título muito longo (max 100)",
      value: `${data.title.length} chars`,
    });
  }

  return cfIssues;
}

/**
 * Verifica consistência do saldo de um grupo
 */
async function validateGroupBalance(groupId) {
  const cashboxSnapshot = await db
    .collection("groups")
    .doc(groupId)
    .collection("cashbox")
    .where("status", "==", "ACTIVE")
    .get();

  let calculatedIncome = 0;
  let calculatedExpense = 0;

  for (const doc of cashboxSnapshot.docs) {
    const data = doc.data();
    const amount = data.amount || 0;
    const type = String(data.type || "").toUpperCase();

    if (type === "INCOME") {
      calculatedIncome += amount;
    } else if (type === "EXPENSE") {
      calculatedExpense += amount;
    }
  }

  const calculatedBalance = calculatedIncome - calculatedExpense;

  // Buscar resumo armazenado
  const summaryDoc = await db
    .collection("groups")
    .doc(groupId)
    .collection("cashbox_summary")
    .doc("current")
    .get();

  if (summaryDoc.exists) {
    const summary = summaryDoc.data();
    const storedBalance = summary.balance || 0;
    const storedIncome = summary.total_income || 0;
    const storedExpense = summary.total_expense || 0;

    const tolerance = 0.01; // Tolerância de centavo

    if (Math.abs(calculatedBalance - storedBalance) > tolerance) {
      return {
        groupId,
        issue: "Saldo inconsistente",
        calculated: calculatedBalance.toFixed(2),
        stored: storedBalance.toFixed(2),
        difference: (calculatedBalance - storedBalance).toFixed(2),
      };
    }

    if (Math.abs(calculatedIncome - storedIncome) > tolerance) {
      return {
        groupId,
        issue: "Total de entradas inconsistente",
        calculated: calculatedIncome.toFixed(2),
        stored: storedIncome.toFixed(2),
      };
    }

    if (Math.abs(calculatedExpense - storedExpense) > tolerance) {
      return {
        groupId,
        issue: "Total de saídas inconsistente",
        calculated: calculatedExpense.toFixed(2),
        stored: storedExpense.toFixed(2),
      };
    }
  }

  return null;
}

/**
 * Executa validação financeira
 */
async function validateFinancial(shouldFix, dryRun, targetGroupId) {
  console.log("========================================");
  console.log("   VALIDAÇÃO FINANCEIRA - Futeba");
  console.log("========================================");
  console.log(`Modo: ${shouldFix ? (dryRun ? "DRY-RUN" : "FIX") : "VALIDAÇÃO"}`);
  if (targetGroupId) {
    console.log(`Grupo: ${targetGroupId}`);
  }
  console.log("");

  // Buscar todos os grupos
  let groupsQuery = db.collection("groups");
  if (targetGroupId) {
    groupsQuery = groupsQuery.where(
      admin.firestore.FieldPath.documentId(),
      "==",
      targetGroupId
    );
  }

  const groupsSnapshot = await groupsQuery.get();
  console.log(`Total de grupos: ${groupsSnapshot.size}`);

  for (const groupDoc of groupsSnapshot.docs) {
    const groupId = groupDoc.id;
    const groupName = groupDoc.data().name || groupId;

    console.log(`\nProcessando grupo: ${groupName}`);

    // 1. Validar entradas de caixa
    const cashboxSnapshot = await db
      .collection("groups")
      .doc(groupId)
      .collection("cashbox")
      .get();

    for (const doc of cashboxSnapshot.docs) {
      stats.cashboxEntries.total++;
      const entryIssues = validateCashboxEntry(doc.id, doc.data());

      if (entryIssues.length === 0) {
        stats.cashboxEntries.valid++;
      } else {
        stats.cashboxEntries.invalid++;
        issues.push({
          type: "cashbox",
          groupId,
          docId: doc.id,
          issues: entryIssues,
        });

        if (shouldFix) {
          const data = doc.data();
          const fixes = {};

          // Corrigir amount
          if (data.amount !== undefined && typeof data.amount === "number") {
            if (data.amount < 0) {
              fixes.amount = Math.abs(data.amount);
            }
          }

          if (Object.keys(fixes).length > 0) {
            console.log(`  [CORRIGINDO CASHBOX] ${doc.id}`);
            if (!dryRun) {
              await db
                .collection("groups")
                .doc(groupId)
                .collection("cashbox")
                .doc(doc.id)
                .update(fixes);
            }
            stats.cashboxEntries.fixed++;
          }
        }
      }
    }

    // 2. Verificar consistência do saldo
    const balanceIssue = await validateGroupBalance(groupId);
    if (balanceIssue) {
      stats.balanceInconsistencies++;
      issues.push({
        type: "balance",
        ...balanceIssue,
      });
      console.log(`  [ALERTA] ${balanceIssue.issue}`);
      console.log(
        `    Calculado: R$ ${balanceIssue.calculated}, Armazenado: R$ ${balanceIssue.stored}`
      );
    }
  }

  // 3. Validar pagamentos (coleção global)
  console.log("\nValidando pagamentos...");
  const paymentsSnapshot = await db.collection("payments").get();

  for (const doc of paymentsSnapshot.docs) {
    stats.payments.total++;
    const paymentIssues = validatePayment(doc.id, doc.data());

    if (paymentIssues.length === 0) {
      stats.payments.valid++;
    } else {
      stats.payments.invalid++;
      issues.push({
        type: "payment",
        docId: doc.id,
        issues: paymentIssues,
      });
    }
  }

  // 4. Validar vaquinhas (coleção global)
  console.log("Validando vaquinhas...");
  const crowdfundingSnapshot = await db.collection("crowdfunding").get();

  for (const doc of crowdfundingSnapshot.docs) {
    stats.crowdfunding.total++;
    const cfIssues = validateCrowdfunding(doc.id, doc.data());

    if (cfIssues.length === 0) {
      stats.crowdfunding.valid++;
    } else {
      stats.crowdfunding.invalid++;
      issues.push({
        type: "crowdfunding",
        docId: doc.id,
        issues: cfIssues,
      });
    }
  }

  // Relatório final
  console.log("\n========================================");
  console.log("              RELATÓRIO FINAL");
  console.log("========================================");

  console.log("\n--- CASHBOX ---");
  console.log(`Total: ${stats.cashboxEntries.total}`);
  console.log(`Válidos: ${stats.cashboxEntries.valid}`);
  console.log(`Inválidos: ${stats.cashboxEntries.invalid}`);
  if (shouldFix) {
    console.log(
      `Corrigidos: ${stats.cashboxEntries.fixed}${dryRun ? " (dry-run)" : ""}`
    );
  }

  console.log("\n--- PAGAMENTOS ---");
  console.log(`Total: ${stats.payments.total}`);
  console.log(`Válidos: ${stats.payments.valid}`);
  console.log(`Inválidos: ${stats.payments.invalid}`);

  console.log("\n--- VAQUINHAS ---");
  console.log(`Total: ${stats.crowdfunding.total}`);
  console.log(`Válidos: ${stats.crowdfunding.valid}`);
  console.log(`Inválidos: ${stats.crowdfunding.invalid}`);

  console.log("\n--- CONSISTÊNCIA ---");
  console.log(`Inconsistências de saldo: ${stats.balanceInconsistencies}`);

  if (issues.length > 0 && !shouldFix) {
    console.log("\n--- DETALHES DOS PROBLEMAS (primeiros 15) ---\n");
    for (const item of issues.slice(0, 15)) {
      console.log(`[${item.type.toUpperCase()}] ${item.docId || item.groupId}`);
      if (item.issues) {
        for (const issue of item.issues) {
          console.log(
            `  - ${issue.field}: ${issue.issue} (valor: ${issue.value})`
          );
        }
      }
    }
    if (issues.length > 15) {
      console.log(`\n... e mais ${issues.length - 15} itens com problemas`);
    }
  }

  console.log("\n========================================");

  return { stats, issues };
}

// Execução principal
const args = process.argv.slice(2);
const shouldFix = args.includes("--fix");
const dryRun = args.includes("--dry-run");
const groupArg = args.find((a) => a.startsWith("--group="));
const targetGroupId = groupArg ? groupArg.split("=")[1] : null;

validateFinancial(shouldFix, dryRun, targetGroupId)
  .then((result) => {
    console.log("\nValidação concluída!");
    const hasIssues =
      result.stats.cashboxEntries.invalid > 0 ||
      result.stats.payments.invalid > 0 ||
      result.stats.crowdfunding.invalid > 0 ||
      result.stats.balanceInconsistencies > 0;
    process.exit(hasIssues && !shouldFix ? 1 : 0);
  })
  .catch((error) => {
    console.error("Erro na validação:", error);
    process.exit(1);
  });
