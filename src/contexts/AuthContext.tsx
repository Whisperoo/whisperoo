import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database.types'

type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  signUp: (email: string, password: string, firstName: string) => Promise<{ user: User | null; error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })

        // If profile doesn't exist, log it clearly
        if (error.code === 'PGRST116') {
          console.error('Profile does not exist for user:', userId)
        }
        setProfile(null)
        return null
      }

      console.log('Profile fetched successfully:', data)
      setProfile(data)
      return data
    } catch (error) {
      console.error('Exception in fetchProfile:', error)
      setProfile(null)
      return null
    }
  }, [])

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    console.log('Setting up auth listener...')

    // Get initial session with better error handling
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('Initial session:', !!session)
      if (error) {
        console.error('Error getting initial session:', error)
      }
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          setLoading(false)
        })
      } else {
        setLoading(false)
      }
    }).catch((error) => {
      console.error('Failed to get initial session:', error)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`Auth state changed: ${event}`)
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user) {
        // Small delay to ensure database trigger has completed
        setTimeout(() => {
          fetchProfile(session.user.id)
        }, 100)
      } else {
        setProfile(null)
      }

      // Only set loading to false after profile fetch for sign-in events
      if (event !== 'SIGNED_IN' || !session?.user) {
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signUp = async (email: string, password: string, firstName: string) => {
    try {
      console.log('Signing up user:', email)
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
          },
        },
      })

      if (error) {
        console.error('Signup error:', error)
        return { user: null, error }
      }

      console.log('Signup successful:', data.user?.id)
      
      // Immediately fetch the profile after successful signup
      if (data.user) {
        console.log('Fetching profile after signup...')
        // Give the database trigger a moment to create the profile
        await new Promise(resolve => setTimeout(resolve, 200))
        const profile = await fetchProfile(data.user.id)
        if (!profile) {
          console.error('Profile not found after signup, retrying...')
          // Retry once more after a short delay
          await new Promise(resolve => setTimeout(resolve, 500))
          await fetchProfile(data.user.id)
        }
      }
      
      return { user: data.user, error: null }
    } catch (error) {
      console.error('Signup exception:', error)
      return { user: null, error: error as AuthError }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Signing in user:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Signin error:', error)
        return { user: null, error }
      }

      console.log('Signin successful:', data.user?.id)
      return { user: data.user, error: null }
    } catch (error) {
      console.error('Signin exception:', error)
      return { user: null, error: error as AuthError }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (!error) {
        setUser(null)
        setProfile(null)
        setSession(null)
      }
      return { error }
    } catch (error) {
      return { error: error as AuthError }
    }
  }

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('No user logged in') }
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (error) {
        return { error: new Error(error.message) }
      }

      // Refresh profile data
      await fetchProfile(user.id)
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }, [user, fetchProfile])

  const value = {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}