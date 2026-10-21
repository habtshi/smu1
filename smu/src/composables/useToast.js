import { ref, readonly } from 'vue'

/* ============================================================
   Global toast queue
   ------------------------------------------------------------
   Matches the .toast-x / .toasts CSS classes used across the app.
   Usage anywhere in a component:

     import { useToast } from '@/composables/useToast'
     const toast = useToast()

     toast.ok('Report submitted')
     toast.err('Please select a teacher')
     toast.warn('Session will expire soon')
     toast.info('New alert triggered')
     toast.push('Custom message', 'warn', 5000)
     toast.dismiss(id)
     toast.clear()
   ============================================================ */

const MAX_VISIBLE = 5
const DEFAULT_DURATION = 3200
const EXIT_DURATION = 280

const toasts = ref([])
let seq = 0
const timers = new Map()

/* ------------------------------------------------------------
   Internals
   ------------------------------------------------------------ */
function clearTimer(id) {
  const t = timers.get(id)
  if (t) {
    clearTimeout(t)
    timers.delete(id)
  }
}

function scheduleRemoval(id, ms) {
  clearTimer(id)
  const t = setTimeout(() => dismiss(id), ms)
  timers.set(id, t)
}

function enforceMax() {
  // Remove oldest visible toasts if we exceed the cap
  while (toasts.value.length > MAX_VISIBLE) {
    const oldest = toasts.value[0]
    if (!oldest) break
    dismiss(oldest.id, { instant: true })
  }
}

/* ------------------------------------------------------------
   Public API
   ------------------------------------------------------------ */
function push(msg, type = 'ok', duration = DEFAULT_DURATION) {
  // Normalize type — accept legacy aliases
  const normalizedType =
    type === 'success' ? 'ok' :
    type === 'error'   ? 'err' :
    type === 'warning' ? 'warn' :
    type

  const id = ++seq
  const safeMsg = String(msg ?? '')
  const ms = Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_DURATION

  toasts.value.push({
    id,
    msg: safeMsg,
    type: normalizedType,
    createdAt: Date.now(),
    dismissing: false
  })

  enforceMax()
  scheduleRemoval(id, ms)
  return id
}

function dismiss(id, { instant = false } = {}) {
  const i = toasts.value.findIndex(t => t.id === id)
  if (i === -1) return

  clearTimer(id)

  if (instant) {
    toasts.value.splice(i, 1)
    return
  }

  // Two-phase removal so the CSS exit transition can play
  toasts.value[i].dismissing = true
  setTimeout(() => {
    const j = toasts.value.findIndex(t => t.id === id)
    if (j !== -1) toasts.value.splice(j, 1)
  }, EXIT_DURATION)
}

function clear() {
  for (const t of toasts.value) clearTimer(t.id)
  toasts.value = []
}

/* ------------------------------------------------------------
   Convenience helpers
   ------------------------------------------------------------ */
function ok(msg, duration)   { return push(msg, 'ok',   duration) }
function err(msg, duration)  { return push(msg, 'err',  duration) }
function warn(msg, duration) { return push(msg, 'warn', duration) }
function info(msg, duration) { return push(msg, 'info', duration ?? 3600) }

/* ------------------------------------------------------------
   Composable — call from any component
   ------------------------------------------------------------ */
export function useToast() {
  return {
    toasts: readonly(toasts),
    push,
    ok,
    err,
    warn,
    info,
    dismiss,
    clear
  }
}

/* ------------------------------------------------------------
   Optional: non-component access (e.g. inside stores or utils)
   ------------------------------------------------------------ */
export const toast = { push, ok, err, warn, info, dismiss, clear }