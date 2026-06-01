import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Skeleton,
  alpha,
  useTheme,
  Alert,
} from '@mui/material';
import {
  FlashOn as QuickIcon,
  Settings as CustomizeIcon,
  Add as AddIcon,
  LocationOn,
  People,
  SportsSoccer,
} from '@mui/icons-material';
import { useGameTemplates } from '../../hooks/useGameTemplates';
import { iconSizes } from '../../theme/iconSizes';

export const QuickCreateCard: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { templates, loading, error } = useGameTemplates();

  const topTemplates = templates.slice(0, 3);

  if (loading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Skeleton variant="text" width="40%" height={24} />
          <Skeleton variant="rounded" height={48} sx={{ mt: 1.5 }} />
          <Skeleton variant="rounded" height={48} sx={{ mt: 1 }} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 2 }}>
          <Alert severity="warning" sx={{ mb: 1 }}>
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (topTemplates.length === 0) {
    return null;
  }

  const navigateToCreate = (templateId: string) => {
    navigate(`/game/create?template=${templateId}`);
  };

  return (
    <Card
      sx={{
        mb: 2,
        bgcolor: alpha(theme.palette.primary.main, 0.03),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
      }}
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <QuickIcon sx={{ fontSize: iconSizes.md, color: theme.palette.primary.main }} />
          <Typography variant="subtitle2" fontWeight={700}>
            Criar Jogo Rápido
          </Typography>
          <Chip
            label={`${topTemplates.length}`}
            size="small"
            sx={{
              ml: 'auto',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              fontWeight: 600,
              fontSize: '0.7rem',
              height: 20,
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {topTemplates.map((tpl) => (
            <Box
              key={tpl.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                bgcolor: theme.palette.background.paper,
                flexWrap: 'wrap',
              }}
            >
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => navigateToCreate(tpl.id)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  flexShrink: 0,
                }}
              >
                {tpl.name}
              </Button>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                {tpl.location_name && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <LocationOn sx={{ fontSize: iconSizes.xs, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {tpl.location_name}
                    </Typography>
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <People sx={{ fontSize: iconSizes.xs, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {tpl.max_players} {tpl.max_goalkeepers > 0 ? `+${tpl.max_goalkeepers}g` : ''}
                  </Typography>
                </Box>
                {tpl.field_type && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SportsSoccer sx={{ fontSize: iconSizes.xs, color: 'text.secondary' }} />
                    <Typography variant="caption" color="text.secondary">
                      {tpl.field_type}
                    </Typography>
                  </Box>
                )}
              </Box>

              <Button
                variant="outlined"
                size="small"
                startIcon={<CustomizeIcon />}
                onClick={() => navigateToCreate(tpl.id)}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  textTransform: 'none',
                  flexShrink: 0,
                }}
              >
                Personalizar
              </Button>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};
