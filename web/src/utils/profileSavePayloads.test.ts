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
  it('mantém updated_at protegido fora do AuthContext e grava timestamp no edit profile', () => {
    const authContext = readRepoFile('web/src/contexts/AuthContext.tsx');
    const authUpdateProfile = sliceBetween(
      authContext,
      'const updateUserProfile = useCallback',
      '  const value = useMemo'
    );
    expect(authUpdateProfile).not.toContain('updated_at');

    const editProfile = readRepoFile('web/src/pages/profile/EditProfileScreen.tsx');
    const editProfileSave = sliceBetween(editProfile, 'const handleSave = async () => {', '  const handleCancel = () => {');
    expect(editProfileSave).toContain('updated_at: serverTimestamp()');

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
    expect(phoneVerification).toContain('canFallbackToOlderVerificationId(attemptCode)');
    expect(sliceBetween(
      phoneVerification,
      'function canFallbackToOlderVerificationId',
      'function auditPhoneVerificationFailure'
    )).not.toContain('auth/invalid-verification-code');
    expect(phoneVerification).toContain('if (resendCooldown > 0)');
    expect(phoneVerification).toContain('disabled={loading || resendCooldown > 0}');
    expect(phoneVerification).toContain('linkedCredential.user ?? auth.currentUser ?? currentUser');
    expect(phoneVerification).toContain('await linkedUser.reload()');

    const app = readRepoFile('web/src/App.tsx');
    expect(app).toContain('function useLoginRedirectReady');
    expect(app).toContain('const activeUser = firebaseUser ?? auth.currentUser');
    expect(app).toContain('if (!loginRedirectReady) return <SplashLoadingFallback />;');
  });

  it('não mascara deleção de conta bem-sucedida quando logout local falha', () => {
    const settingsScreen = readRepoFile('web/src/pages/settings/SettingsScreen.tsx');
    const deleteFlow = sliceBetween(
      settingsScreen,
      'const handleDeleteAccountConfirm = async () => {',
      '  return ('
    );
    const successPath = sliceBetween(deleteFlow, 'try {', '} catch (err) {');
    const cleanupPath = sliceBetween(deleteFlow, '} finally {', '      setDeleting(false);');

    expect(successPath).toContain('await deleteAccount();');
    expect(successPath).toContain("navigate('/login', { replace: true });");
    expect(successPath).not.toContain('await logout();');
    expect(cleanupPath).toContain('await logout();');
    expect(cleanupPath).toContain('queryClient.clear();');
  });

  it('preserva timestamps originais em saves determinísticos de pós-jogo', () => {
    const dreamTeam = readRepoFile('web/src/hooks/useDreamTeam.ts');
    const saveDreamTeam = sliceBetween(dreamTeam, 'export function useSaveDreamTeam()', '    onSuccess: () => {');
    expect(saveDreamTeam).toContain('runTransaction');
    expect(saveDreamTeam).toContain('updated_at: serverTimestamp()');
    expect(saveDreamTeam).toContain("current.exists() ? {} : { created_at: serverTimestamp() }");

    const postGameMessages = readRepoFile('web/src/hooks/usePostGameMessages.ts');
    const savePostGameMessage = sliceBetween(postGameMessages, 'export function useSavePostGameMessage', '    onSuccess: () => {');
    expect(savePostGameMessage).toContain('runTransaction');
    expect(savePostGameMessage).toContain('updated_at: serverTimestamp()');
    expect(savePostGameMessage).toContain("current.exists() ? {} : { created_at: serverTimestamp() }");
  });

  it('mantém comentários paginados ao receber snapshot realtime', () => {
    const comments = readRepoFile('web/src/hooks/useGameComments.ts');
    expect(comments).toContain("import { mergeRealtimePageById } from './realtimePageMerge';");
    expect(comments).toContain("mergeRealtimePageById(prev, data, snapshotIds, 'append')");
    expect(comments).toContain('startAfter(oldestDocRef.current)');
  });

  it('alinha live events e fotos de jogo com constraints do backend e UX', () => {
    const liveGame = readRepoFile('web/src/pages/game/LiveGameScreen.tsx');
    const addEventDialog = sliceBetween(liveGame, '<Dialog open={addEventDialog}', '</Dialog>');
    expect(addEventDialog).not.toContain("value: 'ASSIST'");

    const photosTab = readRepoFile('web/src/pages/game/GamePhotosTab.tsx');
    expect(photosTab).toContain('uploadBytesResumable');
    expect(photosTab).toContain('setUploadProgress');
    expect(photosTab).toContain('<LinearProgress');
  });
});
