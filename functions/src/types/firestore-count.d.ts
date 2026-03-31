// Augment firebase-admin types to include .count() on Query
// This method exists at runtime but is missing from newer type definitions
import { firestore } from "firebase-admin";

declare module "firebase-admin/firestore" {
  interface Query<T = firestore.DocumentData> {
    count(): {
      get(): Promise<{ data(): { count: number } }>;
    };
  }

  interface CollectionReference<T = firestore.DocumentData> {
    count(): {
      get(): Promise<{ data(): { count: number } }>;
    };
  }
}
