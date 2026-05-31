export type RecurrenceType = 'weekly' | 'biweekly' | 'monthly';

export interface RecurrencePreview {
  date: string;
  dayOfWeek: string;
  time: string;
  hasConflict: boolean;
  formattedDate: string;
}

export function getNextRecurrenceDates(
  baseDate: string,
  baseTime: string,
  recurrence: RecurrenceType,
  count: number = 4,
): Date[] {
  const [year, month, day] = baseDate.split('-').map(Number);
  const [hours, minutes] = baseTime.split(':').map(Number);
  const base = new Date(year, month - 1, day, hours, minutes);

  const dates: Date[] = [];
  const intervalDays = recurrence === 'weekly' ? 7 : recurrence === 'biweekly' ? 14 : null;

  for (let i = 1; i <= count; i++) {
    const next = new Date(base);
    if (intervalDays !== null) {
      next.setDate(next.getDate() + intervalDays * i);
    } else {
      // monthly: same day next month(s)
      next.setMonth(next.getMonth() + i);
    }
    dates.push(next);
  }

  return dates;
}

export function formatRecurrencePreview(
  dates: Date[],
  hasConflictFlags: boolean[] = [],
): RecurrencePreview[] {
  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return dates.map((d, i) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dateStr = `${day}/${month}/${d.getFullYear()}`;

    return {
      date: d.toISOString().split('T')[0],
      dayOfWeek: dayNames[d.getDay()],
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      hasConflict: hasConflictFlags[i] || false,
      formattedDate: `${dayNames[d.getDay()]} ${dateStr}`,
    };
  });
}
