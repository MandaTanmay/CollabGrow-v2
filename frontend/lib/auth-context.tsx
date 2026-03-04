"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

/**
 * JWT-based authentication using HTTP-only cookies
 * Access tokens (15 min) and refresh tokens (7 days) stored securely
 * 
 * Key features:
 * - Tokens are stored in HTTP-only cookies (immune to XSS)
 * - Automatic token refresh for seamless UX
 * - Multi-device support with refresh token per device
 * - Secure logout invalidates refresh tokens
 */

interface User {
  id: string
  email: string
  firebaseUid?: string
  uid?: string  // Backwards-compatible alias for firebaseUid
  fullName?: string
  username?: string
  profileImage?: string
  bio?: string
  university?: string
  major?: string
  location?: string
  github_username?: string
  linkedin_url?: string
  portfolio_url?: string
  skills?: string[]
  created_at?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (firebaseUid: string, email: string, fullName?: string, username?: string, profileImage?: string) => Promise<User>
  logout: () => Promise<void>
  refreshAuth: () => Promise<User | null>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => { throw new Error("AuthContext not initialized") },
  logout: async () => { throw new Error("AuthContext not initialized") },
  refreshAuth: async () => null,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

  /**
   * Check if user has valid JWT and fetch current user data
   * With automatic token refresh in fetchWithAuth, this will:
   * 1. Try to fetch user data with current access token
   * 2. If access token expired (401), automatically refresh and retry
   * 3. Only fail if refresh token is also invalid/expired
   */
  const refreshAuth = useCallback(async (): Promise<User | null> => {
    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        method: 'GET',
        credentials: 'include', // Include HTTP-only cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        
        // Backend wraps response in { success, message, data } structure
        const data = result.data || result
        
        // Validate we have minimum required data
        if (!data.id || !data.firebaseUid) {
          console.error("[Auth] Invalid user data received from server:", data)
          setUser(null)
          return null
        }
        
        const userData: User = {
          id: data.id,
          email: data.email,
          firebaseUid: data.firebaseUid,
          // Backwards-compatible alias: many components expect `user.uid`
          // so set `@ts-ignore` style alias by adding uid field dynamically.
          // (Type casts are avoided here for simplicity.)
          // @ts-ignore
          uid: data.firebaseUid,
          fullName: data.fullName,
          username: data.username,
          profileImage: data.profileImage,
          bio: data.bio,
          university: data.university,
          major: data.major,
          location: data.location,
          github_username: data.github_username,
          linkedin_url: data.linkedin_url,
          portfolio_url: data.portfolio_url,
          skills: data.skills,
          created_at: data.created_at,
        }
        setUser(userData)
        console.log("[Auth] ✅ User authenticated:", userData.username)
        return userData
      } else if (response.status === 401) {
        // JWT expired or invalid - try to refresh the token
        console.log("[Auth] Access token invalid/expired, attempting refresh...")
        
        const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        if (refreshResponse.ok) {
          console.log("[Auth] ✅ Token refreshed, retrying auth check...")
          // Retry getting user data with new access token
          const retryResponse = await fetch(`${API_URL}/api/auth/me`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          })
          
          if (retryResponse.ok) {
            const result = await retryResponse.json()
            const data = result.data || result
            
            if (!data.id || !data.firebaseUid) {
              console.error("[Auth] Invalid user data after refresh:", data)
              setUser(null)
              return null
            }
            
            const userData: User = {
              id: data.id,
              email: data.email,
              firebaseUid: data.firebaseUid,
              // @ts-ignore
              uid: data.firebaseUid,
              fullName: data.fullName,
              username: data.username,
              profileImage: data.profileImage,
              bio: data.bio,
              university: data.university,
              major: data.major,
              location: data.location,
              github_username: data.github_username,
              linkedin_url: data.linkedin_url,
              portfolio_url: data.portfolio_url,
              skills: data.skills,
              created_at: data.created_at,
            }
            setUser(userData)
            console.log("[Auth] ✅ User re-authenticated after token refresh:", userData.username)
            return userData
          } else {
            console.error("[Auth] ❌ Failed to get user data after token refresh")
            setUser(null)
            return null
          }
        } else {
          console.log("[Auth] ❌ Token refresh failed - user needs to re-login")
          setUser(null)
          return null
        }
      } else {
        // Other error
        console.error(`[Auth] Authentication check failed with status ${response.status}`)
        setUser(null)
        return null
      }
    } catch (error) {
      console.error("[Auth] Failed to refresh authentication:", error)
      setUser(null)
      return null
    }
  }, [API_URL])

  /**
   * Login with Firebase credentials
   * This creates JWT tokens and sets HTTP-only cookies
   */
  const login = useCallback(
    async (
      firebaseUid: string,
      email: string,
      fullName?: string,
      username?: string,
      profileImage?: string
    ): Promise<User> => {
      try {
        // Validate inputs
        if (!firebaseUid || !email) {
          throw new Error("Firebase UID and email are required")
        }

        const response = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          credentials: 'include', // Include HTTP-only cookies
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firebaseUid,
            email,
            fullName: fullName || email.split('@')[0],
            username: username || email.split('@')[0],
            profileImage: profileImage || null,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Login failed' }))
          
          // Handle rate limiting with retry information
          if (response.status === 429 && errorData.retryAfter) {
            const waitMinutes = Math.ceil(errorData.retryAfter / 60)
            const errorMsg = `${errorData.error || 'Too many requests'}. Please wait ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''} before trying again.`
            console.error("Rate limit exceeded:", errorMsg)
            throw new Error(errorMsg)
          }
          
          // Log specific error message
          const errorMsg = errorData.error || errorData.message || 'Login failed'
          console.error("Login failed:", errorMsg, response.status)
          throw new Error(errorMsg)
        }

        const result = await response.json()
        
        // Backend wraps response in { success, message, data } structure
        // and login data has { message, user } inside data
        const data = result.data || result
        
        // Validate response data
        if (!data.user || !data.user.id || !data.user.firebaseUid) {
          console.error("Invalid user data received:", data)
          throw new Error("Invalid user data received from server")
        }
        
        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          firebaseUid: data.user.firebaseUid,
          // Backwards-compatible alias for Firebase client uid
          // @ts-ignore
          uid: data.user.firebaseUid,
          fullName: data.user.fullName,
          username: data.user.username,
          profileImage: data.user.profileImage,
          bio: data.user.bio,
          university: data.user.university,
          major: data.user.major,
          location: data.user.location,
          github_username: data.user.github_username,
          linkedin_url: data.user.linkedin_url,
          portfolio_url: data.user.portfolio_url,
          skills: data.user.skills,
          created_at: data.user.created_at,
        }
        setUser(userData)
        console.log("✅ Login successful, user:", userData.username)
        return userData
      } catch (error: any) {
        console.error("Login failed:", error?.message || error)
        throw error
      }
    },
    [API_URL]
  )

  /**
   * Logout - invalidates JWT refresh token
   * Only affects the current device
   */
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Include HTTP-only cookies
        headers: {
          'Content-Type': 'application/json',
        },
      })
      setUser(null)
    } catch (error) {
      console.error("Logout failed:", error)
      // Clear local state even if server logout fails
      setUser(null)
    }
  }, [API_URL])

  /**
   * Check authentication on mount and set up periodic refresh
   */
  useEffect(() => {
    const checkAuth = async () => {
      await refreshAuth()
      setLoading(false)
    }

    checkAuth()

    // Periodically refresh authentication (every 12 minutes)
    // This helps detect if tokens were invalidated on the server
    // Access tokens last 15 minutes, so checking every 12 minutes ensures
    // we refresh before expiration (with automatic token refresh in fetchWithAuth)
    const interval = setInterval(() => {
      refreshAuth()
    }, 12 * 60 * 1000)

    return () => clearInterval(interval)
  }, [refreshAuth])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}

