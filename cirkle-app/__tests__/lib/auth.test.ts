import { signInWithGoogle, signOutUser, getCurrentUser } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// Mock Firebase modules
jest.mock('firebase/auth', () => ({
  GoogleAuthProvider: jest.fn(() => ({
    setCustomParameters: jest.fn(),
  })),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  getAuth: jest.fn(),
}));

// Mock the firebase.ts module
jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

describe('Auth Service', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('signInWithGoogle', () => {
    it('should call signInWithPopup with auth and GoogleAuthProvider', async () => {
      // Setup mock return value
      const mockUserCredential = { user: { uid: '123', email: 'test@example.com' } };
      (signInWithPopup as jest.Mock).mockResolvedValue(mockUserCredential);

      // Call the function
      const result = await signInWithGoogle();

      // Assertions
      expect(GoogleAuthProvider).toHaveBeenCalled();
      expect(signInWithPopup).toHaveBeenCalledWith(auth, expect.any(GoogleAuthProvider));
      expect(result).toEqual(mockUserCredential);
    });

    it('should throw error when signInWithPopup fails', async () => {
      // Setup mock to throw error
      const mockError = new Error('Failed to sign in');
      (signInWithPopup as jest.Mock).mockRejectedValue(mockError);

      // Call the function and expect it to throw
      await expect(signInWithGoogle()).rejects.toThrow('Failed to sign in');
      
      // Verify GoogleAuthProvider was still called
      expect(GoogleAuthProvider).toHaveBeenCalled();
    });
  });

  describe('signOutUser', () => {
    it('should call signOut with auth', async () => {
      // Mock successful sign out
      (signOut as jest.Mock).mockResolvedValue(undefined);

      // Call the function
      await signOutUser();

      // Assertions
      expect(signOut).toHaveBeenCalledWith(auth);
    });

    it('should throw error when signOut fails', async () => {
      // Setup mock to throw error
      const mockError = new Error('Failed to sign out');
      (signOut as jest.Mock).mockRejectedValue(mockError);

      // Call the function and expect it to throw
      await expect(signOutUser()).rejects.toThrow('Failed to sign out');
    });
  });

  describe('getCurrentUser', () => {
    it('should return auth.currentUser', () => {
      // Setup mock current user
      const mockUser = { uid: '123', email: 'test@example.com' };
      auth.currentUser = mockUser;

      // Call the function
      const result = getCurrentUser();

      // Assertions
      expect(result).toBe(mockUser);
    });

    it('should return null when no user is signed in', () => {
      // Setup mock current user to be null
      auth.currentUser = null;

      // Call the function
      const result = getCurrentUser();

      // Assertions
      expect(result).toBeNull();
    });
  });
});