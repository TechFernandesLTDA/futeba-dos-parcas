// @vitest-environment jsdom
import { describe, beforeEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '../../test/renderWithProviders';
import { GameChatPanel } from './GameChatPanel';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  remove: vi.fn(),
  messages: [] as Array<{
    id: string;
    senderId: string | null;
    senderName: string;
    senderPhotoUrl: string | null;
    text: string;
    createdAt?: Date;
    deletedAt?: Date | null;
  }>,
  currentUserId: 'user-1',
  loading: false,
  error: null as string | null,
  hasMore: false,
}));

vi.mock('../../hooks/useGameChat', () => ({
  useGameChat: () => ({
    messages: mocks.messages,
    loading: mocks.loading,
    error: mocks.error,
    hasMore: mocks.hasMore,
    loadingMore: false,
    loadMore: vi.fn(),
    currentUserId: mocks.currentUserId,
  }),
  useSendGameMessage: () => ({ send: mocks.send, sending: false }),
  useDeleteGameMessage: () => ({ remove: mocks.remove, deleting: false }),
}));

const ownMessage = {
  id: 'm1',
  senderId: 'user-1',
  senderName: 'Eu Parça',
  senderPhotoUrl: null,
  text: 'Bora pro racha!',
  createdAt: new Date('2026-11-15T10:30:00'),
  deletedAt: null,
};

const otherMessage = {
  id: 'm2',
  senderId: 'user-2',
  senderName: 'Outro Parça',
  senderPhotoUrl: null,
  text: 'Tô dentro',
  createdAt: new Date('2026-11-15T10:31:00'),
  deletedAt: null,
};

const baseProps = {
  gameId: 'game-1',
  isConfirmedPlayer: true,
  isOwner: false,
  canManage: false,
};

// jsdom não implementa scrollIntoView (usado no auto-scroll do chat).
Element.prototype.scrollIntoView = vi.fn();

describe('GameChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.messages = [];
    mocks.currentUserId = 'user-1';
    mocks.loading = false;
    mocks.error = null;
    mocks.hasMore = false;
    mocks.send.mockResolvedValue(undefined);
    mocks.remove.mockResolvedValue(undefined);
  });

  it('renderiza o título e o estado vazio quando não há mensagens', () => {
    renderWithProviders(<GameChatPanel {...baseProps} />);

    expect(screen.getByText('Chat do jogo')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma mensagem ainda')).toBeInTheDocument();
  });

  it('exibe spinner enquanto o chat carrega', () => {
    mocks.loading = true;
    renderWithProviders(<GameChatPanel {...baseProps} />);

    expect(screen.queryByText('Nenhuma mensagem ainda')).not.toBeInTheDocument();
  });

  it('exibe alerta de erro do listener', () => {
    mocks.error = 'Erro ao carregar mensagens';
    renderWithProviders(<GameChatPanel {...baseProps} />);

    expect(screen.getByText('Erro ao carregar mensagens')).toBeInTheDocument();
  });

  it('renderiza mensagens próprias e de outros jogadores', () => {
    mocks.messages = [ownMessage, otherMessage];
    renderWithProviders(<GameChatPanel {...baseProps} />);

    expect(screen.getByText('Bora pro racha!')).toBeInTheDocument();
    expect(screen.getByText('Tô dentro')).toBeInTheDocument();
    expect(screen.getByText('Outro Parça')).toBeInTheDocument();
  });

  it('envia o rascunho ao clicar em enviar e limpa o campo', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GameChatPanel {...baseProps} />);

    const input = screen.getByPlaceholderText('Manda a tua...');
    await user.type(input, 'Bora joia');
    await user.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    await waitFor(() => expect(mocks.send).toHaveBeenCalledWith('Bora joia'));
    expect(input).toHaveValue('');
  });

  it('permite apagar mensagem própria com o botão de lixeira', async () => {
    mocks.messages = [ownMessage];
    const user = userEvent.setup();
    renderWithProviders(<GameChatPanel {...baseProps} />);

    await user.click(screen.getByRole('button', { name: 'Apagar mensagem' }));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('m1'));
  });

  it('bloqueia escrita para quem não confirmou presença', () => {
    mocks.messages = [ownMessage];
    renderWithProviders(
      <GameChatPanel {...baseProps} isConfirmedPlayer={false} />,
    );

    expect(
      screen.getByText('Confirme sua presença para participar do chat.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Manda a tua...'),
    ).not.toBeInTheDocument();
  });

  it('exibe a tag de chat arquivado e remove o campo de escrita', () => {
    mocks.messages = [ownMessage];
    renderWithProviders(
      <GameChatPanel {...baseProps} isArchived />,
    );

    expect(screen.getByText('Chat arquivado')).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Manda a tua...'),
    ).not.toBeInTheDocument();
  });
});
