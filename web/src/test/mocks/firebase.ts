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
  collection: (...args: any[]) => mockCollection(...args),
  doc: (...args: any[]) => mockDoc(...args),
  getDoc: (...args: any[]) => mockGetDoc(...args),
  getDocs: (...args: any[]) => mockGetDocs(...args),
  addDoc: (...args: any[]) => mockAddDoc(...args),
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: any[]) => mockDeleteDoc(...args),
  setDoc: (...args: any[]) => mockSetDoc(...args),
  writeBatch: (...args: any[]) => mockWriteBatch(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  orderBy: (...args: any[]) => mockOrderBy(...args),
  limit: (...args: any[]) => mockLimit(...args),
  startAfter: (...args: any[]) => mockStartAfter(...args),
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
