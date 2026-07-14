import { describe, expect, it } from 'vitest';
import type { GameComment } from '../../hooks/useGameComments';
import { buildGameCommentThreads } from './gameCommentThreads';

function comment(
  id: string,
  parentId: string | null = null,
  options: { deleted?: boolean; context?: GameComment['context'] } = {},
): GameComment {
  return {
    id,
    authorId: 'author',
    authorName: 'Autor',
    authorPhotoUrl: null,
    text: `Texto ${id}`,
    parentId,
    editedAt: null,
    deletedAt: options.deleted ? new Date(2026, 6, 13) : null,
    deletedBy: options.deleted ? 'moderator' : null,
    reactions: {},
    context: options.context ?? 'game',
  };
}

describe('buildGameCommentThreads', () => {
  it('mantém a ordem do pai e agrupa a reply hidratada', () => {
    const threads = buildGameCommentThreads([
      comment('parent-old'),
      comment('root-recent'),
      comment('reply-new', 'parent-old'),
    ], 'game');

    expect(threads.map((thread) => thread.parent?.id)).toEqual(['parent-old', 'root-recent']);
    expect(threads[0].replies.map((reply) => reply.id)).toEqual(['reply-new']);
  });

  it('gera fallback visível quando o pai não existe', () => {
    const threads = buildGameCommentThreads([comment('reply', 'missing-parent')], 'game');

    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ parent: null, parentUnavailable: 'missing' });
    expect(threads[0].replies.map((reply) => reply.id)).toEqual(['reply']);
  });

  it('preserva replies de pai moderado sem expor o conteúdo removido', () => {
    const threads = buildGameCommentThreads([
      comment('deleted-parent', null, { deleted: true }),
      comment('visible-reply', 'deleted-parent'),
      comment('deleted-reply', 'deleted-parent', { deleted: true }),
    ], 'game');

    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({ parent: null, parentUnavailable: 'deleted' });
    expect(threads[0].replies.map((reply) => reply.id)).toEqual(['visible-reply']);
  });

  it('não mistura comentários de outros contextos', () => {
    const threads = buildGameCommentThreads([
      comment('game-root'),
      comment('vote-reply', 'game-root', { context: 'vote_result' }),
    ], 'game');

    expect(threads).toHaveLength(1);
    expect(threads[0].replies).toEqual([]);
  });
});
