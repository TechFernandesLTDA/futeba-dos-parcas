import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';

// Mock window.matchMedia para jsdom
const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock,
});

// Componente auxiliar para acessar o contexto
function ThemeConsumer() {
  const { mode, toggleTheme, setMode } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setMode('dark')}>set-dark</button>
      <button onClick={() => setMode('light')}>set-light</button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('fornece modo padrão "system" quando nada está salvo (respeita prefers-color-scheme)', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('mode').textContent).toBe('system');
  });

  it('toggleTheme alterna de system para light', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // system -> light (system é o padrão)
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('toggleTheme cicla entre system -> light -> dark -> oled', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // system -> light
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('light');

    // light -> dark
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('dark');

    // dark -> oled
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('oled');
  });

  it('persiste preferência de tema no localStorage', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    await user.click(screen.getByText('set-dark'));
    expect(localStorage.getItem('themeMode')).toBe('dark');
  });

  it('carrega tema salvo do localStorage', () => {
    localStorage.setItem('themeMode', 'light');

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('setMode define o modo corretamente', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    await user.click(screen.getByText('set-dark'));
    expect(screen.getByTestId('mode').textContent).toBe('dark');

    await user.click(screen.getByText('set-light'));
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('filhos recebem os valores do contexto', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // Verifica que o componente filho renderiza sem erro
    expect(screen.getByTestId('mode')).toBeInTheDocument();
    expect(screen.getByText('toggle')).toBeInTheDocument();
  });

  it('trata valores inválidos do localStorage como system (default)', () => {
    localStorage.setItem('themeMode', 'invalid-value');

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe('system');
  });

  it('useTheme lança erro quando usado fora do ThemeProvider', () => {
    // Suprimir erro no console durante o teste
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<ThemeConsumer />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });
});
