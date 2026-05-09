// Mock stub pra @google-cloud/storage — evita SyntaxError ESM em jest.
// Usado apenas pelos tests; src ainda importa via real package em runtime.
export class Storage {
  bucket() {
    return {
      getFiles: async () => [[]],
      file: () => ({
        delete: async () => undefined,
        exists: async () => [false],
      }),
    };
  }
}
