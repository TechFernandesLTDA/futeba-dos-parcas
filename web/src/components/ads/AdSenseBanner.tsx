import { Box } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAdsConfig, hasAdsConsent, isAdsAllowedPath, useAdsFree } from '../../config/ads';
import { loadAdSense } from './adsenseLoader';

/**
 * Banner responsivo do AdSense. Retorna null (e não carrega nada) quando:
 * - não há VITE_ADSENSE_PUBLISHER_ID / VITE_ADSENSE_SLOT_BANNER válidos;
 * - a rota não está na lista de permissão (`isAdsAllowedPath`);
 * - o usuário é "Sem anúncios" (`useAdsFree`) ou não há consentimento;
 * - o script foi bloqueado (nesse caso não reserva espaço vazio).
 * Use só ao final de conteúdo já carregado: o AdSense proíbe anúncio em tela sem conteúdo.
 */
export function AdSenseBanner() {
  const { pathname, search } = useLocation();
  const adsFree = useAdsFree();
  const config = getAdsConfig();
  const allowed = !!config && !adsFree && isAdsAllowedPath(pathname, search) && hasAdsConsent();
  const [ready, setReady] = useState(false);
  const pushed = useRef(false);

  useEffect(() => {
    if (!allowed || !config) return;
    let cancelled = false;
    loadAdSense(config).then((ok) => {
      if (!cancelled) setReady(ok);
    });
    return () => {
      cancelled = true;
    };
    // config deriva só de env estático; `allowed` cobre rota/consentimento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  useEffect(() => {
    if (!allowed) {
      pushed.current = false; // o <ins> sai da tela; o próximo precisa de novo push
      return;
    }
    if (!ready || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense recusou o slot: sem anúncio, sem erro para o usuário.
    }
  }, [ready, allowed]);

  if (!allowed || !config || !ready) return null;

  return (
    <Box
      component="aside"
      aria-label="Publicidade"
      sx={{ width: '100%', maxWidth: 728, mx: 'auto', my: 2, px: 2, overflow: 'hidden', minHeight: 50 }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={config.publisherId}
        data-ad-slot={config.bannerSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </Box>
  );
}
