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

  it('fornece modo padrão "light" quando nada está salvo', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('mode').textContent).toBe('light');
  });

  it('toggleTheme alterna de light para dark', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // light -> dark (light é o padrão)
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('dark');
  });

  it('toggleTheme cicla entre light -> dark -> oled -> system', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    // light -> dark
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('dark');

    // dark -> oled
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('oled');

    // oled -> system
    await user.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('system');
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

  it('preserva a preferência explícita pelo tema do sistema', () => {
    localStorage.setItem('themeMode', 'system');
    matchMediaMock.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe('system');
    expect(document.documentElement.dataset.resolvedTheme).toBe('dark');
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

  it('trata valores inválidos do localStorage como light (default)', () => {
    localStorage.setItem('themeMode', 'invalid-value');

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    );

    expect(screen.getByTestId('mode').textContent).toBe('light');
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
