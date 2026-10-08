import {
  Box,
  Container,
  Divider,
  Grid,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { SEO_PARENT_COMPANY_URL } from '../../../components/seo/metadata';
import { trackEvent } from '../../../utils/analytics';

const currentYear = new Date().getFullYear();

const guideLinks = [
  { label: 'Como Funciona o App', path: '/como-funciona' },
  { label: 'Guia: Como Organizar Pelada', path: '/organizar-pelada' },
  { label: 'Ranking & Artilharia Amadora', path: '/ranking-futebol-amador' },
  { label: 'Gestão Financeira e Caixa', path: '/gestao-de-pelada' },
  { label: 'Parcerias para Arenas e Quadras', path: '/parcerias' },
];

const legalLinks = [
  { label: 'Termos de Uso', href: '/terms_of_service.html' },
  { label: 'Política de Privacidade', href: '/privacy_policy.html' },
  { label: 'Exclusão de Conta', href: '/delete_account.html' },
];

export function GrowthFooter() {
  const trackSupport = () => {
    trackEvent('support_cta_clicked', { channel: 'email', location: 'growth_footer' });
  };

  return (
    <Box component="footer" sx={{ bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider' }}>
      <Container maxWidth="lg" sx={{ py: 6, pb: { xs: 10, md: 6 } }}>
        <Grid container spacing={4}>
          {/* Brand Column */}
          <Grid item xs={12} md={4}>
            <Stack spacing={1.5}>
              <Typography variant="h6" fontWeight={900}>
                Futeba dos Parças
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                A tecnologia que joga junto com o futebol amador. Gestão de pelada, confirmações de
                presença, estatísticas, artilharia e MVP.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Um produto da{' '}
                <Link
                  href={SEO_PARENT_COMPANY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  fontWeight={700}
                  color="text.primary"
                  sx={{
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  Tech Fernandes
                </Link>
                .
              </Typography>
            </Stack>
          </Grid>

          {/* Guides Column */}
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Guias & Conteúdo
            </Typography>
            <Stack spacing={0.5}>
              {guideLinks.map((item) => (
                <Link
                  key={item.path}
                  component={RouterLink}
                  to={item.path}
                  color="text.secondary"
                  underline="hover"
                  sx={{
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </Stack>
          </Grid>

          {/* Legal & Support Column */}
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Legal & Suporte
            </Typography>
            <Stack spacing={0.5}>
              {legalLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  color="text.secondary"
                  underline="hover"
                  sx={{
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                  }}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="mailto:techfernandesltda@gmail.com?subject=Contato%20via%20Futeba%20dos%20Par%C3%A7as"
                onClick={trackSupport}
                color="text.secondary"
                underline="hover"
                sx={{
                  minHeight: 44,
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '0.875rem',
                }}
              >
                Falar com suporte
              </Link>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ mt: 5, mb: 3 }} />

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          spacing={1}
        >
          <Typography variant="caption" color="text.secondary">
            © {currentYear} Tech Fernandes LTDA. Todos os direitos reservados. CNPJ 57.285.516/0001-47.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Curitiba/PR · Brasil
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
