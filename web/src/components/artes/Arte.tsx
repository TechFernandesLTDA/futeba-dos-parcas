import React from 'react';
import { Box, SvgIcon, SvgIconProps, SxProps, Theme, useTheme } from '@mui/material';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  ANIMACOES_ARTE,
  ARTES,
  PALETA_CLARO,
  PALETA_ESCURO,
  PICTOGRAMAS,
  type AnimacaoArte,
  type ArteId,
  type NoArte,
  type PapelCor,
  type PictogramaId,
} from './artes.generated';

/**
 * Artes da pelada (spec FEAT_2026-11-21_ARTES_DA_PELADA).
 * Os dados vêm de shared/artes via scripts/artes/gerar.mjs; as cores são papéis
 * resolvidos pela paleta clara ou escura do tema (shared/design-tokens.json#arte).
 */

const fmt = (n: number) => String(Math.round(n * 1000) / 1000);

/** CSS das animações, gerado da mesma especificação que o Android e o iOS usam. */
export const CSS_ANIMACOES_ARTE = (Object.keys(ANIMACOES_ARTE) as AnimacaoArte[])
  .map((nome) => {
    const e = ANIMACOES_ARTE[nome];
    const curva = `cubic-bezier(${e.curva.join(',')})`;
    const quadros = e.quadros
      .map(([p, q]) => {
        const t = `translate(${fmt(q.dx ?? 0)}px, ${fmt(q.dy ?? 0)}px) rotate(${fmt(q.graus ?? 0)}deg) scale(${fmt(q.escala ?? 1)})`;
        return `${fmt(p * 100)}% { transform: ${t}; opacity: ${fmt(q.alfa ?? 1)}; animation-timing-function: ${curva}; }`;
      })
      .join(' ');
    return `@keyframes fdp-arte-${nome} { ${quadros} } `
      + `.fdp-arte-${nome} { animation: fdp-arte-${nome} ${e.duracaoMs}ms infinite ${e.alternar ? 'alternate' : 'normal'} both; transform-box: view-box; transform-origin: 0 0; }`;
  })
  .join('\n');

function desenhar(nos: NoArte[], paleta: Record<PapelCor, string>, animar: boolean, chave: string): React.ReactNode[] {
  return nos.map((no, i) => {
    const k = `${chave}.${i}`;
    if ('g' in no) {
      const filhos = desenhar(no.g, paleta, animar, k);
      const conteudo = no.a && animar ? <g className={`fdp-arte-${no.a}`}>{filhos}</g> : filhos;
      return (
        <g key={k} transform={no.m ? `matrix(${no.m.join(' ')})` : undefined} opacity={no.o}>
          {conteudo}
        </g>
      );
    }
    return (
      <path
        key={k}
        d={no.d}
        fill={no.f ? paleta[no.f] : 'none'}
        stroke={no.s ? paleta[no.s] : undefined}
        strokeWidth={no.s ? (no.w ?? 1) : undefined}
        strokeLinecap={no.s ? no.lc : undefined}
        strokeLinejoin={no.s ? no.lj : undefined}
        strokeDasharray={no.s && no.da ? no.da.join(' ') : undefined}
        opacity={no.o}
      />
    );
  });
}

function temAnimacao(nos: NoArte[]): boolean {
  return nos.some((no) => 'g' in no && (!!no.a || temAnimacao(no.g)));
}

export interface ArteProps {
  id: ArteId;
  /** Texto para leitor de tela. Sem ele, a arte é decorativa e fica oculta. */
  titulo?: string;
  /** Largura máxima em px (a altura segue a proporção). */
  larguraMaxima?: number | string;
  /** Liga as animações curtas; elas nunca rodam com "reduzir movimento". */
  animar?: boolean;
  /** Força a paleta quando o fundo é fixo da marca (ex.: tela verde de boas-vindas). */
  tema?: 'claro' | 'escuro';
  sx?: SxProps<Theme>;
}

export const Arte = React.memo(function Arte({ id, titulo, larguraMaxima = '100%', animar = true, tema, sx }: ArteProps) {
  const theme = useTheme();
  const reduzir = useReducedMotion();
  const arte = ARTES[id];
  const escuro = tema ? tema === 'escuro' : theme.palette.mode === 'dark';
  const paleta = escuro ? PALETA_ESCURO : PALETA_CLARO;
  const comMovimento = animar && !reduzir && temAnimacao(arte.nos);
  const conteudo = React.useMemo(() => desenhar(arte.nos, paleta, comMovimento, id), [arte, paleta, comMovimento, id]);

  return (
    <Box
      component="svg"
      viewBox={`0 0 ${arte.largura} ${arte.altura}`}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      focusable="false"
      data-arte={id}
      sx={[{ display: 'block', width: '100%', maxWidth: larguraMaxima, height: 'auto', mx: 'auto', overflow: 'visible' },
        ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {comMovimento && <style>{CSS_ANIMACOES_ARTE}</style>}
      {conteudo}
    </Box>
  );
});

export interface PictogramaProps extends Omit<SvgIconProps, 'children'> {
  id: PictogramaId;
}

/** Pictograma da pelada na grade 24 (traço 1,8), colorido por `color`/`sx` como qualquer ícone MUI. */
export const Pictograma = React.memo(function Pictograma({ id, ...resto }: PictogramaProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...resto}>
      {PICTOGRAMAS[id].map((t, i) => (
        <path
          key={i}
          d={t.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={t.o}
        />
      ))}
    </SvgIcon>
  );
});

export type { ArteId, PictogramaId };
export default Arte;
