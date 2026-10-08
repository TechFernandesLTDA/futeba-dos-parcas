import { useEffect, useLayoutEffect } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Button,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
  useTheme as useMuiTheme,
} from '@mui/material';
import {
  CheckCircle,
  EmojiEvents,
  EventAvailable,
  ExpandMore,
  Groups,
  Leaderboard,
  PersonAddAlt,
  SportsSoccer,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { trackEvent } from '../../utils/analytics';
import { useTheme as useAppTheme } from '../../contexts/ThemeContext';
import { SEO_PARENT_COMPANY_URL } from '../../components/seo/metadata';

const currentYear = new Date().getFullYear();

const footerLinks = [
  { label: 'Termos', href: '/terms_of_service.html' },
  { label: 'Privacidade', href: '/privacy_policy.html' },
  { label: 'Exclusão de conta', href: '/delete_account.html' },
];

const guideLinks = [
  { label: 'Como Funciona', href: '/como-funciona' },
  { label: 'Organizar Pelada', href: '/organizar-pelada' },
  { label: 'Ranking & MVP', href: '/ranking-futebol-amador' },
  { label: 'Gestão & Caixa', href: '/gestao-de-pelada' },
  { label: 'Parcerias com Quadras', href: '/parcerias' },
];

const benefits = [
  {
    icon: <Groups />,
    title: 'Grupo organizado',
    text: 'Centralize jogadores, convites, mensalistas e comunicação sem depender de mensagens perdidas.',
  },
  {
    icon: <EventAvailable />,
    title: 'Jogo com presença confirmada',
    text: 'Marque data e local, acompanhe as respostas e saiba quem realmente vai entrar em campo.',
  },
  {
    icon: <EmojiEvents />,
    title: 'Ranking que conta a história',
    text: 'Transforme frequência, gols, vitórias e destaques em uma evolução que todo mundo acompanha.',
  },
];

const steps = [
  {
    icon: <PersonAddAlt />,
    label: 'Monte o grupo',
    text: 'Convide os parças e mantenha todos no mesmo lugar.',
  },
  {
    icon: <SportsSoccer />,
    label: 'Organize a rodada',
    text: 'Defina horário, quadra, vagas e confirmação de presença.',
  },
  {
    icon: <Leaderboard />,
    label: 'Registre e evolua',
    text: 'Salve o resultado e acompanhe estatísticas, ranking e conquistas.',
  },
];

const faqs = [
  {
    question: 'O Futeba dos Parças é só para quem organiza a pelada?',
    answer: 'Não. Organizadores controlam grupos e jogos, enquanto jogadores confirmam presença, acompanham estatísticas, rankings e conquistas.',
  },
  {
    question: 'Consigo usar para uma pelada que já acontece toda semana?',
    answer: 'Sim. Você pode criar o grupo, cadastrar a quadra, organizar jogos recorrentes e concentrar confirmações e histórico no Futeba.',
  },
  {
    question: 'Preciso instalar um aplicativo?',
    answer: 'Não. O Futeba funciona no navegador do celular e do computador e também pode ser instalado como aplicativo quando o navegador oferecer essa opção.',
  },
  {
    question: 'Quadras e arenas também podem participar?',
    answer: 'Sim. O produto possui recursos para divulgar locais, organizar horários e aproximar quadras de grupos que procuram onde jogar.',
  },
];

function LaunchPageContent() {
  const theme = useMuiTheme();

  useEffect(() => {
    trackEvent('landing_viewed', { page: 'launch' });
  }, []);

  const trackSignup = (location: string) => {
    trackEvent('signup_cta_clicked', { location });
  };

  const trackSupport = (location: string) => {
    trackEvent('support_cta_clicked', { channel: 'email', location });
  };

  return (
    <Box
      data-testid="public-landing"
      data-resolved-theme={theme.palette.mode}
      sx={{ minHeight: '100dvh', bgcolor: 'background.default', color: 'text.primary', colorScheme: 'light' }}
    >
      <Box
        component="header"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.paper, 0.96),
          position: 'sticky',
          top: 0,
          zIndex: theme.zIndex.appBar,
          backdropFilter: 'blur(12px)',
          // FIX #4130 (a11y): com status-bar `default` o header precisa
          // respeitar a safe-area (Dynamic Island/notch no PWA iOS).
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={{ xs: 1, sm: 2 }}
            sx={{ py: { xs: 1, sm: 1.5 }, minHeight: { xs: 64, sm: 72 } }}
          >
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
              <Box
                component="img"
                src="/logo.png"
                alt="Logotipo do Futeba dos Parças"
                sx={{
                  width: { xs: 36, sm: 42 },
                  height: { xs: 36, sm: 42 },
                  flexShrink: 0,
                  objectFit: 'contain',
                  borderRadius: '50%',
                }}
              />
              <Typography
                variant="subtitle1"
                fontWeight={900}
                noWrap
                sx={{ display: { xs: 'none', sm: 'block' } }}
              >
                Futeba dos Parças
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
              <Button
                component={RouterLink}
                to="/login"
                variant="text"
                size="small"
                sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
              >
                Entrar
              </Button>
              <Button
                component={RouterLink}
                to="/register"
                variant="contained"
                size="small"
                onClick={() => trackSignup('header')}
                sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
              >
                Criar conta
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="main" id="main-content">
        <Box
          data-testid="landing-hero"
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            position: 'relative',
            overflow: 'hidden',
            // #4069: o brilho decorativo (radial-gradient branco 20% em
            // 82% 20%) só existe a partir de md, quando o grid tem duas
            // colunas e o centro do brilho cai sobre a imagem — nunca sobre
            // o texto. Em xs/sm o grid empilha e o texto ocupa a largura
            // toda: o brilho clareava o verde sob o eyebrow para 4,18:1
            // (AA exige 4,5:1 — o primary.main só tem 0,28 de folga).
            '&::before': {
              content: { xs: 'none', md: '""' },
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at 82% 20%, ${alpha(theme.palette.common.white, 0.2)}, transparent 34%)`,
              pointerEvents: 'none',
            },
          }}
        >
          <Container maxWidth="lg" sx={{ position: 'relative' }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(360px, 500px)' },
                gridTemplateAreas: {
                  xs: '"intro" "heroImage" "details" "mock"',
                  md: '"intro heroImage" "details mock"',
                },
                columnGap: { md: 9 },
                rowGap: { xs: 3, md: 3 },
                alignItems: 'center',
                py: { xs: 4, md: 11 },
              }}
            >
              <Stack spacing={3} sx={{ gridArea: 'intro', maxWidth: 720 }}>
                <Typography
                  variant="overline"
                  fontWeight={800}
                  sx={{ letterSpacing: '0.14em', color: 'primary.contrastText' }}
                >
                  Da convocação ao apito final
                </Typography>
                <Typography component="h1" variant="h2" fontWeight={900} sx={{ lineHeight: 1.02 }}>
                  Sua pelada sai do grupo e entra em campo.
                </Typography>
              </Stack>

              <Box
                component="img"
                src="/og-futeba-dos-parcas-hero.webp"
                alt="Amigos reunidos em um campo com a marca Futeba dos Parças"
                // Dimensões explícitas evitam CLS; o LCP é pré-carregado via
                // <link rel="preload"> no index.html (React 18 não suporta fetchPriority).
                width={1200}
                height={630}
                sx={{
                  gridArea: 'heroImage',
                  display: 'block',
                  width: '100%',
                  maxWidth: 500,
                  height: 'auto',
                  aspectRatio: '1200 / 630',
                  objectFit: 'cover',
                  borderRadius: 4,
                  boxShadow: 12,
                  justifySelf: 'center',
                }}
              />

              <Stack spacing={3} sx={{ gridArea: 'details', maxWidth: 720 }}>
                <Typography variant="h6" sx={{ color: 'primary.contrastText', opacity: 0.9, maxWidth: 650 }}>
                  Confirmações, times, placar, estatísticas e ranking em um só lugar para quem organiza,
                  para quem joga e para quem oferece a quadra.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  {/* #4071: CTA branco sólido com texto primary.dark — o azul
                      do secondary (#005FCC, calibrado para TEXTO sobre fundo
                      claro) tinha só 1,25:1 de separação contra o hero verde e
                      era o único elemento fora da paleta da dobra. Branco:
                      4,78:1 contra o hero (>= 3:1 non-text) e ~7,4:1 no texto. */}
                  <Button
                    component={RouterLink}
                    to="/register"
                    variant="contained"
                    size="large"
                    onClick={() => trackSignup('hero')}
                    sx={{
                      bgcolor: 'common.white',
                      color: 'primary.dark',
                      '&:hover': {
                        bgcolor: 'grey.100',
                      },
                      // O focus-ring global (primary.dark) é invisível sobre o
                      // hero verde — aqui o anel precisa ser branco.
                      '&:focus-visible': {
                        outlineColor: 'common.white',
                      },
                      // Alvo de toque >= 44px no mobile (padrão do header/footer).
                      minHeight: 44,
                    }}
                  >
                    Organizar minha pelada
                  </Button>
                  <Button
                    component="a"
                    href="#como-funciona"
                    variant="outlined"
                    size="large"
                    sx={{
                      borderColor: theme.palette.primary.contrastText,
                      color: 'primary.contrastText',
                      '&:hover': {
                        borderColor: theme.palette.primary.contrastText,
                        bgcolor: alpha(theme.palette.common.white, 0.1),
                      },
                      minHeight: 44,
                    }}
                  >
                    Ver como funciona
                  </Button>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }}>
                  {['Funciona no navegador', 'Instalável no celular', 'Feito para futebol amador'].map((item) => (
                    <Stack key={item} direction="row" spacing={0.75} alignItems="center">
                      <CheckCircle sx={{ fontSize: 18 }} />
                      <Typography variant="body2" fontWeight={700}>{item}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>

              <Box
                  aria-label="Exemplo de uma rodada organizada no Futeba dos Parças"
                  sx={{
                    gridArea: 'mock',
                    width: '100%',
                    maxWidth: 410,
                    borderRadius: 4,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    boxShadow: 12,
                    p: { xs: 2.5, sm: 3.5 },
                    transform: { md: 'rotate(1.5deg)' },
                    justifySelf: 'center',
                  }}
                >
                  <Stack spacing={2.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Box>
                      <Typography variant="overline" color="text.secondary" fontWeight={800}>Próxima rodada</Typography>
                      <Typography variant="h5" fontWeight={900}>Quarta dos Parças</Typography>
                      <Typography variant="body2" color="text.secondary">Hoje, 20h • Arena Central</Typography>
                    </Box>
                    <Box sx={{ px: 1.25, py: 0.5, flexShrink: 0, borderRadius: 8, bgcolor: 'success.main', color: 'success.contrastText' }}>
                      <Typography variant="caption" fontWeight={900} noWrap>CONFIRMADO</Typography>
                    </Box>
                  </Stack>
                  <Divider />
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="h4" fontWeight={900}>12/14</Typography>
                      <Typography variant="caption" color="text.secondary">jogadores confirmados</Typography>
                    </Box>
                    <Stack alignItems="flex-end">
                      <Typography variant="body2" fontWeight={800}>2 vagas abertas</Typography>
                      <Typography variant="caption" color="text.secondary">times saem às 19h</Typography>
                    </Stack>
                  </Stack>
                  <Box
                    sx={{
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      border: 1,
                      borderColor: alpha(theme.palette.primary.main, 0.24),
                      p: 2,
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <SportsSoccer color="primary" />
                      <Box>
                        <Typography variant="body2" fontWeight={800}>Depois do jogo</Typography>
                        <Typography variant="caption" color="text.secondary">Placar, MVP, estatísticas e ranking atualizados.</Typography>
                      </Box>
                    </Stack>
                  </Box>
                  </Stack>
                </Box>
            </Box>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
          <Stack spacing={{ xs: 7, md: 10 }}>
            <Stack spacing={3}>
              <Box>
                <Typography variant="overline" color="primary" fontWeight={900}>Tudo no mesmo jogo</Typography>
                <Typography component="h2" variant="h4" fontWeight={900} sx={{ maxWidth: 720 }}>
                  Menos conversa perdida. Mais gente confirmada e bola rolando.
                </Typography>
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                {benefits.map((benefit) => (
                  <Stack
                    key={benefit.title}
                    spacing={1.5}
                    sx={{
                      flex: 1,
                      p: 3,
                      border: 1,
                      borderColor: 'divider',
                      borderRadius: 3,
                      bgcolor: 'background.paper',
                    }}
                  >
                    <Box sx={{ color: 'primary.main', '& svg': { fontSize: 36 } }}>{benefit.icon}</Box>
                    <Typography variant="h6" fontWeight={900}>{benefit.title}</Typography>
                    <Typography color="text.secondary">{benefit.text}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>

            <Stack id="como-funciona" spacing={4} sx={{ scrollMarginTop: 88 }}>
              <Box>
                <Typography variant="overline" color="primary" fontWeight={900}>Como funciona</Typography>
                <Typography component="h2" variant="h4" fontWeight={900}>Três momentos que toda pelada já conhece.</Typography>
              </Box>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                {steps.map((step, index) => (
                  <Stack key={step.label} direction="row" spacing={2} sx={{ flex: 1 }}>
                    <Stack alignItems="center" spacing={1}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                        }}
                      >
                        {step.icon}
                      </Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={900}>0{index + 1}</Typography>
                    </Stack>
                    <Box sx={{ pt: 0.5 }}>
                      <Typography variant="h6" fontWeight={900}>{step.label}</Typography>
                      <Typography color="text.secondary">{step.text}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Stack>

            <Box
              sx={{
                borderRadius: 4,
                bgcolor: 'primary.dark',
                // #4052: no dark, primary.dark é #2E7D32 e o contrastText
                // herdado (#000000, pensado para o main #4ADE80) dá 4.10:1.
                // Branco passa nos dois temas (5.13:1 sobre #2E7D32,
                // 7.5:1 sobre #005A1C do light).
                color: 'common.white',
                p: { xs: 3, md: 5 },
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                <Box>
                  <Typography component="h2" variant="h4" fontWeight={900}>O grupo já existe. Falta organizar o jogo.</Typography>
                  <Typography sx={{ mt: 1, maxWidth: 700 }}>
                    Crie sua conta, chame os parças e prepare a próxima rodada sem depender de planilhas ou centenas de mensagens.
                  </Typography>
                </Box>
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  color="secondary"
                  size="large"
                  onClick={() => trackSignup('mid_page')}
                  sx={{ flexShrink: 0, minHeight: 44 }}
                >
                  Começar agora
                </Button>
              </Stack>
            </Box>

            <Stack
              component="section"
              aria-labelledby="landing-faq-heading"
              spacing={3}
              sx={{ maxWidth: 840, mx: 'auto', width: '100%', alignSelf: 'center' }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="overline" color="primary" fontWeight={900}>Perguntas frequentes</Typography>
                <Typography id="landing-faq-heading" component="h2" variant="h4" fontWeight={900}>Antes de entrar em campo</Typography>
              </Box>
              <Box>
                {faqs.map((faq) => (
                  <Accordion key={faq.question} disableGutters elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <AccordionSummary
                      expandIcon={<ExpandMore />}
                      sx={{
                        position: 'relative',
                        px: { xs: 5, sm: 6 },
                        '& .MuiAccordionSummary-content': {
                          justifyContent: 'center',
                          textAlign: 'center',
                        },
                        '& .MuiAccordionSummary-expandIconWrapper': {
                          position: 'absolute',
                          right: { xs: 12, sm: 16 },
                        },
                      }}
                    >
                      <Typography align="center" fontWeight={800} sx={{ width: '100%' }}>{faq.question}</Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: { xs: 3, sm: 6 }, pt: 0, pb: 3 }}>
                      <Typography align="center" color="text.secondary">{faq.answer}</Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Divider />
      <Box component="footer" sx={{ bgcolor: 'background.paper' }}>
        <Container maxWidth="lg" sx={{ py: 4, pb: { xs: 11, md: 4 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Stack spacing={1}>
              <Stack spacing={0.5}>
                <Typography fontWeight={900}>Futeba dos Parças</Typography>
                <Typography variant="body2" color="text.secondary">A tecnologia que joga junto com o futebol amador.</Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Um produto da{' '}
                <Link
                  href={SEO_PARENT_COMPANY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  fontWeight={700}
                >
                  Tech Fernandes
                </Link>
                .
              </Typography>
            </Stack>
            <Stack spacing={1}>
              <Typography variant="caption" fontWeight={800} color="text.primary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Guias & Conteúdo
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} sx={{ color: 'text.secondary', flexWrap: 'wrap' }}>
                {guideLinks.map((item) => (
                  <Link
                    key={item.href}
                    component={RouterLink}
                    to={item.href}
                    sx={{
                      minHeight: 44,
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: 'text.secondary',
                      '&:hover': { color: 'text.primary' },
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </Stack>
            </Stack>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} sx={{ color: 'text.secondary' }}>
              {footerLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  sx={{
                    // Alvo de toque >= 44px no mobile (WCAG 2.5.8 / Material touch targets).
                    minHeight: 44,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="mailto:techfernandesltda@gmail.com?subject=Quero%20conhecer%20o%20Futeba%20dos%20Par%C3%A7as"
                onClick={() => trackSupport('footer')}
                sx={{
                  minHeight: 44,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Falar com suporte
              </Link>
            </Stack>
          </Stack>
          <Divider sx={{ mt: { xs: 2, md: 3 }, mb: 1.5 }} />
          <Typography variant="caption" color="text.secondary" display="block">
            © {currentYear} Tech Fernandes LTDA. Todos os direitos reservados.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

export function LaunchPage() {
  const { setDocumentThemeOverride } = useAppTheme();

  useLayoutEffect(() => {
    setDocumentThemeOverride('light');
    return () => setDocumentThemeOverride(null);
  }, [setDocumentThemeOverride]);

  // #4070: não há mais MuiThemeProvider local — a override acima agora faz o
  // ThemeProvider raiz entregar o tema claro (inclusive o <CssBaseline /> que
  // pinta o body), deixando "a landing é sempre clara" com uma única fonte de
  // verdade.
  return <LaunchPageContent />;
}
