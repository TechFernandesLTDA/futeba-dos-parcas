import { describe, expect, it } from 'vitest';
import { dedupeLocationReviewsByUser, getLocationReviewStats } from './locationReviews';

describe('locationReviews', () => {
  it('keeps only the most recent review per user', () => {
    const reviews = dedupeLocationReviewsByUser([
      { id: 'old', userId: 'u1', rating: 4, createdAt: new Date('2026-07-01T10:00:00Z') },
      { id: 'new', userId: 'u1', rating: 5, createdAt: new Date('2026-07-02T10:00:00Z') },
      { id: 'other', userId: 'u2', rating: 3, createdAt: new Date('2026-07-01T09:00:00Z') },
    ]);

    expect(reviews.map((review) => review.id)).toEqual(['new', 'other']);
  });

  it('excludes the current user review from the displayed average when other reviews exist', () => {
    expect(
      getLocationReviewStats(
        [
          { userId: 'me', rating: 5 },
          { userId: 'u2', rating: 3 },
          { userId: 'u3', rating: 4 },
        ],
        'me',
        { averageRating: 4.2, reviewCount: 3 },
      ),
    ).toEqual({
      averageRating: 3.5,
      reviewCount: 2,
    });
  });

  it('falls back to persisted aggregates when only the current user review is present', () => {
    expect(
      getLocationReviewStats(
        [{ userId: 'me', rating: 5 }],
        'me',
        { averageRating: 4.2, reviewCount: 7 },
      ),
    ).toEqual({
      averageRating: 4.2,
      reviewCount: 7,
    });
  });
});
