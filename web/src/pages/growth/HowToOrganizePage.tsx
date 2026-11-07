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
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  alpha,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import EventAvailable from '@mui/icons-material/EventAvailable';
import Groups from '@mui/icons-material/Groups';
import Balance from '@mui/icons-material/Balance';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import NotificationsActive from '@mui/icons-material/NotificationsActive';
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
    question: 'Qual é a melhor antecedência para abrir confirmação de presença?',
    answer:
      'Para peladas semanais regulares, o ideal é abrir a lista entre 3 a 4 dias antes (por exemplo, terça-feira para jogos na sexta-feira). Isso dá tempo hábil para os mensalistas confirmarem e, caso sobrem vagas, convidar diaristas com segurança.',
  },
  {
    question: 'Como lidar com quem confirma e desiste em cima da hora?',
    answer:
      'Combine com o grupo um horário limite para cancelar (ex.: 4 horas antes). No Futeba dos Parças, quando alguém cancela e abre uma vaga, o primeiro da lista de espera é avisado e tem 30 minutos para confirmar.',
  },
  {
    question: 'Quantos jogadores por time no futebol society?',
    answer:
      'Geralmente joga-se 5x5 ou 6x6 na linha mais 1 goleiro em cada equipe (total de 12 a 14 jogadores para dois times, ou 18 a 21 para três times com rodízio de 10 minutos).',
  },
  {
    question: 'Como garantir que os times fiquem realmente equilibrados?',
    answer:
      'O segredo é classificar os atletas por estrelas ou notas em fundamentos (velocidade, passe, marcação, finalização) e nunca sortear os dois melhores juntos. No sorteio equilibrado do Futeba dos Parças, os jogadores são divididos pelo nível de cada um (método snake draft), com os goleiros tratados à parte, e o app mostra se os times ficaram equilibrados.',
  },
];

const checklist = [
  {
    stage: '1 semana antes',
    desc: 'Confirmação da quadra, horário e definição do valor por atleta.',
  },
  {
    stage: '3 dias antes',
    desc: 'Abertura da confirmação de presença no aplicativo.',
  },
  {
    stage: '24 horas antes',
    desc: 'O app lembra quem ainda não confirmou presença; vagas que sobrarem podem ser preenchidas por convidados.',
  },
  {
    stage: '2 horas antes',
    desc: 'Sorteio dos times (equilibrado ou aleatório) e novo lembrete para quem ainda não confirmou.',
  },
  {
    stage: 'Pós-jogo',
    desc: 'Registro do placar, gols e assistências e votação de MVP, melhor goleiro e bola murcha.',
  },
];

export function HowToOrganizePage() {
  useEffect(() => {
    trackEvent('landing_viewed', { page: 'organizar-pelada' });
  }, []);

  const registerUtmUrl = buildUtmUrl('/register', {
    utm_source: 'growth_content',
    utm_medium: 'hero_cta',
    utm_campaign: 'organizar_pelada_guide',
    utm_content: 'organizar_pelada_hero',
  });

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', color: 'text.primary' }}>
      <GrowthHeader currentPage="/organizar-pelada" />
      <GrowthBreadcrumbs items={[{ label: 'Como Organizar Pelada' }]} />

      {/* Hero Section */}
      <Box sx={{ pt: { xs: 4, md: 8 }, pb: { xs: 6, md: 10 }, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.03) }}>
        <Container maxWidth="lg">
          <Grid container spacing={5} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack spacing={2.5}>
                <Box>
                  <Chip
                    label="GUIA COMPLETO DE ORGANIZAÇÃO"
                    size="small"
                    sx={{
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
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
                    Como Organizar uma Pelada Sem Confusão no Grupo
                  </Typography>
                </Box>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '1.0625rem', md: '1.2rem' }, lineHeight: 1.6 }}
                >
                  Chega de listas infinitas de WhatsApp, mensagens apagadas, gente que fura na hora
                  do jogo e times desequilibrados. Aprenda o passo a passo para gerenciar confirmações,
                  sorteio e finanças com tranquilidade.
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
                      px: 3.5,
                      fontWeight: 800,
                      borderRadius: '999px',
                      bgcolor: 'primary.main',
                      '&:hover': { bgcolor: 'primary.dark' },
                      textTransform: 'none',
                    }}
                  >
                    Criar Grupo de Pelada
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
                  boxShadow: (theme) => `0 12px 32px ${alpha(theme.palette.common.black, 0.06)}`,
                  bgcolor: 'background.paper',
                }}
              >
                <CardContent sx={{ p: 4 }}>
                  <Typography variant="h6" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EventAvailable sx={{ color: 'primary.main' }} /> Checklist da Pelada Perfeita
                  </Typography>
                  <List disablePadding>
                    {checklist.map((item, idx) => (
                      <ListItem key={idx} disableGutters sx={{ py: 1.25, alignItems: 'flex-start' }}>
                        <ListItemIcon sx={{ minWidth: 32, mt: 0.25 }}>
                          <CheckCircle sx={{ color: 'primary.main', fontSize: 20 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={item.stage}
                          secondary={item.desc}
                          primaryTypographyProps={{ fontWeight: 800, fontSize: '0.925rem' }}
                          secondaryTypographyProps={{ fontSize: '0.85rem' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Main Content Articles */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={8}>
          {/* Section 1 */}
          <Box component="section">
            <Typography variant="h4" component="h2" fontWeight={900} gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
              1. Confirmação de Presença sem Furos
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: '1.0625rem', lineHeight: 1.7 }}>
              O maior pesadelo de todo organizador é chegar na quadra e faltar gente para fechar dois times, ou ter gente
              demais esperando no banco. Em listas comuns de aplicativos de mensagem, nomes são sobrepostos, pessoas confirmam
              sem ler as regras e desistências passam despercebidas.
            </Typography>
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <Groups sx={{ color: 'primary.main', fontSize: 36, mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Vagas Limitadas
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Defina o número de vagas do jogo (ex.: 14). Quem quiser entrar depois que lotar vai para a lista de espera.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <HourglassEmpty sx={{ color: 'primary.main', fontSize: 36, mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Lista de Espera
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Quando alguém cancela, o primeiro da fila é avisado e tem 30 minutos para confirmar a vaga.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <NotificationsActive sx={{ color: 'primary.main', fontSize: 36, mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Lembretes Automáticos
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      O app envia lembretes de confirmação a quem ainda não respondeu, 24 horas e 2 horas antes do jogo.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          {/* Section 2 */}
          <Box component="section">
            <Typography variant="h4" component="h2" fontWeight={900} gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
              2. Sorteio Justo e Equilíbrio de Forças
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: '1.0625rem', lineHeight: 1.7 }}>
              Quem organiza pelada sabe: basta um time ficar muito forte para o jogo perder a graça e os ânimos se exaltarem.
              O método tradicional de “dois capitães tirando par ou ímpar” na hora gera atrasos e ressentimentos.
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: '1.0625rem', lineHeight: 1.7 }}>
              No sorteio equilibrado do <strong>Futeba dos Parças</strong>, cada jogador tem um nível e o app divide os times
              por esse nível, tratando os goleiros à parte, e indica se os times ficaram equilibrados. O organizador também pode refazer o sorteio de forma aleatória.
            </Typography>
            <Card
              sx={{
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                borderRadius: 3,
                border: 1,
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
                p: 2,
              }}
            >
              <CardContent>
                <Typography variant="subtitle1" fontWeight={800} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Balance sx={{ color: 'primary.main' }} /> Dica de Ouro do Capitão:
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Nunca altere a escalação gerada sem o consentimento do grupo. O sorteio transparente elimina acusações de favorecimento e fortalece a amizade no racha.
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Section 3: Links to other clusters */}
          <Box component="section">
            <Typography variant="h4" component="h2" fontWeight={900} gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
              Aprofunde Sua Gestão de Futebol
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: '1.0625rem', lineHeight: 1.7 }}>
              Organizar a lista é só o começo. Conheça também como gerenciar as finanças e transformar cada partida em um campeonato com estatísticas reais:
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Card sx={{ borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Como Criar um Ranking Amador
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Veja como acompanhar artilheiros e eleger o MVP da rodada com votação entre os parças.
                    </Typography>
                    <Button
                      component={RouterLink}
                      to="/ranking-futebol-amador"
                      variant="text"
                      endIcon={<ArrowForward />}
                      sx={{ fontWeight: 700, color: 'primary.main', minHeight: 44 }}
                    >
                      Ler Guia de Ranking
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card sx={{ borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Controle Financeiro da Pelada
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Entenda como organizar mensalistas, diaristas e o caixa do grupo.
                    </Typography>
                    <Button
                      component={RouterLink}
                      to="/gestao-de-pelada"
                      variant="text"
                      endIcon={<ArrowForward />}
                      sx={{ fontWeight: 700, color: 'primary.main', minHeight: 44 }}
                    >
                      Ler Guia Financeiro
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          <GrowthFaq items={faqs} title="Perguntas Frequentes sobre Organização de Pelada" />
        </Stack>
      </Container>

      <GrowthCtaSection
        pageIdentifier="organizar_pelada_bottom"
        title="Chega de estresse para fechar o time da semana"
        subtitle="Crie seu grupo no Futeba dos Parças agora e compartilhe o link direto com os jogadores."
        buttonText="Organizar Minha Pelada Agora"
      />

      <GrowthFooter />
    </Box>
  );
}
