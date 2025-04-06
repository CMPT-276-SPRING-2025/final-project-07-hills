// services/groupService.ts
import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc, 
    doc, 
    query, 
    where, 
    updateDoc, 
    arrayUnion, 
    arrayRemove,
    serverTimestamp,
    setDoc,
    Timestamp
  } from 'firebase/firestore';
  import { db } from '@/lib/firebase';
  
  const GROUPS_COLLECTION = 'groups';
  const USERS_COLLECTION = 'users';
  
  export interface GroupData {
    id?: string;
    name: string;
    createdBy?: string;
    members?: {[key: string]: boolean};
    createdAt?: Timestamp | Date;
    updatedAt?: Timestamp | Date;
    resources?: {
      documents?: any[];
      files?: any[];
    };
    [key: string]: any;
  }
  
  // Create a new group
  export const createGroup = async (groupData: Partial<GroupData>, userId: string): Promise<GroupData> => {
    try {
      const groupRef = collection(db, GROUPS_COLLECTION);
      
      // Create a new group document with the creator as the first member
      const newGroup = {
        ...groupData,
        createdBy: userId,
        members: { [userId]: true }, // Using an object for quicker lookups
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      // Add document to Firestore
      const docRef = await addDoc(groupRef, newGroup);
      const groupId = docRef.id;
      
      // Update user's groups list
      await updateUserGroups(userId, groupId);
      
      // Return consistent data format for immediate display
      return { 
        id: groupId, 
        ...groupData,
        createdBy: userId,
        members: { [userId]: true },
        // Use a Date object for immediate display
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  };
  
  // Get all groups for a user
  export const getUserGroups = async (userId: string): Promise<GroupData[]> => {
    try {
      const groupsQuery = query(
        collection(db, GROUPS_COLLECTION),
        where(`members.${userId}`, '==', true)
      );
      
      const querySnapshot = await getDocs(groupsQuery);
      const groups: GroupData[] = [];
      
      querySnapshot.forEach((doc) => {
        groups.push({ id: doc.id, ...doc.data() } as GroupData);
      });
   
      return groups;
    } catch (error) {
      console.error('Error getting user groups:', error);
      throw error;
    }
  };
  
  // Get a single group by ID
  export const getGroupById = async (groupId: string): Promise<GroupData> => {
    try {
      const docRef = doc(db, GROUPS_COLLECTION, groupId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as GroupData;
      } else {
        console.error(`Group ${groupId} not found`);
        throw new Error('Group not found');
      }
    } catch (error) {
      console.error(`Error getting group ${groupId}:`, error);
      throw error;
    }
  };
  
  // Join a group
  export const joinGroup = async (groupId: string, userId: string): Promise<boolean> => {
    try {
      // First check if the group exists
      const groupRef = doc(db, GROUPS_COLLECTION, groupId);
      const groupSnap = await getDoc(groupRef);
      
      if (!groupSnap.exists()) {
        console.error(`Group ${groupId} not found`);
        throw new Error('Group not found');
      }
      
      const groupData = groupSnap.data();
      
      // Check if user is already a member
      if (groupData.members && groupData.members[userId] === true) {
        throw new Error('Already a member');
      }
      
      // Add user to the group's members
      await updateDoc(groupRef, {
        [`members.${userId}`]: true,
        updatedAt: serverTimestamp()
      });
      
      // Update user's groups list
      await updateUserGroups(userId, groupId);
      
      return true;
    } catch (error) {
      console.error('Error joining group:', error);
      throw error;
    }
  };
  
  // Leave a group
  export const leaveGroup = async (groupId: string, userId: string): Promise<boolean> => {
    try {
      const groupRef = doc(db, GROUPS_COLLECTION, groupId);
      
      // Remove user from the group's members list
      await updateDoc(groupRef, {
        [`members.${userId}`]: false, // Or use dot notation with Firebase to delete
        updatedAt: serverTimestamp()
      });
      
      // Remove group from user's groups list
      const userRef = doc(db, USERS_COLLECTION, userId);
      await updateDoc(userRef, {
        groups: arrayRemove(groupId)
      });
      
      return true;
    } catch (error) {
      console.error('Error leaving group:', error);
      throw error;
    }
  };
  
  // Helper function to update a user's groups
  const updateUserGroups = async (userId: string, groupId: string): Promise<void> => {
    try {
      const userRef = doc(db, USERS_COLLECTION, userId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        // Update existing user document
        await updateDoc(userRef, {
          groups: arrayUnion(groupId),
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new user document if it doesn't exist
        await setDoc(userRef, {
          uid: userId,
          groups: [groupId],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
  
    } catch (error) {
      console.error(`Error updating user ${userId}'s groups:`, error);
      throw error;
    }
  };
  
  // Get a group's invite link/code
  export const getGroupInviteCode = (groupId: string): string => {
    // For simplicity, we're just using the group ID as the invite code
    // In a production app, you might want to generate a separate code
    return groupId;
  };

  // Update the name of a document or file in a group's resources
export const updateGroupResourceName = async (
  groupId: string,
  resourceId: string,
  resourceType: "documents" | "files",
  newName: string
): Promise<void> => {
  try {

    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const groupSnap = await getDoc(groupRef);

    if (!groupSnap.exists()) {
      throw new Error(`Group with ID ${groupId} not found`);
    }

    const groupData = groupSnap.data();

    if (!groupData.resources || !groupData.resources[resourceType]) {
      throw new Error(`Group does not have any resources of type ${resourceType}`);
    }

    const updatedResources = groupData.resources[resourceType].map((res: any) => {
      if (res.id === resourceId) {
        return { ...res, name: newName };
      }
      return res;
    });

    await updateDoc(groupRef, {
      [`resources.${resourceType}`]: updatedResources,
      updatedAt: serverTimestamp(),
    });

  } catch (error) {
    console.error(`Error updating resource name in group ${groupId}:`, error);
    throw error;
  }
};
