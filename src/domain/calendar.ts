export function todayLocalISO(now?: Date): string {
  return localDateISO(now ?? new Date())
}

export function localDateISO(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((utcTimeForISO(toISO) - utcTimeForISO(fromISO)) / 86_400_000)
}

export function addDaysISO(iso: string, n: number): string {
  const date = new Date(utcTimeForISO(iso) + n * 86_400_000)

  return formatUTCDateISO(date)
}

export function isFriSatEvening(now?: Date): boolean {
  const date = now ?? new Date()
  const day = date.getDay()
  const hour = date.getHours()

  return (day === 5 || day === 6) && hour >= 18 && hour <= 23
}

export function isWeekendDateISO(iso: string): boolean {
  const day = new Date(utcTimeForISO(iso)).getUTCDay()

  return day === 0 || day === 6
}

export function clampFutureISO(iso: string, todayISO: string): string {
  return iso > todayISO ? todayISO : iso
}

function utcTimeForISO(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)

  return Date.UTC(year, month - 1, day)
}

function formatUTCDateISO(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
