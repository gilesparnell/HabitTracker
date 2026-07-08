import type { StoredSession } from '../store/schema'
import type { AuthClient, AuthSession } from './client'

export type AuthOk = { ok: true }
export type AuthFailure = { ok: false; error: string }
export type SessionOk = { ok: true; session: StoredSession }
export type RestoreFailure = { ok: false; reason: 'reauth-required' }

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message
  }

  if (typeof error === 'string' && error.length > 0) {
    return error
  }

  return fallback
}

function toStoredSession(session: AuthSession | null): StoredSession | null {
  if (session === null) {
    return null
  }

  if (session.access_token.length === 0 || session.refresh_token.length === 0 || session.user.id.length === 0) {
    return null
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    userId: session.user.id,
    email: session.user.email ?? null,
  }
}

export async function requestCode(client: AuthClient, email: string): Promise<AuthOk | AuthFailure> {
  try {
    const { error } = await client.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    })

    if (error !== null) {
      return { ok: false, error: errorMessage(error, 'Could not send sign-in code.') }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Could not send sign-in code.') }
  }
}

export async function verifyCode(client: AuthClient, email: string, token: string): Promise<SessionOk | AuthFailure> {
  try {
    const { data, error } = await client.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error !== null) {
      return { ok: false, error: errorMessage(error, 'Could not verify sign-in code.') }
    }

    const session = toStoredSession(data.session)

    if (session === null) {
      return { ok: false, error: 'Authentication did not return a session.' }
    }

    return { ok: true, session }
  } catch (error) {
    return { ok: false, error: errorMessage(error, 'Could not verify sign-in code.') }
  }
}

export async function restoreSession(client: AuthClient, stored: StoredSession): Promise<SessionOk | RestoreFailure> {
  try {
    const { data, error } = await client.setSession({
      access_token: stored.accessToken,
      refresh_token: stored.refreshToken,
    })

    if (error !== null) {
      return { ok: false, reason: 'reauth-required' }
    }

    const session = toStoredSession(data.session)

    if (session === null) {
      return { ok: false, reason: 'reauth-required' }
    }

    return { ok: true, session }
  } catch {
    return { ok: false, reason: 'reauth-required' }
  }
}
