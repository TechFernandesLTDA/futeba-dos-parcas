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
  alpha,
  Divider,
} from '@mui/material';
import Stadium from '@mui/icons-material/Stadium';
import TrendingUp from '@mui/icons-material/TrendingUp';
import EventSeat from '@mui/icons-material/EventSeat';
import Handshake from '@mui/icons-material/Handshake';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Email from '@mui/icons-material/Email';
import ArrowForward from '@mui/icons-material/ArrowForward';
import { trackEvent } from '../../utils/analytics';
import { GrowthHeader } from './components/GrowthHeader';
import { GrowthFooter } from './components/GrowthFooter';
import { GrowthBreadcrumbs } from './components/GrowthBreadcrumbs';
import { GrowthFaq, FaqItem } from './components/GrowthFaq';

const faqs: FaqItem[] = [
  {
    question: 'Quanto custa cadastrar minha arena no Futeba dos Parças?',
    answer:
      'Entre em contato com a equipe da Tech Fernandes para tratar das condições de cadastro e divulgação da sua arena. Não publicamos valores nesta página.',
  },
  {
    question: 'Como os grupos encontram minha quadra?',
    answer:
      'Organizadores escolhem o local do jogo entre os locais cadastrados no app, que também aparecem em um mapa de locais.',
  },
  {
    question: 'Posso atualizar dados de valores, fotos e comodidades?',
    answer:
      'Sim. Os dados do local incluem comodidades como estacionamento, vestiário, chuveiro, bar, churrasqueira e iluminação, além de fotos e valores, e podem ser atualizados pelo responsável do local no app.',
  },
  {
    question: 'Como funciona a validação da arena?',
    answer:
      'Locais novos entram como não verificados e só aparecem como verificados depois de confirmação dos dados com o responsável pela arena.',
  },
];

const benefits = [
  {
    icon: <EventSeat sx={{ fontSize: 40, color: '#00852A' }} />,
    title: 'Ocupação de Horários Ociosos',
    desc: 'Apresente sua arena a organizadores que procuram local para jogar, inclusive em horários de menor movimento.',
  },
  {
    icon: <TrendingUp sx={{ fontSize: 40, color: '#00852A' }} />,
    title: 'Novos Grupos Mensalistas',
    desc: 'Grupos do app jogam com regularidade e podem escolher uma quadra para seus jogos.',
  },
  {
    icon: <Stadium sx={{ fontSize: 40, color: '#00852A' }} />,
    title: 'Vitrine Esportiva Local',
    desc: 'Sua arena aparece na lista e no mapa de locais do app para quem organiza peladas na região.',
  },
];

export function PartnershipsPage() {
  useEffect(() => {
    trackEvent('landing_viewed', { page: 'parcerias' });
  }, []);

  const handleInquiryClick = () => {
    trackEvent('partnership_inquiry_clicked', { source: 'partnerships_page' });
  };

  const partnerEmailHref =
    'mailto:techfernandesltda@gmail.com?subject=Interesse%20em%20Parceria%20-%20Arena%20de%20Futebol&body=Ol%C3%A1%20equipe%20Tech%20Fernandes,%0A%0ATenho%20interesse%20em%20divulgar%20minha%20arena/quadra%20no%20Futeba%20dos%20Par%C3%A7as.%0A%0ANome%20da%20Arena:%20%0ACidade/UF:%20%0AN%C3%BAmero%20de%20Quadras:%20%0ATelefone%20de%20Contato:%20%0A%0AObrigado!';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <GrowthHeader currentPage="/parcerias" />
      <GrowthBreadcrumbs items={[{ label: 'Parcerias com Arenas e Quadras' }]} />

      {/* Hero Section */}
      <Box sx={{ pt: { xs: 4, md: 8 }, pb: { xs: 6, md: 10 }, bgcolor: alpha('#00852A', 0.03) }}>
        <Container maxWidth="lg">
          <Grid container spacing={5} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack spacing={2.5}>
                <Box>
                  <Chip
                    label="PROGRAMA DE PARCERIAS PARA ARENAS"
                    size="small"
                    sx={{
                      bgcolor: alpha('#00852A', 0.1),
                      color: '#00852A',
                      fontWeight: 800,
                      letterSpacing: 0.5,
                      mb: 1.5,
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
                    Parcerias para Arenas e Quadras de Futebol Society
                  </Typography>
                </Box>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '1.0625rem', md: '1.2rem' }, lineHeight: 1.6 }}
                >
                  Destaque sua arena esportiva diretamente para quem mais consome futebol: organizadores
                  de peladas e grupos ativos. Mostre sua quadra para quem organiza jogos
                  com a tecnologia da <strong>Tech Fernandes</strong>.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
                  <Button
                    href={partnerEmailHref}
                    variant="contained"
                    size="large"
                    onClick={handleInquiryClick}
                    endIcon={<ArrowForward />}
                    sx={{
                      minHeight: 48,
                      px: 3.5,
                      fontWeight: 800,
                      borderRadius: '999px',
                      bgcolor: '#00852A',
                      '&:hover': { bgcolor: '#006B22' },
                      textTransform: 'none',
                    }}
                  >
                    Quero Divulgar Minha Quadra
                  </Button>
                </Stack>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card
                sx={{
                  borderRadius: 4,
                  border: 1,
                  borderColor: 'divider',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.06)',
                  bgcolor: 'background.paper',
                  p: 3,
                }}
              >
                <CardContent>
                  <Typography variant="h6" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Handshake sx={{ color: '#00852A' }} /> Vantagens da Parceria
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <CheckCircle sx={{ color: '#00852A', fontSize: 20, mt: 0.3 }} />
                      <Typography variant="body2" color="text.secondary">
                        Listagem no app com endereço, comodidades (churrasqueira, bar, vestiário) e tipos de quadra.
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <CheckCircle sx={{ color: '#00852A', fontSize: 20, mt: 0.3 }} />
                      <Typography variant="body2" color="text.secondary">
                        Contato direto com a equipe da Tech Fernandes para alinhar os dados da arena.
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <CheckCircle sx={{ color: '#00852A', fontSize: 20, mt: 0.3 }} />
                      <Typography variant="body2" color="text.secondary">
                        Selo de local verificado após confirmação dos dados com a arena.
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Pillars Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={8}>
          <Grid container spacing={4}>
            {benefits.map((benefit, idx) => (
              <Grid item xs={12} md={4} key={idx}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 4,
                    border: 1,
                    borderColor: 'divider',
                    p: 2,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.04)',
                  }}
                >
                  <CardContent>
                    <Box sx={{ mb: 2 }}>{benefit.icon}</Box>
                    <Typography variant="h6" component="h2" fontWeight={800} gutterBottom>
                      {benefit.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {benefit.desc}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Contact Box */}
          <Box
            sx={{
              p: { xs: 4, md: 6 },
              borderRadius: 4,
              bgcolor: alpha('#00852A', 0.04),
              border: 1,
              borderColor: alpha('#00852A', 0.2),
              textAlign: 'center',
            }}
          >
            <Stack spacing={2} alignItems="center" sx={{ maxWidth: 640, mx: 'auto' }}>
              <Typography variant="h4" component="h3" fontWeight={900}>
                Como Cadastrar Sua Arena
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Entre em contato com a equipe da Tech Fernandes informando o nome da sua arena, cidade, bairro e
                quantidade de quadras disponíveis. Respondemos pelo e-mail informado.
              </Typography>
              <Divider sx={{ my: 1, width: '100%' }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ pt: 1 }}>
                <Button
                  href={partnerEmailHref}
                  variant="contained"
                  onClick={handleInquiryClick}
                  startIcon={<Email />}
                  sx={{
                    minHeight: 48,
                    px: 3,
                    borderRadius: '999px',
                    bgcolor: '#00852A',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#006B22' },
                  }}
                >
                  techfernandesltda@gmail.com
                </Button>
              </Stack>
            </Stack>
          </Box>

          <GrowthFaq items={faqs} title="Perguntas Frequentes de Gestores de Quadra" />
        </Stack>
      </Container>

      <GrowthFooter />
    </Box>
  );
}
