// services/googleDriveService.ts
import { getGoogleAccessToken } from './googleAuthService';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { GroupData } from './groupService';
import { deleteObject, ref } from "firebase/storage";
import { storage } from "@/lib/firebase"; // only if using Firebase Storage
import { google } from "googleapis";

const GROUPS_COLLECTION = 'groups';

interface DocumentData {
  id: string;
  name: string;
  url: string;
  createdBy: string
  createdAt: string;
  type: string;
}

interface FileData {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  createdBy: string;
  createdAt: string;
}

/**
 * Create a new Google Doc through the Drive API
 * @param groupId The ID of the group
 * @param title The title of the new document
 * @param group The group data containing member information
 * @param creatorUserId The ID of the user creating the document
 * @returns The created document data
 */
export const createGroupDocument = async (
  groupId: string, 
  title: string, 
  group: GroupData, 
  creatorUserId: string
): Promise<DocumentData> => {
  const accessToken = getGoogleAccessToken();
  
  if (!accessToken) {
    throw new Error('No valid Google access token found. Please authenticate with Google.');
  }
  
  try {
    console.log(`Creating document "${title}" for group ${groupId}`);
    
    // 1. Create a Google Doc through the Drive API
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: title,
        mimeType: 'application/vnd.google-apps.document' // This creates a Google Doc
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create document: ${error.error?.message || 'Unknown error'}`);
    }
    
    const docData = await response.json();
    console.log(`Document created with ID: ${docData.id}`);
    
    // 2. Get full file details including webViewLink
    const fileResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${docData.id}?fields=id,name,webViewLink`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!fileResponse.ok) {
      const error = await fileResponse.json();
      throw new Error(`Failed to get document details: ${error.error?.message || 'Unknown error'}`);
    }
    
    const fileDetails = await fileResponse.json();
    console.log(`Got document details with link: ${fileDetails.webViewLink}`);
    
    // 3. Set permissions to "Anyone with the link can edit"
    await setLinkSharingPermission(fileDetails.id, accessToken);
    console.log(`Set "Anyone with the link can edit" permission for document ${fileDetails.id}`);
    
    // 4. Store the document reference in Firestore
    // Use current date instead of serverTimestamp() for arrays
    const currentDate = new Date().toISOString();
    const documentData: DocumentData = {
      id: fileDetails.id,
      name: fileDetails.name,
      url: fileDetails.webViewLink,
      createdBy: creatorUserId,
      createdAt: currentDate,
      type: 'google_doc'
    };
    
    await addResourceToGroup(groupId, 'documents', documentData);
    console.log(`Document reference added to group in Firestore`);
    
    return documentData;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

/**
 * Upload a file to Google Drive and set link sharing
 * @param groupId The ID of the group
 * @param file The file to upload
 * @param group The group data containing member information
 * @param creatorUserId The ID of the user uploading the file
 * @returns The uploaded file data
 */
export const uploadGroupFile = async (
  groupId: string, 
  file: File, 
  group: GroupData, 
  creatorUserId: string
): Promise<FileData> => {
  const accessToken = getGoogleAccessToken();
  
  if (!accessToken) {
    throw new Error('No valid Google access token found. Please authenticate with Google.');
  }
  
  try {
    console.log(`Uploading file "${file.name}" for group ${groupId}`);
    
    // 1. Upload file to Google Drive
    const metadata = {
      name: file.name,
      mimeType: file.type
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    
    const uploadResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: form
    });
    
    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(`Failed to upload file: ${error.error?.message || 'Unknown error'}`);
    }
    
    const uploadedFile = await uploadResponse.json();
    console.log(`File uploaded with ID: ${uploadedFile.id}`);
    
    // 2. Get full file details including webViewLink
    const fileResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${uploadedFile.id}?fields=id,name,mimeType,webViewLink,size`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!fileResponse.ok) {
      const error = await fileResponse.json();
      throw new Error(`Failed to get file details: ${error.error?.message || 'Unknown error'}`);
    }
    
    const fileDetails = await fileResponse.json();
    console.log(`Got file details with link: ${fileDetails.webViewLink}`);
    
    // 3. Set permissions to "Anyone with the link can edit"
    await setLinkSharingPermission(fileDetails.id, accessToken);
    console.log(`Set "Anyone with the link can edit" permission for file ${fileDetails.id}`);
    
    // 4. Store the file reference in Firestore
    // Use current date instead of serverTimestamp() for arrays
    const currentDate = new Date().toISOString();
    const fileData: FileData = {
      id: fileDetails.id,
      name: fileDetails.name,
      url: fileDetails.webViewLink,
      mimeType: fileDetails.mimeType,
      size: fileDetails.size || file.size,
      createdBy: creatorUserId,
      createdAt: currentDate
    };
    
    await addResourceToGroup(groupId, 'files', fileData);
    console.log(`File reference added to group in Firestore`);
    
    return fileData;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Set "Anyone with the link can edit" permission on a file
 * @param fileId The ID of the file
 * @param accessToken Google access token
 * @returns The permission response
 */
const setLinkSharingPermission = async (fileId: string, accessToken: string): Promise<any | null> => {
  try {
    console.log(`Setting link sharing permission for file ${fileId}`);
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'writer',
        type: 'anyone',
        allowFileDiscovery: false
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.warn(`Warning: Failed to set link sharing: ${error.error?.message || 'Unknown error'}`);
      return null;
    }
    
    console.log(`Successfully set link sharing for file ${fileId}`);
    return response.json();
  } catch (error) {
    console.warn(`Warning: Error setting link sharing:`, error);
    return null;
  }
};

/**
 * Add a resource to a group in Firestore
 * @param groupId The ID of the group
 * @param resourceType The type of resource ('documents' or 'files')
 * @param resourceData The resource data to add
 * @returns Success status
 */
const addResourceToGroup = async (
  groupId: string, 
  resourceType: 'documents' | 'files', 
  resourceData: DocumentData | FileData
): Promise<boolean> => {
  try {
    console.log(`Adding ${resourceType} to group ${groupId} in Firestore`);
    const groupRef = doc(db, GROUPS_COLLECTION, groupId);
    const groupSnapshot = await getDoc(groupRef);
    
    if (groupSnapshot.exists()) {
      const groupData = groupSnapshot.data();
      let resources = groupData.resources || {};
      let resourceArray = resources[resourceType] || [];
      
      // Add the new resource to the array
      resourceArray.push(resourceData);
      
      // Update the resources object
      resources = {
        ...resources,
        [resourceType]: resourceArray
      };
      
      // Update the document with the new resources object and a timestamp
      await updateDoc(groupRef, {
        resources: resources,
        updatedAt: serverTimestamp()
      });
      
      console.log(`Successfully added ${resourceType} to group`);
      return true;
    } else {
      throw new Error(`Group ${groupId} not found`);
    }
  } catch (error) {
    console.error(`Error adding ${resourceType} to group:`, error);
    throw error;
  }
};

export const deleteGroupFile = async (groupId: string, fileId: string) => {
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);

  if (!groupSnap.exists()) throw new Error("Group not found");

  const groupData = groupSnap.data();
  const file = groupData.resources?.files?.find((f: any) => f.id === fileId);
  const updatedFiles = (groupData.resources?.files || []).filter((f: any) => f.id !== fileId);

  await updateDoc(groupRef, {
    "resources.files": updatedFiles
  });

  if (file?.id) {
    try {
      await fetch('/api/delete-drive-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: file.id,
          accessToken: getGoogleAccessToken()
        })
      });
    } catch (error) {
      console.warn("Google Drive file deletion failed:", error);
    }
  }
};

export const deleteGroupDocument = async (groupId: string, docId: string) => {
  const groupRef = doc(db, "groups", groupId);
  const groupSnap = await getDoc(groupRef);

  if (!groupSnap.exists()) throw new Error("Group not found");

  const groupData = groupSnap.data();
  const updatedDocs = (groupData.resources?.documents || []).filter((doc: any) => doc.id !== docId);

  await updateDoc(groupRef, {
    "resources.documents": updatedDocs
  });

  try {
    await fetch('/api/delete-drive-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId: docId,
        accessToken: getGoogleAccessToken()
      })
    });
  } catch (error) {
    console.warn("Google Drive document deletion failed:", error);
  }
};

export async function fetchDriveFileMetadata(fileId: string, accessToken: string) {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch file metadata: ${response.statusText}`);
  }

  return await response.json(); // contains `id` and `name`
}

// Add this function to services/googleDriveService.ts

/**
 * Rename a document or file in Google Drive and update Firestore
 * @param groupId The group ID
 * @param resourceId The document or file ID
 * @param resourceType The type of resource ('documents' or 'files')
 * @param newName The new name for the resource
 * @returns Success status
 */
export const renameResource = async (
  groupId: string,
  resourceId: string,
  resourceType: 'documents' | 'files',
  newName: string
): Promise<boolean> => {
  try {
    console.log(`Renaming ${resourceType} ${resourceId} to "${newName}"`);
    
    // 1. Get access token
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      throw new Error('No valid Google access token found. Please authenticate with Google.');
    }
    
    // 2. Update the name in Google Drive
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${resourceId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: newName
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to rename in Google Drive: ${error.error?.message || 'Unknown error'}`);
    }
    
    // 3. Update the name in Firestore
    
    
    console.log(`Successfully renamed ${resourceType} ${resourceId} to "${newName}"`);
    return true;
  } catch (error) {
    console.error(`Error renaming ${resourceType}:`, error);
    throw error;
  }
};
