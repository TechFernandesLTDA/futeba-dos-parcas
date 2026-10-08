#!/usr/bin/env node
/**
 * Monta datasets de venues (quadras de futebol) a partir de dados públicos do
 * OpenStreetMap — Nominatim (geocoding do município) + Overpass API (pois).
 *
 * PRincípios (backlog #4186 / issues #4194 e #4195):
 *  - NADA é inventado: sem preço, sem foto e sem coordenada fabricados.
 *    Ausente fica null. Coordenada só existe se o elemento OSM tiver centro.
 *  - Finalidade validada: só entra venue com sinal EXPLÍCITO de futebol
 *    (tag sport com token soccer/futsal/society/football ou nome com
 *    futebol/futsal/society/cancha/quadra de bola...). Registros "randômicos"
 *    de quadra poliesportiva/tennis/vôlei são descartados.
 *  - Provenance por item: fonte = URL do elemento OSM + data de coleta;
 *    dataset guarda a consulta Overpass, o arquivo do Nominatim e o
 *    timestamp base do OSM.
 *  - Dedupe por nome normalizado + proximidade dentro do município.
 *  - Escrita SOMENTE nos arquivos scripts/data/venues-<slug>.json (nunca
 *    Firestore): a importação DRAFT é executada pelo coordenador.
 *
 * Uso:
 *   node scripts/data/build-venues-osm.mjs --raw-dir <dir> [--only <slug>]
 *
 * Requisitos: Node >= 18 (fetch nativo). Sem dependências externas.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {fileURLToPath} from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_AGENT = "TechFernandes/venue-dataset-research (contact: ops@techfernandes.com.br)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const FOOTBALL_SPORT_TOKENS = new Set([
  "soccer", "football", "futsal", "society", "beach_soccer", "beachsoccer",
  "fut7", "fut-7",
]);
const EXCLUDED_AMENITY = new Set([
  "school", "college", "kindergarten", "university", "place_of_worship",
  "parking", "marketplace", "shelter", "toilets", "bbq", "library",
]);
const EXCLUDED_ACCESS = new Set(["private", "no", "permit"]);
const INSTITUTIONAL_NAME =
  /(escola|col[eé]gio|creche|berc[aá]rio|universidade|igreja|cemit[eé]rio|prefeitura)/;
const FOOTBALL_NAME =
  /(futebol|futsal|fut\s?7|fut7|society|societ\s|cancha|quadra\s+d[ea]\s+bola|arena\s+d[ae]?\s*bola|aluguel\s+de\s+quadra|loca[çc][ãa]o\s+de\s+quadra|onde\s+jogar)/;
const DAYS_PT = {Mo: "segunda", Tu: "terca", We: "quarta", Th: "quinta", Fr: "sexta", Sa: "sabado", Su: "domingo"};
const DAY_ORDER = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeName(value) {
  return String(value ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
}

function sportTokens(tags) {
  return String(tags.sport ?? "")
      .toLowerCase()
      .split(";")
      .map((t) => t.trim())
      .filter(Boolean);
}

/** Sinal EXPLÍCITO de futebol nas tags sport (não aceita 'american_football'). */
export function hasFootballSport(tags) {
  return sportTokens(tags).some(
      (t) => FOOTBALL_SPORT_TOKENS.has(t)
        || t.includes("soccer")
        || t.includes("futsal")
        || t === "society",
  );
}

/** Sinal EXPLÍCITO de futebol no nome do local. */
export function hasFootballName(name) {
  if (!name) return false;
  const n = String(name).toLowerCase();
  if (FOOTBALL_NAME.test(n)) return true;
  // "Quadra ..." / "Arena ..." só conta se o nome também citar futebol/bola.
  if (/(quadra|arena|campo)/.test(n)) return /(fut|bola|society)/.test(n);
  return false;
}

/** Motivo de descarte, ou null quando o registro tem finalidade validada. */
export function exclusionReason(tags) {
  const name = tags.name;
  if (!name || !String(name).trim()) return "sem_nome";
  if (INSTITUTIONAL_NAME.test(String(name).toLowerCase())) return "institucional";
  const amenity = tags.amenity;
  if (amenity && EXCLUDED_AMENITY.has(amenity)) return `amenity=${amenity}`;
  const access = tags.access;
  if (access && EXCLUDED_ACCESS.has(access)) return `access=${access}`;
  const leisure = tags.leisure;
  if (leisure !== "pitch" && leisure !== "sports_centre") return `leisure=${leisure ?? "(ausente)"}`;
  const explicit = hasFootballSport(tags);
  const byName = hasFootballName(name);
  if (!explicit && !byName) return "sem_sinal_de_futebol";
  return null;
}

/** Horário OSM simples ("Mo-Su 08:00-22:00") → schema pt-BR do importador. */
export function parseOpeningHours(value) {
  if (!value || typeof value !== "string") return null;
  const m = value.trim().match(
      /^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/,
  );
  if (!m) return null;
  const a = DAY_ORDER.indexOf(m[1]);
  const b = DAY_ORDER.indexOf(m[2]);
  if (a < 0 || b < 0 || b < a) return null;
  const out = {};
  for (let i = a; i <= b; i++) out[DAYS_PT[DAY_ORDER[i]]] = `${m[3]}-${m[4]}`;
  return out;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function osmUrl(el) {
  return `https://www.openstreetmap.org/${el.type}/${el.id}`;
}

function elementCenter(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return {lat: el.lat, lon: el.lon};
  }
  if (el.center && typeof el.center.lat === "number") {
    return {lat: el.center.lat, lon: el.center.lon};
  }
  return null;
}

function tagCount(tags) {
  return Object.keys(tags ?? {}).length;
}

// ---------------------------------------------------------------------------
// rede
// ---------------------------------------------------------------------------

async function geocodeMunicipality(nome, uf) {
  const url = new URL(NOMINATIM);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "8");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", `${nome}, ${uf}, Brasil`);
  const res = await fetch(url, {headers: {"User-Agent": USER_AGENT}});
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const items = await res.json();
  // jsonv2 pode omitir `class`; municipal BR é relation administrativa.
  const hit = items.find((i) => i.osm_type === "relation" && i.type === "administrative")
    || items.find((i) => i.osm_type === "relation")
    || items.find((i) => i.type === "administrative")
    || items[0];
  if (!hit) throw new Error(`município não encontrado no Nominatim: ${nome}/${uf}`);
  const dn = String(hit.display_name ?? "").toLowerCase();
  if (!dn.includes(nome.toLowerCase())) {
    throw new Error(
        `geocoding ambiguado para ${nome}/${uf}: "${hit.display_name}"`);
  }
  return hit;
}

function areaIdFor(hit) {
  if (hit.osm_type === "relation") return 3600000000 + Number(hit.osm_id);
  if (hit.osm_type === "way") return 2400000000 + Number(hit.osm_id);
  throw new Error(`tipo OSM não suportado como área: ${hit.osm_type}`);
}

function buildQuery(areaId) {
  return [
    "[out:json][timeout:180];",
    `area(${areaId})->.a;`,
    "(",
    '  node["leisure"="pitch"](area.a);',
    '  way["leisure"="pitch"](area.a);',
    '  relation["leisure"="pitch"](area.a);',
    '  node["leisure"="sports_centre"](area.a);',
    '  way["leisure"="sports_centre"](area.a);',
    ");",
    "out body center meta;",
  ].join("\n");
}

async function runOverpass(ql) {
  const body = new URLSearchParams({data: ql});
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    const mirror = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length];
    try {
      const res = await fetch(mirror, {
        method: "POST",
        headers: {"User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded"},
        body,
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300).replace(/\s+/g, " ");
        throw new Error(`HTTP ${res.status} — ${detail}`);
      }
      const json = await res.json();
      json.__mirror = mirror;
      return json;
    } catch (err) {
      lastErr = err;
      console.log(`  ⚠ overpass attempt ${attempt + 1} (${mirror}): ${err.message}`);
      await sleep(2500 * (attempt + 1));
    }
  }
  throw new Error(`Overpass indisponível: ${lastErr?.message}`);
}

// ---------------------------------------------------------------------------
// construção do dataset
// ---------------------------------------------------------------------------

function pickAddress(tags, cidade, uf) {
  const rua = tags["addr:street"] ?? null;
  const numero = tags["addr:housenumber"] ?? null;
  const bairro = tags["addr:suburb"] ?? tags["addr:neighbourhood"] ?? tags["addr:quarter"] ?? null;
  return {
    rua: rua ? String(rua) : null,
    numero: numero ? String(numero) : null,
    bairro: bairro ? String(bairro) : null,
    cidade,
    uf,
    cep: tags["addr:postcode"] ?? null,
  };
}

function surfaceToTipoPiso(tags) {
  const surface = tags.surface;
  if (!surface) return null;
  const s = String(surface).toLowerCase();
  if (s === "artificial_turf") return "grama sintética (OSM: surface=artificial_turf)";
  if (s === "grass") return "grama natural (OSM: surface=grass)";
  if (s === "rubber") return "piso emborrachado (OSM: surface=rubber)";
  if (s === "concrete") return "concreto (OSM: surface=concrete)";
  return null;
}

function buildVenue(el, meta, cidade, uf) {
  const tags = el.tags ?? {};
  const center = elementCenter(el);
  const explicit = hasFootballSport(tags);
  const byName = hasFootballName(tags.name);
  const addr = pickAddress(tags, cidade, uf);
  const complete = Boolean(addr.rua && addr.numero && addr.bairro);
  const confidence = (explicit && complete) ? "alta" : (explicit || complete ? "média" : "baixa");

  const fontes = [{
    url: osmUrl(el),
    dado: `OpenStreetMap (${el.type}/${el.id}): `
      + `${explicit ? `sport=${tags.sport}` : `nome="${tags.name}"`}`
      + `${addr.rua ? `, ${addr.rua}${addr.numero ? `, ${addr.numero}` : ""}` : ", sem rua no OSM"}`
      + `, coletado em ${meta.data_coleta}`,
  }];

  const instagramTag = tags["contact:instagram"] ?? tags.instagram ?? null;

  return {
    nome: String(tags.name).trim(),
    endereco: addr,
    telefone: tags.phone ?? tags["contact:phone"] ?? null,
    whatsapp: tags["contact:whatsapp"] ?? null,
    site: tags.website ?? tags["contact:website"] ?? null,
    instagram: instagramTag
      ? (String(instagramTag).startsWith("http")
        ? String(instagramTag)
        : `https://instagram.com/${String(instagramTag).replace(/^@/, "")}`)
      : null,
    preco_hora: null,
    qtd_quadras: null,
    detalhe_quadras: tags.pitch ? `pitch=${tags.pitch}` : null,
    tipo_piso: surfaceToTipoPiso(tags),
    horarios: parseOpeningHours(tags.opening_hours),
    nota_media: null,
    contagem_avaliacoes: null,
    comentarios: [],
    fotos: [],
    fontes,
    confidence,
    coordenadas: center,
    rodada_dados: meta.rodada_dados,
    osm: {type: el.type, id: el.id, sinal_futebol: explicit ? "sport" : "nome"},
  };
}

/** Remove duplicatas (mesmo nome normalizado ou <25 m com nome compatível). */
export function dedupeVenues(venues) {
  const kept = [];
  for (const v of venues) {
    const key = normalizeName(v.nome);
    const sameName = kept.findIndex((k) => normalizeName(k.nome) === key);
    if (sameName >= 0) {
      // Mesmo local mapeado duas vezes: fica o registro com mais endereço.
      const current = kept[sameName];
      const currentScore = (current.endereco.rua ? 2 : 0) + (current.endereco.numero ? 1 : 0);
      const candidateScore = (v.endereco.rua ? 2 : 0) + (v.endereco.numero ? 1 : 0);
      if (candidateScore > currentScore) kept[sameName] = v;
      continue;
    }
    if (v.coordenadas) {
      const near = kept.find((k) => k.coordenadas
        && haversineMeters(k.coordenadas, v.coordenadas) < 25
        && (normalizeName(k.nome).includes(key) || key.includes(normalizeName(k.nome))));
      if (near) continue;
    }
    kept.push(v);
  }
  return kept;
}

async function processCity(city, opts) {
  const meta = {
    data_coleta: opts.data_coleta,
    rodada_dados: `R${city.rodada}`,
  };
  const stats = {
    candidatos_osm: 0, sem_nome: 0, institucional: 0, acesso_restrito: 0,
    amenity_descartada: 0, sem_sinal_de_futebol: 0, other_excluded: 0,
    sem_coordenada: 0, mantidos: 0, duplicatas_removidas: 0,
  };

  const hit = await geocodeMunicipality(city.nome, city.uf);
  const areaId = areaIdFor(hit);
  const ql = buildQuery(areaId);
  const overpass = await runOverpass(ql);

  if (opts.rawDir) {
    fs.mkdirSync(opts.rawDir, {recursive: true});
    fs.writeFileSync(
        path.join(opts.rawDir, `${city.slug}.json`),
        JSON.stringify(overpass),
    );
  }

  const candidates = [];
  for (const el of overpass.elements) {
    const tags = el.tags ?? {};
    if (!tags.name) {
      stats.candidatos_osm += 1;
      stats.sem_nome += 1;
      continue;
    }
    stats.candidatos_osm += 1;
    const reason = exclusionReason(tags);
    if (reason) {
      if (reason === "sem_nome") stats.sem_nome += 1;
      else if (reason === "institucional") stats.institucional += 1;
      else if (reason.startsWith("access=")) stats.acesso_restrito += 1;
      else if (reason.startsWith("amenity=")) stats.amenity_descartada += 1;
      else if (reason === "sem_sinal_de_futebol"
        || reason === "sports_centre_sem_futebol") stats.sem_sinal_de_futebol += 1;
      else stats.other_excluded += 1;
      continue;
    }
    if (!elementCenter(el)) {
      stats.sem_coordenada += 1;
      continue;
    }
    candidates.push(buildVenue(el, meta, city.nome, city.uf));
  }

  const before = candidates.length;
  const venues = dedupeVenues(candidates);
  stats.duplicatas_removidas = before - venues.length;
  stats.mantidos = venues.length;
  venues.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const dataset = {
    gerado_em: opts.data_coleta,
    rodada: city.rodada,
    cidade: city.nome,
    uf: city.uf,
    slug: city.slug,
    issue: city.epic_issue ?? null,
    fonte: {
      provedor: "OpenStreetMap (via Nominatim + Overpass API)",
      licenca: "ODbL 1.0 — https://www.openstreetmap.org/copyright",
      nominatim_url: hit.place_id ? `https://www.openstreetmap.org/${hit.osm_type}/${hit.osm_id}` : null,
      nominatim_display_name: hit.display_name,
      overpass_mirror: overpass.__mirror,
      overpass_query: ql,
      osm_base_timestamp: overpass.osm3s?.timestamp_osm_base ?? null,
    },
    coleta: {
      data: opts.data_coleta,
      ferramenta: "scripts/data/build-venues-osm.mjs",
      finalidade: "dataset curado de quadras para importação DRAFT (revisão humana antes de publicar)",
    },
    estatisticas: stats,
    venues,
  };

  const outPath = path.join(__dirname, `venues-${city.slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 1) + "\n", "utf8");
  return {city, stats, outPath, venues: venues.length};
}

// ---------------------------------------------------------------------------
// main (CLI)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = {rawDir: null, only: null};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--raw-dir") out.rawDir = argv[++i];
    else if (argv[i] === "--only") out.only = argv[++i];
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  opts.data_coleta = new Date().toISOString().slice(0, 10);
  const manifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, "osm-cities.json"), "utf8"),
  );
  const cities = manifest.cidades.filter((c) => !opts.only || c.slug === opts.only);
  if (!cities.length) {
    console.error(`Nenhuma cidade para --only=${opts.only}`);
    process.exit(1);
  }

  const results = [];
  for (const city of cities) {
    process.stdout.write(`\n== ${city.nome}/${city.uf} (R${city.rodada}) ==\n`);
    try {
      const res = await processCity(city, opts);
      results.push({ok: true, ...res});
      console.log(JSON.stringify(res.stats));
      console.log(`  → scripts/data/venues-${city.slug}.json (${res.venues} venues)`);
    } catch (err) {
      results.push({ok: false, city, error: String(err.message ?? err)});
      console.error(`  ✗ falhou: ${err.message}`);
    }
    await sleep(1100); // cortesia com o Nominatim (1 req/s)
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\nResumo: ${results.length - failed.length}/${results.length} cidades ok`);
  for (const r of results) {
    if (r.ok) console.log(`  ${r.city.nome}: ${r.stats.mantidos} venues`);
    else console.log(`  ${r.city.nome}: FALHOU — ${r.error}`);
  }
  process.exit(failed.length ? 1 : 0);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error("✗ falha fatal:", err);
    process.exit(1);
  });
}