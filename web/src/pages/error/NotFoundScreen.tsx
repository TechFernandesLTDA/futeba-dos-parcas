import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, useTheme } from '@mui/material';
import { SentimentDissatisfied as NotFoundIcon } from '@mui/icons-material';

export const NotFoundScreen: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
        px: 3,
        bgcolor: theme.palette.background.default,
        textAlign: 'center',
      }}
    >
      <NotFoundIcon sx={{ fontSize: 80, color: theme.palette.text.disabled }} />
      <Typography variant="h4" fontWeight={700} color={theme.palette.text.primary}>
        404 — Página não encontrada
      </Typography>
      <Typography variant="body1" color={theme.palette.text.secondary}>
        O endereço que você tentou acessar não existe.
      </Typography>
      <Button
        variant="contained"
        size="large"
        onClick={() => navigate('/')}
        sx={{ mt: 1 }}
      >
        Voltar pro início
      </Button>
    </Box>
  );
};
