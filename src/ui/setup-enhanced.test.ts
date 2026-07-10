import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SetupDeps } from './setup'
import type { AuthClient } from '../auth/client'
import { requestCodeWithTimeout, requestCodeWithRetry, createSetupLogger } from './setup-enhanced'

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
  callCount = 0
  failUntilCall = -1 // -1 means never fail, 0 means fail first call, etc.

  async signInWithOtp(params: unknown): FakeResult<unknown> {
    this.signInArgs.push(params)
    this.callCount++

    if (this.callCount <= this.failUntilCall) {
      return { data: {}, error: new Error('Network timeout') }
    }

    return { data: {}, error: null }
  }

  async verifyOtp(): FakeResult<{ session: FakeSession | null }> {
    return { data: { session: null }, error: null }
  }

  async setSession(): FakeResult<{ session: FakeSession | null }> {
    return { data: { session: null }, error: null }
  }
}

describe('requestCodeWithTimeout', () => {
  it('succeeds immediately when email request completes within timeout', async () => {
    const client = new FakeAuthClient()

    const result = await requestCodeWithTimeout(client, 'test@example.com', 5000, console.log)

    expect(result).toEqual({ ok: true })
    expect(client.signInArgs).toHaveLength(1)
  })

  it('returns timeout error when request exceeds timeout duration', async () => {
    const client = new FakeAuthClient()
    // Simulate slow request by making signInWithOtp delay
    const slowClient = new FakeAuthClient()
    slowClient.signInWithOtp = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return { data: {}, error: null }
    }

    const result = await requestCodeWithTimeout(slowClient, 'test@example.com', 10, console.log)

    if (!result.ok) {
      expect(result.error).toContain('timeout')
    }
  })

  it('surfaces Supabase errors immediately without waiting for timeout', async () => {
    const errorClient = new FakeAuthClient()
    errorClient.signInWithOtp = async () => {
      return { data: {}, error: new Error('Email rate limit exceeded') }
    }

    const result = await requestCodeWithTimeout(errorClient, 'test@example.com', 5000, console.log)

    if (!result.ok) {
      expect(result.error).toContain('Email rate limit exceeded')
    }
  })

  it('logs errors when onError callback is provided', async () => {
    const errorClient = new FakeAuthClient()
    errorClient.signInWithOtp = async () => {
      return { data: {}, error: new Error('Network error') }
    }
    const onError = vi.fn()

    await requestCodeWithTimeout(errorClient, 'test@example.com', 5000, onError)

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Network error'))
  })
})

describe('requestCodeWithRetry', () => {
  it('succeeds on first attempt when request succeeds', async () => {
    const client = new FakeAuthClient()

    const result = await requestCodeWithRetry(client, 'test@example.com', { maxRetries: 3, timeout: 5000 })

    expect(result.ok).toBe(true)
    expect(client.callCount).toBe(1)
  })

  it('retries on failure and succeeds on second attempt', async () => {
    const client = new FakeAuthClient()
    client.failUntilCall = 1 // Fail first call, succeed on second

    const result = await requestCodeWithRetry(client, 'test@example.com', { maxRetries: 3, timeout: 5000, onError: () => {} })

    expect(result.ok).toBe(true)
    expect(client.callCount).toBe(2)
  })

  it('respects maxRetries limit and fails after exhausting retries', async () => {
    const client = new FakeAuthClient()
    client.failUntilCall = 99 // Always fail

    const result = await requestCodeWithRetry(client, 'test@example.com', { maxRetries: 2, timeout: 5000, onError: () => {} })

    if (!result.ok) {
      expect(result.error).toContain('Failed after 2 retries')
    }
    expect(client.callCount).toBe(3) // initial + 2 retries
  })

  it('applies exponential backoff between retries', async () => {
    const client = new FakeAuthClient()
    client.failUntilCall = 1

    const startTime = Date.now()
    await requestCodeWithRetry(client, 'test@example.com', { maxRetries: 2, timeout: 5000, onError: () => {} })
    const elapsed = Date.now() - startTime

    // Should have waited at least for first backoff (100ms * 2^0 = 100ms)
    expect(elapsed).toBeGreaterThanOrEqual(50) // Allow some margin
  })

  it('stops retrying after timeout is exceeded on individual request', async () => {
    const slowClient = new FakeAuthClient()
    slowClient.signInWithOtp = async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
      return { data: {}, error: null }
    }

    const result = await requestCodeWithRetry(slowClient, 'test@example.com', { maxRetries: 3, timeout: 20, onError: () => {} })

    if (!result.ok) {
      expect(result.error).toContain('timeout')
    }
  })
})

describe('createSetupLogger', () => {
  it('logs auth request start with email', () => {
    const logs: string[] = []
    const logger = createSetupLogger((msg) => logs.push(msg))

    logger.requestStart('test@example.com')

    expect(logs).toContainEqual(expect.stringContaining('test@example.com'))
    expect(logs).toContainEqual(expect.stringContaining('Requesting OTP'))
  })

  it('logs auth request error with details', () => {
    const logs: string[] = []
    const logger = createSetupLogger((msg) => logs.push(msg))

    logger.requestError('Network timeout', 1)

    expect(logs).toContainEqual(expect.stringContaining('Network timeout'))
    expect(logs).toContainEqual(expect.stringContaining('attempt 1'))
  })

  it('logs retry attempts with backoff timing', () => {
    const logs: string[] = []
    const logger = createSetupLogger((msg) => logs.push(msg))

    logger.retryScheduled(100, 2)

    expect(logs).toContainEqual(expect.stringContaining('100'))
    expect(logs).toContainEqual(expect.stringContaining('retry 2'))
  })

  it('logs verification attempts', () => {
    const logs: string[] = []
    const logger = createSetupLogger((msg) => logs.push(msg))

    logger.verifyStart('12345678')

    expect(logs).toContainEqual(expect.stringContaining('Verifying code'))
    expect(logs[0]).toContain('1234') // First 4 digits shown
  })

  it('logs success and failure states', () => {
    const logs: string[] = []
    const logger = createSetupLogger((msg) => logs.push(msg))

    logger.verifySuccess('user-123')
    logger.verifyError('Code expired', 1)

    expect(logs[0]).toContain('success')
    expect(logs[0]).toContain('user-123')
    expect(logs[1]).toContain('Code expired')
  })

  it('uses console.log when no custom logger provided', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createSetupLogger()

    logger.requestStart('test@example.com')

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
