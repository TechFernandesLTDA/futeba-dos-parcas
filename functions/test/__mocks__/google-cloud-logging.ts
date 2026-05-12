// Mock stub pra @google-cloud/logging — evita SyntaxError ESM em jest.
// Usado apenas pelos tests; src importa via real package em runtime.
export class Logging {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_opts?: unknown) {}
  getEntries(_opts?: unknown): Promise<[unknown[]]> {
    return Promise.resolve([[]]);
  }
}
