export type SupportedRecurrenceType = 'weekly' | 'biweekly' | 'monthly';

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function toLocalDateString(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function applyRecurrenceInterval(date: Date, recurrenceType?: string) {
  if (recurrenceType === 'biweekly') {
    date.setDate(date.getDate() + 14);
    return;
  }

  if (recurrenceType === 'monthly') {
    date.setMonth(date.getMonth() + 1);
    return;
  }

  date.setDate(date.getDate() + 7);
}

export function getNextRecurringDate(baseDate: string, recurrenceType?: string) {
  const [year, month, day] = baseDate.split('-').map(Number);
  const nextDate = new Date(year, month - 1, day);
  applyRecurrenceInterval(nextDate, recurrenceType);
  return toLocalDateString(nextDate);
}

export function calculateNextOccurrence(
  time: string,
  recurrenceType?: string,
  now: Date = new Date(),
): { date: string; time: string } {
  const [hours, minutes] = time.split(':').map(Number);
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0,
  );

  if (candidate.getTime() > now.getTime()) {
    return { date: toLocalDateString(candidate), time };
  }

  const next = new Date(candidate);
  if (recurrenceType === 'weekly' || recurrenceType === 'biweekly' || recurrenceType === 'monthly') {
    applyRecurrenceInterval(next, recurrenceType);
  } else {
    next.setDate(next.getDate() + 1);
  }

  return { date: toLocalDateString(next), time };
}
