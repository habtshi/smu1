// src/composables/__tests__/useAutoBackup.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/* The composable keeps module-level state, so we reload it fresh
   for each test using vi.resetModules() + dynamic import. */

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-12T10:30:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

async function loadComposable() {
  return await import('@/composables/useAutoBackup')
}

describe('useAutoBackup — next-run calculation', () => {
  it('returns null when disabled', async () => {
    localStorage.setItem('tms_autoBackup', JSON.stringify({ enabled: false }))
    const { useAutoBackup } = await loadComposable()
    const { config } = useAutoBackup()
    expect(config.value.nextRunAt).toBeNull()
  })

  it('daily at 02:00 → next run is tomorrow', async () => {
    localStorage.setItem('tms_autoBackup', JSON.stringify({
      enabled: true, frequency: 'daily', time: '02:00'
    }))
    const { useAutoBackup } = await loadComposable()
    const { config } = useAutoBackup()

    const next = new Date(config.value.nextRunAt)
    expect(next.getDate()).toBe(13)   // tomorrow
    expect(next.getHours()).toBe(2)
    expect(next.getMinutes()).toBe(0)
  })

  it('daily at 22:00 (later today) → next run is today', async () => {
    localStorage.setItem('tms_autoBackup', JSON.stringify({
      enabled: true, frequency: 'daily', time: '22:00'
    }))
    const { useAutoBackup } = await loadComposable()
    const { config } = useAutoBackup()

    const next = new Date(config.value.nextRunAt)
    expect(next.getDate()).toBe(12)   // still today
    expect(next.getHours()).toBe(22)
  })

  it('weekly on Monday → next run is next Monday', async () => {
    localStorage.setItem('tms_autoBackup', JSON.stringify({
      enabled: true, frequency: 'weekly', dayOfWeek: 1, time: '03:00'
    }))
    const { useAutoBackup } = await loadComposable()
    const { config } = useAutoBackup()

    const next = new Date(config.value.nextRunAt)
    // 2026-03-12 is a Thursday; next Monday is 2026-03-16
    expect(next.getDay()).toBe(1)         // Monday
    expect(next.getDate()).toBe(16)
    expect(next.getHours()).toBe(3)
  })

  it('monthly on the 1st → next run is 1st of next month', async () => {
    localStorage.setItem('tms_autoBackup', JSON.stringify({
      enabled: true, frequency: 'monthly', dayOfMonth: 1, time: '02:00'
    }))
    const { useAutoBackup } = await loadComposable()
    const { config } = useAutoBackup()

    const next = new Date(config.value.nextRunAt)
    expect(next.getMonth()).toBe(3)       // April (0-indexed)
    expect(next.getDate()).toBe(1)
  })

  it('hourly → next run is within the next hour', async () => {
    localStorage.setItem('tms_autoBackup', JSON.stringify({
      enabled: true, frequency: 'hourly', time: '00:15'
    }))
    const { useAutoBackup } = await loadComposable()
    const { config } = useAutoBackup()

    const next = new Date(config.value.nextRunAt)
    const diff = next.getTime() - Date.now()
    expect(diff).toBeGreaterThan(0)
    expect(diff).toBeLessThanOrEqual(60 * 60 * 1000)
  })
})

describe('useAutoBackup — public API', () => {
  it('setEnabled toggles the flag and recomputes next run', async () => {
    localStorage.setItem('tms_autoBackup', JSON.stringify({
      enabled: false, frequency: 'daily', time: '02:00'
    }))
    const { useAutoBackup } = await loadComposable()
    const api = useAutoBackup()

    expect(api.config.value.enabled).toBe(false)
    expect(api.config.value.nextRunAt).toBeNull()

    api.setEnabled(true)
    expect(api.config.value.enabled).toBe(true)
    expect(api.config.value.nextRunAt).toBeGreaterThan(Date.now())
  })

  it('saveConfig merges partial updates', async () => {
    const { useAutoBackup } = await loadComposable()
    const api = useAutoBackup()

    api.saveConfig({ frequency: 'weekly', time: '06:30' })
    expect(api.config.value.frequency).toBe('weekly')
    expect(api.config.value.time).toBe('06:30')
  })

  it('reset restores defaults', async () => {
    const { useAutoBackup } = await loadComposable()
    const api = useAutoBackup()

    api.setEnabled(true)
    api.saveConfig({ frequency: 'monthly', keepLast: 25 })

    api.reset()
    expect(api.config.value.enabled).toBe(false)
    expect(api.config.value.frequency).toBe('daily')
    expect(api.config.value.keepLast).toBe(10)
  })

  it('start / stop do not throw', async () => {
    const { useAutoBackup } = await loadComposable()
    const api = useAutoBackup()
    const runner = vi.fn()

    expect(() => api.start(runner)).not.toThrow()
    expect(() => api.stop()).not.toThrow()
  })
})