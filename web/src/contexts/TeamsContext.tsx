import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useTeams as useTeamsHook } from '../hooks/useTeams';
import { FavoriteTeam } from '../types/team';

interface TeamsContextType {
  teams: FavoriteTeam[];
  teamsById: Map<string, FavoriteTeam>;
  loading: boolean;
  error: string | null;
}

const TeamsContext = createContext<TeamsContextType | undefined>(undefined);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const { teams, teamsById, loading, error } = useTeamsHook();

  const value = useMemo(
    () => ({ teams, teamsById, loading, error }),
    [teams, teamsById, loading, error]
  );

  return (
    <TeamsContext.Provider value={value}>
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error('useTeams must be used within a TeamsProvider');
  }
  return context;
}
