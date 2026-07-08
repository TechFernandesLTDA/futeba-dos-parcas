export const DEFAULT_GAME_DURATION_MINUTES = 60;

const parseTime = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

export const normalizeHourlyPriceForGame = (hourlyPrice?: number | null) => {
  if (!Number.isFinite(hourlyPrice) || !hourlyPrice || hourlyPrice <= 0) return 0;
  // Campos antigos aparecem em reais; os cadastros comerciais novos usam centavos.
  return hourlyPrice >= 1000 ? hourlyPrice / 100 : hourlyPrice;
};

export const getGameDurationMinutes = (startTime: string, endTime?: string) => {
  if (!startTime) return DEFAULT_GAME_DURATION_MINUTES;
  const start = parseTime(startTime);
  const end = endTime ? parseTime(endTime) : start + DEFAULT_GAME_DURATION_MINUTES;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return DEFAULT_GAME_DURATION_MINUTES;
  }
  return end - start;
};

export const formatGameDurationLabel = (durationMinutes: number) => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours && minutes) return `${hours}h${String(minutes).padStart(2, '0')}`;
  if (hours) return `${hours}h`;
  return `${minutes}min`;
};

export const calculateFieldRentalCost = (
  hourlyPrice: number | undefined | null,
  startTime: string,
  endTime?: string,
) => {
  const normalizedHourlyPrice = normalizeHourlyPriceForGame(hourlyPrice);
  if (normalizedHourlyPrice <= 0) return 0;
  const durationMinutes = getGameDurationMinutes(startTime, endTime);
  return roundCurrency((normalizedHourlyPrice * durationMinutes) / 60);
};

export const calculatePerPlayerPrice = (totalCost: number, maxPlayers: number) => {
  if (totalCost <= 0 || maxPlayers <= 0) return 0;
  return roundCurrency(totalCost / maxPlayers);
};

export interface GamePricingForSaveInput {
  totalCost: number;
  maxPlayers: number;
  dailyPrice?: number | null;
  priceManualOverride?: boolean;
}

export const resolveGamePricingForSave = ({
  totalCost,
  maxPlayers,
  dailyPrice,
  priceManualOverride = false,
}: GamePricingForSaveInput) => {
  const safeTotalCost = Number.isFinite(totalCost) && totalCost > 0 ? roundCurrency(totalCost) : 0;
  const safeDailyPrice = Number.isFinite(dailyPrice) && dailyPrice && dailyPrice > 0
    ? roundCurrency(dailyPrice)
    : 0;

  return {
    totalCost: safeTotalCost,
    dailyPrice: priceManualOverride
      ? safeDailyPrice
      : calculatePerPlayerPrice(safeTotalCost, maxPlayers),
    priceManualOverride,
  };
};
