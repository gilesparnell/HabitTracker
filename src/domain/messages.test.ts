import { describe, expect, it } from 'vitest'
import {
  FRI_SAT_EVENING_TEXT,
  MADE_IT_THROUGH_TEXT,
  milestoneMessage,
  promptText,
  supportMessage,
} from './messages'

describe('supportMessage', () => {
  it('shows made-it-through for a clean Saturday check-in at any time', () => {
    expect(supportMessage(new Date(2026, 6, 4, 9, 0), '2026-07-04')).toEqual({
      kind: 'made-it-through',
      text: MADE_IT_THROUGH_TEXT,
    })
  })

  it('shows made-it-through for a clean Sunday check-in', () => {
    expect(supportMessage(new Date(2026, 6, 5, 10, 0), '2026-07-05')).toEqual({
      kind: 'made-it-through',
      text: MADE_IT_THROUGH_TEXT,
    })
  })

  it('does not show a made-it-through message for a clean weekday check-in outside Fri/Sat evening', () => {
    expect(supportMessage(new Date(2026, 6, 7, 20, 0), '2026-07-07')).toBeNull()
  })

  it('gives made-it-through precedence over fri-sat-evening on Saturday evening', () => {
    expect(supportMessage(new Date(2026, 6, 4, 20, 0), '2026-07-04')).toEqual({
      kind: 'made-it-through',
      text: MADE_IT_THROUGH_TEXT,
    })
  })

  it('shows fri-sat-evening on Friday evening without a clean weekend check-in', () => {
    expect(supportMessage(new Date(2026, 6, 3, 20, 0), null)).toEqual({
      kind: 'fri-sat-evening',
      text: FRI_SAT_EVENING_TEXT,
    })
  })

  it('returns null outside fri-sat-evening when there is no clean weekend check-in', () => {
    expect(supportMessage(new Date(2026, 6, 7, 20, 0), null)).toBeNull()
  })
})

describe('promptText', () => {
  it('uses the correct habit verb for a standard vape prompt', () => {
    expect(promptText('vape', 'standard')).toContain('vape')
  })

  it('uses the correct habit verb for a standard drink prompt', () => {
    expect(promptText('drink', 'standard')).toContain('drink')
  })

  it('uses whole-gap wording for catch-up prompts', () => {
    expect(promptText('vape', 'catchup')).toContain('stay clean the whole time')
  })

  it('returns an empty prompt when no check-in is due', () => {
    expect(promptText('drink', 'none')).toBe('')
  })
})

describe('milestoneMessage', () => {
  it('returns dignified copy containing the crossed milestone day count', () => {
    expect(milestoneMessage(30)).toContain('30')
  })
})
