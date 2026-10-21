import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ROLE_LABEL, LOCKOUT_MAX, LOCKOUT_MS } from '@/utils/constants'
import { hashPassword, verifyPassword } from '@/utils/hash'
import { useDirectoryStore } from './directory'
import { useSettingsStore } from './settings'

const STORAGE_KEY = 'tms_currentUser'
const LOCKOUT_KEY = 'tms_loginLockout'

export const useSessionStore = defineStore('session', () => {
  /* ---------------- state ---------------- */
  const user = ref(null)

  /* ---------------- getters ---------------- */
  const isAuthenticated = computed(() => !!user.value)
  const role            = computed(() => user.value?.role || null)
  const roleLabel       = computed(() => ROLE_LABEL[role.value] || '—')
  const department      = computed(() => user.value?.department || null)
  const userId          = computed(() => user.value?.id || null)

  /* ---------------- session persistence ---------------- */
  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) user.value = JSON.parse(raw)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function setUser(u) {
    user.value = u
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(u)) } catch {}
  }

  function clear() {
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  /* ---------------- login lockout ---------------- */
  function _readLockouts() {
    try { return JSON.parse(localStorage.getItem(LOCKOUT_KEY) || '{}') }
    catch { return {} }
  }
  function _writeLockouts(map) {
    try { localStorage.setItem(LOCKOUT_KEY, JSON.stringify(map)) } catch {}
  }

  function getLockout(username) {
    const map = _readLockouts()
    const e = map[username]
    if (!e) return { count: 0, until: 0 }
    if (e.until && e.until < Date.now()) {
      delete map[username]
      _writeLockouts(map)
      return { count: 0, until: 0 }
    }
    return e
  }

  function bumpLockout(username) {
    const map = _readLockouts()
    const e = map[username] || { count: 0, until: 0 }
    e.count = (e.count || 0) + 1
    e.lastAttempt = new Date().toISOString()
    if (e.count >= LOCKOUT_MAX) e.until = Date.now() + LOCKOUT_MS
    map[username] = e
    _writeLockouts(map)
    return e
  }

  function clearLockout(username) {
    const map = _readLockouts()
    if (map[username]) { delete map[username]; _writeLockouts(map) }
  }

  function isLocked(username) {
    const l = getLockout(username)
    return l.until > Date.now()
  }

  function lockoutRemaining(username) {
    const l = getLockout(username)
    const s = Math.max(0, Math.floor((l.until - Date.now()) / 1000))
    const m = Math.floor(s / 60)
    return { seconds: s, text: `${m}m ${String(s % 60).padStart(2, '0')}s` }
  }

  /* ---------------- authenticate (ASYNC) ----------------
     Because hashing is async, login() now returns a Promise.
     Callers must `await session.login(...)`.
  -------------------------------------------------------- */
  async function login(username, password) {
    const directory = useDirectoryStore()
    const settings  = useSettingsStore()

    const uname = String(username || '').trim().toLowerCase()
    const lock  = getLockout(uname)

    if (lock.until && lock.until > Date.now()) {
      return {
        ok: false,
        error: `Account locked. Try again in ${lockoutRemaining(uname).text}.`,
        locked: true
      }
    }

    const found = directory.users.find(
      u => String(u.username || '').trim().toLowerCase() === uname
    )

    /* Migration — if user still has plaintext password, hash it now */
    if (found && found.password && !found.passwordHash) {
      const h = await hashPassword(found.password)
      await directory.updateUser(found.id, { passwordHash: h })
      found.passwordHash = h
      delete found.password
    }

    /* Verify against hash */
    const ok = found ? await verifyPassword(password, found.passwordHash) : false

    if (!ok) {
      const bumped = bumpLockout(uname)
      const left = LOCKOUT_MAX - bumped.count
      settings.audit('Login Failed', 'Auth', `Failed login for "${uname}"`, 'failure')

      if (bumped.until && bumped.until > Date.now()) {
        return {
          ok: false,
          error: `Too many failed attempts. Locked for ${Math.ceil(LOCKOUT_MS / 60000)} minutes.`,
          locked: true
        }
      }
      return {
        ok: false,
        error: left > 0 && found
          ? `Invalid password. ${left} attempt${left === 1 ? '' : 's'} remaining.`
          : 'Invalid username or password.'
      }
    }

    clearLockout(uname)
    const safeUser = { ...found }
    delete safeUser.password
    delete safeUser.passwordHash
    setUser(safeUser)
    settings.audit('Login', 'Auth', `${found.name} signed in`)
    return { ok: true, user: safeUser }
  }

  function logout() {
    const settings = useSettingsStore()
    if (user.value) settings.audit('Logout', 'Auth', `${user.value.name} signed out`)
    clear()
  }

  function refreshFromDirectory() {
    if (!user.value) return
    const directory = useDirectoryStore()
    const fresh = directory.users.find(u => u.id === user.value.id)
    if (!fresh) return clear()
    const safe = { ...fresh }
    delete safe.password
    delete safe.passwordHash
    setUser(safe)
  }

  return {
    user,
    isAuthenticated, role, roleLabel, department, userId,
    restore, setUser, clear,
    login, logout, refreshFromDirectory,
    getLockout, bumpLockout, clearLockout, isLocked, lockoutRemaining
  }
})