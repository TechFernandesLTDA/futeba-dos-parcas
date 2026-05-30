/**
 * OfflineBadge — envolve uma ação que requer conexão com internet.
 *
 * Quando offline, desabilita visualmente o filho (pointer-events: none + opacidade
 * reduzida) e exibe um Tooltip explicando o motivo. Não remove o elemento do DOM
 * para manter acessibilidade e layout estáveis.
 *
 * Uso:
 *   <OfflineBadge isOnline={isOnline}>
 *     <Button onClick={handleCreate}>Criar Jogo</Button>
 *   </OfflineBadge>
 *
 * Para usar com useOnlineStatus do ConnectionStatus:
 *   const isOnline = useOnlineStatus();
 *   <OfflineBadge isOnline={isOnline}>...</OfflineBadge>
 *
 * TODO (follow-up #2222): adotar em GameCreateButton, ConfirmPresenceButton,
 * VoteButton e outros CTAs que disparam writes no Firestore.
 */
import { Box, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface OfflineBadgeProps {
  /** Indica se o dispositivo está com conexão. Use useOnlineStatus() ou
   *  useNetworkStatus().isOnline para obter o valor. */
  isOnline: boolean;
  /** O elemento filho (botão, ação, etc.) a ser protegido. */
  children: React.ReactNode;
  /** Texto do Tooltip quando offline. Usa chave i18n padrão se omitido. */
  tooltipLabel?: string;
}

export const OfflineBadge: React.FC<OfflineBadgeProps> = ({
  isOnline,
  children,
  tooltipLabel,
}) => {
  // Todos os hooks declarados antes de qualquer ramificação (regra dos Hooks).
  const { t } = useTranslation();

  // Quando online, renderiza o filho diretamente sem nenhum wrapper extra.
  if (isOnline) {
    return <>{children}</>;
  }

  const label = tooltipLabel ?? t('connection.requiresConnection');

  return (
    <Tooltip
      title={label}
      arrow
      // followCursor melhora UX em botões grandes
      followCursor={false}
    >
      {/*
       * O span externo é necessário porque Tooltip exige um filho que aceite
       * ref. Box com `component="span"` garante isso mesmo quando o filho
       * é um botão disabled.
       *
       * aria-disabled + role="group" comunicam o estado para leitores de tela.
       */}
      <Box
        component="span"
        role="group"
        aria-label={label}
        aria-disabled="true"
        sx={{
          display: 'inline-flex',
          // Desabilita visualmente sem remover do DOM.
          opacity: 0.4,
          pointerEvents: 'none',
          cursor: 'not-allowed',
          userSelect: 'none',
        }}
      >
        {children}
      </Box>
    </Tooltip>
  );
};

export default OfflineBadge;
