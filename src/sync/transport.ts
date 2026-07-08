import type { HabitEvent } from '../domain/events'
import type { HabitConfig } from '../store/schema'

export interface SyncTransport {
  pushEvents(events: HabitEvent[]): Promise<{ ok: boolean; insertedIds: string[]; error?: string }>
  pullEvents(sinceCursor: string | null): Promise<{
    ok: boolean
    events: HabitEvent[]
    nextCursor: string | null
    error?: string
  }>
  pushConfig(config: HabitConfig[]): Promise<{ ok: boolean; error?: string }>
  pullConfig(): Promise<{ ok: boolean; config: HabitConfig[]; error?: string }>
}

interface QueryResult<TRow> {
  data: TRow[] | null
  error: { message?: string } | null
}

interface QueryBuilder<TRow> extends PromiseLike<QueryResult<TRow>> {
  select(columns?: string): QueryBuilder<TRow>
  gt(column: string, value: string): QueryBuilder<TRow>
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<TRow>
  upsert(values: unknown, options?: { onConflict?: string; ignoreDuplicates?: boolean }): QueryBuilder<TRow>
}

interface SupabaseLike {
  from<TRow = Record<string, unknown>>(table: string): QueryBuilder<TRow>
}

interface ConfigRow {
  habit: HabitConfig['habit']
  motivational_text: string
  updated_at: string
}

function errorMessage(error: { message?: string } | null): string | undefined {
  return error?.message ?? 'Sync request failed.'
}

function toConfigRow(config: HabitConfig): ConfigRow {
  return {
    habit: config.habit,
    motivational_text: config.motivationalText,
    updated_at: config.updatedAt,
  }
}

function fromConfigRow(row: ConfigRow): HabitConfig {
  return {
    habit: row.habit,
    motivationalText: row.motivational_text,
    updatedAt: row.updated_at,
  }
}

export function createSupabaseTransport(client: SupabaseLike): SyncTransport {
  return {
    async pushEvents(events) {
      if (events.length === 0) {
        return { ok: true, insertedIds: [] }
      }

      const { error } = await client
        .from<HabitEvent>('ht_events')
        .upsert(events, { onConflict: 'id', ignoreDuplicates: true })

      if (error !== null) {
        return { ok: false, insertedIds: [], error: errorMessage(error) }
      }

      return { ok: true, insertedIds: events.map((event) => event.id) }
    },

    async pullEvents(sinceCursor) {
      let query = client.from<HabitEvent>('ht_events').select('*').order('created_at', { ascending: true })

      if (sinceCursor !== null) {
        query = query.gt('created_at', sinceCursor)
      }

      const { data, error } = await query

      if (error !== null) {
        return { ok: false, events: [], nextCursor: sinceCursor, error: errorMessage(error) }
      }

      const events = data ?? []
      const nextCursor = events.reduce<string | null>(
        (cursor, event) => (event.created_at !== undefined && (cursor === null || event.created_at > cursor) ? event.created_at : cursor),
        sinceCursor,
      )

      return { ok: true, events, nextCursor }
    },

    async pushConfig(config) {
      if (config.length === 0) {
        return { ok: true }
      }

      const { error } = await client
        .from<ConfigRow>('ht_habit_config')
        .upsert(config.map(toConfigRow), { onConflict: 'user_id,habit' })

      if (error !== null) {
        return { ok: false, error: errorMessage(error) }
      }

      return { ok: true }
    },

    async pullConfig() {
      const { data, error } = await client.from<ConfigRow>('ht_habit_config').select('*')

      if (error !== null) {
        return { ok: false, config: [], error: errorMessage(error) }
      }

      return { ok: true, config: (data ?? []).map(fromConfigRow) }
    },
  }
}
