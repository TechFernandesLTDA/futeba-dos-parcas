import React, { useState } from 'react';
import {
  Box,
  Container,
  Stack,
  Typography,
  Button,
  Link,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  useTheme,
  alpha,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import SportsSoccer from '@mui/icons-material/SportsSoccer';
import { Link as RouterLink } from 'react-router-dom';
import { trackEvent, buildUtmUrl } from '../../../utils/analytics';

interface GrowthHeaderProps {
  currentPage?: string;
}

const navLinks = [
  { label: 'Como Funciona', path: '/como-funciona' },
  { label: 'Organizar Pelada', path: '/organizar-pelada' },
  { label: 'Ranking & MVP', path: '/ranking-futebol-amador' },
  { label: 'Gestão & Caixa', path: '/gestao-de-pelada' },
  { label: 'Parcerias', path: '/parcerias' },
];

export function GrowthHeader({ currentPage }: GrowthHeaderProps) {
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const registerUtmUrl = buildUtmUrl('/register', {
    utm_source: 'growth_content',
    utm_medium: 'header_nav',
    utm_campaign: 'growth_hub',
    utm_content: currentPage || 'growth_header',
  });

  const handleCtaClick = () => {
    trackEvent('signup_cta_clicked', { location: `growth_header_${currentPage || 'general'}` });
  };

  return (
    <Box
      component="header"
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.paper, 0.96),
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 1100,
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ minHeight: { xs: 64, md: 72 }, py: 1 }}
        >
          {/* Logo */}
          <Link
            component={RouterLink}
            to="/"
            underline="none"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              minHeight: 44,
              color: 'text.primary',
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '10px',
                bgcolor: '#00852A',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 133, 42, 0.25)',
              }}
            >
              <SportsSoccer fontSize="small" />
            </Box>
            <Box>
              <Typography variant="h6" component="div" fontWeight={900} sx={{ lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                Futeba dos Parças
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 600 }}
              >
                Tech Fernandes
              </Typography>
            </Box>
          </Link>

          {/* Desktop Nav Links */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ display: { xs: 'none', lg: 'flex' } }}
          >
            {navLinks.map((link) => {
              const isActive = currentPage === link.path;
              return (
                <Link
                  key={link.path}
                  component={RouterLink}
                  to={link.path}
                  underline="none"
                  sx={{
                    px: 1.5,
                    minHeight: 44,
                    whiteSpace: 'nowrap',
                    display: 'inline-flex',
                    alignItems: 'center',
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? '#00852A' : 'text.secondary',
                    borderRadius: 1,
                    '&:hover': {
                      color: 'text.primary',
                      bgcolor: alpha(theme.palette.action.hover, 0.08),
                    },
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </Stack>

          {/* Right Action CTAs */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              component={RouterLink}
              to="/login"
              variant="text"
              sx={{
                minHeight: 44,
                px: 2,
                whiteSpace: 'nowrap',
                color: 'text.primary',
                fontWeight: 700,
                display: { xs: 'none', sm: 'inline-flex' },
              }}
            >
              Entrar
            </Button>
            <Button
              component={RouterLink}
              to={registerUtmUrl}
              variant="contained"
              onClick={handleCtaClick}
              sx={{
                minHeight: 44,
                px: { xs: 2, sm: 2.5 },
                whiteSpace: 'nowrap',
                fontWeight: 800,
                borderRadius: '999px',
                bgcolor: '#00852A',
                '&:hover': { bgcolor: '#006B22' },
                textTransform: 'none',
                boxShadow: '0 4px 12px rgba(0, 133, 42, 0.25)',
              }}
            >
              Criar Pelada
            </Button>

            {/* Mobile Menu Toggle */}
            <IconButton
              aria-label="Menu principal de navegação"
              onClick={() => setMobileOpen(true)}
              sx={{
                display: { xs: 'inline-flex', lg: 'none' },
                minHeight: 44,
                minWidth: 44,
              }}
            >
              <MenuIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Container>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: { width: 280, p: 2, bgcolor: 'background.paper' },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography fontWeight={900}>Menu</Typography>
          <IconButton
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
            sx={{ minHeight: 44, minWidth: 44 }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
        <List>
          <ListItem disablePadding>
            <ListItemButton
              component={RouterLink}
              to="/"
              onClick={() => setMobileOpen(false)}
              sx={{ minHeight: 44, borderRadius: 1 }}
            >
              <ListItemText primary="Início" primaryTypographyProps={{ fontWeight: 700 }} />
            </ListItemButton>
          </ListItem>
          {navLinks.map((link) => (
            <ListItem key={link.path} disablePadding>
              <ListItemButton
                component={RouterLink}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                sx={{
                  minHeight: 44,
                  borderRadius: 1,
                  bgcolor: currentPage === link.path ? alpha('#00852A', 0.1) : 'transparent',
                }}
              >
                <ListItemText
                  primary={link.label}
                  primaryTypographyProps={{
                    fontWeight: currentPage === link.path ? 800 : 600,
                    color: currentPage === link.path ? '#00852A' : 'text.primary',
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
          <ListItem disablePadding sx={{ mt: 2 }}>
            <ListItemButton
              component={RouterLink}
              to="/login"
              onClick={() => setMobileOpen(false)}
              sx={{ minHeight: 44, borderRadius: 1 }}
            >
              <ListItemText primary="Entrar na conta" primaryTypographyProps={{ fontWeight: 700 }} />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
    </Box>
  );
}
