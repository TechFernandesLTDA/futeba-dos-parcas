import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/game/PendingPlayersSection.tsx'),
  'utf8',
);

describe('PendingPlayersSection responsive contract', () => {
  it('empilha a ação no mobile e mantém o botão compacto no desktop', () => {
    expect(source).not.toContain('secondaryAction=');
    expect(source).toContain("flexDirection: { xs: 'column', sm: 'row' }");
    expect(source).toContain("width: { xs: '100%', sm: 'auto' }");
    expect(source).toContain("overflowWrap: 'anywhere'");
  });
});
