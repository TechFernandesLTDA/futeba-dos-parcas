/**
 * Papel sobre o local (quadra) para o gerenciamento de locais.
 *
 * Papéis: dono do local, gestor (manager) do local, usuário de outra conta de
 * administração e visitante sem vínculo.
 */
import { describe, expect, it } from 'vitest';
import { canManageLocation, type Location } from '../../types/location';

const DONO_LOCAL = 'user-owner';
const GESTOR_LOCAL = 'user-manager';
const OUTRO_USUARIO = 'user-other-group';

function local(overrides: Partial<Location> = {}): Location {
  return {
    id: 'location-1',
    ownerId: DONO_LOCAL,
    managers: [GESTOR_LOCAL],
    ...overrides,
  } as unknown as Location;
}

describe('canManageLocation: quem gerencia a quadra', () => {
  it('dono do local gerencia', () => {
    expect(canManageLocation(local(), DONO_LOCAL)).toBe(true);
  });

  it('gestor cadastrado no local gerencia', () => {
    expect(canManageLocation(local(), GESTOR_LOCAL)).toBe(true);
  });

  it('visitante ou usuário sem vínculo NÃO gerencia o local', () => {
    expect(canManageLocation(local(), OUTRO_USUARIO)).toBe(false);
  });
});
