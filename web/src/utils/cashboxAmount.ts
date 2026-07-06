export function parseCashboxAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s/g, '');
  const normalized = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact;

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatCashboxAmountInput(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
