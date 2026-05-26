import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { responsiveFontSizes } from '@mui/material/styles';
import { futebaTheme, futebaDarkTheme } from '../theme';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('themeMode');
    return (saved as ThemeMode) || 'system';
  });

  // Inicializa isDark de forma síncrona para evitar flash na primeira renderização.
  // Sem esse lazy initializer, o tema light sempre pisca antes de aplicar o dark
  // salvo, pois o useEffect só roda após a montagem do componente.
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('themeMode') as ThemeMode | null;
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    // Modo 'system' (ou nenhuma preferência salva): respeita prefers-color-scheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateTheme = () => {
      if (mode === 'system') {
        setIsDark(mediaQuery.matches);
      } else {
        setIsDark(mode === 'dark');
      }
    };

    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);
    
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode(current => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'system';
      return 'light';
    });
  }, []);

  const value = useMemo<ThemeContextType>(() => ({
    mode, toggleTheme, setMode,
  }), [mode, toggleTheme]);

  const theme = useMemo(() => {
    const base = isDark ? futebaDarkTheme : futebaTheme;
    return responsiveFontSizes(base);
  }, [isDark]);

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useThemeContext = useTheme;
