import { describe, expect, it } from 'vitest';
import { gameCoordinatesForSave } from './gameCoordinates';

describe('gameCoordinatesForSave', () => {
  it('copia latitude e longitude do local', () => {
    expect(gameCoordinatesForSave(-23.5505, -46.6333)).toEqual({ locationLat: -23.5505, locationLng: -46.6333 });
  });

  it('aceita zero (linha do equador e meridiano)', () => {
    expect(gameCoordinatesForSave(0, 0)).toEqual({ locationLat: 0, locationLng: 0 });
  });

  it('sem coordenadas não grava nada', () => {
    expect(gameCoordinatesForSave(undefined, undefined)).toEqual({});
    expect(gameCoordinatesForSave(-23.55, undefined)).toEqual({});
    expect(gameCoordinatesForSave(null, -46.63)).toEqual({});
  });

  it('valor fora do intervalo ou não numérico não grava nada', () => {
    expect(gameCoordinatesForSave(91, 0)).toEqual({});
    expect(gameCoordinatesForSave(0, -181)).toEqual({});
    expect(gameCoordinatesForSave(Number.NaN, 0)).toEqual({});
    expect(gameCoordinatesForSave('-23.55', '-46.63')).toEqual({});
  });
});
