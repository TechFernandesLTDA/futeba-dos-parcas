import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { WifiOff as OfflineIcon } from '@mui/icons-material';

// eslint-disable-next-line react-refresh/only-export-components
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const checkOnline = async () => {
      try {
        await fetch('/favicon.svg', { method: 'HEAD', cache: 'no-store' });
        setIsOnline(true);
      } catch {
        setIsOnline(navigator.onLine);
      }
    };
    const interval = setInterval(checkOnline, 30000);
    checkOnline();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
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
        position: 'sticky',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 'fit-content',
        mx: 'auto',
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
