export const MILESTONES_BASE: readonly number[] = [1, 7, 30, 60, 90, 180, 270]

export function isMilestone(days: number): boolean {
  return MILESTONES_BASE.includes(days) || (days >= 365 && days % 365 === 0)
}

export function milestonesUpTo(maxDays: number): number[] {
  const milestones = new Set(MILESTONES_BASE.filter((days) => days <= maxDays))

  for (let days = 365; days <= maxDays; days += 365) {
    milestones.add(days)
  }

  return [...milestones].sort((a, b) => a - b)
}

export function highestMilestoneAtOrBelow(days: number): number {
  return milestonesUpTo(days).at(-1) ?? 0
}

export function highestNewMilestone(currentDays: number, lastCelebrated: number): number | null {
  return milestonesUpTo(currentDays)
    .filter((days) => days > lastCelebrated)
    .at(-1) ?? null
}
