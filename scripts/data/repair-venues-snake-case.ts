/* eslint-disable require-jsdoc */
/**
 * Reparo pós-importação (#4193): converte os documentos importados em camelCase
 * para a convenção snake_case de produção (locations usam snake_case —
 * firestore.rules e o backfill leem publication_status/has_active_fields/field_count).
 *
 * Alvo: locations onde external_data.imported_by == 'venue-dataset-import' E que
 * ainda possuam ao menos uma chave camelCase mapeada. Documentos já em snake_case
 * (ex.: os 2 pré-existentes SUSPENDED/verificados) NÃO são tocados.
 *
 * Regras de segurança:
 *  - Escrita via update() com FieldValue.delete() nas chaves camelCase — nada é
 *    reescrito por inteiro, campos que o repair não conhece são preservados.
 *  - Se a chave snake_case JÁ existe (ex.: rating_count/field_count/has_active_fields,
 *    calculados pelas Cloud Functions), ela é a fonte da verdade: a camelCase só é
 *    removida (divergência de valores registrada no plano).
 *  - Documentos com chaves camelCase cujo valor DIVERGE do snake_case existente
 *    (dados legados conflitantes) vão para `locations_manual_review` e NÃO são
 *    escritos, a menos que se passe --include-divergent após revisão humana.
 *  - Nunca altera publication_status/is_verified além de renomear a chave;
 *    nunca publica nada.
 *  - Idempotente: após a execução, uma nova rodada não encontra camelCase.
 *  - DRY-RUN é o padrão. Escrita só com --execute.
 *
 * Usage:
 *   NODE_PATH=functions/node_modules npx tsx scripts/data/repair-venues-snake-case.ts \
 *     [--plan-out reports/venues-repair-plan.json] [--execute] [--include-divergent]
 *     [--only <id,id>] [--backup-out reports/venues-legacy-backup.json]
 *
 * Ambiente: VENUES_PROJECT_ID (padrão futebadosparcas). Com FIRESTORE_EMULATOR_HOST
 * definido o Admin SDK fala com o emulador (use projeto demo-*).
 */

import * as fs from "fs";
import * as path from "path";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

const PROJECT_ID = process.env.VENUES_PROJECT_ID ?? "futebadosparcas";
const IMPORT_LABEL = "venue-dataset-import";

if (!admin.apps.length) {
  admin.initializeApp({projectId: PROJECT_ID});
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
  hourlyPrice: "hourly_price",
  isCovered: "is_covered",
  playersPerTeam: "players_per_team",
  minBookingMinutes: "min_booking_minutes",
  openingTime: "opening_time",
  closingTime: "closing_time",
  operatingDays: "operating_days",
  minGameDurationMinutes: "min_game_duration_minutes",
  fieldCount: "field_count",
  fieldType: "field_type",
  fullAddress: "full_address",
  fieldTypeInferred: "field_type_inferred",
  gpsInferred: "gps_inferred",
  primaryFieldType: "primary_field_type",
  activeFieldCount: "active_field_count",
  activeFieldTypes: "active_field_types",
  hasActiveFields: "has_active_fields",
  createdAt: "created_at",
  updatedAt: "updated_at",
  updatedBy: "updated_by",
};

type Data = admin.firestore.DocumentData;

/**
 * Chaves snake_case calculadas/mantidas pelas Cloud Functions (estatísticas da
 * location). Se existirem, vencem sempre; divergência da camelCase legada não
 * exige revisão manual.
 */
const FUNCTION_DERIVED = new Set([
  "rating_count", "field_count", "has_active_fields", "active_field_count",
  "primary_field_type", "active_field_types",
]);

interface Conversion {
  /** camelCase → snake_case (a chave snake não existia: o valor é movido). */
  renamed: Record<string, {to: string; value: unknown}>;
  /** snake_case já existia: a camelCase só é removida. */
  droppedCamel: Record<string, {
    snake: string; camelValue: unknown; snakeValue: unknown;
    diverge: boolean; derivedByFunctions: boolean;
  }>;
  update: Record<string, unknown>;
}

function jsonSafe(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in (value as object)) {
    return (value as {toDate: () => Date}).toDate().toISOString();
  }
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(jsonSafe(a)) === JSON.stringify(jsonSafe(b));
}

function convert(data: Data): Conversion {
  const result: Conversion = {renamed: {}, droppedCamel: {}, update: {}};
  for (const [camel, snake] of Object.entries(CAMEL_TO_SNAKE)) {
    if (!(camel in data)) continue;
    if (snake in data) {
      result.droppedCamel[camel] = {
        snake,
        camelValue: jsonSafe(data[camel]),
        snakeValue: jsonSafe(data[snake]),
        diverge: !sameValue(data[camel], data[snake]),
        derivedByFunctions: FUNCTION_DERIVED.has(snake),
      };
    } else {
      result.renamed[camel] = {to: snake, value: jsonSafe(data[camel])};
      result.update[snake] = data[camel];
    }
    result.update[camel] = FieldValue.delete();
  }
  return result;
}

const hasChanges = (c: Conversion) => Object.keys(c.update).length > 0;

function flatPlan(c: Conversion) {
  return {
    renamed: c.renamed,
    dropped_camel_keeping_snake: c.droppedCamel,
    divergent_values: Object.entries(c.droppedCamel)
        .filter(([, v]) => v.diverge)
        .map(([camel, v]) => ({
          camel, snake: v.snake, camel_value: v.camelValue, snake_value: v.snakeValue,
        })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const includeDivergent = args.includes("--include-divergent");
  // --only <id,id>: restringe o reparo a esses docs (uso: revisão manual resolvida, com --include-divergent).
  const onlyIdx = args.indexOf("--only");
  const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(",").map((x) => x.trim()).filter(Boolean)) : null;
  // --backup-out <arquivo>: grava o estado ANTERIOR (location + fields) dos docs que serão escritos.
  const backupIdx = args.indexOf("--backup-out");
  const backupOut = backupIdx >= 0 ? path.resolve(args[backupIdx + 1]) : null;
  const planIdx = args.indexOf("--plan-out");
  const planOut = planIdx >= 0 ? path.resolve(args[planIdx + 1]) : null;
  const emulator = process.env.FIRESTORE_EMULATOR_HOST ?? null;

  // --all-locations: varre a coleção inteira (locations legadas fora do importador,
  // ex.: owners mock_admin/usuários com chaves camelCase de data-fixes antigos).
  const allLocations = args.includes("--all-locations");
  const snap = allLocations ?
    await db.collection("locations").get() :
    await db.collection("locations")
        .where("external_data.imported_by", "==", IMPORT_LABEL)
        .get();
  console.log(`Projeto: ${PROJECT_ID}${emulator ? ` (EMULADOR ${emulator})` : " (Firestore real)"}. ` +
      `Locations importadas: ${snap.size}. Modo: ${execute ? "EXECUTE" : "DRY-RUN"}`);

  const plan = {
    generated_at: new Date().toISOString(),
    project_id: PROJECT_ID,
    emulator_host: emulator,
    mode: execute ? "execute" : "dry-run",
    write_performed: false,
    target_query: allLocations ? "locations (coleção inteira, --all-locations)" :
      `locations where external_data.imported_by == '${IMPORT_LABEL}'`,
    totals: {
      locations_scanned: snap.size,
      locations_to_fix: 0,
      locations_already_snake: 0,
      locations_manual_review: 0,
      fields_scanned: 0,
      fields_to_fix: 0,
      divergent_value_keys: 0,
    },
    locations_to_fix: [] as unknown[],
    locations_untouched: [] as unknown[],
    locations_manual_review: [] as unknown[],
  };

  const writes: Array<{ref: admin.firestore.DocumentReference; update: Record<string, unknown>}> = [];

  for (const doc of snap.docs) {
    if (only && !only.has(doc.id)) continue;
    const data = doc.data();
    const conv = convert(data);
    const fields = await doc.ref.collection("fields").get();
    plan.totals.fields_scanned += fields.size;
    const fieldPlans: unknown[] = [];
    const fieldWrites: Array<{ref: admin.firestore.DocumentReference; update: Record<string, unknown>}> = [];
    const needsReview = (c: Conversion) =>
      Object.values(c.droppedCamel).some((v) => v.diverge && !v.derivedByFunctions);
    let divergent = needsReview(conv);
    for (const f of fields.docs) {
      const fc = convert(f.data());
      if (!hasChanges(fc)) continue;
      if (needsReview(fc)) divergent = true;
      fieldPlans.push({field_id: f.id, ...flatPlan(fc)});
      fieldWrites.push({ref: f.ref, update: fc.update});
    }
    const header = {
      id: doc.id,
      name: data.name ?? null,
      city: data.city ?? null,
      owner: data.owner_id ?? data.ownerId ?? null,
      publication_status: data.publication_status ?? data.publicationStatus ?? null,
      is_verified: data.is_verified ?? data.isVerified ?? null,
    };
    if (!hasChanges(conv) && fieldWrites.length === 0) {
      plan.totals.locations_already_snake += 1;
      plan.locations_untouched.push({
        ...header,
        reason: "já em snake_case — não será tocado (status/verificação preservados)",
        fields_to_fix: fieldPlans,
      });
      console.log(`  = ${header.name} (já snake_case; status=${header.publication_status})`);
      continue;
    }
    plan.totals.divergent_value_keys +=
      Object.values(conv.droppedCamel).filter((v) => v.diverge).length;
    if (divergent && !includeDivergent) {
      plan.totals.locations_manual_review += 1;
      plan.locations_manual_review.push({
        ...header,
        reason: "chaves camelCase com valor divergente do snake_case existente — " +
          "revisão humana antes de remover (use --include-divergent)",
        ...flatPlan(conv),
        fields: fieldPlans,
      });
      console.log(`  ! ${header.name}: valores divergentes — REVISÃO MANUAL (não será escrito)`);
      continue;
    }
    plan.totals.locations_to_fix += 1;
    plan.totals.fields_to_fix += fieldWrites.length;
    plan.locations_to_fix.push({...header, ...flatPlan(conv), fields: fieldPlans});
    writes.push(...fieldWrites);
    console.log(`  ~ ${header.name}: renomeia ${Object.keys(conv.renamed).join(",") || "-"}; ` +
        `remove camel mantendo snake ${Object.keys(conv.droppedCamel).join(",") || "-"}`);
    if (hasChanges(conv)) writes.push({ref: doc.ref, update: conv.update});
  }

  if (backupOut && writes.length > 0) {
    const backup: Array<{path: string; data: unknown}> = [];
    for (const w of writes) {
      const before = await w.ref.get();
      backup.push({path: w.ref.path, data: JSON.parse(JSON.stringify(before.data() ?? null))});
    }
    fs.mkdirSync(path.dirname(backupOut), {recursive: true});
    fs.writeFileSync(backupOut, JSON.stringify({
      generated_at: new Date().toISOString(), project_id: PROJECT_ID, docs: backup,
    }, null, 2));
    console.log(`Backup de ${backup.length} documento(s) em ${backupOut}`);
  }

  if (execute) {
    let batch = db.batch();
    let ops = 0;
    for (const w of writes) {
      batch.update(w.ref, w.update as admin.firestore.UpdateData<Data>);
      ops += 1;
      if (ops >= 400) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
    plan.write_performed = writes.length > 0;
    console.log(`✓ ${writes.length} documento(s) atualizado(s).`);
  } else {
    console.log(`DRY-RUN: nada escrito (${writes.length} documento(s) seriam atualizados). ` +
        "Rode com --execute para aplicar.");
  }
  console.log(`Totais: ${JSON.stringify(plan.totals)}`);

  if (planOut) {
    fs.mkdirSync(path.dirname(planOut), {recursive: true});
    fs.writeFileSync(planOut, JSON.stringify(plan, null, 2) + "\n", "utf8");
    console.log(`Plano salvo em ${planOut}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ Falha fatal:", err);
  process.exit(1);
});
