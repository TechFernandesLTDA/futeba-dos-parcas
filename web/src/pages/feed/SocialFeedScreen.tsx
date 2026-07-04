import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Stack,
  Typography,
} from '@mui/material';
import {
  DynamicFeed as FeedIcon,
  Groups as GroupsIcon,
  Replay as RetryIcon,
} from '@mui/icons-material';
import { PageContainer } from '../../components/common/PageContainer';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/GameCard';
import { WallPostCard } from '../group/WallPostCard';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useSocialFeed } from '../../hooks/useSocialFeed';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const SocialFeedScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showError, showSuccess } = useToast();
  const { posts, loading, error, hasGroups, refetch, hidePost, reportPost } = useSocialFeed();
  useDocumentTitle(t('socialFeed.title'));

  return (
    <PageContainer maxWidth="focused">
      <Stack spacing={2} sx={{ py: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('socialFeed.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('socialFeed.subtitle')}
          </Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" startIcon={<RetryIcon />} onClick={() => void refetch()}>
                {t('common.retry')}
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {loading && <LoadingState shimmerCount={4} itemType="CARD" />}

        {!loading && !error && !hasGroups && (
          <EmptyState
            icon={<GroupsIcon />}
            title={t('socialFeed.emptyGroupsTitle')}
            description={t('socialFeed.emptyGroupsDesc')}
            actionLabel={t('groups.discoverGroups')}
            onAction={() => navigate('/groups/discover')}
          />
        )}

        {!loading && !error && hasGroups && posts.length === 0 && (
          <EmptyState
            icon={<FeedIcon />}
            title={t('socialFeed.emptyTitle')}
            description={t('socialFeed.emptyDesc')}
            actionLabel={t('socialFeed.goToGroups')}
            onAction={() => navigate('/?tab=2')}
          />
        )}

        {!loading && !error && posts.length > 0 && (
          <Stack spacing={1.5}>
            {posts.map((post) => (
              <WallPostCard
                key={`${post.groupId}-${post.id}`}
                post={post}
                isOwn={post.authorId === currentUser?.uid}
                canManage={false}
                originLabel={post.groupName}
                onOpenOrigin={() => navigate(`/group/${post.groupId}/post/${post.id}`)}
                onHide={async (targetPost) => {
                  try {
                    await hidePost(targetPost);
                    showSuccess(t('socialFeed.hiddenSuccess'));
                  } catch {
                    showError(t('socialFeed.hiddenError'));
                  }
                }}
                onReport={async (targetPost) => {
                  try {
                    await reportPost(targetPost);
                    showSuccess(t('socialFeed.reportSuccess'));
                  } catch {
                    showError(t('socialFeed.reportError'));
                  }
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </PageContainer>
  );
};
