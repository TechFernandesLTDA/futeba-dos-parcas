/**
 * MIGRATION SCRIPT: Create Field documents for existing locations
 *
 * Problema: Locais existentes têm field_count > 0 mas ZERO documentos Field
 * na sub-coleção locations/{id}/fields. Isso faz com que as quadras não
 * apareçam na seleção durante criação de jogos.
 *
 * USAGE:
 * ```bash
 * cd functions
 * npm run build
 * npx ts-node src/scripts/migrate-create-fields.ts           # dry-run
 * npx ts-node src/scripts/migrate-create-fields.ts --execute  # executa de verdade
 * ```
 *
 * IMPORTANTE:
 * - Apenas ADMIN pode executar
 * - Idempotente (pode rodar múltiplas vezes sem duplicar)
 * - Usa writeBatch para atomicidade
 * - Dry-run por padrão (passar --execute para executar)
 */

import * as admin from "firebase-admin";
import "../types/firestore-count";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface MigrationStats {
  totalLocations: number;
  locationsWithFields: number;
  locationsFixed: number;
  fieldsCreated: number;
  errors: number;
}

/**
 * Executa a migração de Field documents para locais existentes.
 * @param {boolean} execute - Se true, executa as modificações. Se false, dry-run.
 */
async function migrateCreateFields(execute = false): Promise<void> {
  const stats: MigrationStats = {
    totalLocations: 0,
    locationsWithFields: 0,
    locationsFixed: 0,
    fieldsCreated: 0,
    errors: 0,
  };

  console.log(`\n${execute ? "⚠️  EXECUTANDO" : "🔍 DRY-RUN"} — Migração de Field documents\n`);

  const locationsSnap = await db.collection("locations").get();
  stats.totalLocations = locationsSnap.size;

  console.log(`Encontrados ${stats.totalLocations} locais para verificar.\n`);

  for (const locDoc of locationsSnap.docs) {
    const loc = locDoc.data();
    const fieldCount = (loc.field_count as number) || 0;

    if (fieldCount === 0) continue;

    try {
      // Count existing fields in sub-collection
      const existingFieldsSnap = await locDoc.ref.collection("fields").get();
      const existingCount = existingFieldsSnap.size;

      if (existingCount >= fieldCount) {
        stats.locationsWithFields++;
        continue;
      }

      const missingCount = fieldCount - existingCount;

      if (execute) {
        const batch = db.batch();
        const fieldType = (loc.field_type as string) || (loc.primary_field_type as string) || "SOCIETY";

        for (let i = existingCount + 1; i <= fieldCount; i++) {
          const fieldRef = locDoc.ref.collection("fields").doc();
          batch.set(fieldRef, {
            name: fieldCount === 1 ? "Quadra Principal" : `Quadra ${i}`,
            location_id: locDoc.id,
            type: fieldType.toUpperCase(),
            is_active: true,
            hourly_price: 0,
            amenities: [],
            photos: [],
            managers: [loc.owner_id].filter(Boolean),
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // Update has_active_fields
        batch.update(locDoc.ref, {
          has_active_fields: true,
        });

        await batch.commit();
        stats.fieldsCreated += missingCount;
        console.log(
          `  ✅ ${locDoc.id} (${loc.name}): created ${missingCount} field(s)`
        );
      } else {
        console.log(
          `  🔍 ${locDoc.id} (${loc.name}): missing ${missingCount} ` +
          `field(s) [has ${existingCount}/${fieldCount}]`
        );
      }

      stats.locationsFixed++;
    } catch (err) {
      stats.errors++;
      console.error(`  ❌ ${locDoc.id} (${loc.name}): ${err}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("RESUMO:");
  console.log(`  Total de locais verificados: ${stats.totalLocations}`);
  console.log(`  Locais com fields corretos:  ${stats.locationsWithFields}`);
  console.log(`  Locais precisando correção:  ${stats.locationsFixed}`);
  console.log(`  Fields criados:              ${stats.fieldsCreated}`);
  console.log(`  Erros:                       ${stats.errors}`);
  console.log("=".repeat(60));

  if (!execute) {
    console.log("\n🔍 Este foi um DRY-RUN. Nenhum dado foi modificado.");
    console.log("   Para executar de verdade, rode:");
    console.log("   npx ts-node src/scripts/migrate-create-fields.ts --execute\n");
  } else {
    console.log("\n✅ Migração concluída!\n");
  }
}

// Parse CLI args
const execute = process.argv.includes("--execute");

migrateCreateFields(execute)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
