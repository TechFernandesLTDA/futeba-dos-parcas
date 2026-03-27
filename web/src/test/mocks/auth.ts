import { vi } from 'vitest';
import React from 'react';

export const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@example.com',
  photoUrl: null,
  level: 5,
  experiencePoints: 500,
};

export const mockFirebaseUser = {
  uid: 'test-user-id',
  displayName: 'Test User',
  email: 'test@example.com',
  photoURL: null,
};

export const mockUseAuth = vi.fn(() => ({
  user: mockUser,
  firebaseUser: mockFirebaseUser,
  loading: false,
  error: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
  signInWithGoogle: vi.fn(),
  resetPassword: vi.fn(),
  updateUserProfile: vi.fn(),
  refreshUser: vi.fn(),
  currentUser: mockFirebaseUser,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
