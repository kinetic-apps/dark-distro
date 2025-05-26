import { createClient } from '@/lib/supabase/client'

interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

interface GoogleUserInfo {
  id: string
  email: string
  name: string
  picture: string
}

export class GoogleAuthService {
  private static instance: GoogleAuthService
  private clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!
  private redirectUri = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/auth/google/callback`
    : ''
  
  // Scopes needed for Google Drive and user profile
  private scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ]

  private constructor() {}

  static getInstance(): GoogleAuthService {
    if (!GoogleAuthService.instance) {
      GoogleAuthService.instance = new GoogleAuthService()
    }
    return GoogleAuthService.instance
  }

  // Generate OAuth URL for authentication
  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent'
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  // Store tokens in localStorage
  async storeTokens(tokens: GoogleTokens): Promise<void> {
    if (typeof window === 'undefined') return
    
    localStorage.setItem('google_access_token', tokens.access_token)
    if (tokens.refresh_token) {
      localStorage.setItem('google_refresh_token', tokens.refresh_token)
    }
    
    // Store expiry time
    const expiryTime = Date.now() + (tokens.expires_in * 1000)
    localStorage.setItem('google_token_expiry', expiryTime.toString())
  }

  // Get stored access token
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null
    
    const token = localStorage.getItem('google_access_token')
    const expiry = localStorage.getItem('google_token_expiry')
    
    if (!token || !expiry) return null
    
    // Check if token is expired
    if (Date.now() > parseInt(expiry)) {
      // Token expired, try to refresh
      this.refreshAccessToken()
      return null
    }
    
    return token
  }

  // Refresh access token using refresh token
  async refreshAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null
    
    const refreshToken = localStorage.getItem('google_refresh_token')
    if (!refreshToken) return null

    try {
      const response = await fetch('/api/auth/google/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (!response.ok) throw new Error('Failed to refresh token')

      const tokens = await response.json()
      await this.storeTokens(tokens)
      
      return tokens.access_token
    } catch (error) {
      console.error('Error refreshing token:', error)
      this.clearTokens()
      return null
    }
  }

  // Get user info
  async getUserInfo(): Promise<GoogleUserInfo | null> {
    const token = this.getAccessToken()
    if (!token) return null

    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) throw new Error('Failed to fetch user info')

      return await response.json()
    } catch (error) {
      console.error('Error fetching user info:', error)
      return null
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getAccessToken()
  }

  // Clear all tokens (logout)
  clearTokens(): void {
    if (typeof window === 'undefined') return
    
    localStorage.removeItem('google_access_token')
    localStorage.removeItem('google_refresh_token')
    localStorage.removeItem('google_token_expiry')
  }

  // Sign out
  signOut(): void {
    this.clearTokens()
  }
} 