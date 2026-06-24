export interface GroupLogoPreset {
  id: string;
  emoji: string;
  color: string;
  labelKey: string;
}

export const GROUP_LOGO_PRESETS = [
  { id: 'football', emoji: '\u26BD', color: 'success.main', labelKey: 'groups.logoPresets.football' },
  { id: 'trophy', emoji: '\u{1F3C6}', color: 'warning.main', labelKey: 'groups.logoPresets.trophy' },
  { id: 'goal', emoji: '\u{1F945}', color: 'primary.main', labelKey: 'groups.logoPresets.goal' },
  { id: 'shield', emoji: '\u{1F6E1}\uFE0F', color: 'info.main', labelKey: 'groups.logoPresets.shield' },
  { id: 'fire', emoji: '\u{1F525}', color: 'error.main', labelKey: 'groups.logoPresets.fire' },
  { id: 'bolt', emoji: '\u26A1', color: 'warning.dark', labelKey: 'groups.logoPresets.bolt' },
  { id: 'star', emoji: '\u2B50', color: 'secondary.main', labelKey: 'groups.logoPresets.star' },
  { id: 'crown', emoji: '\u{1F451}', color: 'warning.main', labelKey: 'groups.logoPresets.crown' },
  { id: 'glove', emoji: '\u{1F9E4}', color: 'info.dark', labelKey: 'groups.logoPresets.glove' },
  { id: 'target', emoji: '\u{1F3AF}', color: 'success.dark', labelKey: 'groups.logoPresets.target' },
  { id: 'rocket', emoji: '\u{1F680}', color: 'secondary.dark', labelKey: 'groups.logoPresets.rocket' },
  { id: 'heart', emoji: '\u{1F49A}', color: 'success.light', labelKey: 'groups.logoPresets.heart' },
] as const satisfies readonly GroupLogoPreset[];

export const DEFAULT_GROUP_LOGO_PRESET_ID = 'football';

const presetById = new Map<string, GroupLogoPreset>(
  GROUP_LOGO_PRESETS.map((preset) => [preset.id, preset]),
);

const validLogoColors = new Set<string>(GROUP_LOGO_PRESETS.map((preset) => preset.color));

export function getGroupLogoPreset(id?: string | null): GroupLogoPreset {
  return presetById.get(id || '') || presetById.get(DEFAULT_GROUP_LOGO_PRESET_ID)!;
}

export function isGroupLogoColor(color?: string | null): color is string {
  return !!color && validLogoColors.has(color);
}
