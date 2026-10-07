import { describe, it, expect } from 'vitest';
import { FieldAvailabilitySlot } from '../services/cloudFunctions';
import { findAvailabilityConflict } from './fieldAvailability';

const makeSlot = (start: number, end: number): FieldAvailabilitySlot => ({
  date: '2026-03-14',
  startMinutes: start,
  endMinutes: end,
});

describe('findAvailabilityConflict', () => {
  it('retorna undefined para lista vazia', () => {
    expect(findAvailabilityConflict([], 600, 720)).toBeUndefined();
  });

  it('detecta conflito com slot totalmente sobreposto', () => {
    const slots = [makeSlot(600, 720)];
    expect(findAvailabilityConflict(slots, 570, 750)).toBe(slots[0]);
  });

  it('detecta conflito quando novo horário começa dentro do slot', () => {
    const slots = [makeSlot(600, 720)];
    expect(findAvailabilityConflict(slots, 630, 750)).toBe(slots[0]);
  });

  it('detecta conflito quando novo horário termina dentro do slot', () => {
    const slots = [makeSlot(600, 720)];
    expect(findAvailabilityConflict(slots, 540, 660)).toBe(slots[0]);
  });

  it('detecta conflito quando slot está contido no novo horário', () => {
    const slots = [makeSlot(600, 660)];
    expect(findAvailabilityConflict(slots, 540, 720)).toBe(slots[0]);
  });

  it('não detecta conflito quando termina exatamente no início do slot', () => {
    const slots = [makeSlot(600, 720)];
    expect(findAvailabilityConflict(slots, 540, 600)).toBeUndefined();
  });

  it('não detecta conflito quando começa exatamente no fim do slot', () => {
    const slots = [makeSlot(600, 720)];
    expect(findAvailabilityConflict(slots, 720, 780)).toBeUndefined();
  });

  it('não detecta conflito quando o horário é totalmente anterior', () => {
    const slots = [makeSlot(600, 720)];
    expect(findAvailabilityConflict(slots, 400, 500)).toBeUndefined();
  });

  it('não detecta conflito quando o horário é totalmente posterior', () => {
    const slots = [makeSlot(600, 720)];
    expect(findAvailabilityConflict(slots, 800, 900)).toBeUndefined();
  });

  it('retorna o primeiro slot em conflito quando há vários', () => {
    const slots = [makeSlot(610, 700), makeSlot(620, 730)];
    expect(findAvailabilityConflict(slots, 640, 660)).toBe(slots[0]);
  });

  it('encontra slot em conflito depois de slots livres', () => {
    const slots = [makeSlot(100, 200), makeSlot(300, 400), makeSlot(500, 600)];
    expect(findAvailabilityConflict(slots, 550, 650)).toBe(slots[2]);
  });

  it('slot de duração zero dentro do horário conta como conflito (predicado aberto)', () => {
    const slots = [makeSlot(600, 600)];
    expect(findAvailabilityConflict(slots, 540, 720)).toBe(slots[0]);
  });

  it('trata horário de duração zero como sem conflito', () => {
    const slots = [makeSlot(600, 720)];
    expect(findAvailabilityConflict(slots, 600, 600)).toBeUndefined();
  });

  it('funciona com minutos cruzando meia-noite (valores grandes)', () => {
    const slots = [makeSlot(1380, 1440)]; // 23:00 - 24:00
    expect(findAvailabilityConflict(slots, 1395, 1400)).toBe(slots[0]);
  });
});
