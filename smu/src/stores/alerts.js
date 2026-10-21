import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ALERT_THRESHOLDS } from '@/utils/constants'
import { useReportsStore } from './reports'
import { useDirectoryStore } from './directory'
import { useMessagesStore } from './messages'
import { useSettingsStore } from './settings'

const ALERTS_KEY = 'tms_alerts'
const MAKEUP_KEY = 'tms_makeupClasses'

function load(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback }
  catch { return fallback }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}
function todayISO() { return new Date().toISOString().slice(0, 10) }

export const useAlertsStore = defineStore('alerts', () => {
  /* ---------- state ---------- */
  const alerts        = ref(load(ALERTS_KEY, []))
  const makeupClasses = ref(load(MAKEUP_KEY, []))

  /* ---------- getters ---------- */
  const activeAlerts    = computed(() => alerts.value.filter(a => a.status === 'active'))
  const resolvedAlerts  = computed(() => alerts.value.filter(a => a.status === 'resolved'))
  const escalatedAlerts = computed(() => activeAlerts.value.filter(a => a.escalated))

  function alertsForTeacher(teacherId) {
    return alerts.value.filter(a => a.teacherId === +teacherId)
  }
  function activeAlertsForDept(dept) {
    if (!dept) return activeAlerts.value
    return activeAlerts.value.filter(a => a.department === dept)
  }

  /* ---------- streak calculation ---------- */
  function consecutiveAbsences(teacherId) {
    const reports = useReportsStore()
    const rows = reports.reports
      .filter(r => r.teacherId === +teacherId && r.reporter_role === 'class_rep')
      .sort((a, b) => b.date.localeCompare(a.date) || (b.id || 0) - (a.id || 0))

    // Collapse multiple same-day reports into one status per day (Red wins)
    const byDay = new Map()
    for (const r of rows) {
      if (!byDay.has(r.date)) {
        byDay.set(r.date, r.attendance_rating === 'Red' ? 'Red' : 'Present')
      } else if (r.attendance_rating === 'Red') {
        byDay.set(r.date, 'Red')
      }
    }

    let n = 0
    for (const [, status] of byDay) {
      if (status === 'Red') n++
      else break
    }
    return n
  }

  /* ══════════════════════════════════════════════════════
     FAST PATH — recompute alerts for ONE teacher only
     ══════════════════════════════════════════════════════ */
  function recomputeForTeacher(teacherId) {
    const directory = useDirectoryStore()
    const messages  = useMessagesStore()

    const t = directory.userById(+teacherId)
    if (!t || t.role !== 'teacher') return

    const count = consecutiveAbsences(t.id)
    const idx = alerts.value.findIndex(a => a.teacherId === t.id)
    const existing = idx >= 0 ? alerts.value[idx] : null

    if (count >= ALERT_THRESHOLDS.deptHead) {
      const escalated = count >= ALERT_THRESHOLDS.admin
      const isNew = !existing || existing.status === 'resolved'
      const wasEscalated = existing?.escalated

      const alert = {
        id: existing?.id || Date.now() + Math.floor(Math.random() * 1000),
        teacherId: t.id,
        teacherName: t.name,
        department: t.department,
        count,
        escalated,
        status: 'active',
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      if (idx >= 0) alerts.value[idx] = alert
      else alerts.value.push(alert)

      if (isNew || (!wasEscalated && escalated)) {
        messages.pushNotification(
          escalated ? 'admin' : 'dept_head',
          escalated ? 'critical-alert' : 'alert',
          escalated
            ? `ESCALATED: ${t.name} — ${count} consecutive absences`
            : `Alert: ${t.name} — ${count} consecutive absences`,
          escalated ? 'danger' : 'warning',
          { teacherId: t.id, department: t.department }
        )
        messages.pushNotification(
          'teacher',
          escalated ? 'critical-alert' : 'alert',
          escalated
            ? `Your attendance has been escalated to administration (${count} consecutive absences)`
            : `Attendance warning: ${count} consecutive absences recorded`,
          escalated ? 'danger' : 'warning',
          { userId: t.id, teacherId: t.id, department: t.department }
        )
      }

      if (isNew) {
        const already = makeupClasses.value.some(
          m => m.teacherId === t.id && m.status !== 'cancelled'
        )
        if (!already) {
          makeupClasses.value.unshift({
            id: Date.now() + Math.floor(Math.random() * 1000),
            teacherId: t.id,
            teacherName: t.name,
            department: t.department,
            division: t.division || 'Regular',                    // ← NEW
            course: 'Auto-generated — replace with actual course',
            originalDate: todayISO(),
            makeupDate: '',
            startTime: '',
            endTime: '',
            room: '',
            status: 'pending',
            studentsNotified: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            autoGenerated: true
          })
          save(MAKEUP_KEY, makeupClasses.value)
          messages.pushNotification(
            'dept_head',
            'alert',
            `Auto-created makeup class for ${t.name} — needs scheduling`,
            'warning',
            { teacherId: t.id, department: t.department }
          )
        }
      }
    } else if (existing && existing.status === 'active') {
      alerts.value[idx] = {
        ...existing,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: 'System (auto)'
      }
      messages.pushNotification(
        'dept_head',
        'alert',
        `Resolved: ${t.name} — attendance improved`,
        'success',
        { teacherId: t.id, department: t.department }
      )
      messages.pushNotification(
        'teacher',
        'alert',
        'Attendance streak reset — thanks for resuming classes',
        'success',
        { userId: t.id, teacherId: t.id, department: t.department }
      )
    }

    save(ALERTS_KEY, alerts.value)
  }

  /* ══════════════════════════════════════════════════════
     FULL RECOMPUTE — checks EVERY teacher
     ══════════════════════════════════════════════════════ */
  function recompute() {
    const directory = useDirectoryStore()
    const messages  = useMessagesStore()

    const prev = alerts.value.slice()
    const prevByTeacher = new Map(prev.map(a => [a.teacherId, a]))
    const next = []
    const teachers = directory.users.filter(u => u.role === 'teacher')

    teachers.forEach(t => {
      const count = consecutiveAbsences(t.id)

      if (count >= ALERT_THRESHOLDS.deptHead) {
        const existing = prevByTeacher.get(t.id)
        const escalated = count >= ALERT_THRESHOLDS.admin

        const alert = {
          id: existing?.id || Date.now() + Math.floor(Math.random() * 1000),
          teacherId: t.id,
          teacherName: t.name,
          department: t.department,
          count,
          escalated,
          status: 'active',
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        next.push(alert)

        const isNew = !existing || existing.status === 'resolved'
        const wasEscalated = existing?.escalated

        if (isNew || (!wasEscalated && escalated)) {
          messages.pushNotification(
            escalated ? 'admin' : 'dept_head',
            escalated ? 'critical-alert' : 'alert',
            escalated
              ? `ESCALATED: ${t.name} — ${count} consecutive absences`
              : `Alert: ${t.name} — ${count} consecutive absences`,
            escalated ? 'danger' : 'warning',
            { teacherId: t.id, department: t.department }
          )
          messages.pushNotification(
            'teacher',
            escalated ? 'critical-alert' : 'alert',
            escalated
              ? `Your attendance has been escalated to administration (${count} consecutive absences)`
              : `Attendance warning: ${count} consecutive absences recorded`,
            escalated ? 'danger' : 'warning',
            { userId: t.id, teacherId: t.id, department: t.department }
          )
        }

        if (isNew) {
          const already = makeupClasses.value.some(
            m => m.teacherId === t.id && m.status !== 'cancelled'
          )
          if (!already) {
            makeupClasses.value.unshift({
              id: Date.now() + Math.floor(Math.random() * 1000),
              teacherId: t.id,
              teacherName: t.name,
              department: t.department,
              division: t.division || 'Regular',                  // ← NEW
              course: 'Auto-generated — replace with actual course',
              originalDate: todayISO(),
              makeupDate: '',
              startTime: '',
              endTime: '',
              room: '',
              status: 'pending',
              studentsNotified: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              autoGenerated: true
            })
            save(MAKEUP_KEY, makeupClasses.value)
            messages.pushNotification(
              'dept_head',
              'alert',
              `Auto-created makeup class for ${t.name} — needs scheduling`,
              'warning',
              { teacherId: t.id, department: t.department }
            )
          }
        }
      } else {
        const existing = prevByTeacher.get(t.id)
        if (existing && existing.status === 'active') {
          next.push({
            ...existing,
            status: 'resolved',
            resolvedAt: new Date().toISOString(),
            resolvedBy: 'System (auto)'
          })
          messages.pushNotification(
            'dept_head',
            'alert',
            `Resolved: ${t.name} — attendance improved`,
            'success',
            { teacherId: t.id, department: t.department }
          )
          messages.pushNotification(
            'teacher',
            'alert',
            'Attendance streak reset — thanks for resuming classes',
            'success',
            { userId: t.id, teacherId: t.id, department: t.department }
          )
        } else if (existing) {
          next.push(existing)
        }
      }
    })

    alerts.value = next
    save(ALERTS_KEY, next)
    return next
  }

  /* ---------- manual resolve ---------- */
  function resolveAlert(alertId, resolverName) {
    const a = alerts.value.find(x => String(x.id) === String(alertId))
    if (!a) return
    a.status = 'resolved'
    a.resolvedAt = new Date().toISOString()
    a.resolvedBy = resolverName
    save(ALERTS_KEY, alerts.value)
    try {
      useSettingsStore().audit('Resolve Alert', 'Alerts', `Alert #${alertId} resolved by ${resolverName}`)
    } catch {}
  }

  /* ---------- makeup classes ---------- */
  function addMakeupClass(row) {
    const next = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'pending',
      ...row
    }
    makeupClasses.value.unshift(next)
    save(MAKEUP_KEY, makeupClasses.value)
    return next
  }

  function updateMakeupClass(id, patch) {
    const idx = makeupClasses.value.findIndex(m => m.id === +id)
    if (idx < 0) return null
    makeupClasses.value[idx] = {
      ...makeupClasses.value[idx],
      ...patch,
      id: +id,
      updatedAt: new Date().toISOString()
    }
    save(MAKEUP_KEY, makeupClasses.value)
    return makeupClasses.value[idx]
  }

  function completeMakeupClass(id) {
    return updateMakeupClass(id, { status: 'completed', completedAt: new Date().toISOString() })
  }

  function deleteMakeupClass(id) {
    makeupClasses.value = makeupClasses.value.filter(m => m.id !== +id)
    save(MAKEUP_KEY, makeupClasses.value)
  }

  function replaceAll({ alerts: a, makeupClasses: m }) {
    if (a) { alerts.value = a; save(ALERTS_KEY, a) }
    if (m) { makeupClasses.value = m; save(MAKEUP_KEY, m) }
  }

  return {
    alerts, makeupClasses,
    activeAlerts, resolvedAlerts, escalatedAlerts,
    alertsForTeacher, activeAlertsForDept,
    consecutiveAbsences,
    recompute,
    recomputeForTeacher,
    resolveAlert,
    addMakeupClass, updateMakeupClass, completeMakeupClass, deleteMakeupClass,
    replaceAll
  }
})