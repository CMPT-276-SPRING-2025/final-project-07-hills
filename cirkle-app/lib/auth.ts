// lib/auth.ts
import {
  signInWithPopup, 
  signOut as firebaseSignOut, 
  User,
  UserCredential 
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';

/**
 * Sign in with Google
 * @returns Promise with UserCredential
 */
export const signInWithGoogle = async (): Promise<UserCredential> => {
  try {
    // Always force select account to ensure user picks a Google account every time
    googleProvider.setCustomParameters({
      prompt: 'select_account'
    });
    
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

/**
 * Sign out the current user
 */
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Get the current user
 * @returns The current user or null if not signed in
 */
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};