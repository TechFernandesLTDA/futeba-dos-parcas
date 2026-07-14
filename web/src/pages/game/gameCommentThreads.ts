import type {
  GameComment,
  GameCommentContext,
} from '../../hooks/useGameComments';

export interface GameCommentThreadGroup {
  parent: GameComment | null;
  parentUnavailable: 'deleted' | 'missing' | null;
  replies: GameComment[];
}

export function buildGameCommentThreads(
  comments: GameComment[],
  context: GameCommentContext,
): GameCommentThreadGroup[] {
  const contextualComments = comments.filter((comment) => comment.context === context);
  const commentsById = new Map(contextualComments.map((comment) => [comment.id, comment]));
  const visibleReplies = contextualComments.filter((comment) => comment.parentId && comment.deletedAt === null);
  const repliesByParent = new Map<string, GameComment[]>();
  for (const reply of visibleReplies) {
    const parentId = reply.parentId as string;
    repliesByParent.set(parentId, [...(repliesByParent.get(parentId) ?? []), reply]);
  }

  const threads: GameCommentThreadGroup[] = [];
  const renderedParentIds = new Set<string>();
  for (const comment of contextualComments) {
    if (comment.parentId || comment.deletedAt !== null) continue;
    renderedParentIds.add(comment.id);
    threads.push({
      parent: comment,
      parentUnavailable: null,
      replies: repliesByParent.get(comment.id) ?? [],
    });
  }

  for (const reply of visibleReplies) {
    const parentId = reply.parentId as string;
    if (renderedParentIds.has(parentId)) continue;
    renderedParentIds.add(parentId);
    const parent = commentsById.get(parentId);
    threads.push({
      parent: null,
      parentUnavailable: parent?.deletedAt ? 'deleted' : 'missing',
      replies: repliesByParent.get(parentId) ?? [],
    });
  }

  return threads;
}
