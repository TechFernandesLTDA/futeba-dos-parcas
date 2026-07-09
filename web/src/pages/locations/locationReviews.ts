import type { LocationReview } from '../../types/location';

interface ReviewStatsFallback {
  averageRating?: number;
  reviewCount?: number;
}

export function dedupeLocationReviewsByUser<T extends Pick<LocationReview, 'userId' | 'createdAt'>>(
  reviews: T[],
): T[] {
  const sorted = [...reviews].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const seen = new Set<string>();

  return sorted.filter((review) => {
    if (!review.userId || seen.has(review.userId)) return false;
    seen.add(review.userId);
    return true;
  });
}

export function getLocationReviewStats(
  reviews: Array<Pick<LocationReview, 'rating' | 'userId'>>,
  currentUserId?: string | null,
  fallback: ReviewStatsFallback = {},
) {
  const externalReviews = currentUserId
    ? reviews.filter((review) => review.userId !== currentUserId)
    : reviews;

  if (externalReviews.length === 0) {
    return {
      averageRating: fallback.averageRating ?? 0,
      reviewCount: fallback.reviewCount ?? 0,
    };
  }

  return {
    averageRating: externalReviews.reduce((sum, review) => sum + review.rating, 0) / externalReviews.length,
    reviewCount: externalReviews.length,
  };
}
