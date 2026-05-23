import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { createLogger } from '../utils/logger';

const logger = createLogger('PerformanceMonitor');

interface PerformanceMetrics {
  screenName: string;
  timestamp: number;
  // Navigation timing
  dnsTime: number;
  tcpTime: number;
  ttfb: number;
  domContentLoaded: number;
  loadComplete: number;
  // Web Vitals
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  fcp?: number; // First Contentful Paint
  // App-specific
  timeToInteractive: number;
  firestoreQueries: number;
  dataDownloaded: number;
  reactRenderTime: number;
}

interface UsePerformanceMonitoringOptions {
  screenName: string;
  trackQueries?: boolean;
  sendDataToAnalytics?: boolean;
}

/**
 * Hook de monitoramento de performance para telas
 * Coleta Web Vitals e métricas customizadas automaticamente
 */
export function usePerformanceMonitoring(options: UsePerformanceMonitoringOptions) {
  const { screenName, trackQueries = true, sendDataToAnalytics = true } = options;
  const location = useLocation();
  const startTimeRef = useRef<number>(performance.now());
  const metricsRef = useRef<Partial<PerformanceMetrics>>({
    screenName,
    timestamp: Date.now(),
    firestoreQueries: 0,
    dataDownloaded: 0,
  });

  // Medir tempo de renderização React
  useEffect(() => {
    const renderTime = performance.now() - startTimeRef.current;
    metricsRef.current.reactRenderTime = renderTime;
    
    if (import.meta.env.DEV) {
      logger.info(`[${screenName}] React render: ${renderTime.toFixed(2)}ms`);
    }
  }, [screenName]);

  // Coletar Web Vitals
  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          metricsRef.current.lcp = entry.startTime;
          if (import.meta.env.DEV) {
            logger.info(`[${screenName}] LCP: ${entry.startTime.toFixed(2)}ms`);
          }
        } else if (entry.entryType === 'first-input') {
          metricsRef.current.fid = (entry as any).processingStart - entry.startTime;
        } else if (entry.entryType === 'layout-shift') {
          if (!(entry as any).hadRecentInput) {
            metricsRef.current.cls = (metricsRef.current.cls || 0) + (entry as any).value;
          }
        } else if (entry.entryType === 'paint' && entry.name === 'first-contentful-paint') {
          metricsRef.current.fcp = entry.startTime;
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift', 'paint'] });
    } catch (e) {
      // Alguns navegadores não suportam todos os tipos
      logger.warn('PerformanceObserver não suporta todos os tipos de métricas');
    }

    return () => observer.disconnect();
  }, [screenName]);

  // Coletar Navigation Timing
  useEffect(() => {
    const collectNavigationTiming = () => {
      const perfEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (perfEntries.length > 0) {
        const nav = perfEntries[0];
        metricsRef.current.dnsTime = nav.domainLookupEnd - nav.domainLookupStart;
        metricsRef.current.tcpTime = nav.connectEnd - nav.connectStart;
        metricsRef.current.ttfb = nav.responseStart - nav.requestStart;
        metricsRef.current.domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime;
        metricsRef.current.loadComplete = nav.loadEventEnd - nav.startTime;
      }
    };

    // Aguardar load event para coletar métricas completas
    if (document.readyState === 'complete') {
      collectNavigationTiming();
    } else {
      window.addEventListener('load', collectNavigationTiming, { once: true });
    }

    return () => window.removeEventListener('load', collectNavigationTiming);
  }, []);

  // Calcular Time to Interactive (TTI)
  useEffect(() => {
    const timer = setTimeout(() => {
      const tti = performance.now() - startTimeRef.current;
      metricsRef.current.timeToInteractive = tti;
      
      if (import.meta.env.DEV) {
        logger.info(`[${screenName}] TTI: ${tti.toFixed(2)}ms`);
      }

      // Enviar métricas completas
      const metrics: PerformanceMetrics = {
        screenName,
        timestamp: Date.now(),
        dnsTime: metricsRef.current.dnsTime || 0,
        tcpTime: metricsRef.current.tcpTime || 0,
        ttfb: metricsRef.current.ttfb || 0,
        domContentLoaded: metricsRef.current.domContentLoaded || 0,
        loadComplete: metricsRef.current.loadComplete || 0,
        lcp: metricsRef.current.lcp,
        fid: metricsRef.current.fid,
        cls: metricsRef.current.cls,
        fcp: metricsRef.current.fcp,
        timeToInteractive: tti,
        firestoreQueries: metricsRef.current.firestoreQueries || 0,
        dataDownloaded: metricsRef.current.dataDownloaded || 0,
        reactRenderTime: metricsRef.current.reactRenderTime || 0,
      };

      // Enviar para Analytics
      if (sendDataToAnalytics) {
        sendToAnalytics(metrics);
      }

      // Log em dev mode
      if (import.meta.env.DEV) {
        logger.info(`[${screenName}] Performance metrics:`, metrics);
      }
    }, 3000); // Aguardar 3s para coletar todas as métricas

    return () => clearTimeout(timer);
  }, [screenName, sendDataToAnalytics]);

  // Função para incrementar contador de queries
  const incrementQueryCount = useCallback((bytes = 0) => {
    metricsRef.current.firestoreQueries = (metricsRef.current.firestoreQueries || 0) + 1;
    metricsRef.current.dataDownloaded = (metricsRef.current.dataDownloaded || 0) + bytes;
  }, []);

  // Retornar métricas atuais
  return {
    metrics: metricsRef.current,
    incrementQueryCount,
  };
}

/**
 * Envia métricas para Firebase Analytics
 */
function sendToAnalytics(metrics: PerformanceMetrics) {
  // Performance budgets
  const budgets = {
    tti: 3000, // 3s
    lcp: 2500, // 2.5s
    fid: 100,  // 100ms
    cls: 0.1,  // 0.1
    fcp: 1800, // 1.8s
  };

  // Verificar se excedeu budgets
  const violations: string[] = [];
  if (metrics.timeToInteractive > budgets.tti) violations.push('TTI');
  if (metrics.lcp && metrics.lcp > budgets.lcp) violations.push('LCP');
  if (metrics.fid && metrics.fid > budgets.fid) violations.push('FID');
  if (metrics.cls && metrics.cls > budgets.cls) violations.push('CLS');
  if (metrics.fcp && metrics.fcp > budgets.fcp) violations.push('FCP');

  // Log violations
  if (violations.length > 0 && import.meta.env.DEV) {
    logger.warn(`[${metrics.screenName}] Performance budget violations:`, violations);
  }

  // Enviar evento para Firebase Analytics (se disponível)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'screen_performance', {
      screen_name: metrics.screenName,
      tti: Math.round(metrics.timeToInteractive),
      lcp: metrics.lcp ? Math.round(metrics.lcp) : undefined,
      fid: metrics.fid ? Math.round(metrics.fid) : undefined,
      cls: metrics.cls ? parseFloat(metrics.cls.toFixed(3)) : undefined,
      fcp: metrics.fcp ? Math.round(metrics.fcp) : undefined,
      firestore_queries: metrics.firestoreQueries,
      data_downloaded_kb: Math.round(metrics.dataDownloaded / 1024),
      performance_violations: violations.join(','),
    });
  }
}

/**
 * Hook para monitorar queries Firestore em tempo real
 */
export function useFirestorePerformanceMonitor(screenName: string) {
  const queryCountRef = useRef(0);
  const bytesDownloadedRef = useRef(0);

  const trackQuery = useCallback((bytes = 0) => {
    queryCountRef.current += 1;
    bytesDownloadedRef.current += bytes;
    
    if (import.meta.env.DEV) {
      logger.debug(`[${screenName}] Query #${queryCountRef.current} (${bytes} bytes)`);
    }
  }, [screenName]);

  useEffect(() => {
    // Log resumo ao desmontar
    return () => {
      if (import.meta.env.DEV && queryCountRef.current > 0) {
        logger.info(
          `[${screenName}] Resumo: ${queryCountRef.current} queries, ` +
          `${(bytesDownloadedRef.current / 1024).toFixed(2)}KB baixados`
        );
      }
    };
  }, [screenName]);

  return { trackQuery, queryCount: queryCountRef.current };
}

/**
 * Componente de Performance Overlay (dev mode apenas)
 * Mostra métricas em tempo real na tela
 */
export function PerformanceOverlay({ metrics }: { metrics: Partial<PerformanceMetrics> }) {
  if (!import.meta.env.DEV) return null;

  const getScore = (value: number, good: number, poor: number) => {
    if (value <= good) return { color: '#0cce6b', label: 'Good' };
    if (value <= poor) return { color: '#ffa400', label: 'Needs Improvement' };
    return { color: '#ff4e42', label: 'Poor' };
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 80,
      right: 20,
      background: 'rgba(0, 0, 0, 0.9)',
      color: '#fff',
      padding: '12px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      minWidth: '200px',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#00d9ff' }}>
        📊 Performance Monitor
      </div>
      <div style={{ marginBottom: '4px' }}>
        Screen: <span style={{ color: '#ffeb3b' }}>{metrics.screenName}</span>
      </div>
      {metrics.lcp && (
        <div>
          LCP: <span style={{ color: getScore(metrics.lcp, 2500, 4000).color }}>
            {metrics.lcp.toFixed(0)}ms
          </span>
        </div>
      )}
      {metrics.fcp && (
        <div>
          FCP: <span style={{ color: getScore(metrics.fcp, 1800, 3000).color }}>
            {metrics.fcp.toFixed(0)}ms
          </span>
        </div>
      )}
      {metrics.timeToInteractive && (
        <div>
          TTI: <span style={{ color: getScore(metrics.timeToInteractive, 3800, 7300).color }}>
            {metrics.timeToInteractive.toFixed(0)}ms
          </span>
        </div>
      )}
      {metrics.cls !== undefined && (
        <div>
          CLS: <span style={{ color: getScore(metrics.cls, 0.1, 0.25).color }}>
            {metrics.cls.toFixed(3)}
          </span>
        </div>
      )}
      <div style={{ marginTop: '8px', borderTop: '1px solid #333', paddingTop: '8px' }}>
        Queries: <span style={{ color: '#4caf50' }}>{metrics.firestoreQueries}</span>
      </div>
      <div>
        Data: <span style={{ color: '#4caf50' }}>
          {((metrics.dataDownloaded || 0) / 1024).toFixed(2)}KB
        </span>
      </div>
    </div>
  );
}
