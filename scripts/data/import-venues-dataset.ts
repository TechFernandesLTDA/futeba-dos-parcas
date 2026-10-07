/* eslint-disable require-jsdoc */
/**
 * Importação de venues de dataset curado (quadras de Curitiba).
 *
 * Lê um dataset JSON pesquisado na web (com fontes) e o aplica no Firestore:
 * - DRY-RUN é o padrão: imprime o plano (create/patch/skip/manualReview) e não escreve nada.
 * - Venue novo entra SEMPRE como publication_status DRAFT, isVerified=false,
 *   sem rating do app (dados externos ficam em `external_data`, isolados das
 *   avaliações reais dos usuários).
 * - Venue existente é apenas ENRIQUECIDO: campos vazios/ausentes recebem dados;
 *   nada existente é sobrescrito. Conflitos vão para manualReview.
 * - ownerId é obrigatório no --execute (documento Location exige owner).
 *
 * Usage:
 *   cd functions
 *   npx ts-node ../scripts/data/import-venues-dataset.ts
 *   npx ts-node ../scripts/data/import-venues-dataset.ts --execute --owner-uid <uid>
 *   # dataset alternativo:
 *   npx ts-node ../scripts/data/import-venues-dataset.ts --dataset <caminho>
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";

if (!admin.apps.length) {
  // --cli-credential: autentica com a sessão do firebase CLI do usuário
  // (refresh_token de ~/.config/configstore/firebase-tools.json + o client
  // OAuth público do próprio firebase-tools). Escreve com a identidade do
  // usuário logado — sem service account nova e sem segredos no repo.
  const args0 = process.argv.slice(2);
  if (args0.includes("--cli-credential")) {
    const cfgPath = path.join(os.homedir(), ".config", "configstore", "firebase-tools.json");
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    const refreshToken = cfg.tokens?.refresh_token;
    if (!refreshToken) {
      console.error("✗ --cli-credential: sem refresh_token em " + cfgPath +
          ". Rode `firebase login` primeiro.");
      process.exit(1);
    }
    admin.initializeApp({
      projectId: "futebadosparcas",
      credential: admin.credential.refreshToken({
        type: "authorized_user",
        client_id: "564921029129-p4j63bjwvusvcq5nrpe7j4o85gctione.apps.googleusercontent.com",
        client_secret: "YSo5NnkNIfoS4bf3FTo5Fop-",
        refresh_token: refreshToken,
      }),
    });
  } else {
    // Sem --cli-credential: usa ADC (gcloud auth application-default login)
    // com o projectId explícito do projeto do app.
    admin.initializeApp({projectId: "futebadosparcas"});
  }
}

const db = admin.firestore();
const SOURCE_LABEL = "venue-dataset-import";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const MAX_BATCH_OPS = 400;

const FIELD_TYPES = ["SOCIETY", "FUTSAL", "CAMPO", "AREIA", "OUTROS"] as const;
type FieldType = (typeof FIELD_TYPES)[number];

interface VenueComment {
  autor: string | null;
  data: string | null;
  texto: string;
  fonte_url: string | null;
}

interface VenueSource {
  url: string;
  dado: string | null;
}

interface VenueDataset {
  nome: string;
  endereco?: {
    rua?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
  };
  telefone?: string | null;
  whatsapp?: string | null;
  site?: string | null;
  instagram?: string | null;
  preco_hora?: string | number | null;
  qtd_quadras?: number | null;
  detalhe_quadras?: string | null;
  tipo_piso?: string | null;
  horarios?: Record<string, string> | null;
  nota_media?: number | null;
  contagem_avaliacoes?: number | null;
  comentarios?: VenueComment[];
  fotos?: string[];
  fontes?: VenueSource[];
  confidence?: string | null;
}

interface ParsedHours {
  openingTime: string;
  closingTime: string;
  operatingDays: number[];
}

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function normalizeName(value: string): string {
  return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
}

function parseHour(value: string, fallback: string): string {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : fallback;
}

/** Mapeia horários por dia da semana (pt-BR) para o schema Location. */
function parseHours(horarios: Record<string, string> | null | undefined): ParsedHours | null {
  if (!horarios || typeof horarios !== "object") return null;
  const dayIndex: Record<string, number> = {
    domingo: 0, segunda: 1, terca: 2, terça: 2, quarta: 3,
    quinta: 4, sexta: 5, sabado: 6, sábado: 6,
  };
  const days: number[] = [];
  let minOpen = "23:59";
  let maxClose = "00:00";
  let found = false;
  for (const [key, range] of Object.entries(horarios)) {
    const idx = dayIndex[key.trim().toLowerCase()];
    if (idx === undefined || typeof range !== "string") continue;
    const [openRaw, closeRaw] = range.split("-");
    if (!openRaw || !closeRaw) continue;
    const open = parseHour(openRaw, "00:00");
    const close = parseHour(closeRaw, "23:59");
    days.push(idx);
    found = true;
    // Quadra que fecha depois da meia-noite: conta como "abre mais cedo".
    if (open < minOpen) minOpen = open;
    if (close > maxClose) maxClose = close;
  }
  if (!found) return null;
  return {openingTime: minOpen, closingTime: maxClose, operatingDays: days.sort()};
}

/** Extrai contagem de quadras por tipo de "4 futsal + 4 society, ...". */
function parseFieldBreakdown(
    detalhe: string | null | undefined,
    tipoPiso: string | null | undefined,
): Array<{type: FieldType; count: number}> | null {
  const text = `${detalhe ?? ""} ${tipoPiso ?? ""}`.toLowerCase();
  if (!text.trim()) return null;
  const out: Array<{type: FieldType; count: number}> = [];
  const patterns: Array<[RegExp, FieldType]> = [
    [/(^|[^a-z])(\d{1,2})\s*(quadras?\s*)?(de\s*)?(society|societ[y7])/g, "SOCIETY"],
    [/(^|[^a-z])(\d{1,2})\s*(quadras?\s*)?(de\s*)?futsal/g, "FUTSAL"],
    [/(^|[^a-z])(\d{1,2})\s*(quadras?\s*)?(de\s*)?campo/g, "CAMPO"],
    [/(^|[^a-z])(\d{1,2})\s*(quadras?\s*)?(de\s*)?(areia|beach)/g, "AREIA"],
  ];
  for (const [regex, type] of patterns) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const count = Number(m[2]);
      if (Number.isInteger(count) && count > 0) out.push({type, count});
    }
  }
  return out.length > 0 ? out : null;
}

function priceToCents(preco: string | number | null | undefined): number | null {
  if (preco == null) return null;
  if (typeof preco === "number" && Number.isFinite(preco) && preco > 0) {
    return Math.round(preco * 100);
  }
  const m = String(preco).replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const value = Number(m[1]);
  return value > 0 ? Math.round(value * 100) : null;
}

function buildFieldPlan(
    venue: VenueDataset,
): {fields: Array<{type: FieldType; priceCents: number | null}>; notes: string[]} {
  const notes: string[] = [];
  const fields: Array<{type: FieldType; priceCents: number | null}> = [];
  const breakdown = parseFieldBreakdown(venue.detalhe_quadras, venue.tipo_piso);
  const priceCents = priceToCents(venue.preco_hora);

  if (breakdown) {
    for (const part of breakdown) {
      for (let i = 0; i < part.count; i++) {
        fields.push({type: part.type, priceCents});
      }
    }
    const declared = venue.qtd_quadras ?? null;
    if (declared != null && declared !== fields.length) {
      notes.push(
          `qtd_quadras (${declared}) diverge do detalhe parseado (${fields.length}); ` +
          `prevalece o detalhe por tipo`,
      );
    }
    return {fields, notes};
  }

  const qtd = venue.qtd_quadras ?? null;
  if (qtd != null && Number.isInteger(qtd) && qtd > 0) {
    for (let i = 0; i < qtd; i++) {
      fields.push({type: "OUTROS", priceCents});
    }
    notes.push(`${qtd} quadra(s) criadas como OUTROS — tipo exato não parseado de detalhe_quadras`);
    return {fields, notes};
  }

  notes.push("sem qtd_quadras nem detalhe parseável — nenhuma quadra criada");
  return {fields, notes};
}

async function loadExistingLocations(): Promise<Map<string, FirebaseFirestore.QueryDocumentSnapshot>> {
  const byKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  // Varredura por cidade curada (dataset atual é Curitiba).
  const snap = await db.collection("locations")
      .where("city", "==", "Curitiba")
      .get();
  for (const doc of snap.docs) {
    const name = doc.get("name");
    if (typeof name === "string" && name.trim()) {
      byKey.set(normalizeName(name), doc);
    }
  }
  return byKey;
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// ---------------------------------------------------------------------------
// Plano de importação
// ---------------------------------------------------------------------------

interface VenuePlan {
  venue: VenueDataset;
  action: "create" | "patch" | "skip";
  locationId?: string;
  createData?: FirebaseFirestore.UpdateData;
  patchData?: FirebaseFirestore.UpdateData;
  fieldsToCreate: Array<{type: FieldType; priceCents: number | null}>;
  manualReview: string[];
}

function buildCreateData(
    venue: VenueDataset,
    ownerUid: string,
    manualReview: string[],
): FirebaseFirestore.UpdateData {
  const end = venue.endereco ?? {};
  const street = end.rua?.trim() ?? null;
  const number = end.numero?.trim() ?? null;
  const district = end.bairro?.trim() ?? null;
  const city = end.cidade?.trim() ?? "Curitiba";
  const state = end.uf?.trim() ?? "PR";
  const hours = parseHours(venue.horarios);
  const {fields} = buildFieldPlan(venue);

  if (!street) manualReview.push("endereço sem rua");
  if (!district) manualReview.push("endereço sem bairro");
  if (!hours) manualReview.push("sem horários parseáveis");
  if (fields.length === 0) manualReview.push("nenhuma quadra identificada");

  const addressParts = [
    [street, number].filter(Boolean).join(", "),
    district,
    `${city} - ${state}`,
  ].filter(Boolean);

  const data: FirebaseFirestore.UpdateData = {
    name: venue.nome.trim(),
    address: addressParts.join(" - "),
    cep: "",
    street: street ?? "",
    number: number ?? "",
    complement: "",
    district: district ?? "",
    city,
    state,
    country: "Brasil",
    neighborhood: district ?? "",
    region: "",
    ownerId: ownerUid,
    managers: [],
    isVerified: false,
    isActive: true,
    publicationStatus: "DRAFT",
    rating: 0,
    ratingCount: 0,
    description: `${venue.nome} — quadra${(venue.qtd_quadras ?? 1) > 1 ? "s" : ""} de futebol em ${district ?? city}.`,
    photoUrl: venue.fotos?.[0] ?? null,
    photos: venue.fotos ?? [],
    amenities: [],
    phone: venue.telefone?.trim() ?? null,
    whatsapp: venue.whatsapp?.trim() ?? null,
    website: venue.site?.trim() ?? null,
    instagram: venue.instagram?.trim() ?? null,
    timeZone: DEFAULT_TIMEZONE,
    openingTime: hours?.openingTime ?? "08:00",
    closingTime: hours?.closingTime ?? "23:59",
    operatingDays: hours?.operatingDays ?? [1, 2, 3, 4, 5, 6, 0],
    minGameDurationMinutes: 60,
    fieldCount: fields.length,
    hasActiveFields: fields.length > 0,
    external_data: {
      rating: venue.nota_media ?? null,
      rating_count: venue.contagem_avaliacoes ?? null,
      confidence: venue.confidence ?? null,
      tipo_piso: venue.tipo_piso ?? null,
      detalhe_quadras: venue.detalhe_quadras ?? null,
      comments: (venue.comentarios ?? []).slice(0, 3).map((c) => ({
        autor: c.autor ?? null,
        data: c.data ?? null,
        texto: c.texto,
        fonte_url: c.fonte_url ?? null,
      })),
      sources: venue.fontes ?? [],
      imported_at: new Date().toISOString(),
      imported_by: SOURCE_LABEL,
    },
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    updated_by: SOURCE_LABEL,
  };
  return data;
}

function buildPatchData(
    venue: VenueDataset,
    existing: FirebaseFirestore.DocumentSnapshot,
    manualReview: string[],
): FirebaseFirestore.UpdateData {
  const data = existing.data() as Data;
  const patch: FirebaseFirestore.UpdateData = {};
  const end = venue.endereco ?? {};

  const fills: Array<[string, unknown]> = [
    ["street", end.rua?.trim() ?? null],
    ["number", end.numero?.trim() ?? null],
    ["neighborhood", end.bairro?.trim() ?? null],
    ["district", end.bairro?.trim() ?? null],
    ["city", end.cidade?.trim() ?? null],
    ["state", end.uf?.trim() ?? null],
    ["phone", venue.telefone?.trim() ?? null],
    ["whatsapp", venue.whatsapp?.trim() ?? null],
    ["website", venue.site?.trim() ?? null],
    ["instagram", venue.instagram?.trim() ?? null],
    ["photoUrl", venue.fotos?.[0] ?? null],
    ["photos", (venue.fotos ?? []).length > 0 ? venue.fotos : null],
  ];
  for (const [key, value] of fills) {
    if (value != null && isBlank(data[key])) patch[key] = value;
  }

  const hours = parseHours(venue.horarios);
  if (hours) {
    if (isBlank(data.openingTime)) patch.openingTime = hours.openingTime;
    if (isBlank(data.closingTime)) patch.closingTime = hours.closingTime;
    if (isBlank(data.operatingDays)) patch.operatingDays = hours.operatingDays;
  }

  // Enriquecimento com dados externos nunca sobrescreve o que existe.
  const external: Data = {
    rating: venue.nota_media ?? null,
    rating_count: venue.contagem_avaliacoes ?? null,
    confidence: venue.confidence ?? null,
    tipo_piso: venue.tipo_piso ?? null,
    detalhe_quadras: venue.detalhe_quadras ?? null,
    comments: (venue.comentarios ?? []).slice(0, 3).map((c) => ({
      autor: c.autor ?? null,
      data: c.data ?? null,
      texto: c.texto,
      fonte_url: c.fonte_url ?? null,
    })),
    sources: venue.fontes ?? [],
    imported_at: new Date().toISOString(),
    imported_by: SOURCE_LABEL,
  };
  patch.external_data = {
    ...(data.external_data ?? {}),
    ...external,
  };
  patch.updated_at = FieldValue.serverTimestamp();
  patch.updated_by = SOURCE_LABEL;

  if (!isBlank(data.rating) || !isBlank(data.ratingCount)) {
    manualReview.push(
        "venue já tem rating do app — nota externa registrada apenas em external_data",
    );
  }
  return patch;
}

type Data = FirebaseFirestore.DocumentData;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const datasetIdx = args.indexOf("--dataset");
  const datasetPath = path.resolve(
      datasetIdx >= 0 ? args[datasetIdx + 1] : path.join(__dirname, "venues-curitiba.json"),
  );
  const ownerIdx = args.indexOf("--owner-uid");
  const ownerUid = ownerIdx >= 0 ? args[ownerIdx + 1] : null;

  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as {venues: VenueDataset[]};
  const venues = dataset.venues ?? [];
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : venues.length;
  const sliced = venues.slice(0, Number.isInteger(limit) && limit > 0 ? limit : venues.length);
  console.log(`Dataset: ${datasetPath} — ${sliced.length}/${venues.length} venue(s). Modo: ${execute ? "EXECUTE" : "DRY-RUN (nada é escrito)"}`);

  if (execute && !ownerUid) {
    console.error("✗ --execute exige --owner-uid (Location exige ownerId). Abortado.");
    process.exit(1);
  }

  let existing: Map<string, FirebaseFirestore.QueryDocumentSnapshot>;
  try {
    existing = await loadExistingLocations();
    console.log(`Locations existentes em Curitiba: ${existing.size}`);
  } catch (err) {
    if (execute) {
      console.error("✗ --execute exige acesso ao Firestore com credenciais válidas. Abortado.");
      process.exit(1);
    }
    existing = new Map();
    console.log("⚠ Sem acesso ao Firestore (sem credenciais/project) — dry-run assume " +
        "que nenhum venue existe (todos entram como create). Use credenciais reais " +
        "(GOOGLE_APPLICATION_CREDENTIALS) para um plano com dedup contra produção.");
  }

  const stats = {create: 0, patch: 0, skip: 0, fields: 0, manualReview: 0, errors: 0};
  const plans: VenuePlan[] = [];

  for (const venue of sliced) {
    try {
      if (!venue.nome?.trim()) {
        stats.skip += 1;
        continue;
      }
      const key = normalizeName(venue.nome);
      const match = existing.get(key);
      const manualReview: string[] = [];
      if (match) {
        const patchData = buildPatchData(venue, match, manualReview);
        plans.push({
          venue, action: "patch", locationId: match.id,
          patchData, fieldsToCreate: [], manualReview,
        });
        stats.patch += 1;
      } else {
        const createData = buildCreateData(venue, ownerUid ?? "", manualReview);
        const {fields, notes} = buildFieldPlan(venue);
        plans.push({
          venue, action: "create", createData, fieldsToCreate: fields,
          manualReview: [...manualReview, ...notes],
        });
        stats.create += 1;
        stats.fields += fields.length;
      }
      if (manualReview.length > 0) stats.manualReview += 1;
    } catch (err) {
      stats.errors += 1;
      console.error(`  ✗ erro planejando "${venue.nome}": ${(err as Error).message}`);
    }
  }

  console.log(`Plano: ${stats.create} criar, ${stats.patch} enriquecer, ` +
      `${stats.skip} pular, ${stats.fields} quadra(s) nova(s), ` +
      `${stats.manualReview} com revisão manual, ${stats.errors} erro(s)`);

  for (const plan of plans) {
    const flag = plan.action === "create" ? "+" : (plan.action === "patch" ? "~" : "-");
    console.log(` ${flag} ${plan.venue.nome}${plan.locationId ? ` (id=${plan.locationId})` : ""}`);
    for (const note of plan.manualReview) console.log(`    ⚠ ${note}`);
  }

  if (!execute) {
    console.log("\nDRY-RUN: nada foi escrito. Para aplicar: --execute --owner-uid <uid>");
    return;
  }

  let batch = db.batch();
  let ops = 0;
  let committed = 0;

  const commitBatch = async () => {
    if (ops === 0) return;
    await batch.commit();
    committed += ops;
    batch = db.batch();
    ops = 0;
  };

  for (const plan of plans) {
    try {
      if (plan.action === "create" && plan.createData) {
        const locRef = db.collection("locations").doc();
        batch.set(locRef, plan.createData);
        ops += 1;
        for (let i = 0; i < plan.fieldsToCreate.length; i++) {
          const f = plan.fieldsToCreate[i];
          batch.set(locRef.collection("fields").doc(), {
            name: `Quadra ${i + 1}`,
            type: f.type,
            description: null,
            photoUrl: null,
            isActive: true,
            hourlyPrice: f.priceCents ? f.priceCents / 100 : 0,
            photos: [],
            managers: [],
            isCovered: false,
            playersPerTeam: null,
            minBookingMinutes: 60,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });
          ops += 1;
        }
        if (ops >= MAX_BATCH_OPS) await commitBatch();
      } else if (plan.action === "patch" && plan.locationId && plan.patchData) {
        batch.update(db.collection("locations").doc(plan.locationId), plan.patchData);
        ops += 1;
        if (ops >= MAX_BATCH_OPS) await commitBatch();
      }
    } catch (err) {
      stats.errors += 1;
      console.error(`  ✗ erro gravando "${plan.venue.nome}": ${(err as Error).message}`);
    }
  }
  await commitBatch();

  console.log(`\n✓ Aplicado: ${committed} operação(ões) gravadas, ${stats.errors} erro(s).`);
  console.log("  Todos os venues novos ficam em DRAFT — publicação comercial passa pelo");
  console.log("  fluxo de revisão (setLocationPublicationStatus) com autorização do dono.");
}

main().catch((err) => {
  console.error("✗ Falha fatal:", err);
  process.exit(1);
});