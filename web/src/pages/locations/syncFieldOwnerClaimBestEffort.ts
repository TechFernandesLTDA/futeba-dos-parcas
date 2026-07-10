import { syncFieldOwnerClaim } from '../../services/cloudFunctions';
import { createLogger } from '../../utils/logger';

const logger = createLogger('syncFieldOwnerClaimBestEffort');

export const syncFieldOwnerClaimBestEffort = async (): Promise<void> => {
  try {
    await syncFieldOwnerClaim();
  } catch (error) {
    logger.warn(
      'Não foi possível sincronizar o perfil de proprietário após erro de permissão:',
      error,
    );
  }
};
