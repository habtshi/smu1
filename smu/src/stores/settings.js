import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const SETTINGS_KEY = 'tms_settings'
const YEARS_KEY    = 'tms_archives'
const BACKUPS_KEY  = 'tms_backups'
const AUDIT_KEY    = 'tms_auditLog'

const DEFAULT_SETTINGS = {
  orgName: "St. Mary's University",
  timezone: 'Africa/Addis_Ababa',
  workingDays: 'Mon – Fri',
  academicYear: '2025/2026',
  emailNotifications: true,
  autoEscalation: true,
  allowSelfReports: true,
  allowDisputes: true,
  passwordPolicy: 'Strong (min 8 chars)',
  sessionTimeout: 60,
  dataRetention: '3 academic years',
  featureFlags: {}                       // ← NEW
}

function load(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback }
  catch { return fallback }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export const useSettingsStore = defineStore('settings', () => {
  /* ---------- state ---------- */
  const settings      = ref({ ...DEFAULT_SETTINGS, ...load(SETTINGS_KEY, {}) })
  const academicYears = ref(load(YEARS_KEY, []))
  const backups       = ref(load(BACKUPS_KEY, []))
  const auditLog      = ref(load(AUDIT_KEY, []))

  /* ---------- getters ---------- */
  const currentAcademicYear = computed(() => settings.value.academicYear)
  const sessionTimeoutMin   = computed(() => +settings.value.sessionTimeout || 60)

  /* ---------- settings ---------- */
  function saveSettings(patch) {
    settings.value = { ...settings.value, ...patch }
    save(SETTINGS_KEY, settings.value)
  }

  function resetSettings() {
    settings.value = { ...DEFAULT_SETTINGS }
    save(SETTINGS_KEY, settings.value)
  }

  /* ---------- academic years ---------- */
  function nextAcademicYear(y) {
    const m = String(y || '2025/2026').match(/(\d{4})\s*\/\s*(\d{4})/)
    return m ? `${+m[1] + 1}/${+m[2] + 1}` : '2026/2027'
  }

  function closeAcademicYear({ summary, backupId }) {
    const closed = settings.value.academicYear
    const next = nextAcademicYear(closed)

    academicYears.value.unshift({
      id: Date.now(),
      year: closed,
      archivedAt: new Date().toISOString(),
      backupId: backupId || null,
      summary: summary || {}
    })
    save(YEARS_KEY, academicYears.value)

    settings.value.academicYear = next
    save(SETTINGS_KEY, settings.value)

    audit('Close Academic Year', 'Academic Year', `${closed} archived; ${next} started`)
    return next
  }

  /* ---------- backups ---------- */
  function registerBackup(record, data) {
    backups.value.unshift(record)
    const kept = backups.value.slice(0, 10)
    // Drop payloads beyond the retention window
    backups.value.slice(10).forEach(b => {
      try { localStorage.removeItem('tms_backup_data_' + b.id) } catch {}
    })
    backups.value = kept
    save(BACKUPS_KEY, kept)
    try { localStorage.setItem('tms_backup_data_' + record.id, JSON.stringify(data)) } catch {}
    return record
  }

  function deleteBackup(id) {
    backups.value = backups.value.filter(b => b.id !== +id)
    save(BACKUPS_KEY, backups.value)
    try { localStorage.removeItem('tms_backup_data_' + id) } catch {}
  }

  function getBackupData(id) {
    try {
      const raw = localStorage.getItem('tms_backup_data_' + id)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  /* ---------- audit log ---------- */
  function audit(action, module, detail = '', result = 'success', user = null) {
    auditLog.value.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      user: user?.name || 'system',
      role: user?.role || 'system',
      action,
      module,
      detail,
      result,
      ip: 'client-demo',
      timestamp: new Date().toISOString()
    })
    auditLog.value = auditLog.value.slice(0, 800)
    save(AUDIT_KEY, auditLog.value)
  }

  function clearAudit() {
    auditLog.value = []
    save(AUDIT_KEY, [])
  }

  function deleteAuditEntry(id) {
    const before = auditLog.value.length
    auditLog.value = auditLog.value.filter(l => String(l.id) !== String(id))
    if (auditLog.value.length === before) return false
    save(AUDIT_KEY, auditLog.value)
    return true
  }

  function deleteAuditEntries(ids) {
    const set = new Set(ids.map(String))
    const before = auditLog.value.length
    auditLog.value = auditLog.value.filter(l => !set.has(String(l.id)))
    save(AUDIT_KEY, auditLog.value)
    return before - auditLog.value.length
  }

  /* ---------- bulk ---------- */
  function replaceAll({ settings: s, academicYears: y, backups: b, auditLog: a }) {
    if (s) { settings.value = { ...DEFAULT_SETTINGS, ...s }; save(SETTINGS_KEY, settings.value) }
    if (y) { academicYears.value = y; save(YEARS_KEY, y) }
    if (b) { backups.value = b; save(BACKUPS_KEY, b) }
    if (a) { auditLog.value = a; save(AUDIT_KEY, a) }
  }

  function factoryReset() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('tms_'))
      .forEach(k => localStorage.removeItem(k))
  }

  return {
    settings, academicYears, backups, auditLog,
    currentAcademicYear, sessionTimeoutMin,
    saveSettings, resetSettings,
    nextAcademicYear, closeAcademicYear,
    registerBackup, deleteBackup, getBackupData,
    audit, clearAudit,
    deleteAuditEntry,
    deleteAuditEntries,
    replaceAll, factoryReset
  }
})