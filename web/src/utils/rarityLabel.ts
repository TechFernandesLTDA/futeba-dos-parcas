/** Nome da raridade para exibir: o valor gravado não tem acento (EPICO, LENDARIO). */
const RARITY_LABELS: Record<string, string> = {
  COMUM: 'Comum',
  INCOMUM: 'Incomum',
  RARO: 'Raro',
  EPICO: 'Épico',
  LENDARIO: 'Lendário',
};

/** Rótulo da raridade; valor desconhecido aparece como veio. */
export function rarityLabel(rarity: string | null | undefined): string {
  if (!rarity) return RARITY_LABELS.COMUM;
  return RARITY_LABELS[rarity.toUpperCase()] ?? rarity;
}
