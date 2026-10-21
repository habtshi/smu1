// src/composables/useBackup.js
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import { useDisputesStore } from '@/stores/disputes'
import { useMessagesStore } from '@/stores/messages'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { downloadJSON } from '@/utils/format'
import { BACKUP_KEYS } from '@/utils/constants'

export function useBackup() {
  const directory = useDirectoryStore()
  const reports   = useReportsStore()
  const alerts    = useAlertsStore()
  const disputes  = useDisputesStore()
  const messages  = useMessagesStore()
  const settings  = useSettingsStore()
  const session   = useSessionStore()

  function buildSnapshotData() {
    const data = {
      version: 3,
      createdAt: new Date().toISOString(),
      application: 'SMU Teacher Attendance & Performance Monitoring System'
    }
    const map = {
      users: directory.users,
      departments: directory.departments,
      courses: directory.courses,
      reports: reports.reports,
      alerts: alerts.alerts,
      disputes: disputes.disputes,
      notifications: messages.notifications,
      messages: messages.messages,
      settings: settings.settings,
      auditLog: settings.auditLog,
      archives: settings.academicYears,
      makeupClasses: alerts.makeupClasses,
      classReports: reports.classReports,
      resetTokens: {},
      loginLockout: {}
    }
    BACKUP_KEYS.forEach(k => { if (map[k] !== undefined) data[k] = JSON.parse(JSON.stringify(map[k])) })
    return data
  }

  function summarize(data) {
    const records = {}
    BACKUP_KEYS.forEach(k => {
      const v = data[k]
      records[k] = Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 1)
    })
    return records
  }

  function createSnapshot({ trigger = 'manual', download = false, label = '' } = {}) {
    const data = buildSnapshotData()
    const id = Date.now()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const year = settings.settings.academicYear || '2025/2026'
    const prefix = trigger === 'auto' ? 'SMU-AutoBackup' : 'SMU-Backup'
    const name = `${prefix}-${year.replace('/', '-')}-${stamp}.json`
    const size = JSON.stringify(data).length
    const records = summarize(data)

    const rec = {
      id, name, createdAt: data.createdAt, year, size, records,
      status: 'completed',
      trigger,
      label: label || (trigger === 'auto' ? 'Automatic' : 'Manual'),
      createdBy: session.user?.name || 'system'
    }
    settings.registerBackup(rec, data)

    if (download) downloadJSON(data, name)
    settings.audit('Create Backup', 'Backup', `${prefix} #${id} (${trigger})`)
    return rec
  }

  function restoreSnapshot(id) {
    const data = settings.getBackupData(id)
    if (!data) return false

    directory.replaceAll({
      users: data.users,
      departments: data.departments,
      courses: data.courses
    })
    reports.replaceAll({
      reports: data.reports,
      classReports: data.classReports
    })
    alerts.replaceAll({
      alerts: data.alerts,
      makeupClasses: data.makeupClasses
    })
    disputes.replaceAll(data.disputes || [])
    messages.replaceAll({
      messages: data.messages,
      notifications: data.notifications
    })
    settings.replaceAll({
      settings: data.settings,
      academicYears: data.archives,
      auditLog: undefined
    })
    settings.audit('Restore Backup', 'Backup', `Restored #${id}`)
    return true
  }

  return { buildSnapshotData, createSnapshot, restoreSnapshot }
}