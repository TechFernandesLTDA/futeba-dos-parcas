import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { getFieldAvailability, type FieldAvailabilitySlot } from '../services/cloudFunctions';
import { createLogger } from '../utils/logger';
import { useTranslation } from 'react-i18next';

const logger = createLogger('useFieldGames');

const MINUTES_PER_DAY = 24 * 60;

const parseTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

export interface AvailabilityWindow {
  openingTime?: string;
  closingTime?: string;
}

export interface FieldGame {
  date: string;
  startMinutes: number;
  endMinutes: number;
}

export interface FieldGameSet {
  byDate: Map<string, FieldGame[]>;
  fullyBookedDates: Set<string>;
  conflictDates: Set<string>;
}

function getAvailabilityWindowMinutes(window?: AvailabilityWindow) {
  const openingTime = window?.openingTime || '';
  const closingTime = window?.closingTime || '';
  if (!openingTime || !closingTime) {
    return { dayStart: 0, dayEnd: MINUTES_PER_DAY };
  }

  const dayStart = parseTime(openingTime);
  const rawDayEnd = parseTime(closingTime);
  const dayEnd = rawDayEnd <= dayStart ? rawDayEnd + MINUTES_PER_DAY : rawDayEnd;

  return { dayStart, dayEnd };
}

const processSlots = (
  slots: FieldAvailabilitySlot[],
  availabilityWindow?: AvailabilityWindow,
): FieldGameSet => {
  const byDate = new Map<string, FieldGame[]>();
  const { dayStart, dayEnd } = getAvailabilityWindowMinutes(availabilityWindow);

  slots.forEach((slot) => {
    const gDate = slot.date;
    const gStart = slot.startMinutes;
    const gEnd = slot.endMinutes;

    if (!byDate.has(gDate)) byDate.set(gDate, []);
    byDate.get(gDate)!.push({ date: gDate, startMinutes: gStart, endMinutes: gEnd });
  });

  const fullyBookedDates = new Set<string>();
  const conflictDates = new Set<string>();

  for (const [date, games] of byDate) {
    games.sort((a, b) => a.startMinutes - b.startMinutes);

    let hasConflict = false;
    let freeMinutes = 0;
    let lastEnd = dayStart;
    for (const g of games) {
      const clampedStart = Math.max(g.startMinutes, dayStart);
      const clampedEnd = Math.min(g.endMinutes, dayEnd);
      if (clampedEnd <= dayStart || clampedStart >= dayEnd) continue;

      if (clampedStart < lastEnd) {
        hasConflict = true;
      }
      if (clampedStart > lastEnd) {
        freeMinutes += clampedStart - lastEnd;
      }
      lastEnd = Math.max(lastEnd, clampedEnd);
    }
    if (lastEnd < dayEnd) freeMinutes += dayEnd - lastEnd;

    if (freeMinutes <= 0) fullyBookedDates.add(date);
    if (hasConflict) conflictDates.add(date);
  }

  return { byDate, fullyBookedDates, conflictDates };
};

export function useFieldGames(
  fieldId: string,
  daysAhead: number = 60,
  availabilityWindow?: AvailabilityWindow,
) {
  const { t } = useTranslation();
  const openingTime = availabilityWindow?.openingTime;
  const closingTime = availabilityWindow?.closingTime;
  const [data, setData] = useState<FieldGameSet>({
    byDate: new Map(),
    fullyBookedDates: new Set(),
    conflictDates: new Set(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fieldId) {
      setData({ byDate: new Map(), fullyBookedDates: new Set(), conflictDates: new Set() });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const today = new Date();
    const startDate = format(today, 'yyyy-MM-dd');
    const endDate = format(addDays(today, daysAhead), 'yyyy-MM-dd');

    let cancelled = false;

    void getFieldAvailability({ fieldId, startDate, endDate })
      .then(({ data: response }) => {
        if (cancelled) return;
        if (response.truncated) {
          setData({ byDate: new Map(), fullyBookedDates: new Set(), conflictDates: new Set() });
          setError(t('feedback.fieldGames.loadError'));
          setLoading(false);
          return;
        }
        setData(processSlots(response.slots, { openingTime, closingTime }));
        setLoading(false);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.error('Error loading field availability:', err);
        setError(t('feedback.fieldGames.loadError'));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [closingTime, daysAhead, fieldId, openingTime, t]);

  return { data, loading, error };
}
