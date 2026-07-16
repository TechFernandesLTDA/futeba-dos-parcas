import { describe, expect, it } from 'vitest';
import en from '../../i18n/locales/en.json';
import es from '../../i18n/locales/es.json';
import ptBR from '../../i18n/locales/pt-BR.json';
import { formatQuickCommandShortcut, getQuickCommand, QUICK_COMMANDS } from './quickCommands';

function readKey(source: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[segment];
  }, source);
}

describe('quickCommands', () => {
  it('usa IDs estáveis e destinos independentes do idioma', () => {
    expect(QUICK_COMMANDS.map((command) => command.id)).toEqual([
      'create-game',
      'create-group',
      'settings',
      'profile',
      'notifications',
    ]);
    expect(getQuickCommand('create-game')?.route).toBe('/game/create');
    expect(getQuickCommand('Configurações')).toBeUndefined();
  });

  it.each([
    ['pt-BR', ptBR],
    ['en', en],
    ['es', es],
  ] as const)('possui rótulo e subtítulo em %s para todos os comandos', (_locale, messages) => {
    for (const command of QUICK_COMMANDS) {
      expect(readKey(messages, command.labelKey)).toEqual(expect.any(String));
      expect(readKey(messages, command.subtitleKey)).toEqual(expect.any(String));
    }
  });

  it('formata atalhos conforme macOS, Windows e Linux', () => {
    const createGame = getQuickCommand('create-game')!;
    const createGroup = getQuickCommand('create-group')!;
    const settings = getQuickCommand('settings')!;
    const profile = getQuickCommand('profile')!;

    expect(formatQuickCommandShortcut(createGame, 'MacIntel')).toBe('⌘N');
    expect(formatQuickCommandShortcut(createGame, 'Win32')).toBe('Ctrl+N');
    expect(formatQuickCommandShortcut(createGroup, 'iPhone')).toBe('⌘⇧N');
    expect(formatQuickCommandShortcut(createGroup, 'Linux x86_64')).toBe('Ctrl+Shift+N');
    expect(formatQuickCommandShortcut(settings, 'Win32')).toBe('Ctrl+,');
    expect(formatQuickCommandShortcut(profile, 'MacIntel')).toBeUndefined();
  });
});
