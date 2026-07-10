// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WallPostComposer } from './WallPostComposer';

function selectImage(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe('WallPostComposer', () => {
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
  });

  it('aceita vídeo MP4 e mantém a prévia durante o envio', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:wall-video');
    const { container } = renderWithProviders(
      <WallPostComposer sending={false} onSubmit={onSubmit} />,
    );
    const video = new File(['video'], 'partida.mp4', { type: 'video/mp4' });

    selectImage(container, video);

    expect(screen.getByLabelText('Pré-visualização do vídeo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('', video));

    createObjectURL.mockRestore();
  });
});
