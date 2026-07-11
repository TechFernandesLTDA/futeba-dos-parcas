// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { WallPost } from '../../hooks/useGroupWall';
import { WallPostCard } from './WallPostCard';

vi.mock('../../components/reactions/ReactionBar', () => ({
  ReactionBar: () => <div data-testid="reaction-bar" />,
}));
vi.mock('../../components/common/GameCard', () => ({
  PlayerAvatar: ({ name }: { name: string }) => <div aria-label={name} />,
}));

const post: WallPost = {
  id: 'post-1',
  groupId: 'group-1',
  authorId: 'user-1',
  authorName: 'Jordi',
  authorPhotoUrl: null,
  text: '',
  mediaUrl: 'https://firebasestorage.googleapis.com/photo.jpg',
  mediaPath: 'groups/group-1/wall_media/__draft__/user-1/photo.jpg',
  mediaType: 'image/jpeg',
  thumbnailPath: null,
  highlightRef: null,
  pinned: false,
  pinnedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  deletedBy: null,
  reactions: {},
  commentsCount: 0,
};

describe('WallPostCard', () => {
  it('renderiza foto sem legenda com abertura acessível', () => {
    renderWithProviders(
      <WallPostCard post={post} isOwn={false} canManage={false} />,
    );

    const image = screen.getByAltText('Foto de Jordi');
    fireEvent.load(image);
    const openButton = screen.getByRole('button', { name: 'Abrir foto de Jordi' });
    expect(openButton).toBeVisible();

    fireEvent.click(openButton);
    expect(screen.getAllByAltText('Foto de Jordi')).toHaveLength(2);
  });

  it('mostra falha de carregamento e permite tentar novamente', () => {
    renderWithProviders(
      <WallPostCard post={post} isOwn={false} canManage={false} />,
    );

    fireEvent.error(screen.getByAltText('Foto de Jordi'));
    expect(screen.getByText('Não foi possível carregar esta foto.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar carregar novamente' }));
    expect(screen.queryByText('Não foi possível carregar esta foto.')).not.toBeInTheDocument();
    expect(screen.getByAltText('Foto de Jordi')).toBeInTheDocument();
  });

  it('carrega apenas o poster e cria o player depois da interação', () => {
    const videoPost: WallPost = {
      ...post,
      mediaUrl: 'https://firebasestorage.googleapis.com/clip.mp4',
      mediaPath: 'groups/group-1/wall_media/__draft__/user-1/clip.mp4',
      mediaType: 'video/mp4',
      thumbnailUrl: 'https://firebasestorage.googleapis.com/poster.webp',
    };
    const { container } = renderWithProviders(
      <WallPostCard post={videoPost} isOwn={false} canManage={false} />,
    );

    expect(document.querySelector('video')).not.toBeInTheDocument();
    expect(container.querySelector('img[src="https://firebasestorage.googleapis.com/poster.webp"]')).toBeInTheDocument();
    const openButton = screen.getByRole('button', { name: 'Abrir vídeo de Jordi' });
    fireEvent.click(openButton);

    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('autoplay');
    expect(container.querySelector('.MuiSkeleton-root')).not.toBeInTheDocument();
  });

  it('reconhece MP4 legado pela URL quando media_type está ausente', () => {
    const legacyVideoPost: WallPost = {
      ...post,
      mediaUrl: 'https://firebasestorage.googleapis.com/clip.mp4?alt=media',
      mediaPath: null,
      mediaType: null,
    };
    renderWithProviders(
      <WallPostCard post={legacyVideoPost} isOwn={false} canManage={false} />,
    );

    expect(document.querySelector('video')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir vídeo de Jordi' }));
    expect(document.querySelector('video')).toHaveAttribute('controls');
  });
});
