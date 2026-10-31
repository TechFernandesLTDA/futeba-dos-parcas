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
import AccountBalanceWallet from '@mui/icons-material/AccountBalanceWallet';
import ReceiptLong from '@mui/icons-material/ReceiptLong';
import TrendingUp from '@mui/icons-material/TrendingUp';
import CreditCard from '@mui/icons-material/CreditCard';
import CheckCircle from '@mui/icons-material/CheckCircle';
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
    question: 'Como calcular o valor da mensalidade e da diária do avulso?',
    answer:
      'Some os custos do mês (aluguel da quadra e uma reserva para reposição de material) e divida pelos mensalistas. Uma prática comum é cobrar do avulso um pouco mais que do mensalista. O painel de finanças mensais do app calcula a parte de cada membro a partir dos jogos do mês.',
  },
  {
    question: 'Como evitar ter que cobrar no privado toda semana?',
    answer:
      'Combine um dia fixo no mês para o pagamento (ex.: dia 5 ou dia 10) e use o painel de finanças mensais do app, que mostra por membro quanto já foi pago e quanto falta.',
  },
  {
    question: 'O Futeba dos Parças cobra taxa sobre o dinheiro da pelada?',
    answer:
      'O caixa do Futeba dos Parças é um registro de entradas e saídas mantido pelos administradores do grupo. As cobranças continuam sendo feitas entre os membros; o app não intermedeia o dinheiro.',
  },
  {
    question: 'O que deve entrar no caixa além do aluguel da quadra?',
    answer:
      'Bolas novas a cada 6 meses, lavagem ou compra de coletes novos, fita para caneleira, apito de árbitro e o tradicional churrasco de encerramento da temporada.',
  },
];

const steps = [
  {
    title: 'Definição de Papéis',
    desc: 'Separe quem é mensalista (vaga garantida todo mês) de quem é diarista/convidado (vaga sob demanda).',
  },
  {
    title: 'Previsão Orçamentária',
    desc: 'Custo da quadra por mês + fundo de reserva para material esportivo e confraternizações.',
  },
  {
    title: 'Transparência de Caixa',
    desc: 'Saldo, entradas e saídas ficam registrados no caixa, e membros confirmados do grupo podem consultá-lo (somente leitura).',
  },
  {
    title: 'Controle de Pagamentos',
    desc: 'Veja por membro quanto já foi pago e quanto falta no mês.',
  },
];

export function PeladaManagementPage() {
  useEffect(() => {
    trackEvent('landing_viewed', { page: 'gestao-de-pelada' });
  }, []);

  const registerUtmUrl = buildUtmUrl('/register', {
    utm_source: 'growth_content',
    utm_medium: 'hero_cta',
    utm_campaign: 'pelada_management_guide',
    utm_content: 'gestao_pelada_hero',
  });

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', color: 'text.primary' }}>
      <GrowthHeader currentPage="/gestao-de-pelada" />
      <GrowthBreadcrumbs items={[{ label: 'Gestão Financeira e Caixa' }]} />

      {/* Hero Section */}
      <Box sx={{ pt: { xs: 4, md: 8 }, pb: { xs: 6, md: 10 }, bgcolor: alpha('#00852A', 0.03) }}>
        <Container maxWidth="lg">
          <Grid container spacing={5} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack spacing={2.5}>
                <Box>
                  <Chip
                    label="FINANÇAS & CAIXA DA PELADA"
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
                    Gestão Financeira da Pelada: Controle de Mensalistas, Diaristas e Caixa
                  </Typography>
                </Box>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ fontSize: { xs: '1.0625rem', md: '1.2rem' }, lineHeight: 1.6 }}
                >
                  Veja como montar um fluxo de caixa para a sua pelada, acompanhar mensalistas e
                  diaristas e manter as contas registradas e consultáveis pelo grupo.
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
                    Controlar Caixa do Meu Racha
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
                    <AccountBalanceWallet sx={{ color: '#00852A' }} /> Pilares do Caixa Saudável
                  </Typography>
                  <Stack spacing={2} sx={{ mt: 2 }}>
                    {steps.map((item, idx) => (
                      <Stack key={idx} direction="row" spacing={2} alignItems="flex-start">
                        <CheckCircle sx={{ color: '#00852A', fontSize: 22, mt: 0.25 }} />
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

      {/* Main Content Articles */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={8}>
          <Box component="section">
            <Typography variant="h4" component="h2" fontWeight={900} gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
              O Dilema do Organizador: Devedores e Pagamentos Adiantados
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph sx={{ fontSize: '1.0625rem', lineHeight: 1.7 }}>
              Quem assume a responsabilidade de alugar a quadra normalmente assina o contrato e compromete seu próprio CPF.
              Quando jogadores atrasam a mensalidade ou faltam sem avisar, o organizador acaba cobrindo a diferença do próprio bolso.
              Com um processo claro de caixa e registro no Futeba dos Parças, os membros acompanham o saldo e os pagamentos do mês.
            </Typography>
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <ReceiptLong sx={{ color: '#00852A', fontSize: 36, mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Extrato Aberto
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      As entradas e saídas do caixa ficam registradas no extrato do grupo, com possibilidade de estorno registrado.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <CreditCard sx={{ color: '#00852A', fontSize: 36, mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Status de Pagamento
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Acompanhe quem já pagou a mensalidade ou a diária e quanto ainda falta.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%', borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <TrendingUp sx={{ color: '#00852A', fontSize: 36, mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Fundo para Eventos
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sobrou saldo no mês? Acumule no caixa para o uniforme novo do time ou o churrasco dos parças.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          {/* Links to Other Guides */}
          <Box component="section">
            <Typography variant="h4" component="h2" fontWeight={900} gutterBottom sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
              Descubra Mais Conteúdos
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Card sx={{ borderRadius: 3, border: 1, borderColor: 'divider', p: 1 }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={800} gutterBottom>
                      Como Organizar uma Pelada Sem Confusão
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Checklist completo de horários, confirmações e sorteio equilibrado de times.
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
                      Parcerias para Arenas e Quadras
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Administra uma arena de futebol society? Conecte seu espaço esportivo com organizadores da região.
                    </Typography>
                    <Button
                      component={RouterLink}
                      to="/parcerias"
                      variant="text"
                      endIcon={<ArrowForward />}
                      sx={{ fontWeight: 700, color: '#00852A', minHeight: 44 }}
                    >
                      Página de Parcerias
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          <GrowthFaq items={faqs} title="Perguntas Frequentes sobre Finanças da Pelada" />
        </Stack>
      </Container>

      <GrowthCtaSection
        pageIdentifier="pelada_management_bottom"
        title="Profissionalize a gestão financeira do seu racha"
        subtitle="Crie seu grupo no Futeba dos Parças e mantenha o caixa do racha registrado em um só lugar."
        buttonText="Começar a Controlar o Caixa"
      />

      <GrowthFooter />
    </Box>
  );
}
