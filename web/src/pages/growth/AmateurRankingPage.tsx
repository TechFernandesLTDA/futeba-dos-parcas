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
} from '@mui/material';
import EmojiEvents from '@mui/icons-material/EmojiEvents';
import MilitaryTech from '@mui/icons-material/MilitaryTech';
import Timeline from '@mui/icons-material/Timeline';
import SportsSoccer from '@mui/icons-material/SportsSoccer';
import Shield from '@mui/icons-material/Shield';
import AutoGraph from '@mui/icons-material/AutoGraph';
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
    question: 'Como funciona a pontuação por presença e vitória?',
    answer:
      'No Futeba dos Parças, cada jogo rende XP: por padrão, 10 por participar, 30 por vitória, 10 por empate, 25 por gol, 20 por assistência, 15 por defesa e 15 por jogo sem sofrer gol (clean sheet). Assim, quem não marca gols também pontua.',
  },
  {
    question: 'Quem pode votar no Craque da Rodada (MVP)?',
    answer:
      'No Futeba dos Parças, quem participou do jogo vota depois da partida, dentro de uma janela de 24 horas após o fim, em MVP, melhor goleiro ou bola murcha. Não é possível votar em si mesmo. O MVP rende 50 XP.',
  },
  {
    question: 'Como o ranking evita que quem joga mais partidas sempre vença?',
    answer:
      'O app organiza o ranking em temporadas mensais e registra estatísticas individuais (gols, assistências, defesas e clean sheets), não só o total de jogos disputados.',
  },
  {
    question: 'Goleiros têm estatísticas próprias?',
    answer:
      'Sim. O app registra defesas e clean sheets (jogos sem sofrer gol), ambos com XP, e a votação pós-jogo tem a categoria de melhor goleiro.',
  },
];

const pillars = [
  {
    icon: <SportsSoccer sx={{ fontSize: 36, color: '#00852A' }} />,
    title: 'Gols & Assistências',
    desc: 'Gols e assistências registrados na partida rendem XP e entram nas estatísticas dos jogadores.',
  },
  {
    icon: <Shield sx={{ fontSize: 36, color: '#00852A' }} />,
    title: 'Defesa & Clean Sheets',
    desc: 'Defesas e jogos sem sofrer gol também rendem XP para quem protege a meta.',
  },
  {
    icon: <EmojiEvents sx={{ fontSize: 36, color: '#00852A' }} />,
    title: 'Craque da Rodada (MVP)',
    desc: 'Quem participou do jogo vota depois da partida, sem poder votar em si mesmo.',
  },
  {
    icon: <AutoGraph sx={{ fontSize: 36, color: '#00852A' }} />,
    title: 'Evolução e Níveis XP',
    desc: 'O XP acumulado sobe seu nível, e conquistas rendem badges.',
  },
];

export function AmateurRankingPage() {
  useEffect(() => {
    trackEvent('landing_viewed', { page: 'ranking-futebol-amador' });
  }, []);

  const registerUtmUrl = buildUtmUrl('/register', {
    utm_source: 'growth_content',
    utm_medium: 'hero_cta',
    utm_campaign: 'amateur_ranking_guide',
    utm_content: 'amateur_ranking_hero',
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      <GrowthHeader currentPage="/ranking-futebol-amador" />
      <GrowthBreadcrumbs items={[{ label: 'Ranking de Futebol Amador' }]} />

      {/* Hero Section */}
      <Box sx={{ pt: { xs: 4, md: 8 }, pb: { xs: 6, md: 10 }, bgcolor: alpha('#00852A', 0.03) }}>
        <Container maxWidth="lg">
          <Grid container spacing={5} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack spacing={2.5}>
                <Box>
                  <Chip
                    label="ESTATÍSTICAS & GAMIFICAÇÃO"
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
                    Ranking de Futebol Amador: Do Racha Entre Amigos à Tabela de Artilharia
                  </Typography>
                </Box>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '1.0625rem', md: '1.2rem' }, lineHeight: 1.6 }}
                >
                  Transforme a pelada semanal em uma competição sadia e divertida. Registre gols,
                  assistências, frequência, eleja o melhor jogador e acompanhe a evolução do racha
                  ao longo da temporada.
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
                      bgcolor: '#00852A',
                      '&:hover': { bgcolor: '#006B22' },
                      textTransform: 'none',
                    }}
                  >
                    Criar Ranking do Meu Time
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
                  p: 2,
                }}
              >
                <CardContent>
                  <Typography variant="h6" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MilitaryTech sx={{ color: '#00852A' }} /> O que o Ranking mede
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    {pillars.map((item, idx) => (
                      <Stack key={idx} direction="row" spacing={2} alignItems="flex-start">
                        <Box sx={{ mt: 0.5 }}>{item.icon}</Box>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={800}>
                            {item.title}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.desc}
                          </Typography>
                        </Box>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Main Content Sections */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={8}>
          <Box component="section">
            <Typography variant="h4" component="h2" fontWeight={900} gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
              Por que ter estatísticas aumenta a presença na pelada?
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: '1.0625rem', lineHeight: 1.7 }}>
              Toda pelada passa por momentos de desânimo onde faltam jogadores e o grupo perde o ritmo. A forma mais eficaz
              de resgatar o entusiasmo dos atletas é criar senso de pertencimento e progresso. Quando cada jogo conta pontos
              para o ranking da temporada e para a artilharia, o grupo ganha um motivo a mais para aparecer.
            </Typography>
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <Timeline sx={{ color: '#00852A', fontSize: 36, mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Histórico Inquestionável
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sem mais discussões sobre quem ganhou mais vezes ou quem fez mais gols no mês. Os dados ficam gravados.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <EmojiEvents sx={{ color: '#00852A', fontSize: 36, mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Premiações de Fim de Ano
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Faça o churrasco de encerramento premiando o Artilheiro, o Garçom e o Craque do Ano com base nos números do grupo.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <MilitaryTech sx={{ color: '#00852A', fontSize: 36, mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Engajamento e Resenha
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      A resenha não acaba no apito: ela continua com as notas, os votos e o debate sobre os melhores lances.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          {/* Links to Other Guides */}
          <Box component="section">
            <Typography variant="h4" component="h2" fontWeight={900} gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
              Continue Aprendendo
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Card sx={{ borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Como Organizar a Pelada Sem Confusão
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Checklist prático, confirmações e sorteio de times equilibrados para que a partida aconteça sem falhas.
                    </Typography>
                    <Button
                      component={RouterLink}
                      to="/organizar-pelada"
                      variant="text"
                      endIcon={<ArrowForward />}
                      sx={{ fontWeight: 700, color: '#00852A', minHeight: 44 }}
                    >
                      Ver Guia de Organização
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card sx={{ borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Como Funciona o Futeba dos Parças
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Veja os recursos do aplicativo para organizadores, jogadores e gestores de quadra.
                    </Typography>
                    <Button
                      component={RouterLink}
                      to="/como-funciona"
                      variant="text"
                      endIcon={<ArrowForward />}
                      sx={{ fontWeight: 700, color: '#00852A', minHeight: 44 }}
                    >
                      Conhecer o Produto
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          <GrowthFaq items={faqs} title="Dúvidas sobre Ranking e Estatísticas" />
        </Stack>
      </Container>

      <GrowthCtaSection
        pageIdentifier="amateur_ranking_bottom"
        title="Seu futebol merece estatísticas profissionais"
        subtitle="Comece a registrar as partidas de hoje e descubra quem realmente é o craque da pelada."
        buttonText="Criar Meu Ranking"
      />

      <GrowthFooter />
    </Box>
  );
}
