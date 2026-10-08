import { useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Stack,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import AssignmentInd from '@mui/icons-material/AssignmentInd';
import SportsSoccer from '@mui/icons-material/SportsSoccer';
import Stadium from '@mui/icons-material/Stadium';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Smartphone from '@mui/icons-material/Smartphone';
import Devices from '@mui/icons-material/Devices';
import ArrowForward from '@mui/icons-material/ArrowForward';
import { Link as RouterLink } from 'react-router-dom';
import { trackEvent, buildUtmUrl } from '../../utils/analytics';
import { GrowthHeader } from './components/GrowthHeader';
import { GrowthFooter } from './components/GrowthFooter';
import { GrowthBreadcrumbs } from './components/GrowthBreadcrumbs';
import { GrowthCtaSection } from './components/GrowthCtaSection';
import { GrowthFaq, FaqItem } from './components/GrowthFaq';

const faqs: FaqItem[] = [
  {
    question: 'Preciso instalar algum aplicativo?',
    answer:
      'Não é obrigatório. O Futeba dos Parças funciona direto no navegador do celular ou do computador e pode ser instalado na tela inicial como PWA. Também existe aplicativo Android.',
  },
  {
    question: 'Funciona no iPhone e no Android?',
    answer:
      'Sim, pelo navegador: a versão web funciona em celulares iPhone e Android e em computadores. O aplicativo nativo disponível é o de Android.',
  },
  {
    question: 'Posso usar se meu grupo jogar em quadras diferentes toda semana?',
    answer:
      'Com certeza. A cada nova partida você pode selecionar a quadra desejada na lista de locais cadastrados ou indicar um endereço novo.',
  },
  {
    question: 'Como convidar os jogadores do meu time?',
    answer:
      'Basta copiar o link de convite exclusivo do seu grupo gerado no app e compartilhar no seu grupo de WhatsApp. O jogador abre o link e entra no grupo.',
  },
];

const flows = [
  {
    role: 'Para Organizadores',
    icon: <AssignmentInd sx={{ fontSize: 36, color: '#00852A' }} />,
    tag: 'CONTROLE TOTAL',
    steps: [
      'Crie seu grupo e gere um link de convite.',
      'Agende partidas com data, horário, quadra e vagas limitadas.',
      'Sorteie times equilibrados pelo nível dos atletas ou de forma aleatória.',
      'Registre placar, gols e assistências da partida.',
    ],
  },
  {
    role: 'Para Jogadores',
    icon: <SportsSoccer sx={{ fontSize: 36, color: '#00852A' }} />,
    tag: 'EXPERIÊNCIA & GAMIFICAÇÃO',
    steps: [
      'Confirme presença com apenas um toque no celular.',
      'Faça check-in no jogo, por localização ou lendo o QR Code do jogo.',
      'Vote no MVP, no melhor goleiro e na bola murcha depois do jogo.',
      'Acompanhe seu XP, seu nível e suas badges.',
    ],
  },
  {
    role: 'Para Arenas & Quadras',
    icon: <Stadium sx={{ fontSize: 36, color: '#00852A' }} />,
    tag: 'OCUPAÇÃO & VISIBILIDADE',
    steps: [
      'Cadastre sua arena e as quadras (society, futsal, campo, areia).',
      'Mostre a estrutura da quadra (comodidades, tipo de piso) para grupos que procuram onde jogar.',
      'Apareça no mapa de locais para organizadores de peladas.',
      'Locais passam por verificação antes de aparecerem como verificados.',
    ],
  },
];

export function HowItWorksPage() {
  const theme = useTheme();

  useEffect(() => {
    trackEvent('landing_viewed', { page: 'como-funciona' });
  }, []);

  const registerUtmUrl = buildUtmUrl('/register', {
    utm_source: 'growth_content',
    utm_medium: 'hero_cta',
    utm_campaign: 'how_it_works',
    utm_content: 'how_it_works_hero',
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <GrowthHeader currentPage="/como-funciona" />
      <GrowthBreadcrumbs items={[{ label: 'Como Funciona' }]} />

      {/* Hero Section */}
      <Box sx={{ pt: { xs: 4, md: 8 }, pb: { xs: 6, md: 10 }, bgcolor: alpha('#00852A', 0.03) }}>
        <Container maxWidth="lg">
          <Stack spacing={2.5} alignItems="center" textAlign="center" sx={{ maxWidth: 840, mx: 'auto' }}>
            <Chip
              label="VISÃO GERAL DO PRODUTO"
              size="small"
              sx={{
                bgcolor: alpha('#00852A', 0.1),
                color: '#00852A',
                fontWeight: 800,
                letterSpacing: 0.5,
              }}
            />
            <Typography
              variant="h2"
              component="h1"
              fontWeight={900}
              sx={{
                fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' },
                lineHeight: 1.15,
                letterSpacing: '-1px',
              }}
            >
              Como Funciona o Futeba dos Parças
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontSize: { xs: '1.0625rem', md: '1.2rem' }, lineHeight: 1.6 }}
            >
              Uma plataforma unificada desenvolvida pela <strong>Tech Fernandes</strong> para
              transformar o futebol amador. Veja como o app atende organizadores, jogadores e donos de quadra.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
              <Button
                component={RouterLink}
                to={registerUtmUrl}
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                sx={{
                  minHeight: 48,
                  px: 4,
                  fontWeight: 800,
                  borderRadius: '999px',
                  bgcolor: '#00852A',
                  '&:hover': { bgcolor: '#006B22' },
                  textTransform: 'none',
                }}
              >
                Criar Minha Conta
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Three User Journeys */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={8}>
          <Grid container spacing={4}>
            {flows.map((flow, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 4,
                    border: 1,
                    borderColor: 'divider',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.05)',
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ mb: 2 }}>{flow.icon}</Box>
                    <Chip
                      label={flow.tag}
                      size="small"
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        bgcolor: alpha('#00852A', 0.1),
                        color: '#00852A',
                        mb: 1.5,
                      }}
                    />
                    <Typography variant="h5" component="h2" fontWeight={900} gutterBottom>
                      {flow.role}
                    </Typography>
                    <Divider sx={{ my: 2 }} />
                    <Stack spacing={1.5}>
                      {flow.steps.map((step, sIdx) => (
                        <Stack key={sIdx} direction="row" spacing={1.5} alignItems="flex-start">
                          <CheckCircle sx={{ color: '#00852A', fontSize: 18, mt: 0.3 }} />
                          <Typography variant="body2" color="text.secondary">
                            {step}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Multiplatform Section */}
          <Box
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: 4,
              bgcolor: alpha(theme.palette.background.paper, 0.8),
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={8}>
                <Stack spacing={1.5}>
                  <Typography variant="h5" fontWeight={900}>
                    Acesse de Qualquer Aparelho
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    Seus amigos não precisam baixar nada para começar: o Futeba dos Parças roda direto no
                    navegador do celular ou do computador e pode ser instalado na tela inicial como PWA. Há também aplicativo Android.
                  </Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction="row" spacing={2} justifyContent={{ xs: 'flex-start', md: 'center' }}>
                  <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: alpha('#00852A', 0.08) }}>
                    <Smartphone sx={{ fontSize: 36, color: '#00852A' }} />
                    <Typography variant="caption" display="block" fontWeight={800}>
                      Mobile PWA
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: alpha('#00852A', 0.08) }}>
                    <Devices sx={{ fontSize: 36, color: '#00852A' }} />
                    <Typography variant="caption" display="block" fontWeight={800}>
                      Desktop Web
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </Box>

          <GrowthFaq items={faqs} title="Perguntas Frequentes sobre o Funcionamento" />
        </Stack>
      </Container>

      <GrowthCtaSection
        pageIdentifier="how_it_works_bottom"
        title="Veja na prática como a sua pelada pode mudar"
        subtitle="Crie seu grupo, monte a próxima rodada e convide seus amigos pelo link do grupo."
        buttonText="Começar a Usar"
      />

      <GrowthFooter />
    </Box>
  );
}
