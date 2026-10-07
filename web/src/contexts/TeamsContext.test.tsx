// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

/**
 * TeamsContext é majoritariamente glue sobre useTeams (#do repo): injeta o hook,
 * memoriza o value e guarda o consumo fora do provider. O hook real (Firestore)
 * é testado em sua própria suíte — aqui mockamos e validamos o contrato do
 * provider: passthrough, memoização e o guard do useTeams.
 */
const mockUseTeamsReturn: any = {
  teams: [
    { id: 'team-1', name: 'Time A' },
    { id: 'team-2', name: 'Time B' },
  ],
  teamsById: new Map([
    ['team-1', { id: 'team-1', name: 'Time A' }],
    ['team-2', { id: 'team-2', name: 'Time B' }],
  ]),
  loading: false,
  error: null,
};

let mockUseTeamsHook: any = () => mockUseTeamsReturn;

vi.mock('../hooks/useTeams', () => ({
  useTeams: () => mockUseTeamsHook(),
}));

import { TeamsProvider, useTeams } from './TeamsContext';

function renderTeamsHook() {
  return renderHook(() => useTeams(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <TeamsProvider>{children}</TeamsProvider>
    ),
  });
}

describe('TeamsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTeamsHook = () => mockUseTeamsReturn;
  });

  it('expõe teams, teamsById, loading e error do hook subjacente', () => {
    const { result } = renderTeamsHook();
    expect(result.current.teams).toEqual(mockUseTeamsReturn.teams);
    expect(result.current.teamsById).toBe(mockUseTeamsReturn.teamsById);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('expõe estado de loading do hook', () => {
    mockUseTeamsHook = () => ({ teams: [], teamsById: new Map(), loading: true, error: null });
    const { result } = renderTeamsHook();
    expect(result.current.loading).toBe(true);
    expect(result.current.teams).toEqual([]);
  });

  it('expõe erro do hook', () => {
    mockUseTeamsHook = () => ({ teams: [], teamsById: new Map(), loading: false, error: 'permission-denied' });
    const { result } = renderTeamsHook();
    expect(result.current.error).toBe('permission-denied');
  });

  it('teamsById é o Map indexado por id', () => {
    const { result } = renderTeamsHook();
    expect(result.current.teamsById).toBeInstanceOf(Map);
    expect(result.current.teamsById.get('team-1')?.name).toBe('Time A');
    expect(result.current.teamsById.get('team-2')?.name).toBe('Time B');
  });

  it('memoiza o value: rerender sem mudanças mantém a mesma referência', () => {
    const { result, rerender } = renderTeamsHook();
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('produz um novo value quando o hook muda de estado', () => {
    const { result, rerender } = renderTeamsHook();
    const first = result.current;
    mockUseTeamsHook = () => ({ ...mockUseTeamsReturn, loading: true });
    rerender();
    expect(result.current).not.toBe(first);
    expect(result.current.loading).toBe(true);
  });

  it('chama o hook useTeams exatamente uma vez por render do provider', () => {
    const spy = vi.fn(() => mockUseTeamsReturn);
    mockUseTeamsHook = spy;
    renderTeamsHook();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('lança erro ao usar useTeams fora do TeamsProvider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTeams())).toThrow('useTeams must be used within a TeamsProvider');
    errorSpy.mockRestore();
  });
});