import { describe, expect, it } from 'vitest';
import { mergeRealtimePageById } from './realtimePageMerge';

describe('mergeRealtimePageById', () => {
  it('preserva historico paginado do chat quando a pagina realtime muda', () => {
    const existing = [
      { id: 'm-1', text: 'mais antiga' },
      { id: 'm-2', text: 'antiga' },
      { id: 'm-3', text: 'recente' },
      { id: 'm-4', text: 'mais recente' },
    ];
    const livePage = [
      { id: 'm-3', text: 'recente (editada)' },
      { id: 'm-4', text: 'mais recente' },
      { id: 'm-5', text: 'nova' },
    ];

    const merged = mergeRealtimePageById(
      existing,
      livePage,
      ['m-3', 'm-4', 'm-5'],
      'append',
    );

    expect(merged).toEqual([
      { id: 'm-1', text: 'mais antiga' },
      { id: 'm-2', text: 'antiga' },
      { id: 'm-3', text: 'recente (editada)' },
      { id: 'm-4', text: 'mais recente' },
      { id: 'm-5', text: 'nova' },
    ]);
  });

  it('remove posts que sairam da pagina realtime por soft delete no mural', () => {
    const existing = [
      { id: 'p-4', text: 'post novo' },
      { id: 'p-3', text: 'post que sumiu' },
      { id: 'p-2', text: 'post antigo' },
      { id: 'p-1', text: 'post bem antigo' },
    ];
    const livePage = [
      { id: 'p-4', text: 'post novo' },
      { id: 'p-2', text: 'post antigo' },
    ];

    const merged = mergeRealtimePageById(
      existing,
      livePage,
      ['p-4', 'p-3', 'p-2'],
      'prepend',
    );

    expect(merged).toEqual([
      { id: 'p-4', text: 'post novo' },
      { id: 'p-2', text: 'post antigo' },
      { id: 'p-1', text: 'post bem antigo' },
    ]);
  });
});
