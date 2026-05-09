/**
 * Constants compartilhadas para grupos.
 * Fix #414: ROLE_CONFIG estava duplicado em GroupDetailScreen + GroupSettingsScreen.
 * Manter como single source of truth.
 *
 * Colors are theme-palette-based to avoid hardcoded hex in sx=.
 * Components should resolve colors via `getRoleColor(theme, role)`.
 */
import { type Theme } from '@mui/material/styles';
import { GroupRole } from '../types/group';

export const ROLE_CONFIG: Record<GroupRole, { label: string; paletteKey: string }> = {
  OWNER: { label: 'Dono', paletteKey: 'warning.main' },
  ADMIN: { label: 'Admin', paletteKey: 'info.main' },
  MEMBER: { label: 'Membro', paletteKey: 'text.secondary' },
};

export function getRoleColor(theme: Theme, role: GroupRole): string {
  const [category, variant] = ROLE_CONFIG[role].paletteKey.split('.');
  return (theme.palette as any)[category]?.[variant] || theme.palette.text.secondary;
}
