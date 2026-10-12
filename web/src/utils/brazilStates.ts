/**
 * Estados brasileiros (UF + nome) usados pelo seletor de quadras (#4370) e
 * pelos filtros Estado → Cidade → Bairro do admin (#4372).
 */
export interface BrazilState {
  uf: string;
  name: string;
}

export const BRAZIL_STATES: readonly BrazilState[] = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];

const stripDiacritics = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const simplify = (value: string) =>
  stripDiacritics(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const BY_UF = new Map(BRAZIL_STATES.map((s) => [s.uf, s]));
const BY_NAME = new Map(BRAZIL_STATES.map((s) => [simplify(s.name), s]));

/**
 * Converte "pr", "PR", "Paraná" ou "parana" na UF canônica ("PR").
 * Valores desconhecidos voltam em caixa alta e sem espaços nas pontas
 * (preserva dados legados), e vazio vira ''.
 */
export function normalizeUf(value?: string | null): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const upper = stripDiacritics(raw).toUpperCase();
  if (BY_UF.has(upper)) return upper;
  const byName = BY_NAME.get(simplify(raw));
  return byName ? byName.uf : raw.toUpperCase();
}

export function getStateName(uf?: string | null): string {
  const normalized = normalizeUf(uf);
  return BY_UF.get(normalized)?.name ?? normalized;
}
