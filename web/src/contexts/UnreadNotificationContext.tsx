import { createContext, useContext, type ReactNode } from 'react';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { useAuth } from './AuthContext';

type UnreadNotificationSummary = ReturnType<typeof useUnreadNotificationCount>;

const UnreadNotificationContext = createContext<UnreadNotificationSummary | null>(null);

/** Mantém uma única assinatura Firestore para todas as superfícies de navegação. */
export function UnreadNotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const summary = useUnreadNotificationCount(user?.id);

  return (
    <UnreadNotificationContext.Provider value={summary}>
      {children}
    </UnreadNotificationContext.Provider>
  );
}

// Provider e consumer ficam no mesmo módulo para preservar o chunk compartilhado
// de AuthContext entre o shell principal e a sidebar lazy.
// eslint-disable-next-line react-refresh/only-export-components
export function useUnreadNotificationSummary(): UnreadNotificationSummary {
  const summary = useContext(UnreadNotificationContext);
  if (!summary) {
    throw new Error('useUnreadNotificationSummary must be used within UnreadNotificationProvider');
  }
  return summary;
}
