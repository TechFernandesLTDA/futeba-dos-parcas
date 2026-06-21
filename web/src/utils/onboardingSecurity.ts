import type { User as FirebaseUser } from 'firebase/auth';

export type VerificationFailureReason =
  | 'invalid_format'
  | 'invalid_cpf'
  | 'duplicate_cpf'
  | 'duplicate_phone'
  | 'rate_limited'
  | 'code_expired'
  | 'code_incorrect';

export function getNextVerificationPath(
  firebaseUser: Pick<FirebaseUser, 'phoneNumber'> | null | undefined,
): '/onboarding/phone' | '/onboarding/cpf' {
  return firebaseUser?.phoneNumber ? '/onboarding/cpf' : '/onboarding/phone';
}

export function mapCpfVerificationFailureReason(code?: string): VerificationFailureReason {
  switch (code) {
    case 'functions/already-exists':
      return 'duplicate_cpf';
    case 'functions/invalid-argument':
      return 'invalid_cpf';
    case 'functions/resource-exhausted':
      return 'rate_limited';
    default:
      return 'invalid_format';
  }
}
