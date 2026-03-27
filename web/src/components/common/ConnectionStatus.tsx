import { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { WifiOff as OfflineIcon } from '@mui/icons-material';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

export const ConnectionStatus: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  if (isOnline) return null;

  return (
    <Box
      role="alert"
      aria-live="assertive"
      sx={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        px: 2,
        py: 1,
        borderRadius: 2,
        bgcolor: 'error.main',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        boxShadow: 3,
      }}
    >
      <OfflineIcon fontSize="small" />
      <Typography variant="body2">Você está offline</Typography>
    </Box>
  );
};
