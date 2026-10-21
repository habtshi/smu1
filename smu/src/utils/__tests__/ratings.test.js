// src/utils/__tests__/ratings.test.js
import { describe, it, expect } from 'vitest'
import {
  scoreFromAtt,
  scoreFromPerf,
  badgeClass,
  dotClass,
  ratingMeta,
  attLabel,
  perfLabel
} from '../ratings'

/* ─────────── scoreFromAtt ─────────── */
describe('scoreFromAtt', () => {
  it('maps Green → 5',       () => expect(scoreFromAtt('Green')).toBe(5))
  it('maps Blue → 4',        () => expect(scoreFromAtt('Blue')).toBe(4))
  it('maps Yellow → 2',      () => expect(scoreFromAtt('Yellow')).toBe(2))
  it('maps Red → 1',         () => expect(scoreFromAtt('Red')).toBe(1))
  it('maps unknown → 0',     () => expect(scoreFromAtt('Purple')).toBe(0))
  it('maps null → 0',        () => expect(scoreFromAtt(null)).toBe(0))
  it('maps undefined → 0',   () => expect(scoreFromAtt(undefined)).toBe(0))
})

/* ─────────── scoreFromPerf ─────────── */
describe('scoreFromPerf', () => {
  it('maps Green → 5',   () => expect(scoreFromPerf('Green')).toBe(5))
  it('maps Yellow → 2',  () => expect(scoreFromPerf('Yellow')).toBe(2))
  it('handles null',     () => expect(scoreFromPerf(null)).toBe(0))
})

/* ─────────── badgeClass ─────────── */
describe('badgeClass', () => {
  it('returns correct classes', () => {
    expect(badgeClass('Green')).toBe('b-green')
    expect(badgeClass('Blue')).toBe('b-blue')
    expect(badgeClass('Yellow')).toBe('b-amber')
    expect(badgeClass('Red')).toBe('b-red')
  })

  it('falls back to gray for unknown', () => {
    expect(badgeClass('Unknown')).toBe('b-gray')
    expect(badgeClass(null)).toBe('b-gray')
  })
})

/* ─────────── dotClass ─────────── */
describe('dotClass', () => {
  it('returns matching dot classes', () => {
    expect(dotClass('Green')).toBe('green')
    expect(dotClass('Blue')).toBe('blue')
    expect(dotClass('Yellow')).toBe('amber')
    expect(dotClass('Red')).toBe('red')
  })

  it('falls back to gray', () => {
    expect(dotClass(null)).toBe('gray')
  })
})

/* ─────────── ratingMeta ─────────── */
describe('ratingMeta', () => {
  it('returns metadata for valid ratings', () => {
    const meta = ratingMeta('Green', 'attendance')
    expect(meta).toHaveProperty('label', 'Excellent')
    expect(meta).toHaveProperty('color')
    expect(meta).toHaveProperty('bg')
  })

  it('uses PERF_META when kind=performance', () => {
    const att  = ratingMeta('Red', 'attendance')
    const perf = ratingMeta('Red', 'performance')
    expect(att.label).toBe('Poor / Absent')
    expect(perf.label).toBe('Not Delivered')
  })

  it('returns null for unknown', () => {
    expect(ratingMeta(null)).toBeNull()
    expect(ratingMeta('Unknown')).toBeNull()
  })
})

/* ─────────── attLabel / perfLabel ─────────── */
describe('attLabel', () => {
  it('marks Red as "Red (Absent)"', () => {
    expect(attLabel('Red')).toBe('Red (Absent)')
  })
  it('passes through other colors', () => {
    expect(attLabel('Green')).toBe('Green')
  })
  it('handles empty', () => {
    expect(attLabel(null)).toBe('—')
  })
})

describe('perfLabel', () => {
  it('returns human labels', () => {
    expect(perfLabel('Green')).toBe('Excellent')
    expect(perfLabel('Yellow')).toBe('Needs Improvement')
  })
  it('handles empty', () => {
    expect(perfLabel(null)).toBe('—')
  })
})