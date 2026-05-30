import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Slide } from '@mui/material';
import { WifiOff as OfflineIcon, Wifi as OnlineIcon } from '@mui/icons-material';

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
  const [showBackOnline, setShowBackOnline] = useState(false);
  const prevOnlineRef = useRef(isOnline);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wasOffline = !prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (wasOffline && isOnline) {
      setShowBackOnline(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowBackOnline(false), 3000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isOnline]);

  if (isOnline && !showBackOnline) return null;

  return (
    <Slide direction="down" in={!isOnline || showBackOnline} mountOnEnter unmountOnExit>
      <Box
        role="alert"
        aria-live="assertive"
        sx={{
          // #2175 (bug 3): `fixed` (não `sticky`) — o banner é renderizado como
          // último filho do MobileBottomNav; sticky no fim do DOM nunca fixa no
          // topo do viewport. fixed + top:0 centralizado garante visibilidade
          // tanto no mobile quanto no desktop (AppLayout).
          position: 'fixed',
          top: 'env(safe-area-inset-top, 0px)',
          left: '50%',
          transform: 'translateX(-50%)',
          maxWidth: 'fit-content',
          mx: 'auto',
          zIndex: 9999,
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: isOnline ? 'success.main' : 'error.main',
          color: isOnline ? 'success.contrastText' : 'error.contrastText',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          boxShadow: 3,
        }}
      >
        {isOnline ? <OnlineIcon fontSize="small" /> : <OfflineIcon fontSize="small" />}
        <Typography variant="body2">
          {isOnline ? 'Conexão restaurada' : 'Você está offline'}
        </Typography>
      </Box>
    </Slide>
  );
};
