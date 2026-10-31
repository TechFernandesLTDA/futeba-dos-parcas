import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { deleteAccount } from '../services/cloudFunctions';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { queryClient } from '../services/queryClient';
import { createLogger } from '../utils/logger';
import { getAuthErrorMessage, getFunctionErrorMessage } from '../utils/firebaseErrors';
import { classifyDeleteAccountError, type OwnedGroupRef } from '../utils/deleteAccountErrors';

const logger = createLogger('useDeleteAccount');

const PASSWORD_PROVIDER_ID = 'password';
const GOOGLE_PROVIDER_ID = 'google.com';

export type DeleteAccountStatus =
  | 'idle'
  | 'deleting'
  | 'needs-reauth'
  | 'reauthenticating'
  | 'blocked-groups'
  | 'error'
  | 'success';

export interface UseDeleteAccountResult {
  status: DeleteAccountStatus;
  /** Grupos que bloqueiam a exclusão (status 'blocked-groups'). */
  blockingGroups: OwnedGroupRef[];
  /** Mensagem de erro exibível (status 'error' ou falha de reautenticação). */
  errorMessage: string | null;
  /** Provedores com os quais o usuário pode reautenticar. */
  reauthMethods: { password: boolean; google: boolean };
  start: () => Promise<void>;
  reauthenticateWithPassword: (password: string) => Promise<void>;
  reauthenticateWithGoogle: () => Promise<void>;
  /** Fecha os diálogos e volta para 'idle' (nunca desloga). */
  reset: () => void;
}

/**
 * Fluxo de exclusão de conta (#4391, LGPD art. 18).
 *
 * Só desloga quando a callable confirma o sucesso: qualquer erro mantém a sessão.
 * `requires-recent-login` pede reautenticação e repete a chamada UMA vez.
 */
export function useDeleteAccount(): UseDeleteAccountResult {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState<DeleteAccountStatus>('idle');
  const [blockingGroups, setBlockingGroups] = useState<OwnedGroupRef[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const providerIds = (auth.currentUser?.providerData ?? []).map((p) => p.providerId);
  const hasPasswordProvider = providerIds.includes(PASSWORD_PROVIDER_ID);
  const hasGoogleProvider = providerIds.includes(GOOGLE_PROVIDER_ID);
  const reauthMethods = useMemo(
    () => ({ password: hasPasswordProvider, google: hasGoogleProvider }),
    [hasPasswordProvider, hasGoogleProvider],
  );

  const finishSuccess = useCallback(async () => {
    try {
      await logout();
    } catch (logoutErr) {
      // A conta já foi apagada no Auth; falha de logout local não mascara o sucesso.
      logger.warn('Conta excluída, mas o logout local falhou:', logoutErr);
      queryClient.clear();
    }
    setStatus('success');
    showSuccess(t('settings.deleteAccountSuccess'));
    navigate('/login', { replace: true });
  }, [logout, navigate, showSuccess, t]);

  /** Chama a callable. `afterReauth` impede laço de reautenticação. */
  const attempt = useCallback(
    async (afterReauth: boolean) => {
      setStatus('deleting');
      setErrorMessage(null);
      try {
        await deleteAccount();
      } catch (err) {
        logger.error('Erro ao excluir conta:', err);
        const failure = classifyDeleteAccountError(err);
        if (failure.kind === 'requires-recent-login' && !afterReauth) {
          setStatus('needs-reauth');
          return;
        }
        if (failure.kind === 'sole-owner-groups') {
          setBlockingGroups(failure.groups);
          setStatus('blocked-groups');
          return;
        }
        const message =
          failure.kind === 'requires-recent-login'
            ? t('settings.deleteRecentLoginStillRequired')
            : failure.kind === 'rate-limited'
              ? t('settings.deleteRateLimited')
              : getFunctionErrorMessage(err, 'deleteAccount', t('settings.deleteAccountError'));
        setErrorMessage(message);
        setStatus('error');
        showError(message);
        return;
      }
      await finishSuccess();
    },
    [finishSuccess, showError, t],
  );

  const start = useCallback(() => attempt(false), [attempt]);

  const failReauth = useCallback((err: unknown) => {
    logger.error('Falha na reautenticação:', err);
    setErrorMessage(getAuthErrorMessage(err));
    setStatus('needs-reauth');
  }, []);

  const reauthenticateWithPassword = useCallback(
    async (password: string) => {
      const current = auth.currentUser;
      if (!current || !current.email) {
        setErrorMessage(t('settings.deleteReauthUnavailable'));
        return;
      }
      setStatus('reauthenticating');
      setErrorMessage(null);
      try {
        await reauthenticateWithCredential(
          current,
          EmailAuthProvider.credential(current.email, password),
        );
        // Renova o ID token: o `auth_time` do token só muda assim
        await current.getIdToken(true);
      } catch (err) {
        failReauth(err);
        return;
      }
      await attempt(true);
    },
    [attempt, failReauth, t],
  );

  const reauthenticateWithGoogle = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setErrorMessage(t('settings.deleteReauthUnavailable'));
      return;
    }
    setStatus('reauthenticating');
    setErrorMessage(null);
    try {
      await reauthenticateWithPopup(current, googleProvider);
      await current.getIdToken(true);
    } catch (err) {
      failReauth(err);
      return;
    }
    await attempt(true);
  }, [attempt, failReauth, t]);

  const reset = useCallback(() => {
    setStatus('idle');
    setBlockingGroups([]);
    setErrorMessage(null);
  }, []);

  return {
    status,
    blockingGroups,
    errorMessage,
    reauthMethods,
    start,
    reauthenticateWithPassword,
    reauthenticateWithGoogle,
    reset,
  };
}
