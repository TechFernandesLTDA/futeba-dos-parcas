import React, { Suspense } from 'react';
import { usePerformanceMonitoring, PerformanceOverlay } from '../../hooks/usePerformanceMonitoring';
import { LoadingScreen } from './LoadingScreen';

interface PerformanceWrapperProps {
  screenName: string;
  children: React.ReactNode;
  showOverlay?: boolean;
}

/**
 * Wrapper component que adiciona monitoramento de performance automático
 * Usa em todas as telas para coletar métricas consistentemente
 */
export function PerformanceWrapper({ 
  screenName, 
  children, 
  showOverlay = import.meta.env.DEV 
}: PerformanceWrapperProps) {
  const { metrics } = usePerformanceMonitoring({ 
    screenName,
    trackQueries: true,
    sendDataToAnalytics: true,
  });

  return (
    <>
      <Suspense fallback={<LoadingScreen variant="cards" />}>
        {children}
      </Suspense>
      {showOverlay && <PerformanceOverlay metrics={metrics} />}
    </>
  );
}

/**
 * HOC para adicionar monitoramento de performance a componentes existentes
 */
// eslint-disable-next-line react-refresh/only-export-components
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  screenName: string
) {
  return function WrappedComponent(props: P) {
    return (
      <PerformanceWrapper screenName={screenName}>
        <Component {...props} />
      </PerformanceWrapper>
    );
  };
}
