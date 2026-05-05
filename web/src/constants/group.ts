/**
 * Constants compartilhadas para grupos.
 * Fix #414: ROLE_CONFIG estava duplicado em GroupDetailScreen + GroupSettingsScreen.
 * Manter como single source of truth.
 */
import { GroupRole } from '../types/group';

export const ROLE_CONFIG: Record<GroupRole, { label: string; color: string }> = {
  OWNER: { label: 'Dono', color: '#F59E0B' },
  ADMIN: { label: 'Admin', color: '#2979FF' },
  MEMBER: { label: 'Membro', color: '#78716C' },
};
