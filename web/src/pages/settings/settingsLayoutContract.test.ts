import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/settings/SettingsScreen.tsx'),
  'utf8',
);

describe('SettingsScreen layout contract', () => {
  it('oferece edição do perfil no cartão do usuário', () => {
    expect(source).toContain("navigate('/profile/edit')");
    expect(source).toContain("{t('profile.editProfile')}");
  });

  it('mantém salvar configurações antes da lista longa de opções', () => {
    const saveAction = source.indexOf('onClick={handleSaveSettings}');
    const settingsList = source.indexOf("aria-label={t('settings.configOptionsAria')}");

    expect(saveAction).toBeGreaterThan(-1);
    expect(settingsList).toBeGreaterThan(-1);
    expect(saveAction).toBeLessThan(settingsList);
  });
});
