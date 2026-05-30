/**
 * WelcomeCarousel — Carrossel de boas-vindas do onboarding.
 *
 * Substitui o AppGuideScreen estático com 4 slides animados (spec feat-2026-05-16 §2.2).
 * Mantém o mesmo nome de componente e rota para não quebrar navegação existente.
 *
 * Acessibilidade:
 * - scroll-snap para navegação suave
 * - aria-label nos controles
 * - Indicadores de slide com descrição semântica
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Stack,
  alpha,
  useTheme,
} from '@mui/material';
import {
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  Groups as GroupsIcon,
  RocketLaunch as RocketIcon,
} from '@mui/icons-material';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useOnboarding } from '../../hooks/useOnboarding';
import { iconSizes } from '../../theme/iconSizes';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AppGuideScreen');

const SLIDES = [
  {
    id: 'organized',
    icon: <SoccerIcon sx={{ fontSize: iconSizes.hero }} />,
    title: 'Sua pelada, organizada',
    subtitle: 'Crie jogos, convoque os parças e acompanhe tudo em um só lugar — sem grupo de WhatsApp bagunçado.',
  },
  {
    id: 'xp',
    icon: <TrophyIcon sx={{ fontSize: iconSizes.hero }} />,
    title: 'Jogou, pontuou',
    subtitle: 'Cada jogo te dá XP. Suba de nível, desbloqueie badges e dispute o ranking mensal da liga.',
  },
  {
    id: 'invite',
    icon: <GroupsIcon sx={{ fontSize: iconSizes.hero }} />,
    title: 'Chame os parças',
    subtitle: 'Envie convites, gerencie confirmações e monte os times automaticamente com equilíbrio.',
  },
  {
    id: 'start',
    icon: <RocketIcon sx={{ fontSize: iconSizes.hero }} />,
    title: 'Bora começar!',
    subtitle: 'Tudo pronto para sua primeira pelada. Crie seu grupo, convide a galera e bora jogar!',
  },
];

export const AppGuideScreen: React.FC = () => {
  useDocumentTitle('Bem-vindo ao Futeba');
  const navigate = useNavigate();
  const theme = useTheme();
  const {
    onCarouselStarted,
    onSlideViewed,
    onCarouselSkipped,
    onCarouselCompleted,
  } = useOnboarding();

  const [activeStep, setActiveStep] = useState(0);
  const isLastSlide = activeStep === SLIDES.length - 1;
  const startedRef = useRef(false);

  // Dispara onboarding_started apenas uma vez
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      onCarouselStarted();
    }
  }, [onCarouselStarted]);

  // Notifica analytics quando o slide muda
  useEffect(() => {
    onSlideViewed(activeStep, SLIDES[activeStep].id);
  }, [activeStep, onSlideViewed]);

  const handleComplete = async () => {
    // #2281: persistência do onboarding não deve bloquear a navegação se falhar.
    try {
      await onCarouselCompleted();
    } catch (err) {
      logger.error('Falha ao registrar conclusão do onboarding:', err);
    }
    navigate('/');
  };

  const handleSkip = async () => {
    try {
      await onCarouselSkipped(activeStep);
    } catch (err) {
      logger.error('Falha ao registrar skip do onboarding:', err);
    }
    navigate('/');
  };

  const slide = SLIDES[activeStep];

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      {/* Botão Pular — apenas nos slides intermediários */}
      <Box sx={{ p: 1, textAlign: 'right', minHeight: 48 }}>
        {!isLastSlide && (
          <Button onClick={handleSkip} color="inherit" aria-label="Pular onboarding">
            Pular
          </Button>
        )}
      </Box>

      {/* Conteúdo do slide */}
      <Container
        maxWidth="sm"
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center' }}
      >
        {/* Ícone / ilustração */}
        <Box
          sx={{
            width: 140,
            height: 140,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 4,
            color: 'primary.main',
          }}
        >
          {slide.icon}
        </Box>

        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          {slide.title}
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 320, mx: 'auto' }}>
          {slide.subtitle}
        </Typography>
      </Container>

      {/* Controles */}
      <Box sx={{ p: 2, pb: 4 }}>
        {/* Dots indicadores */}
        <Stack direction="row" justifyContent="center" spacing={1} sx={{ mb: 3 }} role="tablist" aria-label="Navegação de slides">
          {SLIDES.map((_, index) => (
            <Box
              key={SLIDES[index].id}
              component="button"
              role="tab"
              aria-selected={index === activeStep}
              aria-label={`Ir para slide ${index + 1} de ${SLIDES.length}`}
              tabIndex={index === activeStep ? 0 : -1}
              onClick={() => setActiveStep(index)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveStep(index);
                }
              }}
              sx={{
                width: index === activeStep ? 20 : 8,
                height: 8,
                borderRadius: 4,
                border: 'none',
                cursor: 'pointer',
                p: 0,
                bgcolor: index === activeStep ? 'primary.main' : alpha(theme.palette.primary.main, 0.25),
                transition: (t) => t.transitions.create('width', { duration: t.transitions.duration.standard }),
              }}
            />
          ))}
        </Stack>

        {/* Botões de ação */}
        <Stack spacing={1.5}>
          {isLastSlide ? (
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={handleComplete}
              sx={{ py: 1.5, fontWeight: 700 }}
              aria-label="Começar a usar o app"
            >
              Bora jogar!
            </Button>
          ) : (
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="outlined"
                size="large"
                disabled={activeStep === 0}
                onClick={() => setActiveStep(prev => prev - 1)}
                sx={{ flex: 1, py: 1.5 }}
                aria-label="Slide anterior"
              >
                Voltar
              </Button>
              <Button
                variant="contained"
                size="large"
                onClick={() => setActiveStep(prev => prev + 1)}
                sx={{ flex: 2, py: 1.5, fontWeight: 700 }}
                aria-label="Próximo slide"
              >
                Próximo
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>
    </Box>
  );
};
