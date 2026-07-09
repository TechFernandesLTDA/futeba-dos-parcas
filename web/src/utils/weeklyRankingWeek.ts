function getWeekKey(date: Date): string {
  const year = date.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.ceil((days + startOfYear.getUTCDay() + 1) / 7);
  return `${year}-${String(weekNum).padStart(2, '0')}`;
}
function toBrtWallClockDate(referenceDate: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(referenceDate);

  const getPart = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const hour = getPart('hour') % 24;

  return new Date(Date.UTC(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    hour,
    getPart('minute'),
    getPart('second')
  ));
}

export function getCompletedWeekKey(referenceDate: Date = new Date()): string {
  const brtNow = toBrtWallClockDate(referenceDate);
  const previousDay = new Date(brtNow.getTime() - 24 * 60 * 60 * 1000);
  return getWeekKey(previousDay);
}
