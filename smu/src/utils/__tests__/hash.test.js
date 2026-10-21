// src/utils/__tests__/hash.test.js
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../hash'

describe('hashPassword', () => {
  it('produces a 64-char lowercase hex string', async () => {
    const h = await hashPassword('1234')
    expect(h).toMatch(/^[a-f0-9]{64}$/)
  })

  it('is deterministic — same input → same hash', async () => {
    const a = await hashPassword('hello')
    const b = await hashPassword('hello')
    expect(a).toBe(b)
  })

  it('different inputs → different hashes', async () => {
    const a = await hashPassword('1234')
    const b = await hashPassword('1235')
    expect(a).not.toBe(b)
  })

  it('handles empty string', async () => {
    const h = await hashPassword('')
    expect(h).toMatch(/^[a-f0-9]{64}$/)
  })

  it('handles null / undefined as empty', async () => {
    const a = await hashPassword(null)
    const b = await hashPassword(undefined)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
    expect(a).toBe(b)
  })

  it('never returns the plaintext', async () => {
    const h = await hashPassword('1234')
    expect(h).not.toContain('1234')
  })
})

describe('verifyPassword', () => {
  it('returns true for matching password', async () => {
    const h = await hashPassword('secret123')
    expect(await verifyPassword('secret123', h)).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const h = await hashPassword('secret123')
    expect(await verifyPassword('wrong', h)).toBe(false)
  })

  it('returns false for empty hash', async () => {
    expect(await verifyPassword('secret123', null)).toBe(false)
    expect(await verifyPassword('secret123', '')).toBe(false)
  })
})