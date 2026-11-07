// Shim leve para `re2js` (importado por @firebase/firestore apenas para avaliação local
// de expressões `like`/`regex_match` do Firestore Enterprise Pipeline, não utilizadas no app).
// Evita empacotar ~145 KB de tabelas Unicode do RE2 no bundle de inicialização.
export class RE2JS {
  private readonly regex: RegExp;
  private readonly fullRegex: RegExp;

  private constructor(pattern: string, flags = '') {
    this.regex = new RegExp(pattern, flags);
    this.fullRegex = new RegExp(`^(?:${pattern})$`, flags);
  }

  static compile(pattern: string, flags?: number): RE2JS {
    const flagStr = flags && (flags & 1) ? 'i' : '';
    return new RE2JS(pattern, flagStr);
  }

  test(input: string): boolean {
    return this.regex.test(input);
  }

  matches(input: string): boolean {
    return this.fullRegex.test(input);
  }
}
