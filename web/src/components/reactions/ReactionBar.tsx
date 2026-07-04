import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import { AddReaction as AddReactionIcon } from '@mui/icons-material';
import { REACTION_EMOJIS, ReactionsMap, summarizeReactions } from '../../constants/reactions';
import { useReactions } from '../../hooks/useReactions';

interface ReactionBarProps {
  targetPath: string;
  reactions: ReactionsMap | null | undefined;
  createData?: Record<string, unknown>;
  reactionField?: string;
  enabled?: boolean;
}

export const ReactionBar: React.FC<ReactionBarProps> = ({
  targetPath,
  reactions,
  createData,
  reactionField,
  enabled = true,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const {
    currentUserId,
    reactions: displayReactions,
    pending,
    toggleReaction,
  } = useReactions(targetPath, reactions, { createData, reactionField });
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const summary = useMemo(
    () => summarizeReactions(displayReactions, currentUserId).slice(0, 3),
    [currentUserId, displayReactions],
  );

  const handleClose = () => setAnchorEl(null);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        flexWrap: 'wrap',
      }}
    >
      {summary.map((item) => (
        <Button
          key={item.emoji}
          size="small"
          variant={item.selected ? 'contained' : 'outlined'}
          disabled={pending || !enabled}
          onClick={() => toggleReaction(item.emoji)}
          aria-label={t('reactions.toggleEmoji', { emoji: item.emoji, count: item.count })}
          sx={{
            minWidth: 44,
            px: 1,
            py: 0.25,
            borderRadius: 999,
            lineHeight: 1.4,
            bgcolor: item.selected ? undefined : alpha(theme.palette.action.hover, 0.5),
          }}
        >
          {item.emoji} {item.count}
        </Button>
      ))}

      <Tooltip title={t('reactions.add')}>
        <span>
          <IconButton
            size="small"
            disabled={pending || !enabled}
            onClick={(event) => setAnchorEl(event.currentTarget)}
            aria-label={t('reactions.add')}
            sx={{
              minWidth: 44,
              minHeight: 36,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 999,
            }}
          >
            <AddReactionIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        {REACTION_EMOJIS.map((emoji) => (
          <MenuItem
            key={emoji}
            onClick={() => {
              toggleReaction(emoji);
              handleClose();
            }}
            aria-label={t('reactions.reactWithEmoji', { emoji })}
            sx={{ fontSize: '1.25rem', minWidth: 48, justifyContent: 'center' }}
          >
            {emoji}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};
