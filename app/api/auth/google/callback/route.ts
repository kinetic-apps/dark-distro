import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    // Redirect to assets page with error
    return NextResponse.redirect(
      new URL('/assets?google_auth_error=' + error, request.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/assets?google_auth_error=no_code', request.url)
    )
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: `${request.nextUrl.origin}/api/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for tokens')
    }

    const tokens = await tokenResponse.json()

    // Create a response that redirects to assets page
    const response = NextResponse.redirect(
      new URL('/assets?google_auth_success=true', request.url)
    )

    // Set tokens as HTTP-only cookies for security
    response.cookies.set('google_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in
    })

    if (tokens.refresh_token) {
      response.cookies.set('google_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      })
    }

    // Also pass tokens to client for immediate use
    const url = new URL('/assets', request.url)
    url.searchParams.set('google_auth_success', 'true')
    url.searchParams.set('access_token', tokens.access_token)
    if (tokens.refresh_token) {
      url.searchParams.set('refresh_token', tokens.refresh_token)
    }
    url.searchParams.set('expires_in', tokens.expires_in)

    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    return NextResponse.redirect(
      new URL('/assets?google_auth_error=token_exchange_failed', request.url)
    )
  }
} 