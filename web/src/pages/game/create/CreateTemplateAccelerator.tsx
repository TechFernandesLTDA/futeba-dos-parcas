import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Bolt as BoltIcon,
  ContentPaste as ContentPasteIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { GameTemplate } from '../../../types/game';
import type { RecentGame } from '../../../hooks/useDuplicateGame';

export interface CreateTemplateAcceleratorProps {
  templatesLoading: boolean;
  templates: GameTemplate[];
  recentGames: RecentGame[];
  onOpenSaveTemplate: () => void;
  onOpenDuplicate: () => void;
  onLoadTemplate: (templateId: string) => void;
  onQuickCreateFromTemplate: (template: GameTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
}

export const CreateTemplateAccelerator: React.FC<CreateTemplateAcceleratorProps> = ({
  templatesLoading,
  templates,
  recentGames,
  onOpenSaveTemplate,
  onOpenDuplicate,
  onLoadTemplate,
  onQuickCreateFromTemplate,
  onDeleteTemplate,
}) => {
  const { t } = useTranslation();

  return (
    <Card
      variant="outlined"
      sx={(theme) => ({
        mb: 2.5,
        borderColor: alpha(theme.palette.secondary.main, 0.18),
        boxShadow: theme.shadowsCustom?.card ?? theme.shadows[1],
      })}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: { xs: 2, md: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1 }}>
            <Box
              sx={(theme) => ({
                width: 40,
                height: 40,
                borderRadius: 2.5,
                display: 'grid',
                placeItems: 'center',
                color: 'secondary.main',
                bgcolor: alpha(theme.palette.secondary.main, 0.1),
              })}
            >
              <BoltIcon />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={800}>
                {t('games.create.quickStartTitle')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('games.create.quickStartDescription')}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<SaveIcon />}
              onClick={onOpenSaveTemplate}
            >
              {t('games.create.saveAsTemplate')}
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<ContentPasteIcon />}
              onClick={onOpenDuplicate}
              disabled={recentGames.length === 0}
            >
              {t('games.duplicateGame')}
            </Button>
          </Box>
        </Box>
        <Divider />
        {templatesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={20} />
          </Box>
        ) : templates.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('games.create.noTemplatesDescription')}
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
            {templates.map((tpl) => (
              <Card key={tpl.id} variant="outlined" sx={{ bgcolor: 'background.default' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={700} noWrap>
                      {tpl.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {tpl.location_name || t('games.create.noLocationLabel')} {tpl.time ? `· ${tpl.time}` : ''} {tpl.recurrence_type ? `· ${tpl.recurrence_type === 'weekly' ? t('games.create.frequencyWeekly') : tpl.recurrence_type === 'biweekly' ? t('games.create.frequencyBiweekly') : t('games.create.frequencyMonthly')}` : ''} {tpl.max_players ? `· ${tpl.max_players} ${t('games.playersShort')}` : ''}
                    </Typography>
                  </Box>
                  <Button size="small" variant="outlined" onClick={() => onLoadTemplate(tpl.id)}>
                    {t('common.load')}
                  </Button>
                  <Tooltip title={tpl.time ? t('games.create.quickCreateTooltip') : t('games.create.templateWithoutTimeTooltip')}>
                    <span>
                      <Button
                        size="small"
                        variant="contained"
                        color={tpl.time ? 'primary' : 'inherit'}
                        disabled={!tpl.time}
                        onClick={() => onQuickCreateFromTemplate(tpl)}
                      >
                        {t('games.createGame')}
                      </Button>
                    </span>
                  </Tooltip>
                  <IconButton
                    size="small"
                    onClick={() => onDeleteTemplate(tpl.id)}
                    aria-label={`Remover template ${tpl.name}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
