import { Box, Button, Container, Stack, Typography, alpha, useTheme } from '@mui/material';
import SportsSoccer from '@mui/icons-material/SportsSoccer';
import ArrowForward from '@mui/icons-material/ArrowForward';
import Check from '@mui/icons-material/Check';
import { Link as RouterLink } from 'react-router-dom';
import { trackEvent, buildUtmUrl } from '../../../utils/analytics';

interface GrowthCtaSectionProps {
  title?: string;
  subtitle?: string;
  buttonText?: string;
  pageIdentifier: string;
}

export function GrowthCtaSection({
  title = 'Pronto para levar sua pelada para outro nível?',
  subtitle = 'Chega de listas perdidas no WhatsApp. Monte seu grupo no Futeba dos Parças, organize confirmações e acompanhe ranking e estatísticas.',
  buttonText = 'Criar Minha Conta',
  pageIdentifier,
}: GrowthCtaSectionProps) {
  const theme = useTheme();

  const registerUtmUrl = buildUtmUrl('/register', {
    utm_source: 'growth_content',
    utm_medium: 'cta_section',
    utm_campaign: 'growth_hub',
    utm_content: pageIdentifier,
  });

  const handleCtaClick = () => {
    trackEvent('signup_cta_clicked', { location: `growth_cta_${pageIdentifier}` });
  };

  return (
    <Box
      sx={{
        py: { xs: 8, md: 10 },
        bgcolor: alpha('#00852A', 0.04),
        borderTop: 1,
        borderBottom: 1,
        borderColor: 'divider',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Container maxWidth="md">
        <Stack
          spacing={3}
          alignItems="center"
          textAlign="center"
          sx={{
            p: { xs: 4, sm: 6 },
            borderRadius: 4,
            bgcolor: theme.palette.mode === 'dark' ? 'background.paper' : '#FFFFFF',
            border: 1,
            borderColor: alpha('#00852A', 0.2),
            boxShadow: '0 8px 32px rgba(0, 133, 42, 0.08)',
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              bgcolor: '#00852A',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(0, 133, 42, 0.3)',
            }}
          >
            <SportsSoccer fontSize="large" />
          </Box>

          <Typography variant="h4" component="h2" fontWeight={900} sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' } }}>
            {title}
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, fontSize: '1.0625rem', lineHeight: 1.6 }}>
            {subtitle}
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}>
            <Button
              component={RouterLink}
              to={registerUtmUrl}
              variant="contained"
              size="large"
              onClick={handleCtaClick}
              endIcon={<ArrowForward />}
              sx={{
                minHeight: 48,
                px: 4,
                fontWeight: 800,
                fontSize: '1rem',
                borderRadius: '999px',
                bgcolor: '#00852A',
                '&:hover': { bgcolor: '#006B22' },
                textTransform: 'none',
                boxShadow: '0 4px 14px rgba(0, 133, 42, 0.3)',
              }}
            >
              {buttonText}
            </Button>
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1, sm: 3 }}
            alignItems="center"
            sx={{ pt: 2, color: 'text.secondary', fontSize: '0.875rem' }}
          >
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Check sx={{ color: '#00852A', fontSize: 18 }} />
              <Typography variant="caption" fontWeight={600} color="text.primary">
                Convide os parças por link
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Check sx={{ color: '#00852A', fontSize: 18 }} />
              <Typography variant="caption" fontWeight={600} color="text.primary">
                Sem necessidade de download
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Check sx={{ color: '#00852A', fontSize: 18 }} />
              <Typography variant="caption" fontWeight={600} color="text.primary">
                Web e Android
              </Typography>
            </Stack>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
