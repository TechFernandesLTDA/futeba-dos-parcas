export interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const startDateTime = `${event.startDate.replace(/-/g, '')}T${event.startTime.replace(/:/g, '')}00`;
  const endDateTime = event.endTime
    ? `${event.endDate.replace(/-/g, '')}T${event.endTime.replace(/:/g, '')}00`
    : startDateTime;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.description,
    location: event.location,
    dates: `${startDateTime}/${endDateTime}`,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function generateOutlookCalendarUrl(event: CalendarEvent): string {
  const startDateTime = `${event.startDate}T${event.startTime}:00`;
  const endDateTime = event.endTime
    ? `${event.endDate || event.startDate}T${event.endTime}:00`
    : startDateTime;

  const params = new URLSearchParams({
    rru: 'addevent',
    startdt: startDateTime,
    enddt: endDateTime,
    subject: event.title,
    body: event.description,
    location: event.location,
    allday: 'false',
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function generateIcsContent(event: CalendarEvent): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  const [sy, sm, sd] = event.startDate.split('-').map(Number);
  const [sh, smin] = event.startTime.split(':').map(Number);
  const start = `${sy}${pad(sm)}${pad(sd)}T${pad(sh)}${pad(smin)}00`;

  let end = start;
  if (event.endTime) {
    const [ey, em, ed] = (event.endDate || event.startDate).split('-').map(Number);
    const [eh, emin] = event.endTime.split(':').map(Number);
    end = `${ey}${pad(em)}${pad(ed)}T${pad(eh)}${pad(emin)}00`;
  }

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Futeba dos Parcas//PT-BR',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `DTSTAMP:${now}`,
    `SUMMARY:${event.title}`,
    `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
    `LOCATION:${event.location}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Lembrete: ${event.title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcsFile(event: CalendarEvent): void {
  const content = generateIcsContent(event);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/\s+/g, '_').toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateCalendarLinks(event: CalendarEvent): {
  google: string;
  ical: string;
  outlook: string;
} {
  return {
    google: generateGoogleCalendarUrl(event),
    ical: generateIcsContent(event),
    outlook: generateOutlookCalendarUrl(event),
  };
}
