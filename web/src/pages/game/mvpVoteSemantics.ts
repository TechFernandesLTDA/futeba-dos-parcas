export const hasContradictoryVoteSelection = (
  mvpPlayerId: string,
  bestGoalkeeperId: string,
  worstPlayerId: string,
): boolean => Boolean(
  worstPlayerId
  && (worstPlayerId === mvpPlayerId || worstPlayerId === bestGoalkeeperId)
);
