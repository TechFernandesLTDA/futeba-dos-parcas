import {
  Box,
  Button,
  Container,
  Divider,
  Link,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import {
  EmojiEvents,
  EventAvailable,
  Groups,
  SupportAgent,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const benefits = [
  {
    icon: <Groups />,
    title: 'Grupo organizado',
    text: 'Centralize jogadores, convites e comunicacao sem depender de mensagens perdidas.',
  },
  {
    icon: <EventAvailable />,
    title: 'Jogo com presenca',
    text: 'Marque data, local e acompanhe confirmacoes antes da bola rolar.',
  },
  {
    icon: <EmojiEvents />,
    title: 'Ranking vivo',
    text: 'Transforme frequencia, gols e desempenho em historico do grupo.',
  },
];

export function LaunchPage() {
  useDocumentTitle('Futeba dos Parcas - lancamento');
  const theme = useTheme();

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Box
        component="header"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ py: 2 }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                component="img"
                src="/logo.png"
                alt="Futeba dos Parcas"
                sx={{ width: 40, height: 40, borderRadius: '50%' }}
              />
              <Typography variant="subtitle1" fontWeight={800}>
                Futeba dos Parcas
              </Typography>
            </Stack>
            <Button component={RouterLink} to="/login" variant="outlined" size="small">
              Entrar
            </Button>
          </Stack>
        </Container>
      </Box>

      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 4, md: 8 }}
            alignItems="center"
            sx={{ py: { xs: 7, md: 10 } }}
          >
            <Stack spacing={3} sx={{ flex: 1 }}>
              <Typography component="h1" variant="h2" fontWeight={900}>
                Organize sua pelada sem bagunca
              </Typography>
              <Typography variant="h6" sx={{ color: 'primary.contrastText', opacity: 0.88, maxWidth: 680 }}>
                Grupo, jogo, confirmacao, times e ranking em um so lugar para donos de pelada,
                jogadores e quadras.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button component={RouterLink} to="/register" variant="contained" color="secondary" size="large">
                  Comecar agora
                </Button>
                <Button
                  component="a"
                  href="mailto:techfernandesltda@gmail.com?subject=Quero%20testar%20o%20Futeba%20dos%20Parcas"
                  variant="outlined"
                  size="large"
                  sx={{
                    borderColor: theme.palette.primary.contrastText,
                    color: 'primary.contrastText',
                  }}
                >
                  Falar com suporte
                </Button>
              </Stack>
            </Stack>

            <Box
              aria-hidden="true"
              sx={{
                width: { xs: 220, md: 320 },
                height: { xs: 220, md: 320 },
                borderRadius: '50%',
                bgcolor: 'background.paper',
                display: 'grid',
                placeItems: 'center',
                boxShadow: 8,
                flexShrink: 0,
              }}
            >
              <Box
                component="img"
                src="/logo.png"
                alt=""
                sx={{ width: '72%', height: '72%', objectFit: 'contain' }}
              />
            </Box>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" component="main" sx={{ py: { xs: 5, md: 7 } }}>
        <Stack spacing={5}>
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
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <Box sx={{ color: 'primary.main', '& svg': { fontSize: 34 } }}>{benefit.icon}</Box>
                <Typography variant="h6" fontWeight={800}>{benefit.title}</Typography>
                <Typography color="text.secondary">{benefit.text}</Typography>
              </Stack>
            ))}
          </Stack>

          <Divider />

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={3}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'center' }}
          >
            <Stack spacing={1}>
              <Typography variant="h5" fontWeight={800}>
                Beta publico controlado
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 720 }}>
                A primeira abertura publica prioriza grupos reais, feedback rapido e estabilidade
                dos fluxos principais: cadastro, grupo, jogo, confirmacao e ranking.
              </Typography>
            </Stack>
            <Button
              component={RouterLink}
              to="/settings/feedbacks"
              startIcon={<SupportAgent />}
              variant="contained"
            >
              Enviar feedback
            </Button>
          </Stack>

          <Stack
            component="footer"
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ color: 'text.secondary' }}
          >
            <Link href="/terms_of_service.html">Termos</Link>
            <Link href="/privacy_policy.html">Privacidade</Link>
            <Link href="/delete_account.html">Exclusao de conta</Link>
            <Link href="mailto:techfernandesltda@gmail.com">Suporte</Link>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
