import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import i18n from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Location } from '../../types/location';

const mockSetPublication = vi.fn();
const mockWritePatches = vi.fn();
const mockShowSuccess = vi.fn();
const mockShowError = vi.fn();

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('../../services/cloudFunctions', () => ({
  setLocationPublicationStatus: (...args: unknown[]) => mockSetPublication(...args),
}));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showSuccess: mockShowSuccess, showError: mockShowError }),
}));
vi.mock('../../utils/logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));
vi.mock('./manageLocationBatch', async () => {
  const actual = await vi.importActual<typeof import('./manageLocationBatch')>('./manageLocationBatch');
  return { ...actual, writeLocationPatches: (...args: unknown[]) => mockWritePatches(...args) };
});

import { ManageLocationFilterPanel } from './ManageLocationFilterPanel';
import { ManageLocationActiveChips, ManageLocationFilterSheet } from './ManageLocationFilterSheet';
import { ManageLocationTable } from './ManageLocationTable';
import { ManageLocationBatchBar } from './ManageLocationBatchBar';
import { buildGeoFacets } from './manageLocationFacets';
import { EMPTY_MANAGE_FILTERS, ManageLocationQueryState } from './manageLocationUrlState';

const venue = (id: string, extra: Partial<Location> = {}) =>
  ({
    id,
    name: `Quadra ${id}`,
    city: 'Curitiba',
    state: 'PR',
    neighborhood: 'Centro',
    district: 'Centro',
    isVerified: true,
    isActive: true,
    publicationStatus: 'PUBLISHED',
    fieldType: 'SOCIETY',
    ...extra,
  }) as Location;

const LOCATIONS = [
  venue('1'),
  venue('2', { city: 'Londrina', neighborhood: 'Gleba', district: 'Gleba' }),
  venue('3', { city: 'Joinville', state: 'SC', publicationStatus: 'DRAFT', isVerified: false }),
];

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('pt-BR');
});

describe('ManageLocationFilterPanel', () => {
  const renderPanel = (patch: Partial<ManageLocationQueryState> = {}) => {
    const filters = { ...EMPTY_MANAGE_FILTERS, ...patch };
    const onChange = vi.fn();
    render(
      <ManageLocationFilterPanel
        filters={filters}
        facets={buildGeoFacets(LOCATIONS, filters)}
        onChange={onChange}
      />,
    );
    return onChange;
  };

  it('oferece Estado → Cidade → Bairro com contagem em cada opção', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('combobox', { name: /estado \(uf\)/i }));
    const states = screen.getAllByRole('option');
    expect(states.map((o) => o.textContent)).toEqual(['PR — Paraná2', 'SC — Santa Catarina1']);
  }, 15000);

  it('selecionar uma UF chama onChange com a multi-seleção', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();

    await user.click(screen.getByRole('combobox', { name: /estado \(uf\)/i }));
    await user.click(screen.getByRole('option', { name: /SC — Santa Catarina/ }));

    expect(onChange).toHaveBeenCalledWith({ stateFilters: ['SC'] });
  }, 15000);

  it('as cidades já refletem a UF escolhida (cascata)', async () => {
    const user = userEvent.setup();
    renderPanel({ stateFilters: ['PR'] });

    await user.click(screen.getByRole('combobox', { name: /^cidade/i }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Curitiba1', 'Londrina1']);
  }, 15000);

  it('atalhos rápidos alternam e expõem aria-pressed', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel({ quickFilters: ['UNVERIFIED'] });

    expect(screen.getByRole('button', { name: 'Não verificadas' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Rascunhos importados' })).toHaveAttribute('aria-pressed', 'false');

    await user.click(screen.getByRole('button', { name: 'Rascunhos importados' }));
    expect(onChange).toHaveBeenCalledWith({ quickFilters: ['UNVERIFIED', 'DRAFT_IMPORTED'] });

    await user.click(screen.getByRole('button', { name: 'Não verificadas' }));
    expect(onChange).toHaveBeenCalledWith({ quickFilters: [] });
  });

  it('mantém os atalhos Sem coordenadas e Sem telefone', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'Sem coordenadas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sem telefone' })).toBeInTheDocument();
  });

  it('mantém os filtros que já existiam (publicação, verificada, ativa, tipo, dono...)', () => {
    renderPanel();
    ['Publicação', 'Verificada', 'Ativa', 'Campos ativos', 'Status da mensalidade', 'Tipo', 'Vencimento', 'Valor da mensalidade', 'Dono (UID)']
      .forEach((label) => expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Estacionamento' })).toBeInTheDocument();
  });

  it('comodidade alterna na lista', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel({ amenityFilters: ['bbq'] });
    await user.click(screen.getByRole('button', { name: 'Estacionamento' }));
    expect(onChange).toHaveBeenCalledWith({ amenityFilters: ['bbq', 'parking'] });
  });
});

describe('ManageLocationActiveChips / bottom sheet', () => {
  it('cada chip remove o seu filtro e "Limpar tudo" limpa', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onClearAll = vi.fn();
    render(
      <ManageLocationActiveChips
        chips={[
          { key: 'uf:PR', label: 'PR', clear: { stateFilters: [] } },
          { key: 'q', label: 'Busca: jd', clear: { searchQuery: '' } },
        ]}
        onClear={onClear}
        onClearAll={onClearAll}
      />,
    );

    const chip = screen.getByText('PR').closest('.MuiChip-root') as HTMLElement;
    await user.click(within(chip).getByLabelText(/remover filtro pr/i));
    expect(onClear).toHaveBeenCalledWith({ stateFilters: [] });

    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('sem chips não renderiza nada', () => {
    const { container } = render(<ManageLocationActiveChips chips={[]} onClear={vi.fn()} onClearAll={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('o sheet mostra "Filtros (n)", o total de resultados e limpa tudo', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onClearAll = vi.fn();
    render(
      <ManageLocationFilterSheet open onClose={onClose} onClearAll={onClearAll} resultCount={7} activeCount={3}>
        <div>conteúdo</div>
      </ManageLocationFilterSheet>,
    );

    expect(screen.getByText('Filtros (3)')).toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver 7 quadras' }));
    expect(onClose).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }));
    expect(onClearAll).toHaveBeenCalled();
  });
});

describe('ManageLocationTable', () => {
  const renderTable = (selected: string[] = []) => {
    const props = {
      locations: LOCATIONS,
      selectedIds: new Set(selected),
      onToggle: vi.fn(),
      onToggleAll: vi.fn(),
      onOpen: vi.fn(),
      showSelection: true,
    };
    render(<MemoryRouter><ManageLocationTable {...props} /></MemoryRouter>);
    return props;
  };

  it('mostra cidade/UF, bairro, status e selo "Não verificada"', () => {
    renderTable();
    const row = screen.getByText('Quadra 3').closest('tr') as HTMLElement;
    expect(within(row).getByText('Joinville - SC')).toBeInTheDocument();
    expect(within(row).getByText('Rascunho')).toBeInTheDocument();
    expect(within(row).getByText('Não verificada')).toBeInTheDocument();
    const publishedRow = screen.getByText('Quadra 1').closest('tr') as HTMLElement;
    expect(within(publishedRow).queryByText('Não verificada')).not.toBeInTheDocument();
  });

  it('clicar na linha abre a quadra; o checkbox só seleciona', async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByLabelText('Selecionar Quadra 2'));
    expect(props.onToggle).toHaveBeenCalledWith('2');
    expect(props.onOpen).not.toHaveBeenCalled();

    await user.click(screen.getByText('Quadra 1'));
    expect(props.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('o checkbox do cabeçalho seleciona todas as filtradas', async () => {
    const user = userEvent.setup();
    const props = renderTable();
    await user.click(screen.getByLabelText('Selecionar todas as quadras filtradas'));
    expect(props.onToggleAll).toHaveBeenCalledWith(true);
  });
});

describe('ManageLocationBatchBar', () => {
  const draft = venue('d1', { publicationStatus: 'DRAFT', isVerified: false });
  const draft2 = venue('d2', { publicationStatus: 'DRAFT', isVerified: false });
  const published = venue('p1');

  const renderBar = (selected: Location[]) => {
    const onProcessed = vi.fn();
    const onClearSelection = vi.fn();
    render(
      <ManageLocationBatchBar
        selected={selected}
        adminUid="admin-1"
        onClearSelection={onClearSelection}
        onProcessed={onProcessed}
      />,
    );
    return { onProcessed, onClearSelection };
  };

  it('sem seleção não aparece', () => {
    const { container } = render(
      <ManageLocationBatchBar selected={[]} adminUid="a" onClearSelection={vi.fn()} onProcessed={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('publicar pede confirmação, ignora as já publicadas e chama a função por quadra', async () => {
    mockSetPublication.mockResolvedValue({});
    const user = userEvent.setup();
    const { onProcessed } = renderBar([draft, draft2, published]);

    expect(screen.getByText('3 selecionadas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Publicar' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Publicar 2 quadras?')).toBeInTheDocument();
    expect(within(dialog).getByText(/1 já estão neste estado/)).toBeInTheDocument();
    expect(mockSetPublication).not.toHaveBeenCalled(); // só depois de confirmar

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(mockSetPublication).toHaveBeenCalledTimes(2));
    expect(mockSetPublication).toHaveBeenCalledWith({ locationId: 'd1', publicationStatus: 'PUBLISHED' });
    await waitFor(() => expect(onProcessed).toHaveBeenCalledWith(['d1', 'd2']));
    expect(mockShowSuccess).toHaveBeenCalledWith('2 quadras atualizadas.');
  }, 20000);

  it('falhas por quadra são listadas e só as que deram certo saem da seleção', async () => {
    mockSetPublication
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('failed-precondition: sem fotos'));
    const user = userEvent.setup();
    const { onProcessed } = renderBar([draft, draft2]);

    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(onProcessed).toHaveBeenCalledWith(['d1']));
    expect(await screen.findByText(/Quadra d2: failed-precondition: sem fotos/)).toBeInTheDocument();
    expect(mockShowError).toHaveBeenCalledWith('1 atualizada(s) e 1 com falha.');
  }, 20000);

  it('marcar verificada e desativar usam escrita em lote do admin', async () => {
    mockWritePatches.mockImplementation(async (items: Location[]) =>
      items.map((l) => ({ id: l.id, name: l.name, ok: true })));
    const user = userEvent.setup();
    renderBar([draft]);

    await user.click(screen.getByRole('button', { name: 'Marcar verificada' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mockWritePatches).toHaveBeenCalledWith([draft], 'VERIFY', 'admin-1'));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mockWritePatches).toHaveBeenCalledWith([draft], 'DEACTIVATE', 'admin-1'));
  }, 20000);

  it('cancelar não executa nada', async () => {
    const user = userEvent.setup();
    renderBar([draft]);
    await user.click(screen.getByRole('button', { name: 'Desativar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(mockWritePatches).not.toHaveBeenCalled();
    expect(mockSetPublication).not.toHaveBeenCalled();
  }, 15000);

  it('publicação em lote respeita o limite de 20 e avisa o que sobra', async () => {
    mockSetPublication.mockResolvedValue({});
    const many = Array.from({ length: 23 }, (_, i) =>
      venue(`m${i}`, { publicationStatus: 'DRAFT', isVerified: false }));
    const user = userEvent.setup();
    renderBar(many);

    await user.click(screen.getByRole('button', { name: 'Publicar' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Publicar 20 quadras?')).toBeInTheDocument();
    expect(within(dialog).getByText(/no máximo 20 quadras/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(mockSetPublication).toHaveBeenCalledTimes(20));
  }, 30000);

  it('"Limpar seleção" avisa o pai', async () => {
    const user = userEvent.setup();
    const { onClearSelection } = renderBar([draft]);
    await user.click(screen.getByRole('button', { name: 'Limpar seleção' }));
    expect(onClearSelection).toHaveBeenCalled();
  });
});
