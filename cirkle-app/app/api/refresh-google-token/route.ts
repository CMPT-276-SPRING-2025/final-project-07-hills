// app/api/refresh-google-token/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      return NextResponse.json({ error: 'Missing refresh token' }, { status: 400 });
    }

    const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Exchange refresh token for a new access token
    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Failed to refresh token', 
        details: data 
      }, { status: response.status });
    }

    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
      // Google only returns a new refresh token if the previous one is invalid
      refresh_token: data.refresh_token || null
    });
  } catch (error: any) {
    console.error('Error refreshing Google token:', error);
    return NextResponse.json({ 
      error: 'Token refresh failed', 
      message: error.message 
    }, { status: 500 });
  }
}