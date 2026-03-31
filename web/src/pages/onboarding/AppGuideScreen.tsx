import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  MobileStepper,
  useTheme,
  alpha,
} from '@mui/material';
import {
  KeyboardArrowLeft as LeftIcon,
  KeyboardArrowRight as RightIcon,
  SportsSoccer as SoccerIcon,
  EmojiEvents as TrophyIcon,
  Groups as GroupsIcon,
  MilitaryTech as BadgeIcon,
} from '@mui/icons-material';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

const steps = [
  {
    icon: <SoccerIcon sx={{ fontSize: 80 }} />,
    title: 'Organize Jogos',
    description: 'Crie peladas, convide amigos e gerencie confirmações de forma simples.',
  },
  {
    icon: <GroupsIcon sx={{ fontSize: 80 }} />,
    title: 'Grupos de Amigos',
    description: 'Monte grupos com seus amigos e joguem juntos regularmente.',
  },
  {
    icon: <TrophyIcon sx={{ fontSize: 80 }} />,
    title: 'Ranking e Liga',
    description: 'Compita com outros jogadores e suba de divisão na liga mensal.',
  },
  {
    icon: <BadgeIcon sx={{ fontSize: 80 }} />,
    title: 'Conquistas',
    description: 'Desbloqueie badges e mostre suas habilidades no campo.',
  },
];

export const AppGuideScreen: React.FC = () => {
  useDocumentTitle('Guia do App');
  const navigate = useNavigate();
  const theme = useTheme();
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      localStorage.setItem('appGuideShown', 'true');
      navigate('/');
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    localStorage.setItem('appGuideShown', 'true');
    navigate('/');
  };

  const step = steps[activeStep];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ p: 1, textAlign: 'right' }}>
        <Button onClick={handleSkip} color="inherit">
          Pular
        </Button>
      </Box>

      <Container maxWidth="sm" sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 140,
              height: 140,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3,
              color: 'primary.main',
            }}
          >
            {step.icon}
          </Box>

          <Typography variant="h4" fontWeight={700} gutterBottom>
            {step.title}
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 300, mx: 'auto' }}>
            {step.description}
          </Typography>
        </Box>
      </Container>

      <Box sx={{ p: 2 }}>
        <MobileStepper
          variant="dots"
          steps={steps.length}
          position="static"
          activeStep={activeStep}
          sx={{ bgcolor: 'transparent', justifyContent: 'center', mb: 2 }}
          backButton={
            <Button
              size="small"
              onClick={handleBack}
              disabled={activeStep === 0}
              startIcon={<LeftIcon />}
            >
              Voltar
            </Button>
          }
          nextButton={
            <Button
              size="small"
              onClick={handleNext}
              endIcon={activeStep === steps.length - 1 ? null : <RightIcon />}
            >
              {activeStep === steps.length - 1 ? 'Começar' : 'Próximo'}
            </Button>
          }
        />
      </Box>
    </Box>
  );
};
