import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { futebaTheme, futebaDarkTheme, futebaDarkOledTheme } from '../theme';

export type ThemeMode = 'light' | 'dark' | 'oled' | 'system';
const DEFAULT_THEME_MODE: ThemeMode = 'light';
const THEME_MODES: ThemeMode[] = ['light', 'dark', 'oled', 'system'];

function parseThemeMode(value: string | null): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : DEFAULT_THEME_MODE;
}

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      return parseThemeMode(localStorage.getItem('themeMode'));
    } catch (error) {
      console.warn('Failed to read themeMode from localStorage:', error);
      return DEFAULT_THEME_MODE;
    }
  });

  // Inicializa isDark de forma síncrona para evitar flash na primeira renderização.
  // Sem esse lazy initializer, o tema light sempre pisca antes de aplicar o dark
  // salvo, pois o useEffect só roda após a montagem do componente.
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = parseThemeMode(localStorage.getItem('themeMode'));
      if (saved === 'dark' || saved === 'oled') return true;
      if (saved === 'light') return false;
      // Modo 'system' explicitamente salvo: respeita prefers-color-scheme.
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (error) {
      console.warn('Failed to read themeMode from localStorage:', error);
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateTheme = () => {
      if (mode === 'system') {
        setIsDark(mediaQuery.matches);
      } else {
        setIsDark(mode === 'dark' || mode === 'oled');
      }
    };

    updateTheme();
    mediaQuery.addEventListener('change', updateTheme);
    
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem('themeMode', mode);
    } catch (error) {
      console.warn('Failed to save themeMode to localStorage:', error);
    }
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode(current => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'oled';
      if (current === 'oled') return 'system';
      return 'light';
    });
  }, []);

  const value = useMemo<ThemeContextType>(() => ({
    mode, toggleTheme, setMode,
  }), [mode, toggleTheme]);

  // A typography MD3 já usa clamp() responsivo (#2751), tornando
  // responsiveFontSizes() redundante e conflitante (ele exige line-heights
  // unitless e não suporta fontSize com clamp). clamp() é a única estratégia
  // responsiva agora.
  const theme = useMemo(() => {
    return mode === 'oled' ? futebaDarkOledTheme : isDark ? futebaDarkTheme : futebaTheme;
  }, [isDark, mode]);

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
