/* eslint-disable require-jsdoc */
/**
 * Reparo pós-importação: converte os documentos importados em camelCase para
 * a convenção snake_case de produção (locations usam snake_case — firestore.rules
 * e o script de backfill leem publication_status/has_active_fields/field_count).
 *
 * Alvo: locations onde external_data.imported_by == 'venue-dataset-import'.
 * Idempotente: campos já em snake_case não são tocados; chaves camelCase são
 * removidas após a conversão. Sempre define publication_status='DRAFT'.
 *
 * Usage:
 *   NODE_PATH=functions/node_modules npx tsx scripts/data/repair-venues-snake-case.ts [--execute]
 */

import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({projectId: "futebadosparcas"});
}

const db = admin.firestore();

const CAMEL_TO_SNAKE: Record<string, string> = {
  ownerId: "owner_id",
  isVerified: "is_verified",
  isActive: "is_active",
  publicationStatus: "publication_status",
  commercialStatus: "commercial_status",
  subscriptionStatus: "subscription_status",
  ratingCount: "rating_count",
  photoUrl: "photo_url",
  timeZone: "time_zone",
  openingTime: "opening_time",
  closingTime: "closing_time",
  operatingDays: "operating_days",
  minGameDurationMinutes: "min_game_duration_minutes",
  fieldCount: "field_count",
  fieldType: "field_type",
  primaryFieldType: "primary_field_type",
  activeFieldCount: "active_field_count",
  activeFieldTypes: "active_field_types",
  hasActiveFields: "has_active_fields",
  createdAt: "created_at",
  updatedAt: "updated_at",
  updatedBy: "updated_by",
};

function convert(data: admin.firestore.DocumentData):
    {out: admin.firestore.DocumentData; changed: string[]} {
  const out: admin.firestore.DocumentData = {};
  const changed: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    const snake = CAMEL_TO_SNAKE[key];
    if (snake) {
      out[snake] = value;
      changed.push(`${key}→${snake}`);
    } else {
      out[key] = value;
    }
  }
  return {out, changed};
}

async function main() {
  const execute = process.argv.includes("--execute");
  const snap = await db.collection("locations")
      .where("external_data.imported_by", "==", "venue-dataset-import")
      .get();
  console.log(`Locations importadas: ${snap.size}. Modo: ${execute ? "EXECUTE" : "DRY-RUN"}`);

  let fixed = 0;
  for (const doc of snap.docs) {
    const {out, changed} = convert(doc.data() as admin.firestore.DocumentData);
    // Garantias de estado seguro em produção:
    out.publication_status = "DRAFT";
    out.is_active = out.is_active ?? true;
    out.is_verified = out.is_verified ?? false;
    if (!changed.length && doc.get("publication_status") === "DRAFT") {
      console.log(`  = ${doc.get("name")} (nada a fazer)`);
      continue;
    }
    console.log(`  ~ ${doc.get("name")}: ${changed.join(", ") || "(só status)"}`);
    if (execute) {
      await doc.ref.set(out, {merge: false});
      fixed += 1;
    }
    // Quadras (fields) — mesma conversão.
    const fields = await doc.ref.collection("fields").get();
    for (const f of fields.docs) {
      const conv = convert(f.data());
      if (!execute) {
        if (conv.changed.length) {
          console.log(`      ~ field: ${conv.changed.join(", ")}`);
        }
        continue;
      }
      await f.ref.set(conv.out, {merge: false});
    }
  }
  console.log(execute ? `✓ ${fixed} location(s) convertida(s).` :
      "DRY-RUN: nada escrito. Rode com --execute para aplicar.");
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Falha fatal:", err);
  process.exit(1);
});