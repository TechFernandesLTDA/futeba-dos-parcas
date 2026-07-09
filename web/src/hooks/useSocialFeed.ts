import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { submitContentReport } from '../services/cloudFunctions';
import { useAuth } from '../contexts/AuthContext';
import { useGroups } from './useGroups';
import { mapPost, WallPost } from './useGroupWall';
import { createLogger } from '../utils/logger';

const logger = createLogger('useSocialFeed');
const GROUP_CHUNK_SIZE = 10;
const FEED_PAGE_SIZE = 30;

export interface SocialFeedPost extends WallPost {
  groupName: string;
}

function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += GROUP_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + GROUP_CHUNK_SIZE));
  }
  return chunks;
}

function postTime(post: WallPost): number {
  return post.createdAt?.getTime() ?? 0;
}

export function useSocialFeed() {
  const { currentUser } = useAuth();
  const {
    groups,
    loading: groupsLoading,
    error: groupsError,
    refetch: refetchGroups,
  } = useGroups();

  const groupMap = useMemo(
    () => new Map(groups.map((group) => [group.id, group.name || 'Grupo'])),
    [groups],
  );
  const groupIds = useMemo(() => groups.map((group) => group.id).filter(Boolean), [groups]);
  const currentUserId = currentUser?.uid;

  const {
    data: posts = [],
    isLoading: postsLoading,
    error: postsError,
    refetch: refetchPosts,
  } = useQuery({
    queryKey: ['social-feed', currentUserId, groupIds],
    enabled: !!currentUserId && !groupsLoading && groupIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<SocialFeedPost[]> => {
      const chunks = chunkIds(groupIds);
      const hiddenSnap = await getDocs(collection(db, 'users', currentUserId!, 'hidden_feed_posts'));
      const hiddenKeys = new Set(hiddenSnap.docs.map((docSnap) => docSnap.id));
      const results = await Promise.allSettled(
        chunks.map(async (chunk) => {
          const snap = await getDocs(
            query(
              collectionGroup(db, 'wall_posts'),
              where('group_id', 'in', chunk),
              orderBy('created_at', 'desc'),
              limit(FEED_PAGE_SIZE),
            ),
          );
          return snap.docs.map(mapPost);
        }),
      );

      const merged: SocialFeedPost[] = [];
      let firstChunkError: unknown = null;
      for (const result of results) {
        if (result.status === 'rejected') {
          logger.error('Erro ao carregar chunk do feed social:', result.reason);
          firstChunkError ??= result.reason;
          continue;
        }
        merged.push(
          ...result.value
            .filter((post) => post.deletedAt === null)
            .filter((post) => !hiddenKeys.has(postKey(post.groupId, post.id)))
            .map((post) => ({
              ...post,
              groupName: groupMap.get(post.groupId) ?? 'Grupo',
            })),
        );
      }

      if (merged.length === 0 && firstChunkError) {
        throw firstChunkError;
      }

      return merged
        .sort((a, b) => postTime(b) - postTime(a))
        .slice(0, FEED_PAGE_SIZE);
    },
  });

  const refetch = async () => {
    await refetchGroups();
    await refetchPosts();
  };

  const hidePost = async (post: WallPost) => {
    if (!currentUserId) throw new Error('Usuário não autenticado');
    const key = postKey(post.groupId, post.id);
    await setDoc(doc(db, 'users', currentUserId, 'hidden_feed_posts', key), {
      user_id: currentUserId,
      group_id: post.groupId,
      post_id: post.id,
      post_key: key,
      target_path: `groups/${post.groupId}/wall_posts/${post.id}`,
      hidden_at: serverTimestamp(),
    });
    await refetchPosts();
  };

  const reportPost = async (post: WallPost) => {
    if (!currentUserId) throw new Error('Usuário não autenticado');
    await submitContentReport({
      targetType: 'group_wall_post',
      groupId: post.groupId,
      postId: post.id,
      reason: 'inappropriate_content',
    });
  };

  return {
    posts,
    loading: groupsLoading || postsLoading,
    error: groupsError || (postsError instanceof Error ? postsError.message : postsError ? String(postsError) : null),
    hasGroups: groupIds.length > 0,
    refetch,
    hidePost,
    reportPost,
  };
}

function postKey(groupId: string, postId: string): string {
  return `${groupId}_${postId}`;
}
