import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateGoogleCalendarUrl,
  generateOutlookCalendarUrl,
  generateIcsContent,
  downloadIcsFile,
  generateCalendarLinks,
  CalendarEvent,
} from './calendarLinks';

const makeEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  title: 'Pelada de Quinta',
  description: 'Jogo semanal do grupo',
  location: 'Arena Futeba',
  startDate: '2026-03-14',
  startTime: '20:00',
  endDate: '2026-03-14',
  endTime: '22:00',
  ...overrides,
});

describe('generateGoogleCalendarUrl', () => {
  it('gera URL do Google Calendar com action TEMPLATE', () => {
    const url = generateGoogleCalendarUrl(makeEvent());
    expect(url).toContain('https://calendar.google.com/calendar/render?');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('Pelada de Quinta');
    expect(parsed.searchParams.get('details')).toBe('Jogo semanal do grupo');
    expect(parsed.searchParams.get('location')).toBe('Arena Futeba');
  });

  it('formata dates como YYYYMMDDTHHmmss/YYYYMMDDTHHmmss', () => {
    const url = generateGoogleCalendarUrl(makeEvent());
    const dates = new URL(url).searchParams.get('dates');
    expect(dates).toBe('20260314T200000/20260314T220000');
  });

  it('usa horário de início como fim quando endTime vazio', () => {
    const url = generateGoogleCalendarUrl(makeEvent({ endTime: '' }));
    const dates = new URL(url).searchParams.get('dates');
    expect(dates).toBe('20260314T200000/20260314T200000');
  });

  it('remove hífens da data e dois-pontos do horário', () => {
    const url = generateGoogleCalendarUrl(
      makeEvent({ startDate: '2026-12-01', startTime: '09:30', endDate: '2026-12-01', endTime: '11:00' }),
    );
    const dates = new URL(url).searchParams.get('dates');
    expect(dates).toBe('20261201T093000/20261201T110000');
  });

  it('encoda caracteres especiais do título', () => {
    const url = generateGoogleCalendarUrl(makeEvent({ title: 'Pelada & Confraria' }));
    const parsed = new URL(url);
    expect(parsed.searchParams.get('text')).toBe('Pelada & Confraria');
  });
});

describe('generateOutlookCalendarUrl', () => {
  it('gera URL do Outlook deeplink com rru=addevent', () => {
    const url = generateOutlookCalendarUrl(makeEvent());
    expect(url).toContain('https://outlook.live.com/calendar/0/deeplink/compose?');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('rru')).toBe('addevent');
    expect(parsed.searchParams.get('subject')).toBe('Pelada de Quinta');
    expect(parsed.searchParams.get('body')).toBe('Jogo semanal do grupo');
    expect(parsed.searchParams.get('location')).toBe('Arena Futeba');
    expect(parsed.searchParams.get('allday')).toBe('false');
  });

  it('formata startdt/enddt como ISO local (YYYY-MM-DDTHH:mm:00)', () => {
    const url = generateOutlookCalendarUrl(makeEvent());
    expect(new URL(url).searchParams.get('startdt')).toBe('2026-03-14T20:00:00');
    expect(new URL(url).searchParams.get('enddt')).toBe('2026-03-14T22:00:00');
  });

  it('usa startDate como endDate quando endDate vazio', () => {
    const url = generateOutlookCalendarUrl(makeEvent({ endDate: '', endTime: '22:00' }));
    expect(new URL(url).searchParams.get('enddt')).toBe('2026-03-14T22:00:00');
  });

  it('usa horário de início como fim quando endTime vazio', () => {
    const url = generateOutlookCalendarUrl(makeEvent({ endTime: '' }));
    expect(new URL(url).searchParams.get('enddt')).toBe('2026-03-14T20:00:00');
  });
});

describe('generateIcsContent', () => {
  it('contém estrutura VCALENDAR/VEVENT/VALARM', () => {
    const ics = generateIcsContent(makeEvent());
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Futeba dos Parcas//PT-BR')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT1H');
    expect(ics).toContain('ACTION:DISPLAY');
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
  });

  it('formata DTSTART/DTEND em formato UTC-like local', () => {
    const ics = generateIcsContent(makeEvent());
    expect(ics).toContain('DTSTART:20260314T200000');
    expect(ics).toContain('DTEND:20260314T220000');
  });

  it('inclui SUMMARY, LOCATION e DESCRIPTION', () => {
    const ics = generateIcsContent(makeEvent());
    expect(ics).toContain('SUMMARY:Pelada de Quinta');
    expect(ics).toContain('DESCRIPTION:Jogo semanal do grupo');
    expect(ics).toContain('LOCATION:Arena Futeba');
  });

  it('escapa quebras de linha na descrição', () => {
    const ics = generateIcsContent(makeEvent({ description: 'linha1\nlinha2' }));
    const descLine = ics.split('\r\n').find((l) => l.includes('linha1'));
    expect(descLine).toBe('DESCRIPTION:linha1\\nlinha2');
    // o VALARM mantém o lembrete com o título
    expect(ics).toContain('DESCRIPTION:Lembrete: Pelada de Quinta');
  });

  it('usa startDate como DTEND quando endTime vazio', () => {
    const ics = generateIcsContent(makeEvent({ endTime: '' }));
    expect(ics).toContain('DTSTART:20260314T200000');
    expect(ics).toContain('DTEND:20260314T200000');
  });

  it('usa startDate quando endDate vazio e endTime presente', () => {
    const ics = generateIcsContent(makeEvent({ endDate: '', endTime: '22:30' }));
    expect(ics).toContain('DTEND:20260314T223000');
  });

  it('inclui DTSTAMP com timestamp UTC válido', () => {
    const ics = generateIcsContent(makeEvent());
    const line = ics.split('\r\n').find((l) => l.startsWith('DTSTAMP:'));
    expect(line).toBeDefined();
    expect(line).toMatch(/^DTSTAMP:\d{8}T\d{6}Z$/);
  });

  it('inclui lembrete no VALARM com o título', () => {
    const ics = generateIcsContent(makeEvent());
    expect(ics).toContain('DESCRIPTION:Lembrete: Pelada de Quinta');
  });

  it('linhas separadas por CRLF', () => {
    const ics = generateIcsContent(makeEvent());
    expect(ics).toContain('\r\n');
  });
});

describe('downloadIcsFile', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();
    (URL as unknown as Record<string, unknown>).createObjectURL = createObjectURL;
    (URL as unknown as Record<string, unknown>).revokeObjectURL = revokeObjectURL;
    appendChildSpy = vi.spyOn(document.body, 'appendChild');
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cria blob text/calendar e revoga a URL', () => {
    downloadIcsFile(makeEvent());
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/calendar;charset=utf-8');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });

  it('baixa arquivo .ics com nome derivado do título', () => {
    downloadIcsFile(makeEvent());
    expect(clickSpy).toHaveBeenCalledTimes(1);
    const link = appendChildSpy.mock.calls.find(
      (call: unknown[]) => call[0] instanceof HTMLAnchorElement,
    )?.[0] as HTMLAnchorElement;
    expect(link).toBeDefined();
    expect(link.download).toBe('pelada_de_quinta.ics');
    expect(link.href).toContain('blob:mock-url');
  });

  it('remove o link do body após o download', () => {
    downloadIcsFile(makeEvent());
    const links = document.body.querySelectorAll('a');
    expect(links).toHaveLength(0);
  });

  it('nome do arquivo remove espaços e normaliza para lowercase', () => {
    downloadIcsFile(makeEvent({ title: 'Pelada   DE SÁBADO   Especial' }));
    const link = appendChildSpy.mock.calls.find(
      (call: unknown[]) => call[0] instanceof HTMLAnchorElement,
    )?.[0] as HTMLAnchorElement;
    expect(link.download).toBe('pelada_de_sábado_especial.ics');
  });
});

describe('generateCalendarLinks', () => {
  it('retorna google, ical e outlook preenchidos', () => {
    const event = makeEvent();
    const links = generateCalendarLinks(event);
    expect(links.google).toBe(generateGoogleCalendarUrl(event));
    expect(links.ical).toBe(generateIcsContent(event));
    expect(links.outlook).toBe(generateOutlookCalendarUrl(event));
  });

  it('ical contém o conteúdo ICS completo', () => {
    const links = generateCalendarLinks(makeEvent());
    expect(links.ical).toContain('BEGIN:VCALENDAR');
    expect(links.ical).toContain('DTSTART:20260314T200000');
  });
});
