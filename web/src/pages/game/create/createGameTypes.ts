import { addDays, format as formatDate, parse } from 'date-fns';
import { TFunction } from 'i18next';
import { FieldType, GameGender, GameVisibility, PixKeyType } from '../../../types/game';
import { Field, Location as FutebaLocation } from '../../../types/location';
import { FieldAvailabilitySlot } from '../../../services/cloudFunctions';
import { findAvailabilityConflict } from '../../../utils/fieldAvailability';
import { DEFAULT_GAME_DURATION_MINUTES } from '../../../utils/gamePricing';
import { isScheduledDateTimeInPast } from '../../../utils/gameScheduleValidation';
import { formatRecurrencePreview, getNextRecurrenceDates } from '../../../utils/recurrencePreview';
import { GAME_VALIDATION } from '../../../utils/validationConstants';

export const TIME_SLOTS = [
  '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30',
  '22:00', '22:30', '23:00',
];

export const MIN_GROUP_MEMBERS_TO_CREATE_GAME = 5;

// Teto inviolável da série recorrente (1 ano de jogos semanais).
// Espelha RECURRENCE_HARD_CAP do backend (functions/src/games/recurrence-limits.ts)
// e a regra Firestore isValidRecurrenceCount (2..52).
export const RECURRENCE_HARD_CAP = 52;

export const parseTime = (t: string): number => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export const formatTime = (minutes: number): string => {
  const normalizedMinutes = minutes % (24 * 60);
  const h = Math.floor(normalizedMinutes / 60);
  const m = normalizedMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const formatGameDate = (date: string, time: string): string => {
  if (!date) return '';
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y?.slice(2)} ${time}`;
};

export interface GameFormData {
  [key: string]: unknown;
  locationId: string;
  locationName: string;
  locationAddress: string;
  locationLat?: number;
  locationLng?: number;
  fieldId: string;
  fieldName: string;
  date: string;
  time: string;
  endTime: string;
  fieldType: FieldType;
  gameType: string;
  maxPlayers: number;
  maxGoalkeepers: number;
  numberOfTeams: number;
  totalCost: number;
  dailyPrice: number;
  priceManualOverride: boolean;
  pixPaymentEnabled: boolean;
  pixKey: string;
  pixKeyType: PixKeyType;
  pixBeneficiaryName: string;
  rules: string;
  groupId?: string;
  groupName?: string;
  visibility: GameVisibility;
  recurrenceEnabled: boolean;
  recurrenceType: 'weekly' | 'biweekly' | 'monthly';
  // Fim da série (spec #2398): 'forever' = até o teto de 52, 'count' = N jogos
  // no total, 'until' = repete até a data. count XOR end_date no payload.
  recurrenceEndMode: 'forever' | 'count' | 'until';
  recurrenceCount: number;
  recurrenceEndDate: string;
  streamUrl: string;
  autoInviteMembers: boolean;
  gender: GameGender;
}

export interface CreatedGameData {
  gameId: string;
  date: string;
  time: string;
  endTime: string;
  locationName: string;
  fieldName: string;
  locationAddress: string;
  maxPlayers: number;
  dailyPrice: number;
  rules: string;
}

export interface ConflictSuggestion {
  date: string;
  time: string;
  label: string;
}

export interface FieldPricingSummary {
  hourlyPrice: number;
  durationMinutes: number;
  durationLabel: string;
  totalCost: number;
}

export const defaultFormData: GameFormData = {
  locationId: '',
  locationName: '',
  locationAddress: '',
  fieldId: '',
  fieldName: '',
  date: '',
  time: '',
  endTime: '',
  fieldType: 'SOCIETY',
  gameType: 'SOCIETY',
  maxPlayers: GAME_VALIDATION.MAX_PLAYERS / 2,
  maxGoalkeepers: 2,
  numberOfTeams: 2,
  totalCost: 0,
  dailyPrice: 0,
  priceManualOverride: false,
  pixPaymentEnabled: false,
  pixKey: '',
  pixKeyType: 'RANDOM',
  pixBeneficiaryName: '',
  rules: '',
  visibility: 'PUBLIC_CLOSED',
  recurrenceEnabled: false,
  recurrenceType: 'weekly',
  recurrenceEndMode: 'forever',
  recurrenceCount: 10,
  recurrenceEndDate: '',
  streamUrl: '',
  autoInviteMembers: true,
  gender: 'MIXED' as GameGender,
};

export const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export type NumericField =
  | 'maxPlayers'
  | 'maxGoalkeepers'
  | 'numberOfTeams'
  | 'totalCost'
  | 'dailyPrice'
  | 'recurrenceCount';

export const buildNumericDrafts = (data: GameFormData): Record<NumericField, string> => ({
  maxPlayers: String(data.maxPlayers),
  maxGoalkeepers: String(data.maxGoalkeepers),
  numberOfTeams: String(data.numberOfTeams),
  totalCost: data.totalCost ? String(data.totalCost) : '',
  dailyPrice: data.dailyPrice ? String(data.dailyPrice) : '',
  recurrenceCount: String(data.recurrenceCount),
});

export const parseIntegerDraft = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseCurrencyDraft = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const getLocationDisplayAddress = (loc: FutebaLocation): string => {
  const streetPart = [loc.street, loc.number].filter(Boolean).join(', ');
  const areaPart = [loc.district, loc.city].filter(Boolean).join(', ');
  const constructedAddress = areaPart ? `${streetPart} - ${areaPart}` : streetPart;
  return loc.address || constructedAddress;
};

export const buildRecurrencePreview = (formData: GameFormData) => {
  if (!formData.recurrenceEnabled || !formData.date || !formData.time) return [];
  const PREVIEW_CAP = 12;
  const HARD_CAP_FUTURE = RECURRENCE_HARD_CAP - 1; // série inclui o jogo atual
  let futureCount: number;
  if (formData.recurrenceEndMode === 'count') {
    futureCount = Math.max(0, Math.min(formData.recurrenceCount - 1, HARD_CAP_FUTURE));
  } else if (formData.recurrenceEndMode === 'until') {
    futureCount = HARD_CAP_FUTURE;
  } else {
    futureCount = 4;
  }
  let dates = getNextRecurrenceDates(formData.date, formData.time, formData.recurrenceType, futureCount);
  if (formData.recurrenceEndMode === 'until' && formData.recurrenceEndDate) {
    dates = dates.filter((d) => d.toISOString().split('T')[0] <= formData.recurrenceEndDate);
  }
  return formatRecurrencePreview(dates.slice(0, PREVIEW_CAP));
};

export function validateCreateGameForm(params: {
  formData: GameFormData;
  numericDrafts: Record<NumericField, string>;
  useCustomLocation: boolean;
  fields: Field[];
  hasSelectedEligibleGroup: boolean;
  t: TFunction;
}): {
  errors: Record<string, string>;
  normalizedNumericValues: {
    maxPlayers: number;
    maxGoalkeepers: number;
    numberOfTeams: number;
    totalCost: number;
    dailyPrice: number;
    recurrenceCount: number;
  };
} {
  const { formData, numericDrafts, useCustomLocation, fields, hasSelectedEligibleGroup, t } = params;
  const errors: Record<string, string> = {};
  const parsedMaxPlayers = parseIntegerDraft(numericDrafts.maxPlayers);
  const parsedMaxGoalkeepers = parseIntegerDraft(numericDrafts.maxGoalkeepers);
  const parsedNumberOfTeams = parseIntegerDraft(numericDrafts.numberOfTeams);
  const parsedTotalCost = parseCurrencyDraft(numericDrafts.totalCost) ?? 0;
  const parsedDailyPrice = parseCurrencyDraft(numericDrafts.dailyPrice) ?? 0;
  const parsedRecurrenceCount = parseIntegerDraft(numericDrafts.recurrenceCount);

  if (!formData.locationName.trim()) {
    errors.locationName = useCustomLocation ? t('games.create.errorLocationNameRequired') : t('games.create.errorSelectLocation');
  }
  if (useCustomLocation && !formData.locationAddress.trim()) errors.locationAddress = t('games.create.errorAddressRequired');
  if (!useCustomLocation && formData.locationId && !formData.fieldId) {
    errors.fieldId = fields.length > 0
      ? t('games.create.errorSelectField')
      : t('games.create.errorActiveFieldRequired');
  }
  if (!formData.date) {
    errors.date = t('games.create.errorDateRequired');
  } else {
    const today = new Date().toISOString().split('T')[0];
    if (formData.date < today) errors.date = t('games.create.errorDatePast');
  }
  if (!formData.time) {
    errors.time = t('games.create.errorTimeRequired');
  } else if (formData.date && isScheduledDateTimeInPast(formData.date, formData.time)) {
    errors.time = t('games.create.errorTimePastToday');
  } else if (formData.endTime && formData.endTime <= formData.time) {
    errors.endTime = t('games.create.errorEndTimeBeforeStart');
  }
  if (!formData.groupId || !hasSelectedEligibleGroup) {
    errors.groupId = t('games.create.errorQualifiedOwnerGroupRequired');
  }
  if (formData.streamUrl.trim() && !/^https?:\/\/.+\..+/.test(formData.streamUrl.trim())) {
    errors.streamUrl = t('games.create.errorStreamUrlInvalid');
  }

  if (parsedMaxPlayers === null || parsedMaxPlayers < GAME_VALIDATION.MIN_PLAYERS || parsedMaxPlayers > GAME_VALIDATION.MAX_PLAYERS) {
    errors.maxPlayers = t('games.create.errorPlayersRange', {
      min: GAME_VALIDATION.MIN_PLAYERS,
      max: GAME_VALIDATION.MAX_PLAYERS,
    });
  }
  if (parsedMaxGoalkeepers === null || parsedMaxGoalkeepers < GAME_VALIDATION.MIN_GOALKEEPERS || parsedMaxGoalkeepers > GAME_VALIDATION.MAX_GOALKEEPERS) {
    errors.maxGoalkeepers = t('games.create.errorGoalkeepersRange', {
      min: GAME_VALIDATION.MIN_GOALKEEPERS,
      max: GAME_VALIDATION.MAX_GOALKEEPERS,
    });
  }
  if (parsedNumberOfTeams === null || parsedNumberOfTeams < GAME_VALIDATION.MIN_TEAMS || parsedNumberOfTeams > GAME_VALIDATION.MAX_TEAMS) {
    errors.numberOfTeams = t('games.create.errorTeamsRange', {
      min: GAME_VALIDATION.MIN_TEAMS,
      max: GAME_VALIDATION.MAX_TEAMS,
    });
  }

  if (parsedTotalCost < GAME_VALIDATION.MIN_PRICE) {
    errors.totalCost = t('games.create.errorPriceNegative');
  }
  if (parsedDailyPrice < GAME_VALIDATION.MIN_PRICE) {
    errors.dailyPrice = t('games.create.errorPriceNegative');
  }
  if (formData.recurrenceEnabled && formData.recurrenceEndMode === 'count' && (
    parsedRecurrenceCount === null ||
    parsedRecurrenceCount < 2 ||
    parsedRecurrenceCount > RECURRENCE_HARD_CAP
  )) {
    errors.recurrenceCount = t('games.create.errorRecurrenceCountRange', {
      min: 2,
      max: RECURRENCE_HARD_CAP,
    });
  }

  if (formData.pixPaymentEnabled) {
    if (!formData.pixKey.trim()) errors.pixKey = t('games.create.errorPixKeyRequired');
    if (!formData.pixBeneficiaryName.trim()) errors.pixBeneficiaryName = t('games.create.errorPixBeneficiaryRequired');
  }

  return {
    errors,
    normalizedNumericValues: {
      maxPlayers: parsedMaxPlayers ?? formData.maxPlayers,
      maxGoalkeepers: parsedMaxGoalkeepers ?? formData.maxGoalkeepers,
      numberOfTeams: parsedNumberOfTeams ?? formData.numberOfTeams,
      totalCost: parsedTotalCost,
      dailyPrice: parsedDailyPrice,
      recurrenceCount: parsedRecurrenceCount ?? formData.recurrenceCount,
    },
  };
}

export function buildConflictResult(params: {
  existingSlots: FieldAvailabilitySlot[];
  date: string;
  time: string;
  endTime: string;
  byDate: Map<string, Array<{ startMinutes: number; endMinutes: number }>>;
}): { message: string; suggestions: ConflictSuggestion[] } | null {
  const { existingSlots, date, time, endTime, byDate } = params;
  const newStart = parseTime(time);
  const parsedNewEnd = endTime ? parseTime(endTime) : newStart + DEFAULT_GAME_DURATION_MINUTES;
  const newEnd = parsedNewEnd <= newStart ? parsedNewEnd + 24 * 60 : parsedNewEnd;
  const conflicting = findAvailabilityConflict(existingSlots, newStart, newEnd);
  if (!conflicting) return null;

  const DAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  const suggestions: ConflictSuggestion[] = [];

  // 1. Same-day nearby free slots
  const freeSlots: string[] = [];
  const slotDuration = DEFAULT_GAME_DURATION_MINUTES;
  const dayEnd = 23 * 60;

  for (let s = 0; s <= dayEnd - slotDuration; s += 30) {
    const e = s + slotDuration;
    if (e > dayEnd) break;
    const conflicts = findAvailabilityConflict(existingSlots, s, e) !== undefined;
    if (!conflicts) freeSlots.push(formatTime(s));
  }

  const nearbySameDay = freeSlots
    .filter((s) => Math.abs(parseTime(s) - newStart) <= 240)
    .slice(0, 2);

  for (const t of nearbySameDay) {
    const dayOfWeek = new Date(date + 'T12:00:00').getDay();
    suggestions.push({
      date,
      time: t,
      label: `${DAY_LABELS_SHORT[dayOfWeek]} ${date.slice(8)}/${date.slice(5, 7)} ${t}`,
    });
  }

  // 2. Alternative days (next 3 days with free slots near selected time)
  const todayStr = formatDate(new Date(), 'yyyy-MM-dd');
  const selectedEndStr = formatTime(newEnd);

  for (let d = 1; suggestions.length < 3 && d <= 7; d++) {
    const altDate = formatDate(addDays(parse(todayStr, 'yyyy-MM-dd', new Date()), d), 'yyyy-MM-dd');
    if (altDate === date) continue;
    const dayGames = byDate.get(altDate) || [];

    let bestTime = '';
    let bestDiff = Infinity;
    for (let s = 0; s <= dayEnd - slotDuration; s += 30) {
      const e = s + slotDuration;
      if (e > dayEnd) break;
      const occupied = dayGames.some((sl) => sl.startMinutes < e && sl.endMinutes > s);
      if (occupied) continue;
      const diff = Math.abs(s - newStart);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestTime = formatTime(s);
      }
    }

    if (bestTime && bestDiff <= 180) {
      const dayOfWeek = new Date(altDate + 'T12:00:00').getDay();
      suggestions.push({
        date: altDate,
        time: bestTime,
        label: `${DAY_LABELS_SHORT[dayOfWeek]} ${altDate.slice(8)}/${altDate.slice(5, 7)} ${bestTime}`,
      });
    }
  }

  const message = `Horário indisponível: ${formatTime(conflicting.startMinutes)} às ${formatTime(conflicting.endMinutes)} já ocupado.` +
    (selectedEndStr ? ` (${time} às ${selectedEndStr})` : '');

  return {
    message,
    suggestions: suggestions.slice(0, 4),
  };
}
