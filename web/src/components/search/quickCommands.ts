export type QuickCommandId =
  | 'create-game'
  | 'create-group'
  | 'settings'
  | 'profile'
  | 'notifications';

export interface QuickCommand {
  id: QuickCommandId;
  labelKey: string;
  subtitleKey: string;
  route: string;
  shortcut?: string;
}

/**
 * Identificadores e destinos são estáveis; somente os textos passam pelo i18n.
 * Isso impede que uma tradução altere silenciosamente o comportamento do item.
 */
export const QUICK_COMMANDS: readonly QuickCommand[] = [
  {
    id: 'create-game',
    labelKey: 'games.createGame',
    subtitleKey: 'commandPalette.quickCommandSubtitles.createGame',
    route: '/game/create',
    shortcut: '⌘N',
  },
  {
    id: 'create-group',
    labelKey: 'groups.createGroup',
    subtitleKey: 'commandPalette.quickCommandSubtitles.createGroup',
    route: '/group/create',
    shortcut: '⌘⇧N',
  },
  {
    id: 'settings',
    labelKey: 'nav.settings',
    subtitleKey: 'commandPalette.quickCommandSubtitles.settings',
    route: '/settings',
    shortcut: '⌘,',
  },
  {
    id: 'profile',
    labelKey: 'nav.profile',
    subtitleKey: 'commandPalette.quickCommandSubtitles.profile',
    route: '/profile',
  },
  {
    id: 'notifications',
    labelKey: 'nav.notifications',
    subtitleKey: 'commandPalette.quickCommandSubtitles.notifications',
    route: '/notifications',
  },
];

export function getQuickCommand(id: string): QuickCommand | undefined {
  return QUICK_COMMANDS.find((command) => command.id === id);
}
