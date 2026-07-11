import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../version', () => ({ versionLabel: () => 'v0.0.0 (test0000)' }))

import { emptyData, type AppData } from '../store/schema'
import { openSettingsSheet, type SettingsCallbacks } from './settings'

function createRoot(): HTMLElement {
  const root = document.createElement('div')
  document.body.replaceChildren(root)

  return root
}

function createCallbacks(): SettingsCallbacks {
  return {
    onData: vi.fn(),
    onImport: vi.fn(),
    onReauth: vi.fn(),
  }
}

function checkInInput(root: HTMLElement, habit: string): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>(`[data-checkin-time="${habit}"]`)
  expect(input).not.toBeNull()

  return input as HTMLInputElement
}

function saveCheckInButton(root: HTMLElement, habit: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`[data-save-checkin-time="${habit}"]`)
  expect(button).not.toBeNull()

  return button as HTMLButtonElement
}

describe('openSettingsSheet check-in time settings', () => {
  let root: HTMLElement
  let callbacks: SettingsCallbacks

  beforeEach(() => {
    root = createRoot()
    callbacks = createCallbacks()
  })

  it('renders a default check-in time input for each habit when no config exists', () => {
    openSettingsSheet(root, emptyData(), callbacks)

    expect(checkInInput(root, 'vape').value).toBe('07:00')
    expect(checkInInput(root, 'drink').value).toBe('07:00')
  })

  it('renders the stored check-in time value when config has one', () => {
    const data = emptyData()
    data.config.push({
      habit: 'vape',
      motivationalText: 'Stay clear',
      checkInTime: '21:30',
      updatedAt: '0-stored-vape-config',
    })

    openSettingsSheet(root, data, callbacks)

    expect(checkInInput(root, 'vape').value).toBe('21:30')
  })

  it('saves a changed check-in time for a habit and removes the settings overlay', () => {
    const data = emptyData()
    openSettingsSheet(root, data, callbacks)

    checkInInput(root, 'vape').value = '18:45'
    saveCheckInButton(root, 'vape').dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(callbacks.onData).toHaveBeenCalledOnce()
    const nextData = vi.mocked(callbacks.onData).mock.calls[0][0]
    expect(nextData.config).toContainEqual(
      expect.objectContaining({
        habit: 'vape',
        checkInTime: '18:45',
      }),
    )
    expect(root.querySelector('[data-settings]')).toBeNull()
  })

  it('falls back to the default check-in time when saving an empty input value', () => {
    openSettingsSheet(root, emptyData(), callbacks)

    checkInInput(root, 'drink').value = ''
    saveCheckInButton(root, 'drink').dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(callbacks.onData).toHaveBeenCalledOnce()
    const nextData = vi.mocked(callbacks.onData).mock.calls[0][0]
    expect(nextData.config).toContainEqual(
      expect.objectContaining({
        habit: 'drink',
        checkInTime: '07:00',
      }),
    )
  })

  it('preserves the other habit config when saving one habit check-in time', () => {
    const data = emptyData()
    data.config.push(
      {
        habit: 'vape',
        motivationalText: 'No nicotine today',
        checkInTime: '07:15',
        updatedAt: '0-stored-vape-config',
      },
      {
        habit: 'drink',
        motivationalText: 'Clear head',
        checkInTime: '20:30',
        updatedAt: '0-stored-drink-config',
      },
    )

    openSettingsSheet(root, data, callbacks)

    checkInInput(root, 'vape').value = '06:45'
    saveCheckInButton(root, 'vape').dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const nextData = vi.mocked(callbacks.onData).mock.calls[0][0] as AppData
    expect(nextData.config).toContainEqual(
      expect.objectContaining({
        habit: 'vape',
        motivationalText: 'No nicotine today',
        checkInTime: '06:45',
      }),
    )
    expect(nextData.config).toContainEqual({
      habit: 'drink',
      motivationalText: 'Clear head',
      checkInTime: '20:30',
      updatedAt: '0-stored-drink-config',
    })
  })
})
