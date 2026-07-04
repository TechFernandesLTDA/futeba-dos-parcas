import {decideFollowMutation} from "../src/social/follow";

describe("follow mutation decision", () => {
  test("follow novo incrementa os dois contadores", () => {
    expect(decideFollowMutation(false, true)).toEqual({
      changed: true,
      followingDelta: 1,
      followersDelta: 1,
    });
  });

  test("follow repetido e idempotente", () => {
    expect(decideFollowMutation(true, true)).toEqual({
      changed: false,
      followingDelta: 0,
      followersDelta: 0,
    });
  });

  test("unfollow existente decrementa os dois contadores", () => {
    expect(decideFollowMutation(true, false)).toEqual({
      changed: true,
      followingDelta: -1,
      followersDelta: -1,
    });
  });

  test("unfollow repetido e idempotente", () => {
    expect(decideFollowMutation(false, false)).toEqual({
      changed: false,
      followingDelta: 0,
      followersDelta: 0,
    });
  });
});
