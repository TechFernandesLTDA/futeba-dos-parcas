/**
 * Acesso às notas de versão ("Novidades") no web.
 *
 * Combina duas fontes (spec §3.8), espelhando `ReleaseNotesRepositoryImpl.kt`:
 * - **Firestore** (`release_notes`) — fonte primária, dinâmica. Documento
 *   aninhado por locale (`content."pt-BR"`), gravado pela CI via Admin SDK.
 * - **JSON embarcado** (`/release-notes.json` em `public/`) — fallback offline.
 *   Formato achatado, gerado por `scripts/release-notes.js bundle`.
 *
 * Política de merge:
 * - Firestore OK → é a fonte; o fallback só completa versões ausentes.
 * - Firestore falha → degrada para o fallback embarcado; só lança erro se
 *   também não houver fallback.
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase F, task #20.
 */

import { collection, getDocs, limit, query, Timestamp, where } from 'firebase/firestore';
import { db } from './firebase';
import { ReleaseHighlight, ReleaseNote, normalizeReleaseType } from '../types/releaseNotes';
import { compareVersions } from '../utils/semver';
import { createLogger } from '../utils/logger';

const logger = createLogger('releaseNotes');

const COLLECTION = 'release_notes';
const LOCALE = 'pt-BR';
const QUERY_LIMIT = 30;
const FALLBACK_URL = '/release-notes.json';

/** Plataforma desta aplicação — usada no filtro do Firestore e do fallback. */
export const WEB_PLATFORM = 'web';

// ─── DTO do fallback embarcado (forma achatada do bundle) ────────────────────

interface BundledReleaseNote {
  version?: string;
  buildNumber?: number | null;
  releaseDate?: string;
  type?: string;
  showPopup?: boolean;
  published?: boolean;
  headline?: string;
  highlights?: Partial<ReleaseHighlight>[];
  added?: string[];
  improved?: string[];
  fixed?: string[];
  issueRefs?: number[];
}

interface BundledReleaseNotes {
  platform?: string;
  generatedAt?: string;
  notes?: BundledReleaseNote[];
}

// ─── Helpers de mapeamento ───────────────────────────────────────────────────

function toEpochMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  // Duck-typing para Timestamp serializado / variações do SDK.
  const ts = value as { toDate?: () => Date; seconds?: number } | null | undefined;
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

function parseIsoDate(date: string | undefined): number {
  if (!date) return 0;
  // "2026-05-22" é interpretado como meia-noite UTC pela spec ISO date-only.
  const ms = Date.parse(date);
  return Number.isNaN(ms) ? 0 : ms;
}

function toStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((it): it is string => typeof it === 'string') : [];
}

function toIntList(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((it): it is number => typeof it === 'number')
    : [];
}

function toHighlights(value: unknown): ReleaseHighlight[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const m = (item ?? {}) as Partial<ReleaseHighlight>;
    return {
      icon: String(m.icon ?? ''),
      title: String(m.title ?? ''),
      description: String(m.description ?? ''),
    };
  });
}

/** Ordena por versão (SemVer), mais recente primeiro. */
function sortByVersionDesc(notes: ReleaseNote[]): ReleaseNote[] {
  return [...notes].sort((a, b) => compareVersions(b.version, a.version));
}

// ─── Firestore (fonte primária) ──────────────────────────────────────────────

/**
 * Mapeia um documento Firestore (forma aninhada por locale) para [ReleaseNote].
 * Qualquer falha de leitura — ou `published: false` — descarta a nota (`null`)
 * sem quebrar a lista.
 */
function mapFirestoreDoc(raw: Record<string, unknown>): ReleaseNote | null {
  try {
    if (raw.published === false) return null;
    const content = (raw.content ?? {}) as Record<string, unknown>;
    const ptBr = (content[LOCALE] ?? {}) as Record<string, unknown>;
    const sections = (ptBr.sections ?? {}) as Record<string, unknown>;
    const displayConfig = (raw.displayConfig ?? {}) as Record<string, unknown>;
    return {
      platform: String(raw.platform ?? ''),
      version: String(raw.version ?? ''),
      buildNumber: typeof raw.buildNumber === 'number' ? raw.buildNumber : null,
      releaseDate: toEpochMillis(raw.releaseDate),
      type: normalizeReleaseType(raw.type),
      headline: String(ptBr.headline ?? ''),
      highlights: toHighlights(ptBr.highlights),
      added: toStringList(sections.added),
      improved: toStringList(sections.improved),
      fixed: toStringList(sections.fixed),
      issueRefs: toIntList(raw.issueRefs),
      showPopup: displayConfig.showPopup === true,
    };
  } catch (err) {
    logger.warn('Documento release_notes inválido, ignorado:', err);
    return null;
  }
}

/**
 * Consulta o Firestore por uma única igualdade (`platform`) — não exige índice
 * composto. O filtro `published` e a ordenação por versão são feitos no cliente
 * (o dataset é pequeno: poucas notas por plataforma).
 */
async function queryFirestore(platform: string): Promise<ReleaseNote[]> {
  const q = query(
    collection(db, COLLECTION),
    where('platform', '==', platform),
    limit(QUERY_LIMIT),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => mapFirestoreDoc(d.data()))
    .filter((n): n is ReleaseNote => n !== null);
}

// ─── Fallback embarcado (offline) ────────────────────────────────────────────

function bundledToDomain(note: BundledReleaseNote, platform: string): ReleaseNote {
  return {
    platform,
    version: note.version ?? '',
    buildNumber: typeof note.buildNumber === 'number' ? note.buildNumber : null,
    releaseDate: parseIsoDate(note.releaseDate),
    type: normalizeReleaseType(note.type),
    headline: note.headline ?? '',
    highlights: toHighlights(note.highlights),
    added: note.added ?? [],
    improved: note.improved ?? [],
    fixed: note.fixed ?? [],
    issueRefs: note.issueRefs ?? [],
    showPopup: note.showPopup === true,
  };
}

async function readFallback(platform: string): Promise<ReleaseNote[]> {
  try {
    const res = await fetch(FALLBACK_URL, { cache: 'no-cache' });
    if (!res.ok) return [];
    const bundle = (await res.json()) as BundledReleaseNotes;
    // O bundle é por plataforma; ignora se não casar com a solicitada.
    if (bundle.platform && platform && bundle.platform !== platform) return [];
    const resolved = platform || bundle.platform || WEB_PLATFORM;
    return (bundle.notes ?? [])
      .filter((n) => n.published !== false)
      .map((n) => bundledToDomain(n, resolved));
  } catch (err) {
    logger.warn('Fallback release-notes.json indisponível:', err);
    return [];
  }
}

// ─── API pública ─────────────────────────────────────────────────────────────

/**
 * Retorna todas as notas de versão da [platform], mais recente primeiro.
 *
 * - Sucesso com lista vazia = não há notas (não é erro).
 * - Lança erro só quando o Firestore falha **e** não há fallback embarcado.
 */
export async function fetchReleaseNotes(platform: string = WEB_PLATFORM): Promise<ReleaseNote[]> {
  const fallback = await readFallback(platform);
  try {
    const remote = await queryFirestore(platform);
    const remoteVersions = new Set(remote.map((n) => n.version));
    const merged = [...remote, ...fallback.filter((n) => !remoteVersions.has(n.version))];
    return sortByVersionDesc(merged);
  } catch (err) {
    // Firestore indisponível — degrada para o fallback embarcado.
    if (fallback.length > 0) {
      logger.warn('Firestore release_notes indisponível, usando fallback embarcado:', err);
      return sortByVersionDesc(fallback);
    }
    throw err;
  }
}
