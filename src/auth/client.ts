import { createClient } from '@supabase/supabase-js'

declare global {
  interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

export interface AuthSession {
  access_token: string
  refresh_token: string
  expires_at?: number | null
  user: {
    id: string
    email?: string | null
  }
}

export interface AuthResult<TData> {
  data: TData
  error: Error | null
}

export interface AuthClient {
  signInWithOtp(params: {
    email: string
    options: {
      shouldCreateUser: boolean
    }
  }): Promise<AuthResult<unknown>>

  verifyOtp(params: {
    email: string
    token: string
    type: 'email'
  }): Promise<AuthResult<{ session: AuthSession | null }>>

  setSession(params: {
    access_token: string
    refresh_token: string
  }): Promise<AuthResult<{ session: AuthSession | null }>>
}

export function createSupabase(): AuthClient {
  return createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: false,
    },
  }).auth
}
