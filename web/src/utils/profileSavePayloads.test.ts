import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(process.cwd(), '..');

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function sliceBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('profile save payloads', () => {
  it('não enviam updated_at protegido em updates client-side de users/{uid}', () => {
    const authContext = readRepoFile('web/src/contexts/AuthContext.tsx');
    const authUpdateProfile = sliceBetween(
      authContext,
      'const updateUserProfile = useCallback',
      '  const value = useMemo'
    );
    expect(authUpdateProfile).not.toContain('updated_at');

    const editProfile = readRepoFile('web/src/pages/profile/EditProfileScreen.tsx');
    const editProfileSave = sliceBetween(editProfile, 'const handleSave = async () => {', '  const handleCancel = () => {');
    expect(editProfileSave).not.toContain('updated_at');

    const phoneVerification = readRepoFile('web/src/pages/onboarding/PhoneVerificationScreen.tsx');
    expect(phoneVerification).not.toContain('updated_at: serverTimestamp()');
  });

  it('não cria users/{uid} com campos gamificados bloqueados pelas rules', () => {
    const authContext = readRepoFile('web/src/contexts/AuthContext.tsx');
    const createUserDocument = sliceBetween(
      authContext,
      'const createUserDocument = async',
      '  const fetchUserDataRef = useRef(fetchUserData);'
    );

    expect(createUserDocument).not.toContain('level: 1');
    expect(createUserDocument).not.toContain('experience_points: 0');
  });

  it('mantém o onboarding por telefone resiliente a refresh de auth no web mobile', () => {
    const phoneVerification = readRepoFile('web/src/pages/onboarding/PhoneVerificationScreen.tsx');
    expect(phoneVerification).toContain('auth.currentUser ?? firebaseUser');
    expect(phoneVerification).toContain('PHONE_VERIFICATION_SESSION_KEY');
    expect(phoneVerification).toContain('PHONE_VERIFICATION_TTL_MS');
    expect(phoneVerification).toContain('linkWithPhoneNumber');
    expect(phoneVerification).toContain('attempt.confirmationResult.confirm(otp)');
    expect(phoneVerification).toContain('PhoneAuthProvider.credential(attempt.verificationId, otp)');
    expect(phoneVerification).toContain('if (resendCooldown > 0)');
    expect(phoneVerification).toContain('disabled={loading || resendCooldown > 0}');
    expect(phoneVerification).toContain('linkedCredential.user ?? auth.currentUser ?? currentUser');
    expect(phoneVerification).toContain('await linkedUser.reload()');

    const app = readRepoFile('web/src/App.tsx');
    expect(app).toContain('function useLoginRedirectReady');
    expect(app).toContain('const activeUser = firebaseUser ?? auth.currentUser');
    expect(app).toContain('if (!loginRedirectReady) return <SplashLoadingFallback />;');
  });
});
