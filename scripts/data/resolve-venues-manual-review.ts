/* eslint-disable require-jsdoc */
/**
 * Resolução com fonte dos 2 docs da RMC em revisão manual (#4195, R9).
 *
 * O repair snake_case (repair-venues-snake-case.ts) isolou 4 locations cujo camelCase divergia do
 * snake_case. Para as 2 da RMC (Camisa 9 e Cancha do Corinthians) a divergência é decidida pela fonte:
 *  - Camisa 9: o site oficial (WebQuadras) publica segunda a sábado 9h-23h30 e 3 society cobertas + 1 campo
 *    de grama — igual ao snake_case (09:00-23:30, dias 1-6); o camelCase (08:00-23:00) estava errado.
 *    Os 2 field docs genéricos (OUTROS) ganham o tipo da fonte (SOCIETY / CAMPO).
 *  - Cancha do Corinthians: a ficha do Maps está ativa (sem 'fechado'); o horário já era igual nas duas chaves.
 *  - is_active e publication_status NÃO mudam (SUSPENDED continua; reativação passa pelo fluxo de revisão).
 * A fonte e o status operacional são registrados em external_data. Dry-run por padrão; --execute grava.
 *
 * Uso: NODE_PATH=functions/node_modules npx tsx scripts/data/resolve-venues-manual-review.ts [--execute]
 */
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

const PROJECT_ID = process.env.VENUES_PROJECT_ID ?? "futebadosparcas";
if (!admin.apps.length) admin.initializeApp({projectId: PROJECT_ID});
const db = admin.firestore();

interface Resolution {
  id: string;
  name: string;
  expect: {opening_time: string; closing_time: string};
  source: {url: string; dado: string};
  fieldTypes?: Record<string, "SOCIETY" | "CAMPO">;
}

const RESOLUTIONS: Resolution[] = [
  {
    id: "gfkNKZgYq78GjbrZObSd",
    name: "Camisa 9 Futebol e Diversão",
    expect: {opening_time: "09:00", closing_time: "23:30"},
    source: {
      url: "https://camisa9.webquadras.com.br/",
      dado: "site oficial (consultado em 08/10/2026): aberto de segunda a sábado, das 9h às 23h30; 3 quadras de futebol society sintético (cobertas) + 1 quadra de futebol de campo em grama (descoberta); Av. Ayrton Senna da Silva, 2700",
    },
    fieldTypes: {"Quadra 3": "SOCIETY", "Quadra 4": "CAMPO"},
  },
  {
    id: "F3pHv28Zo9fA2JPSytB5",
    name: "Cancha do Corinthians",
    expect: {opening_time: "08:00", closing_time: "23:00"},
    source: {
      url: "https://www.google.com/maps/search/Cancha+do+Corinthians+Rua+Henrique+Coelho+Neto+Pinhais",
      dado: "ficha do Google Maps (consultada em 08/10/2026): 'Cancha do Corinthians - Campo', R. Henrique Coelho Neto, 534, Vargem Grande, Pinhais, sem marcação de fechado",
    },
  },
];

async function main() {
  const execute = process.argv.includes("--execute");
  console.log(`Resolução de revisão manual (RMC) — ${execute ? "EXECUTE" : "DRY-RUN"}`);
  for (const r of RESOLUTIONS) {
    const ref = db.collection("locations").doc(r.id);
    const snap = await ref.get();
    if (!snap.exists) { console.error(`  ✗ ${r.name}: doc ${r.id} não existe`); continue; }
    const d = snap.data() as FirebaseFirestore.DocumentData;
    if (d.opening_time !== r.expect.opening_time || d.closing_time !== r.expect.closing_time) {
      console.error(`  ✗ ${r.name}: snake_case ${d.opening_time}-${d.closing_time} diverge da fonte ` +
        `${r.expect.opening_time}-${r.expect.closing_time} — nada alterado`);
      continue;
    }
    const ext = (d.external_data ?? {}) as Record<string, unknown>;
    const sources = Array.isArray(ext.sources) ? (ext.sources as Array<{url: string}>) : [];
    const update: Record<string, unknown> = {
      "external_data.operational_status": "em_operacao",
      "external_data.manual_review_resolved": {at: new Date().toISOString(), by: "venue-dataset-import", rodada: "R9"},
      "updated_at": FieldValue.serverTimestamp(),
      "updated_by": "venue-dataset-import",
    };
    if (!sources.some((s) => s.url === r.source.url)) {
      update["external_data.sources"] = [...sources, r.source];
    }
    console.log(`  ~ ${r.name}: horário snake_case confirmado pela fonte (${d.opening_time}-${d.closing_time}); ` +
      `status=${d.publication_status} is_active=${d.is_active} mantidos`);
    const fieldUpdates: Array<{ref: FirebaseFirestore.DocumentReference; type: string; name: string}> = [];
    if (r.fieldTypes) {
      const fs = await ref.collection("fields").get();
      for (const f of fs.docs) {
        const want = r.fieldTypes[f.get("name") as string];
        if (want && f.get("type") === "OUTROS") fieldUpdates.push({ref: f.ref, type: want, name: f.get("name")});
      }
      for (const u of fieldUpdates) console.log(`    quadra "${u.name}": OUTROS -> ${u.type}`);
    }
    if (execute) {
      const batch = db.batch();
      batch.update(ref, update);
      for (const u of fieldUpdates) batch.update(u.ref, {type: u.type, updated_at: FieldValue.serverTimestamp()});
      await batch.commit();
      console.log("    ✓ gravado");
    }
  }
}

main().catch((e) => { console.error("✗ Falha fatal:", e); process.exit(1); });
