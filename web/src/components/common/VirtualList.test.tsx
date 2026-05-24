import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => {
    const items = Array.from({ length: count }, (_, i) => ({
      key: i,
      index: i,
      start: i * estimateSize(),
      size: estimateSize(),
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * estimateSize(),
    };
  },
}));

import { VirtualList } from './VirtualList';

const theme = createTheme();

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('VirtualList', () => {
  it('renderiza itens visíveis', () => {
    const items = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
    renderWithTheme(
      <VirtualList
        items={items}
        renderItem={(item) => <div>{item.name}</div>}
        estimateSize={50}
      />
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('lida com lista vazia', () => {
    renderWithTheme(
      <VirtualList
        items={[]}
        renderItem={() => <div />}
      />
    );
  });

  it('renderiza número correto de itens', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, label: `Item ${i}` }));
    renderWithTheme(
      <VirtualList
        items={items}
        renderItem={(item) => <div>{item.label}</div>}
        estimateSize={50}
        overscan={0}
      />
    );
  });

  it('usa getItemKey quando fornecido', () => {
    const items = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }];
    renderWithTheme(
      <VirtualList
        items={items}
        renderItem={(item) => <div>{item.name}</div>}
        getItemKey={(index) => items[index].id}
      />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renderiza container para scroll', () => {
    const items = [{ id: 1, name: 'X' }];
    const { container } = renderWithTheme(
      <VirtualList
        items={items}
        renderItem={(item) => <div>{item.name}</div>}
      />
    );
    expect(screen.getByText('X')).toBeInTheDocument();
  });

  it('renderiza com diferentes estimateSize', () => {
    const items = [{ id: 1, name: 'Tall' }];
    renderWithTheme(
      <VirtualList
        items={items}
        renderItem={(item) => <div>{item.name}</div>}
        estimateSize={300}
      />
    );
    expect(screen.getByText('Tall')).toBeInTheDocument();
  });

  it('renderiza sem overscan especificado', () => {
    const items = [{ id: 1, name: 'No Overscan' }];
    renderWithTheme(
      <VirtualList
        items={items}
        renderItem={(item) => <div>{item.name}</div>}
      />
    );
    expect(screen.getByText('No Overscan')).toBeInTheDocument();
  });

  it('renderiza com objetos vazios', () => {
    const items: { id: number; name: string }[] = [];
    renderWithTheme(
      <VirtualList
        items={items}
        renderItem={() => <div />}
      />
    );
  });
});
