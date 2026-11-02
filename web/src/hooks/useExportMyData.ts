import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportMyData, type ExportMyDataPayload } from '../services/cloudFunctions';
import { useToast } from '../contexts/ToastContext';
import { createLogger } from '../utils/logger';
import { getFunctionErrorMessage } from '../utils/firebaseErrors';

const logger = createLogger('useExportMyData');

export type ExportMyDataStatus = 'idle' | 'exporting' | 'error' | 'success';

export type ExportMyDataFailure = 'rate-limited' | 'too-large' | 'other';

export interface UseExportMyDataResult {
  status: ExportMyDataStatus;
  /** Mensagem exibível quando status é 'error'. */
  errorMessage: string | null;
  start: () => Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Classifica o erro da callable `exportMyData` (#4482).
 * O backend usa resource-exhausted tanto para o limite diário quanto para o
 * arquivo acima de 8 MiB; o segundo vem com details.reason 'export-too-large'.
 */
export function classifyExportMyDataError(error: unknown): ExportMyDataFailure {
  const rawCode = isRecord(error) && typeof error.code === 'string' ? error.code : '';
  const code = rawCode.replace(/^functions\//, '');
  const details = isRecord(error) && isRecord(error.details) ? error.details : undefined;
  if (code === 'resource-exhausted') {
    return details?.reason === 'export-too-large' ? 'too-large' : 'rate-limited';
  }
  return 'other';
}

/** Nome do arquivo baixado: futeba-dos-parcas-meus-dados-AAAA-MM-DD.json (data local). */
export function exportFileName(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `futeba-dos-parcas-meus-dados-${yyyy}-${mm}-${dd}.json`;
}

/**
 * Espera antes de revogar a URL do Blob: Firefox e Safari podem cancelar o
 * download se a URL for revogada no mesmo tick do clique.
 */
export const REVOKE_OBJECT_URL_DELAY_MS = 1000;

/** Entrega o JSON ao navegador como download, sem passar por Storage. */
function downloadJson(payload: ExportMyDataPayload, fileName: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_OBJECT_URL_DELAY_MS);
}

/**
 * Exportação dos dados do titular (#4482, LGPD art. 18, V).
 *
 * A callable devolve o JSON direto (sem URL de Storage) e o arquivo é montado
 * no navegador. Exportação parcial (`complete === false`) baixa o arquivo e
 * avisa que faltaram partes. Nenhum dado do arquivo é logado.
 */
export function useExportMyData(): UseExportMyDataResult {
  const { t } = useTranslation();
  const { showSuccess, showWarning, showError } = useToast();
  const [status, setStatus] = useState<ExportMyDataStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const start = useCallback(async () => {
    setStatus('exporting');
    setErrorMessage(null);
    let payload: ExportMyDataPayload;
    try {
      const result = await exportMyData();
      payload = result.data;
    } catch (err) {
      logger.error('Erro ao exportar dados:', err);
      const failure = classifyExportMyDataError(err);
      const message =
        failure === 'rate-limited'
          ? t('settings.exportMyDataRateLimited')
          : failure === 'too-large'
            ? t('settings.exportMyDataTooLarge')
            : getFunctionErrorMessage(err, 'exportMyData', t('settings.exportMyDataError'));
      setErrorMessage(message);
      setStatus('error');
      showError(message);
      return;
    }

    try {
      downloadJson(payload, exportFileName());
    } catch (err) {
      logger.error('Erro ao montar o arquivo de exportação:', err);
      const message = t('settings.exportMyDataError');
      setErrorMessage(message);
      setStatus('error');
      showError(message);
      return;
    }

    setStatus('success');
    if (payload.complete === false) {
      showWarning(t('settings.exportMyDataPartial'));
    } else {
      showSuccess(t('settings.exportMyDataSuccess'));
    }
  }, [showError, showSuccess, showWarning, t]);

  return { status, errorMessage, start };
}
