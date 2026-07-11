// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WallPostComposer } from './WallPostComposer';

function selectImage(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('WallPostComposer', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation((file) => `blob:${(file as File).name}`);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mantém o campo inline sempre visível, sem CTA intermediário', () => {
    renderWithProviders(
      <WallPostComposer sending={false} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );

    expect(screen.getByRole('region', { name: 'Nova mensagem no mural' })).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Criar post' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar foto ou vídeo' })).toBeEnabled();
  });

  it('rejeita arquivo com exatamente 10 MiB para alinhar com as Storage Rules', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <WallPostComposer sending={false} onSubmit={onSubmit} />,
    );
    const image = new File(['image'], 'limite.png', { type: 'image/png' });
    Object.defineProperty(image, 'size', { value: 10 * 1024 * 1024 });

    selectImage(container, image);

    expect(screen.queryByAltText('Pré-visualização da imagem')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  });

  it('publica uma foto sem exigir legenda e só limpa o rascunho após sucesso', async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    }));
    const { container } = renderWithProviders(
      <WallPostComposer sending={false} onSubmit={onSubmit} />,
    );
    const image = new File(['image'], 'partida.png', { type: 'image/png' });

    selectImage(container, image);
    expect(await screen.findByAltText('Pré-visualização da imagem')).toBeInTheDocument();
    expect(screen.getByText('partida.png')).toBeInTheDocument();
    expect(screen.getByText('Pronto para publicar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    expect(onSubmit).toHaveBeenCalledWith('', image);
    expect(screen.getByAltText('Pré-visualização da imagem')).toBeInTheDocument();

    resolveSubmit?.();
    await waitFor(() => {
      expect(screen.queryByAltText('Pré-visualização da imagem')).not.toBeInTheDocument();
    });
  });

  it('preserva texto e foto quando a publicação falha para permitir nova tentativa', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('upload indisponível'));
    const { container } = renderWithProviders(
      <WallPostComposer sending={false} onSubmit={onSubmit} />,
    );
    const image = new File(['image'], 'resenha.webp', { type: 'image/webp' });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Pós-jogo' } });
    selectImage(container, image);
    await screen.findByAltText('Pré-visualização da imagem');
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('textbox')).toHaveValue('Pós-jogo');
    expect(screen.getByAltText('Pré-visualização da imagem')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível publicar. Seu texto e anexo foram mantidos para tentar novamente.',
    );
  });

  it('aceita vídeo MP4 e mantém a prévia durante o envio', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <WallPostComposer sending={false} onSubmit={onSubmit} />,
    );
    const video = new File(['video'], 'partida.mp4', { type: 'video/mp4' });

    selectImage(container, video);

    expect(screen.getByLabelText('Pré-visualização do vídeo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('', video));
  });

  it('aceita MP4 sem MIME confiável quando a extensão é válida', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <WallPostComposer sending={false} onSubmit={onSubmit} />,
    );
    const video = new File(['video'], 'jogada.MP4', { type: '' });

    selectImage(container, video);

    expect(screen.getByLabelText('Pré-visualização do vídeo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('', video));
  });

  it('não bloqueia a publicação quando o navegador não consegue pré-visualizar o vídeo', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = renderWithProviders(
      <WallPostComposer sending={false} onSubmit={onSubmit} />,
    );
    const video = new File(['video'], 'partida.mp4', { type: 'video/mp4' });

    selectImage(container, video);
    const preview = await screen.findByLabelText('Pré-visualização do vídeo');
    fireEvent.error(preview);

    expect(screen.getByText('Não foi possível pré-visualizar este vídeo, mas você ainda pode publicá-lo.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('', video));
  });

  it('expõe estado de envio e bloqueia novas interações', () => {
    renderWithProviders(
      <WallPostComposer sending uploadProgress={42} onSubmit={vi.fn().mockResolvedValue(undefined)} />,
    );

    expect(screen.getByRole('region', { name: 'Nova mensagem no mural' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publicando...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar foto ou vídeo' })).toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mostra progresso compacto e acessível apenas durante envio de mídia', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container, rerender } = renderWithProviders(
      <WallPostComposer sending={false} uploadProgress={null} onSubmit={onSubmit} />,
    );
    const image = new File(['image'], 'jogada.png', { type: 'image/png' });
    selectImage(container, image);
    await screen.findByAltText('Pré-visualização da imagem');

    rerender(
      <WallPostComposer sending uploadProgress={42.4} onSubmit={onSubmit} />,
    );

    expect(screen.getByRole('status', { name: 'Enviando mídia: 42%' })).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('publica com Ctrl+Enter sem remover suporte a quebra de linha normal', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<WallPostComposer sending={false} onSubmit={onSubmit} />);
    const textbox = screen.getByRole('textbox');

    fireEvent.change(textbox, { target: { value: 'Gol no fim!' } });
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Gol no fim!', undefined));
  });

  it('impede envio duplicado antes do rerender de loading', async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    }));
    renderWithProviders(<WallPostComposer sending={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Só vale um post' } });
    const publishButton = screen.getByRole('button', { name: 'Publicar' });

    fireEvent.click(publishButton);
    fireEvent.click(publishButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    resolveSubmit?.();
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
  });
});
