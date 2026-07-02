export type VerificationFailureReason =
  | 'invalid_format'
  | 'invalid_cpf'
  | 'duplicate_cpf'
  | 'duplicate_phone'
  | 'rate_limited'
  | 'code_expired'
  | 'code_incorrect';

// #3187: getNextVerificationPath removido — único consumidor era o
// VerificationBanner (código morto deletado); ProtectedRoute em App.tsx
// mantém a lógica de redirecionamento equivalente inline.

export function mapCpfVerificationFailureReason(code?: string): VerificationFailureReason {
  switch (code) {
    case 'functions/already-exists':
      return 'duplicate_cpf';
    case 'functions/invalid-argument':
      return 'invalid_cpf';
    case 'functions/resource-exhausted':
      return 'rate_limited';
    // #3187: verifyCpf com success:false (verificação recusada pelo servidor) —
    // audita como invalid_cpf (dentro do enum aceito pela callable
    // logVerificationFailure), distinto de invalid_format.
    case 'app/cpf-verification-failed':
      return 'invalid_cpf';
    default:
      return 'invalid_format';
  }
}
