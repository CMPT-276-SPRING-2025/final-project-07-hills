// app/api/rename-drive-file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { updateGroupResourceName } from '@/services/groupService';

export async function POST(req: NextRequest) {
  try {
    const { fileId, newName, accessToken, groupId, resourceType } = await req.json();

    if (!fileId || !newName || !accessToken || !groupId || !resourceType) {
      return NextResponse.json({ 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    // Set up auth client with token
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: authClient });
    
    try {
      // First, check if we have permission to modify this file
      const file = await drive.files.get({
        fileId,
        fields: 'capabilities'
      });
      
      const canEdit = file.data.capabilities?.canEdit || false;
      
      if (!canEdit) {
        return NextResponse.json({ 
          success: false, 
          error: 'You don\'t have permission to edit this file. Only the creator or users with edit access can rename it.',
          permissionError: true 
        }, { status: 403 });
      }
      
      // If we have permission, proceed with rename
      await drive.files.update({
        fileId,
        requestBody: {
          name: newName
        }
      });
    } catch (driveError: any) {
      // Handle Google Drive API errors
      if (driveError.code === 403 || (driveError.response?.status === 403)) {
        return NextResponse.json({ 
          success: false, 
          error: 'You don\'t have permission to rename this file',
          permissionError: true 
        }, { status: 403 });
      }
      
      if (driveError.code === 404 || (driveError.response?.status === 404)) {
        return NextResponse.json({ 
          success: false, 
          error: 'File not found or already deleted',
          notFoundError: true 
        }, { status: 404 });
      }
      
      throw driveError; // Re-throw for the outer catch
    }

    // Update the name in Firestore
    await updateGroupResourceName(groupId, fileId, resourceType as 'documents' | 'files', newName);

    return NextResponse.json({ 
      success: true,
      message: `Successfully renamed to "${newName}"`
    });
  } catch (error: any) {
    console.error('Failed to rename file in Drive:', error);
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}