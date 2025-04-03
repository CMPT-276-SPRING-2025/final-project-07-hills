// app/api/delete-drive-file/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function POST(req: NextRequest) {
  try {
    const { fileId, accessToken } = await req.json();

    if (!fileId || !accessToken) {
      return NextResponse.json({ error: 'Missing fileId or accessToken' }, { status: 400 });
    }

    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth: authClient });
    await drive.files.delete({ fileId });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete file from Drive:', error);
    console.error("FULL ERROR OBJECT:", error);
    
    // Check for permission errors
    if (error.code === 403 || 
        (error.response?.status === 403) || 
        (error.message && (
          error.message.includes("permission") || 
          error.message.includes("Permission") ||
          error.message.includes("access") ||
          error.message.includes("Access")
        ))
    ) {
      return NextResponse.json({ 
        success: false, 
        error: 'You don\'t have permission to delete this resource',
        permissionError: true 
      }, { status: 403 });
    }
    
    // Check for file not found errors
    if (error.code === 404 || 
        (error.response?.status === 404) || 
        (error.message && error.message.includes("not found"))
    ) {
      return NextResponse.json({ 
        success: false, 
        error: 'Resource not found or already deleted',
        notFoundError: true 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Unknown error' 
    }, { status: 500 });
  }
}