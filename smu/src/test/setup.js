// src/test/setup.js
import { beforeEach, vi } from 'vitest'

// Reset localStorage before every test so state never leaks
beforeEach(() => {
  try { localStorage.clear() } catch {}
})

// Silence noisy console.warn from stores during tests
vi.spyOn(console, 'warn').mockImplementation(() => {})