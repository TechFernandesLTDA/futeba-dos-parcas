import { vi } from 'vitest';

// Mock Firestore functions
export const mockOnSnapshot = vi.fn();
export const mockGetDoc = vi.fn();
export const mockGetDocs = vi.fn();
export const mockAddDoc = vi.fn();
export const mockUpdateDoc = vi.fn();
export const mockDeleteDoc = vi.fn();
export const mockSetDoc = vi.fn();
export const mockWriteBatch = vi.fn(() => ({
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue(undefined),
}));
export const mockCollection = vi.fn();
export const mockDoc = vi.fn();
export const mockQuery = vi.fn();
export const mockWhere = vi.fn();
export const mockOrderBy = vi.fn();
export const mockLimit = vi.fn();
export const mockStartAfter = vi.fn();
export const mockTimestamp = {
  now: vi.fn(() => ({ toDate: () => new Date() })),
  fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
};

vi.mock('firebase/firestore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collection: (...args: any[]) => mockCollection(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: (...args: any[]) => mockDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDoc: (...args: any[]) => mockGetDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDocs: (...args: any[]) => mockGetDocs(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addDoc: (...args: any[]) => mockAddDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setDoc: (...args: any[]) => mockSetDoc(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (...args: any[]) => mockQuery(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where: (...args: any[]) => mockWhere(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orderBy: (...args: any[]) => mockOrderBy(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  limit: (...args: any[]) => mockLimit(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  startAfter: (...args: any[]) => mockStartAfter(...args),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
  Timestamp: mockTimestamp,
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  serverTimestamp: vi.fn(),
  DocumentSnapshot: vi.fn(),
}));

// Mock Firebase app
vi.mock('../../services/firebase', () => ({
  db: {},
  auth: { currentUser: null },
  storage: {},
  functions: {},
}));
