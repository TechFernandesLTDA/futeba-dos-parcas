// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import { WallPostVideoPlayer } from './WallPostVideoPlayer';

const src = 'https://firebasestorage.googleapis.com/processed.mp4?alt=media&token=abc';
const poster = 'https://firebasestorage.googleapis.com/poster.webp?alt=media&token=def';

function renderPlayer() {
  return renderWithProviders(
    <WallPostVideoPlayer src={src} poster={poster} authorName="Jordi" />,
  );
}

describe('WallPostVideoPlayer', () => {
  it('adia o MP4 ate o toque e configura o elemento nativo para reproducao inline', () => {
    const { container } = renderPlayer();

    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('src', poster);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' }));

    const video = container.querySelector('video');
    const source = container.querySelector('video source');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('crossorigin');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).toHaveAttribute('controlslist', 'nodownload');
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('poster', poster);
    expect(source).toHaveAttribute('src', `${src}&fp_play=0`);
    expect(source).toHaveAttribute('type', 'video/mp4');
  });

  it('inicia a reproducao programaticamente no onCanPlay mantendo o audio', () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    HTMLMediaElement.prototype.play = playMock;
    const { container } = renderPlayer();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' }));
    const video = container.querySelector('video')!;

    fireEvent.canPlay(video);
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('informa carregamento, espera e retomada sem bloquear os controles', () => {
    const { container } = renderPlayer();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' }));
    const video = container.querySelector('video')!;

    expect(screen.getByRole('status')).toHaveTextContent('Carregando');
    fireEvent.loadedMetadata(video);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.waiting(video);
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.playing(video);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('troca falha de rede ou URL legada por erro acionavel e remonta no retry', () => {
    const { container } = renderPlayer();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' }));
    const failedVideo = container.querySelector('video')!;

    fireEvent.error(failedVideo);
    expect(screen.getByText('Não foi possível carregar este vídeo.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar carregar novamente' }));
    const retriedVideo = container.querySelector('video');
    expect(retriedVideo).toBeInTheDocument();
    expect(retriedVideo).not.toBe(failedVideo);
    expect(container.querySelector('video source')).toHaveAttribute('src', `${src}&fp_play=1`);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renova uma URL legada uma unica vez pelo mediaPath antes de exibir erro', async () => {
    const freshSrc = 'https://firebasestorage.googleapis.com/fresh.mp4?alt=media&token=new';
    const resolveStorageUrl = vi.fn().mockResolvedValue(freshSrc);
    const { container } = renderWithProviders(
      <WallPostVideoPlayer
        src={src}
        poster={poster}
        mediaPath="groups/group-1/wall_media/post-1/video.mp4"
        authorName="Jordi"
        resolveStorageUrl={resolveStorageUrl}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' }));

    fireEvent.error(container.querySelector('video')!);

    await waitFor(() => {
      expect(container.querySelector('video source')).toHaveAttribute('src', `${freshSrc}&fp_play=1`);
    });
    expect(resolveStorageUrl).toHaveBeenCalledTimes(1);
    expect(resolveStorageUrl).toHaveBeenCalledWith('groups/group-1/wall_media/post-1/video.mp4');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.error(container.querySelector('video')!);
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar este vídeo.');
    expect(resolveStorageUrl).toHaveBeenCalledTimes(1);
  });

  it('abre novo budget de renovação quando o usuário tenta novamente', async () => {
    const freshSrc = 'https://firebasestorage.googleapis.com/recovered.mp4?alt=media&token=new';
    const resolveStorageUrl = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(freshSrc);
    const { container } = renderWithProviders(
      <WallPostVideoPlayer
        src={src}
        poster={poster}
        mediaPath="groups/group-1/wall_media/post-1/video.mp4"
        authorName="Jordi"
        resolveStorageUrl={resolveStorageUrl}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' }));
    fireEvent.error(container.querySelector('video')!);
    await screen.findByText('Não foi possível carregar este vídeo.');

    fireEvent.click(screen.getByRole('button', { name: 'Tentar carregar novamente' }));
    fireEvent.error(container.querySelector('video')!);

    await waitFor(() => {
      expect(container.querySelector('video source')).toHaveAttribute('src', `${freshSrc}&fp_play=2`);
    });
    expect(resolveStorageUrl).toHaveBeenCalledTimes(2);
  });

  it('renova poster protegido pelo thumbnailPath sem baixar o MP4', async () => {
    const freshPoster = 'https://firebasestorage.googleapis.com/fresh.webp?alt=media&token=new';
    const resolveStorageUrl = vi.fn().mockResolvedValue(freshPoster);
    const { container } = renderWithProviders(
      <WallPostVideoPlayer
        src={src}
        poster={poster}
        posterPath="groups/group-1/wall_media/post-1/poster.webp"
        authorName="Jordi"
        resolveStorageUrl={resolveStorageUrl}
      />,
    );

    fireEvent.error(container.querySelector('img')!);

    await waitFor(() => {
      expect(container.querySelector('img')).toHaveAttribute('src', freshPoster);
    });
    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(resolveStorageUrl).toHaveBeenCalledTimes(1);
  });

  it('continua reproduzivel quando o poster nao existe', () => {
    const { container } = renderPlayer();
    const posterImage = container.querySelector('img')!;

    fireEvent.error(posterImage);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' }));

    expect(container.querySelector('video')).toBeInTheDocument();
    expect(container.querySelector('video')).not.toHaveAttribute('poster');
  });

  it('volta ao poster quando o post recebe uma nova URL', () => {
    const { container, rerender } = renderPlayer();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' }));
    expect(container.querySelector('video')).toBeInTheDocument();

    rerender(
      <WallPostVideoPlayer
        src="https://firebasestorage.googleapis.com/outro.mp4?alt=media"
        poster={poster}
        authorName="Jordi"
      />,
    );

    expect(container.querySelector('video')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' })).toBeInTheDocument();
  });
});
