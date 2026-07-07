import { describe, expect, it } from 'vitest'
import {
  highestMilestoneAtOrBelow,
  highestNewMilestone,
  isMilestone,
  milestonesUpTo,
} from './milestones'

describe('milestones', () => {
  it('recognises base milestones and yearly multiples', () => {
    expect(isMilestone(1)).toBe(true)
    expect(isMilestone(7)).toBe(true)
    expect(isMilestone(30)).toBe(true)
    expect(isMilestone(365)).toBe(true)
    expect(isMilestone(730)).toBe(true)

    expect(isMilestone(2)).toBe(false)
    expect(isMilestone(400)).toBe(false)
    expect(isMilestone(366)).toBe(false)
  })

  it('returns sorted milestones up to the requested maximum', () => {
    expect(milestonesUpTo(100)).toEqual([1, 7, 30, 60, 90])
    expect(milestonesUpTo(370)).toEqual([1, 7, 30, 60, 90, 180, 270, 365])
  })

  it('returns the highest new milestone crossed since the last celebration', () => {
    expect(highestNewMilestone(7, 1)).toBe(7)
    expect(highestNewMilestone(90, 30)).toBe(90)
    expect(highestNewMilestone(5, 1)).toBeNull()
    expect(highestNewMilestone(100, 1)).toBe(90)
    expect(highestNewMilestone(0, 0)).toBeNull()
  })

  it('returns the highest milestone at or below a current streak', () => {
    expect(highestMilestoneAtOrBelow(400)).toBe(365)
    expect(highestMilestoneAtOrBelow(0)).toBe(0)
    expect(highestMilestoneAtOrBelow(200)).toBe(180)
  })
})
