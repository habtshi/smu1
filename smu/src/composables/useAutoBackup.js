// src/composables/useAutoBackup.js
import { ref } from 'vue'

const STORAGE_KEY = 'tms_autoBackup'
const CHECK_INTERVAL = 30 * 1000 // check every 30s

const DEFAULTS = {
  enabled: false,
  frequency: 'daily',   // hourly | daily | weekly | monthly | custom
  time: '02:00',
  dayOfWeek: 1,         // 0=Sun, 1=Mon ... 6=Sat
  dayOfMonth: 1,        // 1..28
  customDays: 7,
  keepLast: 10,
  download: false,      // auto-download the .json file too
  lastRunAt: null,
  nextRunAt: null,
  runs: []              // { at, status }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS }
  } catch { return { ...DEFAULTS } }
}
function save(cfg) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)) } catch {}
}

/* ---------- next-run calculation ---------- */
function computeNextRun(cfg, from = Date.now()) {
  if (!cfg.enabled) return null
  const now = new Date(from)
  const [hh, mm] = String(cfg.time || '02:00').split(':').map(n => Number(n) || 0)

  if (cfg.frequency === 'hourly') {
    const next = new Date(now)
    next.setMinutes(mm, 0, 0)
    if (next <= now) next.setHours(next.getHours() + 1)
    return next.getTime()
  }

  if (cfg.frequency === 'daily') {
    const next = new Date(now)
    next.setHours(hh, mm, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next.getTime()
  }

  if (cfg.frequency === 'weekly') {
    const next = new Date(now)
    next.setHours(hh, mm, 0, 0)
    const target = Number(cfg.dayOfWeek) || 0
    const diff = (target - next.getDay() + 7) % 7
    next.setDate(next.getDate() + diff)
    if (next <= now) next.setDate(next.getDate() + 7)
    return next.getTime()
  }

  if (cfg.frequency === 'monthly') {
    const day = Math.min(28, Math.max(1, Number(cfg.dayOfMonth) || 1))
    const next = new Date(now.getFullYear(), now.getMonth(), day, hh, mm, 0, 0)
    if (next <= now) next.setMonth(next.getMonth() + 1)
    return next.getTime()
  }

  if (cfg.frequency === 'custom') {
    const days = Math.max(1, Number(cfg.customDays) || 7)
    const next = new Date(now)
    next.setHours(hh, mm, 0, 0)
    if (next <= now) next.setDate(next.getDate() + days)
    return next.getTime()
  }

  return null
}

/* ---------- shared reactive state ---------- */
const config = ref(load())

function persist() { save(config.value) }

function refreshNextRun() {
  config.value.nextRunAt = computeNextRun(config.value)
  persist()
}

// init once
refreshNextRun()

/* ---------- public composable ---------- */
export function useAutoBackup() {
  let timer = null
  let runner = null

  function start(callback) {
    runner = callback
    if (timer) return
    timer = setInterval(checkDue, CHECK_INTERVAL)
    checkDue()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
    runner = null
  }

  async function checkDue() {
    if (!config.value.enabled) return
    if (!config.value.nextRunAt) { refreshNextRun(); return }
    if (Date.now() < config.value.nextRunAt) return

    try {
      if (typeof runner === 'function') await runner()
      config.value.lastRunAt = new Date().toISOString()
      config.value.runs = [
        { at: config.value.lastRunAt, status: 'success' },
        ...(config.value.runs || []).slice(0, 19)
      ]
    } catch (e) {
      config.value.runs = [
        { at: new Date().toISOString(), status: 'failed', error: String(e) },
        ...(config.value.runs || []).slice(0, 19)
      ]
    }
    refreshNextRun()
  }

  function saveConfig(partial) {
    config.value = { ...config.value, ...partial }
    refreshNextRun()
  }

  function setEnabled(v) {
    config.value.enabled = !!v
    refreshNextRun()
  }

  function runNow() {
    // Force the scheduler to fire on the next tick
    config.value.nextRunAt = Date.now()
    return checkDue()
  }

  function reset() {
    config.value = { ...DEFAULTS }
    persist()
  }

  return { config, saveConfig, setEnabled, refreshNextRun, runNow, start, stop, reset }
}