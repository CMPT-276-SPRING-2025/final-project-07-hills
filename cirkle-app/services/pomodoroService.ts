// services/pomodoroService.ts
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    query, 
    where, 
    getDocs,
    serverTimestamp,
    orderBy,
    Timestamp
  } from 'firebase/firestore';
  import { db } from '@/lib/firebase';
  
  const POMODORO_SCORES_COLLECTION = 'pomodoro_scores';
  
  interface PomodoroScore {
    groupId: string;
    userId: string;
    userName: string;
    userEmail: string;
    score: number;
    lastUpdated: Timestamp | Date;
  }
  
  /**
   * Get scores for a specific group
   * @param groupId The group ID to get scores for
   * @returns Array of scores with user info
   */
  export const getGroupScores = async (groupId: string): Promise<PomodoroScore[]> => {
    try {
      
      const scoresQuery = query(
        collection(db, POMODORO_SCORES_COLLECTION),
        where('groupId', '==', groupId),
        orderBy('score', 'desc')
      );
      
      const querySnapshot = await getDocs(scoresQuery);
      const scores: PomodoroScore[] = [];
      
      querySnapshot.forEach((doc) => {
        scores.push(doc.data() as PomodoroScore);
      });
      
      return scores;
    } catch (error) {
      console.error('Error getting pomodoro scores:', error);
      throw error;
    }
  };
  
  /**
   * Get a user's score for a group
   * @param groupId The group ID
   * @param userId The user ID
   * @returns The user's score or 0 if not found
   */
  export const getUserScore = async (groupId: string, userId: string): Promise<number> => {
    try {
      const scoreDoc = await getDoc(doc(db, POMODORO_SCORES_COLLECTION, `${groupId}_${userId}`));
      
      if (scoreDoc.exists()) {
        return scoreDoc.data().score;
      }
      
      return 0;
    } catch (error) {
      console.error('Error getting user score:', error);
      return 0;
    }
  };
  
  /**
   * Update a user's score for a group
   * @param groupId The group ID
   * @param userId The user ID
   * @param userName User's display name
   * @param userEmail User's email
   * @param scoreToAdd Points to add to the score
   * @returns Updated score
   */
  export const updateUserScore = async (
    groupId: string, 
    userId: string, 
    userName: string,
    userEmail: string,
    scoreToAdd: number
  ): Promise<number> => {
    try {
      
      const scoreDocRef = doc(db, POMODORO_SCORES_COLLECTION, `${groupId}_${userId}`);
      const scoreDoc = await getDoc(scoreDocRef);
      
      let currentScore = 0;
      
      if (scoreDoc.exists()) {
        currentScore = scoreDoc.data().score;
      }
      
      const newScore = currentScore + scoreToAdd;
      
      // Update or create the score document
      await setDoc(scoreDocRef, {
        groupId,
        userId,
        userName,
        userEmail,
        score: newScore,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      
      return newScore;
    } catch (error) {
      console.error('Error updating user score:', error);
      throw error;
    }
  };