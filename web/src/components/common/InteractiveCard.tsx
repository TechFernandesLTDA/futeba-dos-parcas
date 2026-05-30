import React, { useCallback } from 'react';
import { Card, CardActionArea, CardProps, SxProps, Theme } from '@mui/material';
import { useHapticFeedback } from '../../hooks/useHapticFeedback';

// Hover apenas para dispositivos com ponteiro real (mouse), nao touch
const HOVER_SX: SxProps<Theme> = {
  '@media (hover: hover) and (pointer: fine)': {
    '&:hover': {
      boxShadow: (theme: Theme) => theme.shadows[8],
      transform: 'translateY(-2px)',
    },
  },
};

const BASE_TRANSITION_SX: SxProps<Theme> = {
  transition: (theme: Theme) => theme.transitions.create(['box-shadow', 'transform'], { duration: theme.transitions.duration.shortest }),
};

export interface InteractiveCardProps extends Omit<CardProps, 'onClick'> {
  onClick?: () => void;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  actionAreaSx?: SxProps<Theme>;
  actionAreaLabel?: string;
  children: React.ReactNode;
}

/**
 * Wrapper padronizado para cards clicaveis.
 * Usa CardActionArea para acessibilidade e hover apenas em mouse via media query.
 * Aceita ref para posicionar menu de contexto no Shift+F10.
 */
export const InteractiveCard = React.memo(
  React.forwardRef<HTMLDivElement, InteractiveCardProps>(function InteractiveCard(
    { onClick, onContextMenu, onKeyDown, actionAreaSx, actionAreaLabel, children, sx, ...cardProps },
    ref,
  ) {
    // #2218: hook declarado antes de qualquer early return (regra dos Hooks).
    const { trigger } = useHapticFeedback();
    // #2218: feedback tátil leve no toque, com fallback silencioso (sem suporte
    // ou prefers-reduced-motion). Espelha o ripple/micro-interação do Android.
    const handleClick = useCallback(() => {
      if (!onClick) return;
      trigger('light');
      onClick();
    }, [onClick, trigger]);

    if (process.env.NODE_ENV === 'development' && onClick && !actionAreaLabel) {
      console.warn('InteractiveCard: onClick provided without actionAreaLabel for accessibility');
    }

    if (!onClick) {
      return (
        <Card ref={ref} sx={sx} onContextMenu={onContextMenu} onKeyDown={onKeyDown} {...cardProps}>
          {children}
        </Card>
      );
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(e);
      if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <Card
        ref={ref}
        sx={[
          BASE_TRANSITION_SX,
          HOVER_SX,
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
        onContextMenu={onContextMenu}
        onKeyDown={handleKeyDown}
        {...cardProps}
      >
        <CardActionArea
          onClick={handleClick}
          aria-label={actionAreaLabel}
          sx={[
            { borderRadius: 'inherit', height: '100%' },
            ...(Array.isArray(actionAreaSx) ? actionAreaSx : actionAreaSx ? [actionAreaSx] : []),
          ]}
        >
          {children}
        </CardActionArea>
      </Card>
    );
  }),
);
