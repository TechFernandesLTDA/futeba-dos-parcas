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

// VENUES_PROJECT_ID permite apontar para o emulador (projeto demo-*) nos testes.
const PROJECT_ID = process.env.VENUES_PROJECT_ID ?? "futebadosparcas";

if (!admin.apps.length) {
  // --cli-credential: autentica com a sessão do firebase CLI do usuário
  // (refresh_token de ~/.config/configstore/firebase-tools.json + o client
  // OAuth vindo de GOOGLE_OAUTH_CLIENT_ID/_SECRET, nunca escrito no código).
  // Escreve com a identidade do usuário logado — sem service account nova e sem segredos no repo.
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
    // O client OAuth NÃO fica no repo (issue #4343): informe o par usado pelo
    // login do firebase-tools via variáveis de ambiente.
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("✗ --cli-credential exige GOOGLE_OAUTH_CLIENT_ID e " +
          "GOOGLE_OAUTH_CLIENT_SECRET no ambiente (o client OAuth do firebase-tools " +
          "não é versionado). Alternativa: omita --cli-credential e use ADC " +
          "(`gcloud auth application-default login`).");
      process.exit(1);
    }
    admin.initializeApp({
      projectId: PROJECT_ID,
      credential: admin.credential.refreshToken({
        type: "authorized_user",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });
  } else {
    // Sem --cli-credential: usa ADC (gcloud auth application-default login)
    // com o projectId explícito do projeto do app.
    admin.initializeApp({projectId: PROJECT_ID});
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
    cep?: string | null;
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
  /** Coordenadas verificáveis (geocoding/OSM). Ausente/null = não gravar. */
  coordenadas?: {lat: number; lon: number} | null;
  /** Finalidade validada na pesquisa (ex.: comercial_aluguel). */
  finalidade?: string | null;
  /** Origem primária do registro (ex.: web, osm). */
  origem?: string | null;
  /** Rodada do epic #4186 em que o registro entrou (R1..R9). */
  rodada_dados?: string | null;
  /** Enriquecimento: id exato da location em produção (evita dedupe por nome). */
  location_id?: string | null;
  /** Situação operacional segundo a fonte (ex.: permanentemente_fechado, temporariamente_fechado). */
  status_operacional?: string | null;
  /** Tabela de preços publicada pela fonte (texto livre; unidade conforme a fonte). */
  precos?: Array<{item: string; valor: string}> | null;
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
  let maxCloseKey = "00:00";
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
    if (open < minOpen) minOpen = open;
    // Fechamento depois da meia-noite (ex.: 08:00-00:30) conta como 24h+: o
    // closing_time gravado é o mais tardio de fato, não o maior string.
    const closeKey = close <= open ? `${24 + Number(close.slice(0, 2))}${close.slice(2)}` : close;
    if (closeKey > maxCloseKey) {
      maxCloseKey = closeKey;
      maxClose = close;
    }
  }
  if (!found) return null;
  return {openingTime: minOpen, closingTime: maxClose, operatingDays: days.sort()};
}

/** Horário padrão do importador (sem fonte): permite sobrescrever com dado sourced. */
function hasImporterDefaultHours(data: FirebaseFirestore.DocumentData): boolean {
  const days = Array.isArray(data.operating_days) ? [...data.operating_days].sort().join(",") : "";
  return data.opening_time === "08:00" && data.closing_time === "23:59" &&
    days === "0,1,2,3,4,5,6" && data.external_data?.imported_by === SOURCE_LABEL;
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

/**
 * Carrega as locations existentes das cidades presentes no dataset.
 * A chave é `cidade::nomeNormalizado` — dedupe multi-cidade (RMC/R4-R8) sem
 * colidir venues de cidades diferentes que compartilham nome.
 */
async function loadExistingLocations(
    cities: string[],
): Promise<Map<string, FirebaseFirestore.QueryDocumentSnapshot>> {
  const byKey = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const city of cities) {
    const snap = await db.collection("locations")
        .where("city", "==", city)
        .get();
    for (const doc of snap.docs) {
      const name = doc.get("name");
      if (typeof name === "string" && name.trim()) {
        byKey.set(`${city}::${normalizeName(name)}`, doc);
      }
      // Índice secundário por endereço (rua + número) — evita duplicar venues
      // já existentes com nome ligeiramente diferente.
      const addr = addressKey(city, doc.get("street"), doc.get("number"));
      if (addr && !byKey.has(addr)) byKey.set(addr, doc);
    }
  }
  return byKey;
}

/** Chave de endereço `addr::cidade::rua|numero` (null se faltar rua ou número). */
function addressKey(city: string, street: unknown, number: unknown): string | null {
  if (typeof street !== "string" || typeof number !== "string") return null;
  const st = normalizeName(street.replace(/^(r|rua|av|avenida|al|alameda|rod|rodovia|tv|travessa|estrada)\.?\s+/i, ""));
  const nu = number.trim().toLowerCase();
  if (!st || !nu) return null;
  return `addr::${city}::${st}|${nu}`;
}

/**
 * Procura location existente: 1) cidade+nome exato; 2) cidade+rua+número;
 * 3) mesmo município e um nome contido no outro (menor com >= 8 caracteres).
 */
function findExisting(
    existing: Map<string, FirebaseFirestore.QueryDocumentSnapshot>,
    venue: VenueDataset,
    city: string,
): {doc: FirebaseFirestore.QueryDocumentSnapshot; by: string} | null {
  const exact = existing.get(`${city}::${normalizeName(venue.nome)}`);
  if (exact) return {doc: exact, by: "nome"};
  const addr = addressKey(city, venue.endereco?.rua, venue.endereco?.numero);
  const byAddr = addr ? existing.get(addr) : undefined;
  if (byAddr) return {doc: byAddr, by: "endereço"};
  const mine = normalizeName(venue.nome);
  for (const [key, doc] of existing) {
    if (!key.startsWith(`${city}::`)) continue;
    const other = key.slice(city.length + 2);
    const [short, long] = mine.length <= other.length ? [mine, other] : [other, mine];
    if (short.length >= 8 && (long === short || long.startsWith(`${short} `))) {
      return {doc, by: "nome parecido"};
    }
  }
  return null;
}

/** Cidade de um venue do dataset (fallback: cidade do dataset / Curitiba). */
function cityOf(venue: VenueDataset, datasetCity?: string): string {
  return venue.endereco?.cidade?.trim() || datasetCity || "Curitiba";
}

function validCoord(
    value: unknown,
): value is {lat: number; lon: number} {
  if (!value || typeof value !== "object") return false;
  const c = value as {lat?: unknown; lon?: unknown};
  return typeof c.lat === "number" && Number.isFinite(c.lat)
    && typeof c.lon === "number" && Number.isFinite(c.lon)
    && Math.abs(c.lat) <= 90 && Math.abs(c.lon) <= 180;
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
  /** Patch: quantas quadras já existiam sob a location. */
  existingFieldCount?: number;
  manualReview: string[];
}

function buildCreateData(
    venue: VenueDataset,
    ownerUid: string,
    manualReview: string[],
    datasetCity?: string,
): FirebaseFirestore.UpdateData {
  const end = venue.endereco ?? {};
  const street = end.rua?.trim() ?? null;
  const number = end.numero?.trim() ?? null;
  const district = end.bairro?.trim() ?? null;
  const city = end.cidade?.trim() || datasetCity || "Curitiba";
  const state = end.uf?.trim() || "PR";
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
    cep: end.cep?.trim() ?? "",
    street: street ?? "",
    number: number ?? "",
    complement: "",
    district: district ?? "",
    city,
    state,
    country: "Brasil",
    neighborhood: district ?? "",
    region: "",
    owner_id: ownerUid,
    managers: [],
    is_verified: false,
    is_active: true,
    publication_status: "DRAFT",
    rating: 0,
    rating_count: 0,
    description: `${venue.nome} — quadra${(venue.qtd_quadras ?? 1) > 1 ? "s" : ""} de futebol em ${district ?? city}.`,
    photo_url: venue.fotos?.[0] ?? null,
    photos: venue.fotos ?? [],
    amenities: [],
    phone: venue.telefone?.trim() ?? null,
    whatsapp: venue.whatsapp?.trim() ?? null,
    website: venue.site?.trim() ?? null,
    instagram: venue.instagram?.trim() ?? null,
    time_zone: DEFAULT_TIMEZONE,
    opening_time: hours?.openingTime ?? "08:00",
    closing_time: hours?.closingTime ?? "23:59",
    operating_days: hours?.operatingDays ?? [1, 2, 3, 4, 5, 6, 0],
    min_game_duration_minutes: 60,
    field_count: fields.length,
    has_active_fields: fields.length > 0,
    external_data: {
      rating: venue.nota_media ?? null,
      rating_count: venue.contagem_avaliacoes ?? null,
      confidence: venue.confidence ?? null,
      finalidade: venue.finalidade ?? null,
      origem: venue.origem ?? null,
      tipo_piso: venue.tipo_piso ?? null,
      detalhe_quadras: venue.detalhe_quadras ?? null,
      rodada_dados: venue.rodada_dados ?? null,
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
  if (validCoord(venue.coordenadas)) {
    data.latitude = venue.coordenadas.lat;
    data.longitude = venue.coordenadas.lon;
  }
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
    ["cep", end.cep?.trim() ?? null],
    ["phone", venue.telefone?.trim() ?? null],
    ["whatsapp", venue.whatsapp?.trim() ?? null],
    ["website", venue.site?.trim() ?? null],
    ["instagram", venue.instagram?.trim() ?? null],
    ["photo_url", venue.fotos?.[0] ?? null],
    ["photos", (venue.fotos ?? []).length > 0 ? venue.fotos : null],
  ];
  for (const [key, value] of fills) {
    if (value != null && isBlank(data[key])) patch[key] = value;
  }
  // Coordenadas verificáveis só preenchem o que está vazio.
  if (validCoord(venue.coordenadas)) {
    if (isBlank(data.latitude)) patch.latitude = venue.coordenadas.lat;
    if (isBlank(data.longitude)) patch.longitude = venue.coordenadas.lon;
  }

  const hours = parseHours(venue.horarios);
  if (hours) {
    // Venue criado pelo importador sem horário sourced tem o padrão 08:00-23:59 nos 7 dias:
    // esse padrão não é dado existente e pode ser substituído por horário com fonte.
    const defaults = hasImporterDefaultHours(data);
    if (defaults || isBlank(data.opening_time)) patch.opening_time = hours.openingTime;
    if (defaults || isBlank(data.closing_time)) patch.closing_time = hours.closingTime;
    if (defaults || isBlank(data.operating_days)) patch.operating_days = hours.operatingDays;
  }

  // external_data: enriquecimento NÃO destrutivo. Só valores não nulos entram
  // (nada existente vira null) e as fontes são acrescentadas (dedupe por URL).
  const incoming: Data = {
    rating: venue.nota_media ?? null,
    rating_count: venue.contagem_avaliacoes ?? null,
    confidence: venue.confidence ?? null,
    finalidade: venue.finalidade ?? null,
    origem: venue.origem ?? null,
    tipo_piso: venue.tipo_piso ?? null,
    detalhe_quadras: venue.detalhe_quadras ?? null,
    rodada_dados: venue.rodada_dados ?? null,
    operational_status: venue.status_operacional ?? null,
    price_table: venue.precos && venue.precos.length > 0 ? venue.precos : null,
  };
  const prevExternal = (data.external_data ?? {}) as Data;
  const external: Data = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v != null) external[k] = v;
  }
  if ((venue.comentarios ?? []).length > 0) {
    external.comments = (venue.comentarios ?? []).slice(0, 3).map((c) => ({
      autor: c.autor ?? null,
      data: c.data ?? null,
      texto: c.texto,
      fonte_url: c.fonte_url ?? null,
    }));
  }
  const prevSources: VenueSource[] = Array.isArray(prevExternal.sources) ? prevExternal.sources : [];
  const seenUrls = new Set(prevSources.map((s) => s.url));
  external.sources = [...prevSources, ...(venue.fontes ?? []).filter((s) => !seenUrls.has(s.url))];
  external.enriched_at = new Date().toISOString();
  external.enriched_by = SOURCE_LABEL;
  if (!prevExternal.imported_at) {
    external.imported_at = new Date().toISOString();
    external.imported_by = SOURCE_LABEL;
  }
  patch.external_data = {...prevExternal, ...external};
  patch.updated_at = FieldValue.serverTimestamp();
  patch.updated_by = SOURCE_LABEL;

  if (Number(data.rating) > 0 || Number(data.rating_count) > 0) {
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
  // --patch-only (ou "modo": "enriquecimento" no dataset): nunca cria locations;
  // venues sem match viram skip. Rodadas de enriquecimento usam location_id exato.
  const ownerIdx = args.indexOf("--owner-uid");
  const ownerUid = ownerIdx >= 0 ? args[ownerIdx + 1] : null;

  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf8")) as {
    cidade?: string;
    rodada?: number;
    modo?: string;
    venues: VenueDataset[];
  };
  const patchOnly = args.includes("--patch-only") || dataset.modo === "enriquecimento";
  const venues = dataset.venues ?? [];
  const datasetCity = dataset.cidade?.trim() || undefined;
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : venues.length;
  const sliced = venues.slice(0, Number.isInteger(limit) && limit > 0 ? limit : venues.length);
  console.log(`Dataset: ${datasetPath} — ${sliced.length}/${venues.length} venue(s). Modo: ${execute ? "EXECUTE" : "DRY-RUN (nada é escrito)"}`);

  if (execute && !ownerUid) {
    console.error("✗ --execute exige --owner-uid (Location exige ownerId). Abortado.");
    process.exit(1);
  }

  let existing: Map<string, FirebaseFirestore.QueryDocumentSnapshot>;
  // Cidades distintas do dataset: dedupe idempotente multi-cidade.
  const cities = [...new Set(
      venues.map((v) => cityOf(v, datasetCity)).filter(Boolean),
  )];
  try {
    existing = await loadExistingLocations(cities);
    console.log(`Cidades do dataset (${cities.length}): ${cities.join(", ")}`);
    console.log(`Locations existentes nessas cidades: ${new Set([...existing.values()].map((d) => d.id)).size}`);
  } catch (err) {
    console.error(`  (detalhe: ${(err as Error).message})`);
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
      let found = findExisting(existing, venue, cityOf(venue, datasetCity));
      if (venue.location_id) {
        // id exato tem precedência sobre qualquer heurística de nome/endereço.
        const byId = [...existing.values()].find((d) => d.id === venue.location_id);
        if (!byId) {
          console.error(`  ✗ location_id ${venue.location_id} (${venue.nome}) não existe em produção — pulado`);
          stats.skip += 1;
          continue;
        }
        found = {doc: byId, by: "nome"};
      }
      const match = found?.doc;
      const manualReview: string[] = [];
      if (match) {
        const patchData = buildPatchData(venue, match, manualReview);
        if (found && found.by !== "nome") {
          manualReview.push(`venue existente reconhecido por ${found.by} ("${match.get("name")}") — confirmar que é o mesmo local`);
        }
        // Quadras faltantes (qtd/detalhe do dataset menos as já existentes).
        const plannedFields = buildFieldPlan(venue).fields;
        const existingCount = (await match.ref.collection("fields").get()).size;
        const toCreate = plannedFields.slice(existingCount);
        if (toCreate.length > 0) {
          patchData.field_count = existingCount + toCreate.length;
          patchData.has_active_fields = true;
        }
        plans.push({
          venue, action: "patch", locationId: match.id,
          patchData, fieldsToCreate: toCreate, existingFieldCount: existingCount, manualReview,
        });
        stats.patch += 1;
        stats.fields += toCreate.length;
      } else if (patchOnly) {
        console.log(`  - ${venue.nome}: sem location existente (modo patch-only) — pulado`);
        stats.skip += 1;
        continue;
      } else {
        const createData = buildCreateData(venue, ownerUid ?? "", manualReview, datasetCity);
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
    console.log(` ${flag} ${plan.venue.nome}${plan.locationId ? ` (id=${plan.locationId})` : ""}` +
        `${plan.action === "patch" && plan.fieldsToCreate.length > 0 ? ` [+${plan.fieldsToCreate.length} quadra(s)]` : ""}`);
    if (plan.action === "patch" && plan.patchData) {
      const keys = Object.keys(plan.patchData).filter((k) => !["external_data", "updated_at", "updated_by"].includes(k));
      console.log(`    campos preenchidos: ${keys.length > 0 ? keys.join(", ") : "(apenas external_data)"}`);
    }
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
            photo_url: null,
            is_active: true,
            hourly_price: f.priceCents ? f.priceCents / 100 : 0,
            photos: [],
            managers: [],
            is_covered: false,
            players_per_team: null,
            min_booking_minutes: 60,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });
          ops += 1;
        }
        if (ops >= MAX_BATCH_OPS) await commitBatch();
      } else if (plan.action === "patch" && plan.locationId && plan.patchData) {
        const locRef = db.collection("locations").doc(plan.locationId);
        batch.update(locRef, plan.patchData);
        ops += 1;
        // Enriquecimento de quadras: cria as que o detalhe/qtd do dataset indicam
        // e que ainda não existem (field_count/has_active_fields já vão no patch).
        const existingCount = plan.existingFieldCount ?? 0;
        for (let i = 0; i < plan.fieldsToCreate.length; i++) {
          const f = plan.fieldsToCreate[i];
          batch.set(locRef.collection("fields").doc(), {
            name: `Quadra ${existingCount + i + 1}`,
            type: f.type,
            description: null,
            photo_url: null,
            is_active: true,
            hourly_price: f.priceCents ? f.priceCents / 100 : 0,
            photos: [],
            managers: [],
            is_covered: false,
            players_per_team: null,
            min_booking_minutes: 60,
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });
          ops += 1;
          if (ops >= MAX_BATCH_OPS) await commitBatch();
        }
        // Preço por hora público (explícito na fonte): só preenche quadras sem preço.
        const priceCents = priceToCents(plan.venue.preco_hora);
        if (priceCents) {
          const existingFields = await locRef.collection("fields").get();
          for (const fd of existingFields.docs) {
            if (!(Number(fd.get("hourly_price")) > 0)) {
              batch.update(fd.ref, {hourly_price: priceCents / 100, updated_at: FieldValue.serverTimestamp()});
              ops += 1;
              if (ops >= MAX_BATCH_OPS) await commitBatch();
            }
          }
        }
        if (plan.fieldsToCreate.length > 0) {
          console.log(`      + ${plan.fieldsToCreate.length} quadra(s) criada(s) por enriquecimento`);
        }
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