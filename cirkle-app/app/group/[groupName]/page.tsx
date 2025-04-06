// app/group/[groupName]/page.tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { HomeIcon, TimerIcon, PlusIcon, ClipboardIcon, CheckIcon, UploadIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getGroupById, getGroupInviteCode } from "@/services/groupService";
import { createGroupDocument, uploadGroupFile, deleteGroupFile, deleteGroupDocument } from "@/services/googleDriveService";
import { requestGooglePermissions, hasValidGoogleToken, saveGoogleTokenData, getGoogleAccessToken } from "@/services/googleAuthService";
import { getUserGroups } from '@/services/groupService';
import ProtectedRoute from "@/components/protected-route";
import { getUserById } from '@/services/userService';
import { XIcon } from "lucide-react";
import { syncResourceNames } from "@/services/resourceSyncService";
import { EditIcon } from "lucide-react";
import { updateGroupResourceName } from '@/services/groupService';


export default function GroupPage() {
  const params = useParams();
  const groupName = params.groupName as string;
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showCreateDocument, setShowCreateDocument] = useState(false);
  const [documentName, setDocumentName] = useState("");
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [memberData, setMemberData] = useState<{[key: string]: any}>({});
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'document' | 'file';
    id: string;
  } | null>(null);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [resourceToRename, setResourceToRename] = useState<{
      id: string;
      name: string;
      type: 'document' | 'file';
      createdBy: string;
    } | null>(null);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  // Fetch member data when group loads
  useEffect(() => {
    const fetchMemberData = async () => {
      if (!group || !group.members) return;
      
      const memberIds = Object.keys(group.members).filter(id => group.members[id]);
      const userData: {[key: string]: any} = {};
      
      // Fetch data for each member
      for (const id of memberIds) {
        try {
          const user = await getUserById(id);
          if (user) {
            userData[id] = user;
          }
        } catch (err) {
          console.error(`Error fetching user data for ${id}:`, err);
        }
      }
      
      setMemberData(userData);
    };
    
    if (group) {
      fetchMemberData();
    }
  }, [group]);

  useEffect(() => {
    const syncNames = async () => {
      if (group && user) {
        await syncResourceNames(group, user.uid);
        const refreshed = await getGroupById(group.id);
        setGroup(refreshed);
      }
    };
  
    syncNames();
  }, [group?.id, user]);
  

  // Fetch group data when component mounts
  useEffect(() => {
    const fetchGroupData = async () => {
      try {
        if (!user) {
          router.push('/');
          return;
        }
        
        setLoading(true);
        setError(null);
        
        // Find group by name
        const userGroups = await getUserGroups(user.uid);
        const foundGroup = userGroups.find(g => g.name === decodeURIComponent(groupName));
        
        if (foundGroup) {
          setGroup(foundGroup);
        } else {
          setError('Group not found');
        }
      } catch (err) {
        console.error('Error fetching group data:', err);
        setError('Failed to load group data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchGroupData();
  }, [groupName, user, router]);

  const copyToClipboard = () => {
    if (!group) return;
    
    navigator.clipboard.writeText(getGroupInviteCode(group.id)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

 // Update the initiateRename function
const initiateRename = (resource: any, type: 'document' | 'file') => {
  // Verify that the current user is the creator of the resource
  if (resource.createdBy !== user?.uid) {
    setError(`You can only rename your own ${type}s.`);
    return;
  }
  
  setResourceToRename({
    id: resource.id,
    name: resource.name,
    type,
    createdBy: resource.createdBy
  });
  setNewName(resource.name);
  setShowRenameModal(true);
};
 // Update the handleRename function
const handleRename = async () => {
  if (!resourceToRename || !newName.trim() || !group || !user) return;
  
  try {
    setIsRenaming(true);
    setError(null);
    
    // Verify that the current user is the creator of the resource
    if (resourceToRename.createdBy !== user.uid) {
      throw new Error(`You can only rename your own ${resourceToRename.type}s.`);
    }
    
    // Always update in Firestore first, since this is likely to succeed
    await updateGroupResourceName(
      group.id, 
      resourceToRename.id, 
      resourceToRename.type === 'document' ? 'documents' : 'files', 
      newName.trim()
    );
    
    // Get access token - but don't show errors if this fails
    let accessToken = getGoogleAccessToken();
    
    // Only try Google Drive update if we have a token
    let driveUpdateSuccessful = false;
    if (accessToken) {
      try {
        // Call the Drive API directly - but don't fail the whole operation if it errors
        const response = await fetch("/api/rename-drive-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: resourceToRename.id,
            newName: newName.trim(),
            accessToken,
            groupId: group.id,
            resourceType: resourceToRename.type === 'document' ? 'documents' : 'files'
          }),
        });
        
        if (response.ok) {
          driveUpdateSuccessful = true;
        } else {
          // Silently log error but don't show to user since Firestore update worked
          console.warn("Google Drive rename had issues, but Firestore was updated");
        }
      } catch (driveErr) {
        // Silently log error but don't show to user
        console.warn("Google Drive rename error:", driveErr);
      }
    }
    
    // Refresh group data to show the updated name
    const refreshedGroup = await getGroupById(group.id);
    setGroup(refreshedGroup);
    
    // Show appropriate success message
    if (driveUpdateSuccessful) {
      setSuccessMessage(`${resourceToRename.type === 'document' ? 'Document' : 'File'} renamed successfully!`);
    } else {
      setSuccessMessage(`${resourceToRename.type === 'document' ? 'Document' : 'File'} renamed in group. Changes may not be visible to other users until they refresh.`);
    }
    
    setTimeout(() => setSuccessMessage(null), 3000);
    
    // Reset state
    setShowRenameModal(false);
    setResourceToRename(null);
    setNewName("");
  } catch (err: any) {
    console.error("Error renaming resource:", err);
    setError(err.message || "Failed to rename. Please try again.");
  } finally {
    setIsRenaming(false);
  }
};
  

  // Handle document creation
  const handleCreateDocument = async () => {
    if (!documentName.trim() || !group || !user) return;
    
    try {
      setIsCreatingDoc(true);
      setError(null);
      
      // Ensure we have Google permissions
      const hasPermissions = await ensureGooglePermissions();
      if (!hasPermissions) {
        setIsCreatingDoc(false);
        return;
      }
      
      // Create the document
      await createGroupDocument(
        group.id, 
        documentName.trim(), 
        group, 
        user.uid
      );
      
      // Reset state
      setDocumentName('');
      setShowCreateDocument(false);
      setSuccessMessage('Document created successfully!');
      
      // Refresh group data to show the new document
      const refreshedGroup = await getGroupById(group.id);
      setGroup(refreshedGroup);
      
      // Clear success message after a delay
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error creating document:', err);
      setError('Failed to create document. Please try again.');
    } finally {
      setIsCreatingDoc(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !group || !user) return;
    
    const file = e.target.files[0];
    
    try {
      setIsUploadingFile(true);
      setError(null);
      
      // Ensure we have Google permissions
      const hasPermissions = await ensureGooglePermissions();
      if (!hasPermissions) {
        setIsUploadingFile(false);
        return;
      }
      
      // Upload the file
      await uploadGroupFile(
        group.id, 
        file, 
        group, 
        user.uid
      );
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      setSuccessMessage('File uploaded successfully!');
      
      // Refresh group data to show the new file
      const refreshedGroup = await getGroupById(group.id);
      setGroup(refreshedGroup);
      
      // Clear success message after a delay
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const performDeleteResource = async (type: 'document' | 'file', resourceId: string) => {
    if (!group || !user) return;
  
    try {
      setError(null);
      setSuccessMessage("Deleting...");
  
      const hasPermissions = await ensureGooglePermissions();
      if (!hasPermissions) {
        setSuccessMessage(null); // Clear the "Deleting..." message if permissions check fails
        return;
      }
  
      let accessToken = getGoogleAccessToken();
      if (!accessToken) {
        const hasPermissions = await ensureGooglePermissions();
        if (!hasPermissions) {
          setSuccessMessage(null); // Clear the "Deleting..." message if permissions check fails
          return;
        }
  
        accessToken = getGoogleAccessToken(); // retry after permission
        if (!accessToken) {
          setSuccessMessage(null); // Clear the "Deleting..." message if getting token fails
          throw new Error("Access token still missing after requesting permissions");
        }
      }
  
      const response = await fetch("/api/delete-drive-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: resourceId, accessToken }),
      });
  
      const responseData = await response.json().catch(() => ({ error: "Unknown error" }));
  
      if (!response.ok) {
        // Check for specific error types
        if (response.status === 403 || responseData.permissionError) {
          throw new Error(`Unable to delete this ${type}. Only the creator can delete their own ${type}s.`);
        } else if (response.status === 404 || responseData.notFoundError) {
          throw new Error(`This ${type} no longer exists or was already deleted.`);
        } else {
          throw new Error(responseData.error || `Failed to delete ${type}. Please try again.`);
        }
      }
  
      // Firestore update
      if (type === "document") {
        await deleteGroupDocument(group.id, resourceId);
      } else {
        await deleteGroupFile(group.id, resourceId);
      }
  
      const refreshedGroup = await getGroupById(group.id);
      setGroup(refreshedGroup);
      setSuccessMessage(`${type === "document" ? "Document" : "File"} deleted successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error(`Failed to delete ${type}:`, err);
      // Clear the "Deleting..." message when an error occurs
      setSuccessMessage(null);
      // Set error state
      setError(err.message || `Failed to delete ${type}. Please try again.`);
    } finally {
      setConfirmDelete(null); // Close modal
    }
  };
  
  
  // Request Google permissions if needed
  // Replace the ensureGooglePermissions function in app/group/[groupName]/page.tsx
  const ensureGooglePermissions = async (): Promise<boolean> => {
    try {
      // Check if we have a valid token
      const hasValid = await hasValidGoogleToken();
      
      if (!hasValid) {
        // Request new permissions
        const tokenData = await requestGooglePermissions();
        if (!tokenData) {
          setError("You must grant Google Drive access to manage files.");
          return false;
        }
        return true;
      }
      
      return true;
    } catch (err) {
      console.error("Google auth error:", err);
      
      // Check for specific error types and provide helpful messages
      let errorMessage = "Google Drive authentication failed. Please try again.";
      
      if (err instanceof Error) {
        if (err.message.includes("popup")) {
          errorMessage = "Popup was blocked. Please allow popups for this site and try again.";
        } else if (err.message.includes("network")) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (err.message.includes("permission")) {
          errorMessage = "Permission denied. Please grant all required permissions to use this feature.";
        }
      }
      
      setError(errorMessage);
      return false;
    }
  };
  

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF3E9] flex flex-col items-center justify-center">
        <div className="text-2xl">Loading...</div>
      </main>
    );
  }

  if (error) {
    // For critical errors (group not found or loading failed),
    // we should still show the critical error page.
    const isCriticalError = error.includes("Group not found") || 
                            error.includes("Failed to load group data");
    
    if (isCriticalError) {
      return (
        <main className="min-h-screen bg-[#FAF3E9] flex flex-col items-center justify-center">
          <div className="text-2xl text-red-500">{error}</div>
          <Link href="/welcome" className="mt-4">
            <Button>Back to Groups</Button>
          </Link>
        </main>
      );
    }
    
    // For non-critical errors, we'll show them in the notifications area
    // and continue showing the group page - this is handled later in the component
  }

  if (!group || !group.id) {
    return (
      <main className="min-h-screen bg-[#FAF3E9] flex flex-col items-center justify-center">
        <div className="text-2xl text-gray-700">Group data is still loading...</div>
      </main>
    );
  }
  
  // Ensure resources exist with default empty arrays
  if (!group.resources) {
    group.resources = { documents: [], files: [] };
  }
  

  return (
    <ProtectedRoute>
    <main className="min-h-screen bg-[#FAF3E9] flex flex-col items-center p-8">
      {/* Top Navigation */}
      <div className="w-full max-w-6xl flex justify-between items-center">
        {/* Navigation Buttons */}
        <div className="flex items-center space-x-6">
          <Link href="/welcome" className="flex items-center space-x-2 text-black font-medium text-lg">
            <HomeIcon className="h-5 w-5" />
            <span>Home</span>
          </Link>
          <Link href={`/pomodoro?groupId=${group.id}&from=${encodeURIComponent(groupName)}`} className="flex items-center space-x-2 text-black font-medium text-lg">
            <TimerIcon className="h-5 w-5" />
            <span>Pomodoro</span>
          </Link>
        </div>

        {/* Overlapping User Avatars */}
        <div className="flex -space-x-2">
          {group && group.members && Object.keys(group.members)
            .filter(key => group.members[key])
            .map((userId) => {
              const userData = memberData[userId];
              const firstLetter = userData?.displayName?.charAt(0).toUpperCase() || userId.charAt(0).toUpperCase();
              const backgroundColor = userData ? (userId === user?.uid ? "#FFD1DC" : "#D0C3FF") : "#CCCCCC";
              
              return (
                <div
                  key={userId}
                  className="w-8 h-8 flex items-center justify-center text-black font-bold rounded-full border border-white group relative"
                  style={{ backgroundColor }}
                >
                  {firstLetter}
                  
                  {/* Tooltip that appears on hover */}
                  <div className="absolute hidden group-hover:block top-full mt-2 p-2 bg-white shadow-md rounded z-10 text-xs min-w-[150px]">
                    <p className="font-semibold">{userData?.displayName || 'Unknown User'}</p>
                    <p className="text-gray-600">{userData?.email || ''}</p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="w-full max-w-6xl mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="w-full max-w-6xl mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <div className="flex justify-between items-center">
            <div className="flex-1 mr-4">{error}</div>
            <div className="flex space-x-3">
              <Button 
                variant="outline"
                size="sm"
                className="border-red-500 text-red-500 hover:bg-red-50"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Group Title and Copyable ID */}
      <div className="max-w-6xl w-full mt-8">
        <div className="flex items-center">
          <h1 className="text-6xl font-bold text-[#3B2F2F]">{decodeURIComponent(groupName)}</h1>
          {group && (
            <span className="ml-4 text-xl text-[#79747e] flex items-center">
              #{getGroupInviteCode(group.id)}
              <button onClick={copyToClipboard} className="ml-2">
                {copied ? (
                  <CheckIcon className="h-5 w-5 text-green-500" />
                ) : (
                  <ClipboardIcon className="h-5 w-5 cursor-pointer" />
                )}
              </button>
            </span>
          )}
        </div>
        <div className="w-full h-[3px] bg-[#3B2F2F] mt-4"></div>
      </div>

      {/* Notes & File Uploads Section */}
      <div className="max-w-6xl w-full mt-10">
        {/* Notes Section */}
        <h2 className="text-3xl font-bold text-[#B78D75]">Notes</h2>
        
        {showCreateDocument ? (
          <div className="mt-4 bg-white p-4 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-2">Create New Document</h3>
            <input
              type="text"
              className="w-full p-2 border rounded mb-4"
              placeholder="Document Name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
            />
            <div className="flex space-x-2">
              <Button 
                onClick={handleCreateDocument}
                disabled={isCreatingDoc || !documentName.trim()}
                className="bg-[#924747]"
              >
                {isCreatingDoc ? 'Creating...' : 'Create Document'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setShowCreateDocument(false);
                  setDocumentName('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 mt-4 flex-wrap">
{/* Replace the existing document mapping code with this updated version */}
{/* Replace the existing document mapping code with this updated version */}
{group?.resources?.documents?.map((doc: any) => (
  <div 
    key={doc.id}
    className="relative w-[200px] h-[100px]"
  >
    <a 
      href={doc.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full h-full"
    >
      <Button className="w-full h-full flex flex-col items-center justify-center bg-[#924747] text-white rounded-xl shadow-md">
        <span className="text-lg font-semibold truncate text-ellipsis overflow-hidden whitespace-nowrap w-full text-center px-2">
          {doc.name}
        </span>
      </Button>
    </a>
    <div className="absolute top-1 right-1 flex space-x-1">
      {/* Only show the rename button if the current user is the creator */}
      {doc.createdBy === user?.uid && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            initiateRename(doc, 'document');
          }}
          className="w-5 h-5 text-sm text-white flex items-center justify-center hover:text-blue-300"
          title="Rename document"
        >
          <EditIcon className="w-4 h-4" />
        </button>
      )}
      {doc.createdBy === user?.uid && (
      <button
        onClick={() => setConfirmDelete({ type: 'document', id: doc.id })}
        className="w-5 h-5 text-sm text-white flex items-center justify-center hover:text-red-300"
        title="Delete document"
      >
        <XIcon className="w-5 h-5" />
      </button>
      )}
    </div>
  </div>
))}
            
            <Button 
              className="w-[200px] h-[100px] flex flex-col items-center justify-center bg-[#924747] text-white rounded-xl shadow-md"
              onClick={() => setShowCreateDocument(true)}
            >
              <PlusIcon className="h-6 w-6" />
            </Button>
          </div>
        )}

        {/* File Uploads Section */}
        <h2 className="text-3xl font-bold text-[#B78D75] mt-10">File Uploads</h2>
        <div className="flex gap-6 mt-4 flex-wrap">
          {/* Display existing files */}
          

{/* Replace the existing file mapping code with this updated version */}
{/* Replace the existing file mapping code with this updated version */}
{group?.resources?.files?.map((file: any) => (
  <div 
    key={file.id}
    className="relative w-[200px] h-[100px]"
  >
    <a 
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full h-full"
    >
      <Button className="w-full h-full flex flex-col items-center justify-center bg-[#924747] text-white rounded-xl shadow-md">
        <span className="text-lg font-semibold truncate text-ellipsis overflow-hidden whitespace-nowrap w-full text-center px-2">
          {file.name}
        </span>
      </Button>
    </a>
    <div className="absolute top-1 right-1 flex space-x-1">
      {/* Only show the rename button if the current user is the creator */}
      {file.createdBy === user?.uid && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            initiateRename(file, 'file');
          }}
          className="w-5 h-5 text-sm text-white flex items-center justify-center hover:text-blue-300"
          title="Rename file"
        >
          <EditIcon className="w-4 h-4" />
        </button>
      )}
      {file.createdBy === user?.uid && (
      <button
        onClick={() => setConfirmDelete({ type: 'file', id: file.id })}
        className="w-5 h-5 text-sm text-white flex items-center justify-center hover:text-red-300"
        title="Delete file"
      >
        <XIcon className="w-5 h-5" />
      </button>
      )}
    </div>
  </div>
))}

          
          <label className="w-[200px] h-[100px] cursor-pointer">
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
              disabled={isUploadingFile}
            />
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#924747] text-white rounded-xl shadow-md">
              {isUploadingFile ? (
                <span className="text-lg font-semibold">Uploading...</span>
              ) : (
                <>
                  <UploadIcon className="h-6 w-6" />
                  <span className="mt-1">Upload File</span>
                </>
              )}
            </div>
          </label>
        </div>
      </div>
      {confirmDelete && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full text-center">
      <h3 className="text-lg font-semibold mb-4">
        Confirm Deletion
      </h3>
      <p className="mb-6">
        Are you sure you want to delete this {confirmDelete.type}?
        This action will delete the resource permanently for everyone in the
        group and cannot be undone.
      </p>
      <div className="flex justify-center space-x-4">
        <Button 
          className="bg-red-600 text-white hover:bg-red-700"
          onClick={() => performDeleteResource(confirmDelete.type, confirmDelete.id)}
        >
          Delete
        </Button>
        <Button 
          variant="outline"
          onClick={() => setConfirmDelete(null)}
        >
          Cancel
        </Button>
      </div>
    </div>
  </div>
)}

{/* ADD THE ERROR TOAST COMPONENT HERE, just before the closing main tag */}
      {/* Error Toast with Back to Group option */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-white border border-red-300 rounded-lg shadow-lg p-4 max-w-md animate-in slide-in-from-right">
          <div className="flex flex-col">
            <div className="flex items-start mb-2">
              <div className="bg-red-100 p-2 rounded-full mr-3">
                <XIcon className="h-5 w-5 text-red-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Error</h3>
                <p className="text-sm text-gray-700 mt-1">{error}</p>
              </div>
              <button 
                onClick={() => setError(null)} 
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-end space-x-2 mt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setError(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add this Rename Modal at the bottom of the component, right before the closing main tag */}
    {showRenameModal && resourceToRename && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-sm w-full">
          <h3 className="text-lg font-semibold mb-4">
            Rename {resourceToRename.type === 'document' ? 'Document' : 'File'}
          </h3>
          <input
            type="text"
            className="w-full p-2 border rounded mb-4"
            placeholder="New name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={isRenaming}
          />
          <div className="flex justify-end space-x-3">
            <Button 
              variant="outline"
              onClick={() => {
                setShowRenameModal(false);
                setResourceToRename(null);
                setNewName("");
              }}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRename}
              disabled={isRenaming || !newName.trim() || newName === resourceToRename.name}
              className="bg-[#924747]"
            >
              {isRenaming ? 'Renaming...' : 'Rename'}
            </Button>
          </div>
        </div>
      </div>
    )}

    </main>
    </ProtectedRoute>
  );
}