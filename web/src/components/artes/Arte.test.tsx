import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { Arte, Pictograma, CSS_ANIMACOES_ARTE } from './Arte';
import { ARTES, PALETA_CLARO, PALETA_ESCURO, PICTOGRAMAS, type ArteId, type PictogramaId } from './artes.generated';

function mockReducedMotion(reduzir: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query.includes('reduce') ? reduzir : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
}

const claro = createTheme({ palette: { mode: 'light' } });
const escuro = createTheme({ palette: { mode: 'dark' } });
const comTema = (ui: React.ReactElement, tema = claro) => render(<ThemeProvider theme={tema}>{ui}</ThemeProvider>);

describe('Arte', () => {
  afterEach(() => vi.restoreAllMocks());

  it('desenha todas as artes do catálogo sem texto embutido', () => {
    mockReducedMotion(false);
    for (const id of Object.keys(ARTES) as ArteId[]) {
      const { container, unmount } = comTema(<Arte id={id} />);
      const svg = container.querySelector(`svg[data-arte="${id}"]`);
      expect(svg).toBeInTheDocument();
      expect(svg!.querySelectorAll('path').length).toBeGreaterThan(0);
      expect(svg!.querySelector('text')).toBeNull();
      unmount();
    }
  });

  it('é decorativa por padrão e informativa com título', () => {
    mockReducedMotion(false);
    const { container } = comTema(<Arte id="campo" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    comTema(<Arte id="podio" titulo="Pódio com taça" />);
    expect(screen.getByRole('img', { name: 'Pódio com taça' })).toBeInTheDocument();
  });

  it('usa a paleta escura no tema escuro', () => {
    mockReducedMotion(false);
    const { container: c1 } = comTema(<Arte id="campo" />);
    const { container: c2 } = comTema(<Arte id="campo" />, escuro);
    const fills = (c: HTMLElement) => Array.from(c.querySelectorAll('path')).map((p) => p.getAttribute('fill'));
    expect(fills(c1)).toContain(PALETA_CLARO.grama);
    expect(fills(c2)).toContain(PALETA_ESCURO.grama);
    expect(fills(c2)).not.toContain(PALETA_CLARO.grama);
  });

  it('anima só sem "reduzir movimento"', () => {
    mockReducedMotion(false);
    const { container: animada } = comTema(<Arte id="campo" />);
    expect(animada.querySelector('.fdp-arte-rolar')).toBeInTheDocument();
    expect(animada.querySelector('style')).toBeInTheDocument();
    vi.restoreAllMocks();
    mockReducedMotion(true);
    const { container: parada } = comTema(<Arte id="campo" />);
    expect(parada.querySelector('.fdp-arte-rolar')).toBeNull();
    expect(parada.querySelector('style')).toBeNull();
  });

  it('gera CSS das quatro animações a partir da especificação compartilhada', () => {
    for (const nome of ['rolar', 'cair', 'piscar', 'quicar']) {
      expect(CSS_ANIMACOES_ARTE).toContain(`@keyframes fdp-arte-${nome}`);
    }
    expect(CSS_ANIMACOES_ARTE).toContain('2400ms infinite alternate');
  });
});

describe('Pictograma', () => {
  it('desenha os 14 pictogramas com traço em currentColor', () => {
    const ids = Object.keys(PICTOGRAMAS) as PictogramaId[];
    expect(ids).toHaveLength(14);
    for (const id of ids) {
      const { container, unmount } = comTema(<Pictograma id={id} />);
      const paths = container.querySelectorAll('svg path');
      expect(paths.length).toBe(PICTOGRAMAS[id].length);
      paths.forEach((p) => expect(p).toHaveAttribute('stroke', 'currentColor'));
      unmount();
    }
  });
});
