import { describe, expect, it } from 'vitest'
import type { StoredSession } from '../store/schema'
import type { AuthClient } from './client'
import { requestCode, restoreSession, verifyCode } from './otp'

interface FakeSession {
  access_token: string
  refresh_token: string
  expires_at?: number | null
  user: {
    id: string
    email?: string | null
  }
}

type FakeResult<T> = Promise<{ data: T; error: Error | null }>

class FakeAuthClient implements AuthClient {
  signInArgs: unknown[] = []
  verifyArgs: unknown[] = []
  setSessionArgs: unknown[] = []

  signInResult: FakeResult<unknown> = Promise.resolve({ data: {}, error: null })
  verifyResult: FakeResult<{ session: FakeSession | null }> = Promise.resolve({ data: { session: null }, error: null })
  setSessionResult: FakeResult<{ session: FakeSession | null }> = Promise.resolve({ data: { session: null }, error: null })

  async signInWithOtp(params: unknown): FakeResult<unknown> {
    this.signInArgs.push(params)
    return this.signInResult
  }

  async verifyOtp(params: unknown): FakeResult<{ session: FakeSession | null }> {
    this.verifyArgs.push(params)
    return this.verifyResult
  }

  async setSession(params: unknown): FakeResult<{ session: FakeSession | null }> {
    this.setSessionArgs.push(params)
    return this.setSessionResult
  }
}

function session(overrides: Partial<FakeSession> = {}): FakeSession {
  return {
    access_token: 'access-new',
    refresh_token: 'refresh-new',
    expires_at: 1_783_459_600,
    user: {
      id: 'user-1',
      email: 'giles@example.com',
    },
    ...overrides,
  }
}

const storedSession: StoredSession = {
  accessToken: 'access-old',
  refreshToken: 'refresh-old',
  expiresAt: 1_783_456_000,
  userId: 'user-1',
  email: 'giles@example.com',
}

describe('requestCode', () => {
  it('requests an email OTP with account creation enabled', async () => {
    const client = new FakeAuthClient()

    await expect(requestCode(client, 'giles@example.com')).resolves.toEqual({ ok: true })

    expect(client.signInArgs).toEqual([
      {
        email: 'giles@example.com',
        options: { shouldCreateUser: true },
      },
    ])
  })

  it('surfaces sign-in failures without throwing', async () => {
    const client = new FakeAuthClient()
    client.signInResult = Promise.resolve({ data: {}, error: new Error('Email rate limit exceeded') })

    await expect(requestCode(client, 'giles@example.com')).resolves.toEqual({
      ok: false,
      error: 'Email rate limit exceeded',
    })
  })
})

describe('verifyCode', () => {
  it('verifies an email token and maps the Supabase session into StoredSession exactly', async () => {
    const client = new FakeAuthClient()
    client.verifyResult = Promise.resolve({ data: { session: session() }, error: null })

    await expect(verifyCode(client, 'giles@example.com', '123456')).resolves.toEqual({
      ok: true,
      session: {
        accessToken: 'access-new',
        refreshToken: 'refresh-new',
        expiresAt: 1_783_459_600,
        userId: 'user-1',
        email: 'giles@example.com',
      },
    })

    expect(client.verifyArgs).toEqual([
      {
        email: 'giles@example.com',
        token: '123456',
        type: 'email',
      },
    ])
  })

  it('surfaces wrong-code failures without throwing', async () => {
    const client = new FakeAuthClient()
    client.verifyResult = Promise.resolve({ data: { session: null }, error: new Error('Token has expired or is invalid') })

    await expect(verifyCode(client, 'giles@example.com', '000000')).resolves.toEqual({
      ok: false,
      error: 'Token has expired or is invalid',
    })
  })

  it('treats success without a session as a failure', async () => {
    const client = new FakeAuthClient()
    client.verifyResult = Promise.resolve({ data: { session: null }, error: null })

    await expect(verifyCode(client, 'giles@example.com', '123456')).resolves.toEqual({
      ok: false,
      error: 'Authentication did not return a session.',
    })
  })
})

describe('restoreSession', () => {
  it('restores stored tokens and returns the refreshed StoredSession', async () => {
    const client = new FakeAuthClient()
    client.setSessionResult = Promise.resolve({
      data: {
        session: session({
          access_token: 'access-refreshed',
          refresh_token: 'refresh-refreshed',
          expires_at: 1_783_999_600,
        }),
      },
      error: null,
    })

    await expect(restoreSession(client, storedSession)).resolves.toEqual({
      ok: true,
      session: {
        accessToken: 'access-refreshed',
        refreshToken: 'refresh-refreshed',
        expiresAt: 1_783_999_600,
        userId: 'user-1',
        email: 'giles@example.com',
      },
    })

    expect(client.setSessionArgs).toEqual([
      {
        access_token: 'access-old',
        refresh_token: 'refresh-old',
      },
    ])
  })

  it('returns reauth-required without throwing when restore fails', async () => {
    const client = new FakeAuthClient()
    client.setSessionResult = Promise.resolve({ data: { session: null }, error: new Error('Refresh token expired') })

    await expect(restoreSession(client, storedSession)).resolves.toEqual({
      ok: false,
      reason: 'reauth-required',
    })
  })

  it('returns reauth-required without throwing when the client throws', async () => {
    const client = new FakeAuthClient()
    client.setSession = async () => {
      throw new Error('Network unavailable')
    }

    await expect(restoreSession(client, storedSession)).resolves.toEqual({
      ok: false,
      reason: 'reauth-required',
    })
  })
})
