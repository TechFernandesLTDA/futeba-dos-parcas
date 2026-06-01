/**
 * DIAGNÓSTICO COMPLETO: Locations e Fields no Firestore
 *
 * USAGE:
 * cd functions
 * npx ts-node src/scripts/diagnose-locations-fields.ts
 */

import * as admin from "firebase-admin";
import "../types/firestore-count";

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

interface LocationDiag {
  id: string;
  name: string;
  fieldCount: number;
  hasActiveFields: boolean;
  subCollectionFields: number;
  rootFields: number;
  fieldType?: string;
  owner?: string;
  isActive?: boolean;
  issues: string[];
}

async function diagnose(): Promise<void> {
  console.log("\n🔍 DIAGNÓSTICO COMPLETO — Locations e Fields\n");

  const locationsSnap = await db.collection("locations").get();
  const diagnostics: LocationDiag[] = [];

  let totalFieldCount = 0;
  let totalSubFields = 0;
  let totalRootFields = 0;
  let locationsWithFields = 0;
  let locationsWithoutFields = 0;
  let locationsWithIssues = 0;

  for (const locDoc of locationsSnap.docs) {
    const loc = locDoc.data();
    const fieldCount = (loc.field_count as number) || 0;
    const hasActiveFields = loc.has_active_fields as boolean;

    // Count sub-collection fields
    const subSnap = await locDoc.ref.collection("fields").get();
    const subCount = subSnap.size;

    // Count root fields
    const rootSnap = await db
      .collection("fields")
      .where("location_id", "==", locDoc.id)
      .get();
    const rootCount = rootSnap.size;

    const issues: string[] = [];

    if (fieldCount > 0 && subCount === 0 && rootCount === 0) {
      issues.push("field_count > 0 mas ZERO fields reais");
    }
    if (fieldCount > 0 && subCount > 0 && subCount < fieldCount) {
      issues.push(
        `sub-coleção tem ${subCount} fields mas field_count=${fieldCount}`
      );
    }
    if (fieldCount > 0 && rootCount > 0 && rootCount < fieldCount) {
      issues.push(`root tem ${rootCount} fields mas field_count=${fieldCount}`);
    }
    if (subCount > 0 && hasActiveFields === false) {
      issues.push("has_active_fields=false mas tem fields na sub-coleção");
    }
    if (fieldCount === 0 && subCount > 0) {
      issues.push("field_count=0 mas tem fields na sub-coleção");
    }

    totalFieldCount += fieldCount;
    totalSubFields += subCount;
    totalRootFields += rootCount;

    if (subCount > 0 || rootCount > 0) {
      locationsWithFields++;
    } else {
      locationsWithoutFields++;
    }
    if (issues.length > 0) {
      locationsWithIssues++;
    }

    diagnostics.push({
      id: locDoc.id,
      name: (loc.name as string) || "SEM NOME",
      fieldCount,
      hasActiveFields: hasActiveFields || false,
      subCollectionFields: subCount,
      rootFields: rootCount,
      fieldType: loc.field_type as string,
      owner: loc.owner_id as string,
      isActive: loc.is_active as boolean,
      issues,
    });
  }

  // Print detailed report
  console.log("=" .repeat(80));
  console.log("RESUMO GERAL");
  console.log("=".repeat(80));
  console.log(`Total de locais:              ${diagnostics.length}`);
  console.log(`Total field_count (soma):     ${totalFieldCount}`);
  console.log(`Total sub-collection fields:  ${totalSubFields}`);
  console.log(`Total root fields:            ${totalRootFields}`);
  console.log(`Locais COM fields reais:      ${locationsWithFields}`);
  console.log(`Locais SEM fields reais:      ${locationsWithoutFields}`);
  console.log(`Locais COM problemas:         ${locationsWithIssues}`);

  console.log("\n" + "=".repeat(80));
  console.log("DETALHES POR LOCAL");
  console.log("=".repeat(80));

  for (const d of diagnostics) {
    const status =
      d.issues.length > 0
        ? `❌ ${d.issues.join("; ")}`
        : d.subCollectionFields > 0 || d.rootFields > 0
        ? "✅ OK"
        : d.fieldCount > 0
        ? "⚠️  field_count > 0 mas SEM fields reais"
        : "ℹ️  field_count=0 (sem quadras)";

    console.log(
      `\n📍 ${d.name} (${d.id})`
    );
    console.log(
      `   field_count=${d.fieldCount} | sub=${d.subCollectionFields} | root=${d.rootFields} | has_active_fields=${d.hasActiveFields} | type=${d.fieldType || "-"}`
    );
    console.log(`   ${status}`);

    // Show field details if exists
    if (d.subCollectionFields > 0) {
      const fields = await db
        .collection("locations")
        .doc(d.id)
        .collection("fields")
        .get();
      console.log("   Sub-collection fields:");
      fields.forEach((f) => {
        const fd = f.data();
        console.log(
          `     - ${f.id}: name="${fd.name}" type="${fd.type}" active=${fd.is_active} price=${fd.hourly_price ?? fd.hourlyPrice ?? 0}`
        );
      });
    }
    if (d.rootFields > 0) {
      const rootFields = await db
        .collection("fields")
        .where("location_id", "==", d.id)
        .get();
      console.log("   Root fields:");
      rootFields.forEach((f) => {
        const fd = f.data();
        console.log(
          `     - ${f.id}: name="${fd.name}" type="${fd.type}" active=${fd.is_active} price=${fd.hourly_price ?? fd.hourlyPrice ?? 0}`
        );
      });
    }
  }

  // Schema analysis
  console.log("\n" + "=".repeat(80));
  console.log("ANÁLISE DE SCHEMA - Campos nos documents Location");
  console.log("=".repeat(80));

  if (diagnostics.length > 0) {
    const sample = diagnostics[0];
    const sampleDoc = await db.collection("locations").doc(sample.id).get();
    const sampleData = sampleDoc.data()!;
    console.log("Campos no primeiro local:");
    for (const [key, value] of Object.entries(sampleData)) {
      const valStr =
        typeof value === "object" && value !== null
          ? JSON.stringify(value).substring(0, 80)
          : String(value);
      console.log(`  ${key}: ${valStr}`);
    }

    // Show field schema too
    const firstWithFields = diagnostics.find((d) => d.subCollectionFields > 0);
    if (firstWithFields) {
      const fieldsSnap = await db
        .collection("locations")
        .doc(firstWithFields.id)
        .collection("fields")
        .limit(1)
        .get();
      if (!fieldsSnap.empty) {
        const fieldData = fieldsSnap.docs[0].data();
        console.log("\nCampos no primeiro Field (sub-coleção):");
        for (const [key, value] of Object.entries(fieldData)) {
          const valStr =
            typeof value === "object" && value !== null
              ? JSON.stringify(value).substring(0, 80)
              : String(value);
          console.log(`  ${key}: ${valStr}`);
        }
      }
    }

    const firstRootField = diagnostics.find((d) => d.rootFields > 0);
    if (firstRootField) {
      const rootSnap = await db
        .collection("fields")
        .where("location_id", "==", firstRootField.id)
        .limit(1)
        .get();
      if (!rootSnap.empty) {
        const fieldData = rootSnap.docs[0].data();
        console.log("\nCampos no primeiro Field (root):");
        for (const [key, value] of Object.entries(fieldData)) {
          const valStr =
            typeof value === "object" && value !== null
              ? JSON.stringify(value).substring(0, 80)
              : String(value);
          console.log(`  ${key}: ${valStr}`);
        }
      }
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("🔍 DIAGNÓSTICO CONCLUÍDO");
  console.log("=".repeat(80));
}

diagnose()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Diagnosis failed:", err);
    process.exit(1);
  });
