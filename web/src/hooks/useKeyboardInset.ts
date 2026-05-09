import { useEffect, useState } from 'react';

/**
 * Retorna a altura do teclado virtual em pixels (0 quando fechado).
 *
 * Usa a API visualViewport (suportada no iOS Safari 13+ e Chrome Android),
 * que reflete o viewport visível após o teclado aparecer — diferente de
 * window.innerHeight que não atualiza dinamicamente no iOS.
 *
 * Uso:
 *   const kbdInset = useKeyboardInset();
 *   <Box sx={{ pb: `calc(env(safe-area-inset-bottom, 0px) + ${kbdInset}px + 16px)` }} />
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const vv = window.visualViewport;

    const handler = () => {
      // Diferença entre altura total da janela e altura do viewport visível
      // corresponde à altura ocupada pelo teclado virtual
      const offset = window.innerHeight - vv.height;
      setInset(Math.max(0, offset));
    };

    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    // Leitura inicial (teclado já pode estar aberto ao montar)
    handler();

    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, []);

  return inset;
}
