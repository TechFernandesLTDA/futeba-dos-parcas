import { describe, expect, it } from 'vitest';
import { md3TypeScale } from './index';
import { avatarSizes } from './iconSizes';
import { navigationControlTokens } from './navigationControls';

describe('navigationControlTokens', () => {
  it('mantém captions do rail no menor token legível da escala MD3', () => {
    expect(md3TypeScale.labelSmall.fontSize).toBe('0.6875rem');
  });

  it('mantém chips no labelMedium e dimensões semânticas', () => {
    expect(md3TypeScale.labelMedium.fontSize).toBe('0.75rem');
    expect(navigationControlTokens.shortcutChipHeight).toBe(24);
  });

  it('separa o avatar compacto do tamanho semântico do drawer', () => {
    expect(avatarSizes.sidebarCompact).toBe(28);
    expect(avatarSizes.sidebar).toBe(36);
  });
});
