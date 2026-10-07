import { describe, expect, it } from 'vitest';
import {
  UPCOMING_GAME_STATUSES,
  SCHEDULING_BLOCKING_STATUSES,
  isSchedulingBlockingStatus,
  getIsPublicFromVisibility,
  getGameStartDate,
  isFutureGame,
  isUpcomingGame,
} from './gameLifecycle';

const NOW = new Date('2026-10-06T12:00:00Z');

describe('gameLifecycle', () => {
  describe('constantes exportadas', () => {
    it('UPCOMING_GAME_STATUSES cobre SCHEDULED, CONFIRMED e LIVE', () => {
      expect(UPCOMING_GAME_STATUSES).toEqual(['SCHEDULED', 'CONFIRMED', 'LIVE']);
    });

    it('SCHEDULING_BLOCKING_STATUSES cobre SCHEDULED, CONFIRMED e LIVE', () => {
      expect(SCHEDULING_BLOCKING_STATUSES).toEqual(['SCHEDULED', 'CONFIRMED', 'LIVE']);
    });
  });

  describe('isSchedulingBlockingStatus', () => {
    it.each(['SCHEDULED', 'CONFIRMED', 'LIVE'] as const)(
      'retorna true para status bloqueante %s',
      (status) => {
        expect(isSchedulingBlockingStatus(status)).toBe(true);
      },
    );

    it.each(['FINISHED', 'CANCELLED', 'scheduled', '', 'QUALQUER_COISA'] as const)(
      'retorna false para status não bloqueante "%s"',
      (status) => {
        expect(isSchedulingBlockingStatus(status)).toBe(false);
      },
    );

    it('retorna false para entrada não-string (undefined, null, números, objetos)', () => {
      expect(isSchedulingBlockingStatus(undefined)).toBe(false);
      expect(isSchedulingBlockingStatus(null)).toBe(false);
      expect(isSchedulingBlockingStatus(123)).toBe(false);
      expect(isSchedulingBlockingStatus({})).toBe(false);
      expect(isSchedulingBlockingStatus(['SCHEDULED'])).toBe(false);
    });
  });

  describe('getIsPublicFromVisibility', () => {
    it('retorna true para PUBLIC_OPEN', () => {
      expect(getIsPublicFromVisibility('PUBLIC_OPEN')).toBe(true);
    });

    it('retorna true para PUBLIC_CLOSED', () => {
      expect(getIsPublicFromVisibility('PUBLIC_CLOSED')).toBe(true);
    });

    it('retorna false para GROUP_ONLY', () => {
      expect(getIsPublicFromVisibility('GROUP_ONLY')).toBe(false);
    });

    it('retorna false para undefined', () => {
      expect(getIsPublicFromVisibility(undefined)).toBe(false);
    });

    it('retorna false para string vazia ou valores arbitrários', () => {
      expect(getIsPublicFromVisibility('')).toBe(false);
      expect(getIsPublicFromVisibility('public_open')).toBe(false);
      expect(getIsPublicFromVisibility('PUBLIC_OPEN ')).toBe(false);
    });
  });

  describe('getGameStartDate', () => {
    it('retorna dateTime diretamente quando já é Date', () => {
      const date = new Date('2026-10-10T15:00:00Z');
      expect(getGameStartDate({ dateTime: date, date: '2026-10-01', time: '10:00' })).toBe(date);
    });

    it('monta a data a partir de date + time quando dateTime não é Date', () => {
      const result = getGameStartDate({ dateTime: undefined, date: '2026-10-10', time: '15:30' });
      expect(result).not.toBeNull();
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(9); // outubro
      expect(result!.getDate()).toBe(10);
      expect(result!.getHours()).toBe(15);
      expect(result!.getMinutes()).toBe(30);
      expect(result!.getSeconds()).toBe(0);
    });

    it('retorna null quando date está ausente', () => {
      expect(getGameStartDate({ dateTime: undefined, date: undefined, time: '15:30' })).toBeNull();
    });

    it('retorna null quando time está ausente', () => {
      expect(getGameStartDate({ dateTime: undefined, date: '2026-10-10', time: undefined })).toBeNull();
    });

    it('retorna null quando ambos date e time estão ausentes', () => {
      expect(getGameStartDate({ dateTime: undefined, date: undefined, time: undefined })).toBeNull();
    });

    it('retorna null para strings que produzem data inválida', () => {
      expect(getGameStartDate({ dateTime: undefined, date: 'nao-e-data', time: '99:99' })).toBeNull();
      expect(getGameStartDate({ dateTime: undefined, date: '2026-13-45', time: '10:00' })).toBeNull();
    });

    it('não trata dateTime como Date se não for instância de Date (ex.: string)', () => {
      // dateTime string ISO cai no caminho date+time; aqui date/time ausentes => null
      const result = getGameStartDate({ dateTime: '2026-10-10T15:00:00Z' as never, date: undefined, time: undefined });
      expect(result).toBeNull();
    });
  });

  describe('isFutureGame', () => {
    const futureGame = { dateTime: undefined, date: '2026-10-06', time: '23:00' };
    const pastGame = { dateTime: undefined, date: '2026-10-01', time: '08:00' };

    it('retorna true para jogo cujo início é depois de now', () => {
      expect(isFutureGame(futureGame, NOW)).toBe(true);
    });

    it('retorna false para jogo cujo início já passou', () => {
      expect(isFutureGame(pastGame, NOW)).toBe(false);
    });

    it('retorna true quando o início é exatamente igual a now (>=)', () => {
      const now = new Date('2026-10-06T12:00:00');
      expect(isFutureGame({ dateTime: now, date: undefined, time: undefined }, now)).toBe(true);
    });

    it('usa dateTime Date diretamente', () => {
      expect(
        isFutureGame({ dateTime: new Date('2026-12-31T00:00:00'), date: undefined, time: undefined }, NOW),
      ).toBe(true);
    });

    it('retorna false quando não é possível derivar a data de início', () => {
      expect(isFutureGame({ dateTime: undefined, date: undefined, time: undefined }, NOW)).toBe(false);
    });

    it('usa o horário atual por padrão quando now não é informado', () => {
      expect(isFutureGame({ dateTime: new Date(Date.now() + 60_000), date: undefined, time: undefined })).toBe(true);
      expect(isFutureGame({ dateTime: new Date(Date.now() - 60_000), date: undefined, time: undefined })).toBe(false);
    });
  });

  describe('isUpcomingGame', () => {
    it('retorna true para jogo SCHEDULED com início no futuro', () => {
      expect(
        isUpcomingGame({ status: 'SCHEDULED', date: '2026-10-06', time: '23:00' }, NOW),
      ).toBe(true);
    });

    it.each(['CONFIRMED', 'LIVE'] as const)('retorna true para status %s no futuro', (status) => {
      expect(isUpcomingGame({ status, date: '2026-10-06', time: '23:00' }, NOW)).toBe(true);
    });

    it.each(['FINISHED', 'CANCELLED'] as const)(
      'retorna false para status terminal %s mesmo com início no futuro',
      (status) => {
        expect(isUpcomingGame({ status, date: '2026-10-06', time: '23:00' }, NOW)).toBe(false);
      },
    );

    it('retorna false para jogo ativo com início no passado', () => {
      expect(isUpcomingGame({ status: 'SCHEDULED', date: '2026-10-01', time: '08:00' }, NOW)).toBe(false);
    });

    it('retorna false quando a data de início não pode ser derivada', () => {
      expect(isUpcomingGame({ status: 'SCHEDULED', date: undefined, time: undefined }, NOW)).toBe(false);
    });
  });
});
