// services/resourceSyncService.ts

import { getGoogleAccessToken } from "@/services/googleAuthService";
import { fetchDriveFileMetadata } from "@/services/googleDriveService";
import { updateGroupResourceName } from "@/services/groupService";
// Updated syncResourceNames function in services/resourceSyncService.ts

// Add this flag to detect if a sync is currently in progress
let syncInProgress = false;

export async function syncResourceNames(group: any, userId: string) {
  if (!group?.resources || syncInProgress) return false;

  try {
    // Set flag to prevent overlapping syncs
    syncInProgress = true;
    
    const accessToken = getGoogleAccessToken();
    if (!accessToken) return false;

    const updates: { type: 'documents' | 'files', id: string, newName: string }[] = [];

    for (const type of ["documents", "files"] as const) {
      const resources = group.resources[type];
      if (!resources || !Array.isArray(resources)) continue;

      for (const resource of resources) {
        try {
          // Skip resources that were just updated locally (within last 5 seconds)
          const wasRecentlyUpdated = resource.lastUpdated && 
                                     (new Date().getTime() - new Date(resource.lastUpdated).getTime() < 5000);
          
          if (wasRecentlyUpdated) {
            continue;
          }
          
          const metadata = await fetchDriveFileMetadata(resource.id, accessToken);

          if (metadata.name !== resource.name) {
            updates.push({ type, id: resource.id, newName: metadata.name });
          }
        } catch (err) {
          console.warn(`Could not update ${type} ${resource.id}:`, err);
        }
      }
    }

    // Apply all updates in parallel
    if (updates.length > 0) {
      await Promise.all(
        updates.map(update => 
          updateGroupResourceName(group.id, update.id, update.type, update.newName)
            .catch(err => console.error(`Failed to update ${update.type} ${update.id}:`, err))
        )
      );
      
      return true; // Return true if any updates were made
    }
    
    return false; // Return false if no updates were needed
  } finally {
    // Always reset the flag when done
    syncInProgress = false;
  }
}