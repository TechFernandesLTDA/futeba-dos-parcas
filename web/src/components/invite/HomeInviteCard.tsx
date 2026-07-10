import { ArrowForward as ArrowForwardIcon, PersonAddAlt as InviteIcon } from '@mui/icons-material';
import { Box, Card, CardActionArea, Stack, Typography, alpha, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface HomeInviteCardProps {
  onInvite: () => void;
}

/** CTA principal da Home para crescimento orgânico por convite. */
export function HomeInviteCard({ onInvite }: HomeInviteCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        overflow: 'hidden',
        borderColor: alpha(theme.palette.primary.main, 0.35),
        background: `linear-gradient(120deg, ${alpha(theme.palette.primary.main, 0.13)}, ${alpha(theme.palette.success.main, 0.07)})`,
      }}
    >
      <CardActionArea
        onClick={onInvite}
        aria-label={t('home.inviteFriends')}
        sx={{ p: { xs: 1.75, sm: 2 } }}
      >
        <Stack direction="row" spacing={1.75} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              color: 'primary.contrastText',
              bgcolor: 'primary.main',
              boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.24)}`,
            }}
          >
            <InviteIcon />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800}>
              {t('home.inviteFriends')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('invite.shareDescription')}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'grid',
              placeItems: 'center',
              width: 36,
              height: 36,
              borderRadius: '50%',
              flexShrink: 0,
              color: 'primary.main',
              bgcolor: alpha(theme.palette.background.paper, 0.8),
            }}
            aria-hidden
          >
            <ArrowForwardIcon fontSize="small" />
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}
