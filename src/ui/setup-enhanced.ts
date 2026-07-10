import type { AuthClient } from '../auth/client'

export interface RequestCodeOptions {
  maxRetries?: number
  timeout?: number
  onError?: (error: string, attempt?: number) => void
}

export interface SetupLogger {
  requestStart(email: string): void
  requestError(error: string, attempt: number): void
  retryScheduled(delayMs: number, retryNumber: number): void
  verifyStart(code: string): void
  verifyError(error: string, attempt: number): void
  verifySuccess(userId: string): void
}

/**
 * Request OTP code with timeout protection.
 * Returns immediately on error or success, whichever comes first.
 * Aborts if the request takes longer than timeoutMs.
 */
export async function requestCodeWithTimeout(
  client: AuthClient,
  email: string,
  timeoutMs: number,
  onError?: (error: string) => void,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    let timedOut = false
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        timedOut = true
        reject(new Error(`Request timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    const result = await Promise.race([
      client.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      }),
      timeoutPromise,
    ])

    const { error } = result as { data: unknown; error: Error | null }

    if (error !== null) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      onError?.(`Auth error: ${errorMsg}`)
      return { ok: false, error: errorMsg }
    }

    return { ok: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    onError?.(`Request failed: ${errorMsg}`)
    return { ok: false, error: errorMsg }
  }
}

/**
 * Request OTP code with retry logic and exponential backoff.
 * Retries up to maxRetries times with exponential backoff between attempts.
 */
export async function requestCodeWithRetry(
  client: AuthClient,
  email: string,
  options: { maxRetries?: number; timeout?: number; onError?: (error: string, attempt?: number) => void },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const maxRetries = options.maxRetries ?? 2
  const timeout = options.timeout ?? 10000
  const onError = options.onError
  let lastError = ''

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await requestCodeWithTimeout(client, email, timeout, onError)

    if (result.ok) {
      return result
    }

    lastError = result.error

    // Don't backoff after the last failed attempt
    if (attempt < maxRetries) {
      const backoffMs = Math.pow(2, attempt) * 100 // 100ms, 200ms, 400ms, etc.
      onError?.(`Retry in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`, attempt + 1)
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }

  return { ok: false, error: `Failed after ${maxRetries} retries: ${lastError}` }
}

/**
 * Create a structured logger for auth flow debugging.
 * Logs to console.log by default, or a custom function.
 */
export function createSetupLogger(onLog?: (msg: string) => void): SetupLogger {
  const log = onLog ?? console.log
  const prefix = '[HabitTracker Auth]'

  return {
    requestStart(email: string): void {
      log(`${prefix} Requesting OTP for ${email}`)
    },

    requestError(error: string, attempt: number): void {
      log(`${prefix} Request failed (attempt ${attempt}): ${error}`)
    },

    retryScheduled(delayMs: number, retryNumber: number): void {
      log(`${prefix} Scheduling retry ${retryNumber} in ${delayMs}ms`)
    },

    verifyStart(code: string): void {
      log(`${prefix} Verifying code: ${code.slice(0, 4)}****`)
    },

    verifyError(error: string, attempt: number): void {
      log(`${prefix} Code verification failed (attempt ${attempt}): ${error}`)
    },

    verifySuccess(userId: string): void {
      log(`${prefix} Authentication success for user ${userId}`)
    },
  }
}
