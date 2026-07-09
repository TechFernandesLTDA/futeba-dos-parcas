const CASHBOX_CENTS_MULTIPLIER = 100;

function normalizeCashboxAmountString(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/\s/g, '');
  return compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact;
}

export function parseCashboxAmountToCents(value: string): number | null {
  const normalized = normalizeCashboxAmountString(value);
  if (!normalized) return null;

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const [wholePart, decimalPart = ''] = normalized.split('.');
  const whole = Number.parseInt(wholePart, 10);
  const cents = Number.parseInt(decimalPart.padEnd(2, '0'), 10);
  const parsed = (whole * CASHBOX_CENTS_MULTIPLIER) + cents;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function cashboxAmountToCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(value * CASHBOX_CENTS_MULTIPLIER);
}

export function centsToCashboxAmount(cents: number): number {
  return Math.round(cents) / CASHBOX_CENTS_MULTIPLIER;
}

export function normalizeCashboxAmount(value: unknown): number {
  return centsToCashboxAmount(cashboxAmountToCents(value));
}

export function parseCashboxAmount(value: string): number | null {
  const cents = parseCashboxAmountToCents(value);
  return cents === null ? null : centsToCashboxAmount(cents);
}

export function formatCashboxAmountInput(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
