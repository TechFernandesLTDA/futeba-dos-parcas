import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/profile/EditProfileScreen.tsx'),
  'utf8',
);

describe('EditProfileScreen save lock', () => {
  it('releases the lock on every early failure after acquisition', () => {
    const handleSave = source.slice(
      source.indexOf('const handleSave = async () => {'),
      source.indexOf('  const handleCancel = () => {'),
    );

    expect(handleSave).toContain('const releaseSaveLock = () =>');
    expect(handleSave.match(/releaseSaveLock\(\);/g)).toHaveLength(4);
    expect(handleSave).not.toContain('setSaving(false);\n        return;');
  });
});
