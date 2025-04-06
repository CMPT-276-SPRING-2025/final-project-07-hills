// services/userService.ts
import { 
    doc, 
    getDoc, 
    setDoc, 
    serverTimestamp
  } from 'firebase/firestore';
  import { User } from 'firebase/auth';
  import { db } from '@/lib/firebase';
  
  const USERS_COLLECTION = 'users';
  
  interface UserData {
    uid: string;
    displayName: string | null;
    email: string | null;
    photoURL: string | null;
    groups?: string[];
    createdAt?: any;
    updatedAt?: any;
    [key: string]: any;
  }
  
  /**
   * Get user data by ID
   * @param userId The user ID
   * @returns The user data or null if not found
   */
  export const getUserById = async (userId: string): Promise<UserData | null> => {
    try {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {

        const data = userSnap.data();
        return { 
          uid: userSnap.id, 
          displayName: data?.displayName || null, 
          email: data?.email || null, 
          photoURL: data?.photoURL || null, 
          groups: data?.groups || [], 
          createdAt: data?.createdAt || null, 
          updatedAt: data?.updatedAt || null,
          ...data 
        } as UserData;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting user ${userId}:`, error);
      throw error;
    }
  };
  
  /**
   * Create or update user data
   * @param userId The user ID
   * @param userData The user data to store
   * @returns The created/updated user data
   */
  export const updateUserData = async (userId: string, userData: Partial<UserData>): Promise<UserData> => {
    try {

      const userRef = doc(db, USERS_COLLECTION, userId);
      
      // Merge with existing data if it exists
      await setDoc(userRef, {
        ...userData,
        updatedAt: serverTimestamp()
      }, { merge: true });
    
      return { id: userId, ...userData } as UserData;
    } catch (error) {
      throw error;
    }
  };
  
  /**
   * Create or update a user profile with authentication info
   * @param user The Firebase auth user object
   * @returns The created/updated user profile
   */
  export const createUserProfile = async (user: User): Promise<UserData> => {
    try {
      const { uid, displayName, email, photoURL } = user;
      const userRef = doc(db, USERS_COLLECTION, uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create new user profile
        const userData: UserData = {
          uid,
          displayName,
          email,
          photoURL,
          groups: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await setDoc(userRef, userData);
        return { id: uid, ...userData };
      } else {
        // Update existing user profile
        const userData = {
          displayName,
          email,
          photoURL,
          updatedAt: serverTimestamp()
        };
        
        await setDoc(userRef, userData, { merge: true });
        return { uid, ...userSnap.data(), ...userData } as UserData;
      }
    } catch (error) {
      console.error(`Error creating/updating user profile:`, error);
      throw error;
    }
  };
  
  /**
   * Get email addresses for a list of user IDs
   * @param userIds The user IDs to look up
   * @returns Array of email addresses (may contain null for users without emails)
   */
  export const getUserEmails = async (userIds: string[]): Promise<(string | null)[]> => {
    try {
      const emails: (string | null)[] = [];
      
      // Process in batches to avoid excessive reads
      const batchSize = 10;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const userDocs = await Promise.all(
          batch.map(userId => getUserById(userId))
        );
        
        userDocs.forEach(user => {
          if (user && user.email) {
            emails.push(user.email);
          } else {
            emails.push(null);
          }
        });
      }
      
      return emails;
    } catch (error) {
      console.error(`Error getting user emails:`, error);
      throw error;
    }
  };