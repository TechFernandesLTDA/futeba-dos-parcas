// Augmentação de tipos do firebase-admin para incluir .count() em Query
// Necessário pois o método existe em runtime mas falta nas definições de tipo.
import {firestore} from "firebase-admin";

declare module "firebase-admin/firestore" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Query<T = firestore.DocumentData> {
    count(): {
      get(): Promise<{data(): {count: number}}>;
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface CollectionReference<T = firestore.DocumentData> {
    count(): {
      get(): Promise<{data(): {count: number}}>;
    };
  }
}

export {};
