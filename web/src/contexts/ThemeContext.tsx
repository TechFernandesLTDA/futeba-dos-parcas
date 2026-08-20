import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { futebaTheme, futebaDarkTheme, futebaDarkOledTheme } from '../theme';

export type ThemeMode = 'light' | 'dark' | 'oled' | 'system';
// Novas instalações começam no tema claro. Preferências já salvas continuam
// sendo respeitadas, inclusive `system`, dark e OLED.
const DEFAULT_THEME_MODE: ThemeMode = 'light';
const THEME_MODES: ThemeMode[] = ['light', 'dark', 'oled', 'system'];

function parseThemeMode(value: string | null): ThemeMode {
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : DEFAULT_THEME_MODE;
}

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
  setDocumentThemeOverride: (mode: 'light' | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [documentThemeOverride, setDocumentThemeOverride] = useState<'light' | null>(null);
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

  useEffect(() => {
    const resolvedMode = documentThemeOverride ?? (mode === 'oled' ? 'dark' : isDark ? 'dark' : 'light');
    const resolvedTheme = resolvedMode === 'dark' ? futebaDarkTheme : futebaTheme;
    const themeColorElements = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
    );
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.resolvedTheme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
    themeColorElements.forEach((element) => {
      element.content = resolvedTheme.palette.primary.main;
      element.removeAttribute('media');
    });

    return () => {
      delete document.documentElement.dataset.theme;
      delete document.documentElement.dataset.resolvedTheme;
      document.documentElement.style.removeProperty('color-scheme');
    };
  }, [documentThemeOverride, isDark, mode]);

  const toggleTheme = useCallback(() => {
    setMode(current => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'oled';
      if (current === 'oled') return 'system';
      return 'light';
    });
  }, []);

  const value = useMemo<ThemeContextType>(() => ({
    mode, toggleTheme, setMode, setDocumentThemeOverride,
  }), [mode, toggleTheme]);

  // A typography MD3 já usa clamp() responsivo (#2751), tornando
  // responsiveFontSizes() redundante e conflitante (ele exige line-heights
  // unitless e não suporta fontSize com clamp). clamp() é a única estratégia
  // responsiva agora.
  //
  // #4070: a override de documento ("landing sempre clara", #3740) também
  // participa da escolha do tema MUI — sem isto, o <CssBaseline /> deste
  // provider continuava pintando o body com a paleta escura atrás de uma
  // landing clara (visível no overscroll). Fonte única de verdade: com a
  // override ativa não é mais necessário um MuiThemeProvider claro dentro da
  // página pública.
  const theme = useMemo(() => {
    if (documentThemeOverride === 'light') return futebaTheme;
    return mode === 'oled' ? futebaDarkOledTheme : isDark ? futebaDarkTheme : futebaTheme;
  }, [isDark, mode, documentThemeOverride]);

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
