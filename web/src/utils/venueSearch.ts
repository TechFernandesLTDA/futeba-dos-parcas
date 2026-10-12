/**
 * Busca inteligente de quadras (#4370, reutilizada pelo admin em #4372).
 *
 * Regras de produto:
 * - sem acento e sem caixa;
 * - vários termos: TODOS precisam bater, em qualquer campo;
 * - aceita prefixo ("arena ju" → "Arena Jurerê");
 * - tolera 1 erro de digitação (substituição, falta, sobra ou troca de letras
 *   vizinhas) em termos com 5 ou mais letras;
 * - abreviações comuns: soc → society, fut → futsal, jd → jardim, vl → vila.
 *
 * Tudo é puro (sem React/Firebase) para ser testado e usado em qualquer tela.
 */
import { FIELD_TYPE_CONFIG, Location } from '../types/location';
import { getStateName, normalizeUf } from './brazilStates';

export type VenueSearchValue = string | number | null | undefined;

/** Abreviação → palavra completa. Vale nos dois sentidos (busca e texto). */
export const VENUE_SEARCH_ABBREVIATIONS: Readonly<Record<string, string>> = {
  soc: 'society',
  fut: 'futsal',
  jd: 'jardim',
  vl: 'vila',
  av: 'avenida',
  pq: 'parque',
  sta: 'santa',
  sto: 'santo',
};

/** Mínimo de letras do termo para tolerar 1 erro de digitação. */
export const VENUE_TYPO_MIN_LENGTH = 5;

const REVERSE_ABBREVIATIONS: Record<string, string[]> = {};
for (const [abbr, full] of Object.entries(VENUE_SEARCH_ABBREVIATIONS)) {
  (REVERSE_ABBREVIATIONS[full] ||= []).push(abbr);
}

/** Minúsculas, sem acento, só letras/números separados por um espaço. */
export function normalizeVenueText(value: VenueSearchValue): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Compara a e b com no máximo 1 edição (Damerau: inclui troca de vizinhas). */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const lengthDiff = Math.abs(a.length - b.length);
  if (lengthDiff > 1) return false;

  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  // Um dos lados acabou: resta no máximo 1 caractere de diferença.
  if (i === a.length || i === b.length) return true;

  if (a.length === b.length) {
    // Substituição
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    // Troca de duas letras vizinhas
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  // Inserção / remoção
  return a.length > b.length
    ? a.slice(i + 1) === b.slice(i)
    : b.slice(i + 1) === a.slice(i);
}

export interface VenueSearchIndex {
  /** Palavras normalizadas (já com as abreviações expandidas nos dois sentidos). */
  words: string[];
  /** Texto contíguo normalizado, para busca por trecho. */
  text: string;
  /** Só os dígitos de cada campo, para CEP digitado com ou sem hífen. */
  digitFields: string[];
}

const isDigits = (value: string) => /^[0-9]+$/.test(value);

/** Pré-processa os campos de uma quadra; reutilize ao filtrar listas grandes. */
export function buildVenueSearchIndex(fields: readonly VenueSearchValue[]): VenueSearchIndex {
  const words = new Set<string>();
  const digitFields: string[] = [];
  const parts: string[] = [];

  for (const field of fields) {
    const normalized = normalizeVenueText(field);
    if (!normalized) continue;
    parts.push(normalized);
    const digits = normalized.replace(/[^0-9]/g, '');
    if (digits.length >= 4) digitFields.push(digits);
    for (const word of normalized.split(' ')) {
      words.add(word);
      const expanded = VENUE_SEARCH_ABBREVIATIONS[word];
      if (expanded) words.add(expanded);
      for (const abbr of REVERSE_ABBREVIATIONS[word] ?? []) words.add(abbr);
    }
  }

  return { words: [...words], text: parts.join(' '), digitFields };
}

function termMatchesIndex(candidate: string, index: VenueSearchIndex): boolean {
  const { words, text, digitFields } = index;

  if (words.some((word) => word.startsWith(candidate))) return true;
  if (candidate.length >= 3 && text.includes(candidate)) return true;
  if (isDigits(candidate) && candidate.length >= 4 &&
      digitFields.some((digits) => digits.includes(candidate))) {
    return true;
  }

  // Erro de digitação: só para termos com 5+ letras e sem números.
  if (candidate.length >= VENUE_TYPO_MIN_LENGTH && !/[0-9]/.test(candidate)) {
    for (const word of words) {
      if (withinOneEdit(candidate, word)) return true;
      // Prefixo com erro: "socety" ~ "society".
      for (const length of [candidate.length - 1, candidate.length, candidate.length + 1]) {
        if (word.length > length && withinOneEdit(candidate, word.slice(0, length))) return true;
      }
    }
  }
  return false;
}

/** Quebra a busca em termos normalizados (vazio = sem filtro). */
export function tokenizeVenueQuery(query: VenueSearchValue): string[] {
  const normalized = normalizeVenueText(query);
  return normalized ? normalized.split(' ') : [];
}

export function matchesVenueIndex(index: VenueSearchIndex, query: VenueSearchValue): boolean {
  const terms = tokenizeVenueQuery(query);
  if (terms.length === 0) return true;
  return terms.every((term) => {
    const expanded = VENUE_SEARCH_ABBREVIATIONS[term];
    return termMatchesIndex(term, index) || (expanded ? termMatchesIndex(expanded, index) : false);
  });
}

/** Atalho: a busca bate com estes campos? */
export function matchesVenueQuery(
  fields: readonly VenueSearchValue[],
  query: VenueSearchValue,
): boolean {
  if (tokenizeVenueQuery(query).length === 0) return true;
  return matchesVenueIndex(buildVenueSearchIndex(fields), query);
}

/** Filtra uma lista; o índice de cada item é calculado uma única vez. */
export function filterVenuesByQuery<T>(
  items: readonly T[],
  query: VenueSearchValue,
  getFields: (item: T) => readonly VenueSearchValue[],
): T[] {
  if (tokenizeVenueQuery(query).length === 0) return [...items];
  return items.filter((item) => matchesVenueIndex(buildVenueSearchIndex(getFields(item)), query));
}

/**
 * Campos pesquisáveis de uma quadra: nome, bairro, endereço, cidade, UF
 * (sigla e nome), CEP e tipo de campo. `extra` permite acrescentar campos
 * do admin (telefone, id, dono...).
 */
export function getVenueSearchFields(
  location: Partial<Location>,
  extra: readonly VenueSearchValue[] = [],
): VenueSearchValue[] {
  const fieldTypes = [
    location.fieldType,
    location.primaryFieldType,
    ...(location.activeFieldTypes ?? []),
  ].filter(Boolean) as Array<keyof typeof FIELD_TYPE_CONFIG>;

  const state = normalizeUf(location.state);

  return [
    location.name,
    location.neighborhood,
    location.district,
    location.region,
    location.address,
    location.street,
    location.number,
    location.city,
    state,
    state ? getStateName(state) : '',
    location.cep,
    ...fieldTypes.flatMap((type) => [type, FIELD_TYPE_CONFIG[type]?.label]),
    ...extra,
  ];
}

/** A quadra bate com a busca? (campos públicos; `extra` p/ campos do admin) */
export function locationMatchesVenueQuery(
  location: Partial<Location>,
  query: VenueSearchValue,
  extra: readonly VenueSearchValue[] = [],
): boolean {
  return matchesVenueQuery(getVenueSearchFields(location, extra), query);
}
