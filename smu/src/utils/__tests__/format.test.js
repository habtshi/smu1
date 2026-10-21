// src/utils/__tests__/format.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  esc,
  fmtDate,
  fmtDateTime,
  todayISO,
  daysAgoISO,
  initials,
  timeAgo,
  fmtBytes,
  debounce
} from '../format'

/* ─────────── esc ─────────── */
describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;')
    expect(esc('"hi"')).toBe('&quot;hi&quot;')
    expect(esc("it's")).toBe('it&#39;s')
    expect(esc('a & b')).toBe('a &amp; b')
  })

  it('handles null and undefined safely', () => {
    expect(esc(null)).toBe('')
    expect(esc(undefined)).toBe('')
  })
})

/* ─────────── fmtDate ─────────── */
describe('fmtDate', () => {
  it('formats an ISO date as "12 Mar 2026"', () => {
    expect(fmtDate('2026-03-12')).toBe('12 Mar 2026')
  })

  it('returns em-dash for empty input', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate('')).toBe('—')
  })
})

/* ─────────── fmtDateTime ─────────── */
describe('fmtDateTime', () => {
  it('includes day, month, hour, minute', () => {
    const out = fmtDateTime('2026-03-12T14:30:00Z')
    // Timezone-independent: just check the shape (dd Mon, HH:MM)
    expect(out).toMatch(/^\d{2} \w{3}, \d{2}:\d{2}$/)
    expect(out).toMatch(/Mar/)
  })

  it('returns em-dash for empty', () => {
    expect(fmtDateTime(null)).toBe('—')
  })
})

/* ─────────── todayISO ─────────── */
describe('todayISO', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('matches the current date', () => {
    const expected = new Date().toISOString().slice(0, 10)
    expect(todayISO()).toBe(expected)
  })
})

/* ─────────── daysAgoISO ─────────── */
describe('daysAgoISO', () => {
  it('returns N days before today', () => {
    const seven = daysAgoISO(7)
    const now = new Date()
    const expected = new Date(now)
    expected.setDate(expected.getDate() - 7)
    expect(seven).toBe(expected.toISOString().slice(0, 10))
  })

  it('returns today for 0', () => {
    expect(daysAgoISO(0)).toBe(todayISO())
  })
})

/* ─────────── initials ─────────── */
describe('initials', () => {
  it('returns first two initials, uppercase', () => {
    expect(initials('Abebe Tesfaye')).toBe('AT')
    expect(initials('john doe smith')).toBe('JD')
  })

  it('handles single-word names', () => {
    expect(initials('admin')).toBe('A')
  })

  it('handles empty / null safely', () => {
    expect(initials('')).toBe('?')
    expect(initials(null)).toBe('?')
  })

  it('caps at 2 letters', () => {
    expect(initials('a b c d')).toBe('AB')
  })
})

/* ─────────── timeAgo ─────────── */
describe('timeAgo', () => {
  it('returns "just now" for very recent times', () => {
    expect(timeAgo(Date.now() - 10 * 1000)).toBe('just now')
  })

  it('returns minutes for times under an hour', () => {
    expect(timeAgo(Date.now() - 5 * 60 * 1000)).toBe('5m ago')
  })

  it('returns hours for times under a day', () => {
    expect(timeAgo(Date.now() - 3 * 3600 * 1000)).toBe('3h ago')
  })

  it('returns days for older times', () => {
    expect(timeAgo(Date.now() - 2 * 86400 * 1000)).toBe('2d ago')
  })
})

/* ─────────── fmtBytes ─────────── */
describe('fmtBytes', () => {
  it('formats bytes', () => {
    expect(fmtBytes(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(fmtBytes(2048)).toBe('2.0 KB')
  })

  it('formats megabytes', () => {
    expect(fmtBytes(3 * 1024 * 1024)).toBe('3.00 MB')
  })

  it('handles null', () => {
    expect(fmtBytes(null)).toBe('—')
  })
})

/* ─────────── debounce ─────────── */
describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('delays invocation', () => {
    const fn = vi.fn()
    const d = debounce(fn, 250)
    d('a')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(fn).toHaveBeenCalledWith('a')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancels previous call when called again', () => {
    const fn = vi.fn()
    const d = debounce(fn, 250)
    d('a')
    d('b')
    d('c')
    vi.advanceTimersByTime(250)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
  })
})