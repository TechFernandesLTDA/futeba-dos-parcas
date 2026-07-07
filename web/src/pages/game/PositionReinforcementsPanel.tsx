import React, { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import SendIcon from '@mui/icons-material/Send';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import { useTranslation } from 'react-i18next';
import type { Game, GameConfirmation } from '../../types/game';
import { useToast } from '../../contexts/ToastContext';
import { EmptyState } from '../../components/common/EmptyState';
import { getFirestoreErrorMessage } from '../../utils/firebaseErrors';
import {
  getPreferredPositionsForNeed,
  type ReinforcementNeed,
} from '../../utils/positionReinforcements';
import { usePositionReinforcements } from '../../hooks/usePositionReinforcements';

interface PositionReinforcementsPanelProps {
  game: Game;
  confirmations: GameConfirmation[];
  canManage: boolean;
}

const NEEDS: ReinforcementNeed[] = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'STRIKER', 'ANY_FIELD'];

export const PositionReinforcementsPanel: React.FC<PositionReinforcementsPanelProps> = ({
  game,
  confirmations,
  canManage,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  const [need, setNeed] = useState<ReinforcementNeed>('GOALKEEPER');
  const [recentPresenceOnly, setRecentPresenceOnly] = useState(false);
  const {
    candidates,
    loading,
    error,
    refetch,
    sendReinforcement,
    sendingUserId,
  } = usePositionReinforcements(canManage ? game : null, confirmations, need, recentPresenceOnly);

  if (!canManage || !['SCHEDULED', 'CONFIRMED'].includes(game.status)) return null;

  const preferredPositions = getPreferredPositionsForNeed(need)
    .map((position) => t(`profile.positions.${position}`))
    .join(', ');

  const handleSend = async (candidate: (typeof candidates)[number]) => {
    try {
      await sendReinforcement(candidate);
      showSuccess(t('games.detail.reinforcements.sentSuccess', { name: candidate.user.name }));
    } catch (err) {
      showError(getFirestoreErrorMessage(err));
    }
  };

  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            <PersonSearchIcon />
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('games.detail.reinforcements.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('games.detail.reinforcements.description')}
            </Typography>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="reinforcement-need-label">
              {t('games.detail.reinforcements.needLabel')}
            </InputLabel>
            <Select
              labelId="reinforcement-need-label"
              value={need}
              label={t('games.detail.reinforcements.needLabel')}
              onChange={(event) => setNeed(event.target.value as ReinforcementNeed)}
              disabled={loading || !!sendingUserId}
            >
              {NEEDS.map((option) => (
                <MenuItem key={option} value={option}>
                  {t(`games.detail.reinforcements.needs.${option}`)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={refetch} disabled={loading || !!sendingUserId}>
            {loading ? t('common.loading') : t('common.refresh')}
          </Button>
        </Stack>
        <FormControlLabel
          sx={{ mb: 1 }}
          control={(
            <Switch
              checked={recentPresenceOnly}
              onChange={(event) => setRecentPresenceOnly(event.target.checked)}
              disabled={loading || !!sendingUserId}
            />
          )}
          label={t('games.detail.reinforcements.recentPresenceOnly')}
        />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {t('games.detail.reinforcements.matchHint', { positions: preferredPositions })}
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={<Button color="inherit" size="small" onClick={refetch}>{t('common.retry')}</Button>}
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={<SportsSoccerIcon sx={{ fontSize: 48 }} />}
            title={t('games.detail.reinforcements.emptyTitle')}
            description={t('games.detail.reinforcements.emptyDescription')}
          />
        ) : (
          <List disablePadding aria-label={t('games.detail.reinforcements.candidatesList')}>
            {candidates.slice(0, 8).map((candidate, index) => (
              <Box key={candidate.user.id}>
                {index > 0 && <Divider />}
                <ListItem
                  disableGutters
                  secondaryAction={
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={sendingUserId === candidate.user.id ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                      onClick={() => handleSend(candidate)}
                      disabled={!!sendingUserId}
                    >
                      {sendingUserId === candidate.user.id
                        ? t('games.detail.reinforcements.sending')
                        : t('games.detail.reinforcements.send')}
                    </Button>
                  }
                >
                  <ListItemAvatar>
                    <Avatar src={candidate.user.photoUrl}>
                      {candidate.user.name.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={candidate.user.name}
                    secondary={
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                        {candidate.user.preferredPosition && (
                          <Chip size="small" label={t(`profile.positions.${candidate.user.preferredPosition}`)} />
                        )}
                        {candidate.isLookingToday && (
                          <Chip size="small" color="success" label={t('games.detail.reinforcements.lookingToday')} />
                        )}
                        {candidate.isPreferredPositionMatch && (
                          <Chip size="small" color="primary" label={t('games.detail.reinforcements.positionMatch')} />
                        )}
                        {candidate.hasRecentPresence && (
                          <Chip size="small" color="info" label={t('games.detail.reinforcements.recentPresence')} />
                        )}
                        {candidate.rating > 0 && (
                          <Chip size="small" label={t('games.detail.reinforcements.rating', { rating: candidate.rating.toFixed(1) })} />
                        )}
                      </Stack>
                    }
                  />
                </ListItem>
              </Box>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
