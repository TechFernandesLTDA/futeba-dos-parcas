import { describe, it, expect } from 'vitest';
import {
  getNextRecurrenceDates,
  formatRecurrencePreview,
  RecurrenceType,
} from './recurrencePreview';

describe('getNextRecurrenceDates', () => {
  it('retorna 4 datas semanais por padrão (intervalo de 7 dias)', () => {
    const dates = getNextRecurrenceDates('2026-03-07', '20:00', 'weekly');
    expect(dates).toHaveLength(4);
    // 07/03/2026 é sábado; semanas seguintes: 14, 21, 28/03
    expect(dates[0].getDate()).toBe(14);
    expect(dates[1].getDate()).toBe(21);
    expect(dates[2].getDate()).toBe(28);
    expect(dates[3].getDate()).toBe(4);
    expect(dates[3].getMonth()).toBe(3); // abril
  });

  it('semanal: preserva dia da semana e horário', () => {
    const dates = getNextRecurrenceDates('2026-03-07', '20:00', 'weekly');
    for (const d of dates) {
      expect(d.getDay()).toBe(6); // sábado
      expect(d.getHours()).toBe(20);
      expect(d.getMinutes()).toBe(0);
    }
  });

  it('quinzenal: intervalo de 14 dias', () => {
    const dates = getNextRecurrenceDates('2026-03-07', '20:00', 'biweekly', 2);
    expect(dates).toHaveLength(2);
    expect(dates[0].getDate()).toBe(21);
    expect(dates[1].getDate()).toBe(4);
    expect(dates[1].getMonth()).toBe(3);
  });

  it('mensal: mesmo dia nos meses seguintes', () => {
    const dates = getNextRecurrenceDates('2026-03-07', '20:00', 'monthly', 3);
    expect(dates).toHaveLength(3);
    expect(dates[0].getMonth()).toBe(3); // 07/04
    expect(dates[0].getDate()).toBe(7);
    expect(dates[1].getMonth()).toBe(4); // 07/05
    expect(dates[2].getMonth()).toBe(5); // 07/06
  });

  it('mensal: preserva horário', () => {
    const dates = getNextRecurrenceDates('2026-03-07', '21:30', 'monthly', 1);
    expect(dates[0].getHours()).toBe(21);
    expect(dates[0].getMinutes()).toBe(30);
  });

  it('respeita count customizado', () => {
    expect(getNextRecurrenceDates('2026-03-07', '20:00', 'weekly', 1)).toHaveLength(1);
    expect(getNextRecurrenceDates('2026-03-07', '20:00', 'weekly', 6)).toHaveLength(6);
  });

  it('retorna array vazio para count 0', () => {
    expect(getNextRecurrenceDates('2026-03-07', '20:00', 'weekly', 0)).toEqual([]);
  });

  it('não inclui a data base no resultado (começa na 1ª recorrência)', () => {
    const dates = getNextRecurrenceDates('2026-03-07', '20:00', 'weekly', 2);
    for (const d of dates) {
      expect(d.getTime()).not.toBe(new Date(2026, 2, 7, 20, 0).getTime());
    }
  });

  it('não muta a data base (Date interno)', () => {
    const dates = getNextRecurrenceDates('2026-03-07', '20:00', 'weekly', 1);
    expect(dates[0].getDate()).toBe(14);
  });

  it('funciona com horário contendo minutos', () => {
    const dates = getNextRecurrenceDates('2026-03-07', '19:45', 'weekly', 1);
    expect(dates[0].getHours()).toBe(19);
    expect(dates[0].getMinutes()).toBe(45);
  });

  it('tipos válidos de recorrência', () => {
    const tipos: RecurrenceType[] = ['weekly', 'biweekly', 'monthly'];
    for (const tipo of tipos) {
      expect(getNextRecurrenceDates('2026-03-07', '20:00', tipo, 1)).toHaveLength(1);
    }
  });
});

describe('formatRecurrencePreview', () => {
  it('formata datas com dia da semana e data DD/MM/YYYY', () => {
    const result = formatRecurrencePreview([new Date(2026, 2, 14, 20, 0)]);
    expect(result).toHaveLength(1);
    expect(result[0].dayOfWeek).toBe('Sáb');
    expect(result[0].formattedDate).toBe('Sáb 14/03/2026');
    expect(result[0].time).toBe('20:00');
  });

  it('retorna date em ISO (YYYY-MM-DD)', () => {
    const result = formatRecurrencePreview([new Date(2026, 2, 14, 20, 0)]);
    expect(result[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result[0].date).toBe('2026-03-14');
  });

  it('hasConflict default é false quando flags não informadas', () => {
    const result = formatRecurrencePreview([new Date(2026, 2, 14, 20, 0)]);
    expect(result[0].hasConflict).toBe(false);
  });

  it('aplica flags de conflito por posição', () => {
    const dates = [new Date(2026, 2, 14, 20, 0), new Date(2026, 2, 21, 20, 0)];
    const result = formatRecurrencePreview(dates, [true, false]);
    expect(result[0].hasConflict).toBe(true);
    expect(result[1].hasConflict).toBe(false);
  });

  it('flags ausentes além do tamanho do array viram false', () => {
    const dates = [new Date(2026, 2, 14, 20, 0), new Date(2026, 2, 21, 20, 0)];
    const result = formatRecurrencePreview(dates, [true]);
    expect(result[1].hasConflict).toBe(false);
  });

  it('mapeia todos os dias da semana corretamente', () => {
    // 2026-03-08 (dom) até 2026-03-14 (sáb)
    const dates = [
      new Date(2026, 2, 8, 10, 0),
      new Date(2026, 2, 9, 10, 0),
      new Date(2026, 2, 10, 10, 0),
      new Date(2026, 2, 11, 10, 0),
      new Date(2026, 2, 12, 10, 0),
      new Date(2026, 2, 13, 10, 0),
      new Date(2026, 2, 14, 10, 0),
    ];
    const result = formatRecurrencePreview(dates);
    const namesExpected = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    result.forEach((r, i) => {
      expect(r.dayOfWeek).toBe(namesExpected[i]);
    });
  });

  it('formata horário com zero à esquerda', () => {
    const result = formatRecurrencePreview([new Date(2026, 2, 14, 8, 5, 0)]);
    expect(result[0].time).toBe('08:05');
  });

  it('formata data com zero à esquerda em dia e mês', () => {
    const result = formatRecurrencePreview([new Date(2026, 0, 2, 10, 0)]);
    expect(result[0].formattedDate).toBe('Sex 02/01/2026');
  });

  it('retorna array vazio para lista vazia', () => {
    expect(formatRecurrencePreview([])).toEqual([]);
  });

  it('não muta as datas de entrada', () => {
    const d = new Date(2026, 2, 14, 20, 0);
    const original = d.getTime();
    formatRecurrencePreview([d], [true]);
    expect(d.getTime()).toBe(original);
  });
});
