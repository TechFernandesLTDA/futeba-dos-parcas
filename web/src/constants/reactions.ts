export const REACTION_EMOJIS = ['🔥', '😂', '👏', '😡', '💀', '🤡', '👑', '⚽'] as const;

export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export type ReactionsMap = Partial<Record<ReactionEmoji, string[]>> & Record<string, string[] | undefined>;

export interface ReactionSummaryItem {
  emoji: ReactionEmoji;
  count: number;
  selected: boolean;
}

export function getUserReaction(
  reactions: ReactionsMap | null | undefined,
  userId: string | null | undefined,
): ReactionEmoji | null {
  if (!reactions || !userId) return null;
  return REACTION_EMOJIS.find((emoji) => reactions[emoji]?.includes(userId)) ?? null;
}

export function summarizeReactions(
  reactions: ReactionsMap | null | undefined,
  userId: string | null | undefined,
): ReactionSummaryItem[] {
  return REACTION_EMOJIS
    .map((emoji) => ({
      emoji,
      count: reactions?.[emoji]?.length ?? 0,
      selected: !!userId && (reactions?.[emoji]?.includes(userId) ?? false),
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || REACTION_EMOJIS.indexOf(a.emoji) - REACTION_EMOJIS.indexOf(b.emoji));
}

export function countReactions(reactions: ReactionsMap | null | undefined): number {
  return REACTION_EMOJIS.reduce((total, emoji) => total + (reactions?.[emoji]?.length ?? 0), 0);
}
