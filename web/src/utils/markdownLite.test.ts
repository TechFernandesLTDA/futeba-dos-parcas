import { describe, expect, it } from 'vitest';
import { parseMarkdownLite } from './markdownLite';

describe('parseMarkdownLite', () => {
  it('retorna vazio para string vazia', () => {
    expect(parseMarkdownLite('')).toEqual([]);
  });

  it('retorna um único segmento não-negrito quando não há marcação', () => {
    expect(parseMarkdownLite('texto simples')).toEqual([
      { text: 'texto simples', bold: false },
    ]);
  });

  it('parseia negrito no início da string (bug #3876)', () => {
    expect(
      parseMarkdownLite('**Carona mais discreta**: o painel agora fica atrás de um ícone.')
    ).toEqual([
      { text: 'Carona mais discreta', bold: true },
      { text: ': o painel agora fica atrás de um ícone.', bold: false },
    ]);
  });

  it('parseia múltiplos trechos em negrito', () => {
    expect(parseMarkdownLite('**a** meio **b** fim')).toEqual([
      { text: 'a', bold: true },
      { text: ' meio ', bold: false },
      { text: 'b', bold: true },
      { text: ' fim', bold: false },
    ]);
  });

  it('não deixa asteriscos literais nos segmentos resultantes', () => {
    const segments = parseMarkdownLite('**Gestor confirma jogadores**: organizadores...');
    const joined = segments.map((s) => s.text).join('');
    expect(joined).not.toContain('**');
  });

  it('trata negrito não fechado como texto puro (sem crash)', () => {
    expect(parseMarkdownLite('texto **sem fechamento')).toEqual([
      { text: 'texto **sem fechamento', bold: false },
    ]);
  });
});
