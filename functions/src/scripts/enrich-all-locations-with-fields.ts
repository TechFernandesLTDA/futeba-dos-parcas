/**
 * ENRIQUECIMENTO EM MASSA: Criar Field para TODOS os locais sem quadras
 *
 * Problema: 57 dos 58 locais têm field_count=0 (foram criados sem quadras).
 * O CreateGameScreen só mostra quadras no dropdown se existirem Field documents.
 *
 * Solução: Para cada local ativo sem fields, criar 1 field padrão e
 * atualizar field_count=1, has_active_fields=true.
 *
 * USAGE:
 * cd functions
 * npx ts-node src/scripts/enrich-all-locations-with-fields.ts           # dry-run
 * npx ts-node src/scripts/enrich-all-locations-with-fields.ts --execute  # executa
 */

import * as admin from "firebase-admin";
import "../types/firestore-count";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface Stats {
  total: number;
  alreadyHasFields: number;
  skippedInactive: number;
  enriched: number;
  errors: number;
}

/**
 * Infere o tipo de quadra baseado no nome do local.
 * @param {string} name Nome do local.
 * @return {string} Tipo de quadra inferido (FUTSAL/CAMPO/AREIA/SOCIETY).
 */
function inferFieldType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("futsal")) return "FUTSAL";
  if (lower.includes("campo") || lower.includes("grass")) return "CAMPO";
  if (lower.includes("areia") || lower.includes("beach") || lower.includes("praia")) {
    return "AREIA";
  }
  // society é o mais comum no Brasil para quadras pequenas
  return "SOCIETY";
}

/**
 * Cria um field padrão para cada local ativo sem quadras.
 * @param {boolean} execute Se true, aplica as mudanças; senão dry-run.
 */
async function enrich(execute = false): Promise<void> {
  const stats: Stats = {
    total: 0,
    alreadyHasFields: 0,
    skippedInactive: 0,
    enriched: 0,
    errors: 0,
  };

  console.log(
    `\n${execute ? "⚠️  EXECUTANDO" : "🔍 DRY-RUN"} — Enriquecimento de Fields\n`
  );

  const locationsSnap = await db.collection("locations").get();
  stats.total = locationsSnap.size;

  for (const locDoc of locationsSnap.docs) {
    const loc = locDoc.data();
    const isActive = loc.is_active as boolean;

    // Pular locais inativos
    if (!isActive) {
      stats.skippedInactive++;
      continue;
    }

    // Check if already has fields
    const subSnap = await locDoc.ref.collection("fields").get();
    if (subSnap.size > 0) {
      stats.alreadyHasFields++;
      continue;
    }

    // Check root fields
    const rootSnap = await db
      .collection("fields")
      .where("location_id", "==", locDoc.id)
      .get();
    if (rootSnap.size > 0) {
      stats.alreadyHasFields++;
      continue;
    }

    // This location needs a field
    const name = (loc.name as string) || "Local sem nome";
    const owner = (loc.owner_id as string) || "";
    const fieldType = inferFieldType(name);

    if (execute) {
      try {
        const batch = db.batch();

        // Create field document
        const fieldRef = locDoc.ref.collection("fields").doc();
        batch.set(fieldRef, {
          name: "Quadra Principal",
          location_id: locDoc.id,
          type: fieldType,
          is_active: true,
          hourly_price: 0,
          amenities: [],
          photos: [],
          managers: owner ? [owner] : [],
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update location
        batch.update(locDoc.ref, {
          field_count: 1,
          has_active_fields: true,
          primary_field_type: fieldType,
          field_type: fieldType,
        });

        await batch.commit();
        console.log(`  ✅ ${name}: created field (type=${fieldType})`);
        stats.enriched++;
      } catch (err) {
        stats.errors++;
        console.error(`  ❌ ${name}: ${err}`);
      }
    } else {
      console.log(`  🔍 ${name}: needs field (will create type=${fieldType})`);
      stats.enriched++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("RESUMO:");
  console.log(`  Total de locais:           ${stats.total}`);
  console.log(`  Já possuem fields:         ${stats.alreadyHasFields}`);
  console.log(`  Inativos (pulados):        ${stats.skippedInactive}`);
  console.log(`  Precisam enriquecimento:   ${stats.enriched}`);
  console.log(`  Fields criados:            ${stats.enriched}`);
  console.log(`  Erros:                     ${stats.errors}`);
  console.log("=".repeat(60));

  if (!execute) {
    console.log("\n🔍 Este foi um DRY-RUN. Nenhum dado foi modificado.");
    console.log("   Para executar de verdade:");
    console.log(
      "   npx ts-node src/scripts/enrich-all-locations-with-fields.ts --execute\n"
    );
  } else {
    console.log("\n✅ Enriquecimento concluído!\n");
  }
}

const execute = process.argv.includes("--execute");

enrich(execute)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Enrichment failed:", err);
    process.exit(1);
  });
