import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { InfiniteScrollTrigger } from './InfiniteScrollTrigger';

class MockIntersectionObserver {
  observe() { return null; }
  unobserve() { return null; }
  disconnect() { return null; }
}

beforeEach(() => {
  window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('InfiniteScrollTrigger', () => {
  it('mostra loading quando loading=true', () => {
    renderWithTheme(
      <InfiniteScrollTrigger onLoadMore={vi.fn()} hasMore loading />
    );
    expect(screen.getByText('Carregando mais...')).toBeInTheDocument();
  });

  it('mostra mensagem de fim quando hasMore=false', () => {
    renderWithTheme(
      <InfiniteScrollTrigger onLoadMore={vi.fn()} hasMore={false} loading={false} />
    );
    expect(screen.getByText('Você chegou ao fim!')).toBeInTheDocument();
  });

  it('mostra endMessage customizada quando fornecida', () => {
    renderWithTheme(
      <InfiniteScrollTrigger onLoadMore={vi.fn()} hasMore={false} loading={false} endMessage="Fim da lista" />
    );
    expect(screen.getByText('Fim da lista')).toBeInTheDocument();
  });

  it('não mostra texto quando hasMore e não loading', () => {
    renderWithTheme(
      <InfiniteScrollTrigger onLoadMore={vi.fn()} hasMore loading={false} />
    );
    expect(screen.queryByText('Carregando mais...')).not.toBeInTheDocument();
    expect(screen.queryByText('Você chegou ao fim!')).not.toBeInTheDocument();
  });

  it('mostra CircularProgress durante loading', () => {
    renderWithTheme(
      <InfiniteScrollTrigger onLoadMore={vi.fn()} hasMore loading />
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('não mostra progress quando não loading', () => {
    renderWithTheme(
      <InfiniteScrollTrigger onLoadMore={vi.fn()} hasMore={false} loading={false} />
    );
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('não mostra sentinel quando loading', () => {
    renderWithTheme(
      <InfiniteScrollTrigger onLoadMore={vi.fn()} hasMore loading />
    );
    expect(screen.getByText('Carregando mais...')).toBeInTheDocument();
  });

  it('mostra mensagem de fim customizada para null hasMore', () => {
    renderWithTheme(
      <InfiniteScrollTrigger onLoadMore={vi.fn()} hasMore={false} loading={false} endMessage="Chegamos ao fim" />
    );
    expect(screen.getByText('Chegamos ao fim')).toBeInTheDocument();
  });
});
