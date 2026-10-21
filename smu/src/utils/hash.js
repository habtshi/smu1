// src/utils/hash.js
/* ============================================================
   Password hashing — frontend demo only
   ------------------------------------------------------------
   Uses SHA-256 with a static pepper. This is NOT bcrypt and
   NOT a substitute for a real backend, but it prevents
   plaintext passwords from being visible in DevTools.

   ⚠️ Do NOT change the PEPPER string after the app has been
   used — existing hashes will become invalid and nobody
   will be able to log in.
   ============================================================ */

const PEPPER = 'smu-tms-2026-pepper'

/**
 * Hash a plaintext password with SHA-256 + pepper.
 * @param {string} plain
 * @returns {Promise<string>} 64-char lowercase hex string
 */
export async function hashPassword(plain) {
  const input = String(plain ?? '') + PEPPER
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Check whether a plaintext password matches a stored hash.
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plain, hash) {
  if (!hash) return false
  const computed = await hashPassword(plain)
  return computed === hash
}