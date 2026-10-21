// src/stores/__tests__/alerts.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAlertsStore } from '@/stores/alerts'
import { useReportsStore } from '@/stores/reports'

/* Helper — seed reports for a single teacher */
function seedReports(list) {
  const reports = useReportsStore()
  reports.replaceAll({ reports: list, classReports: [] })
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('alerts.consecutiveAbsences', () => {
  it('returns 0 when no reports exist', () => {
    seedReports([])
    const alerts = useAlertsStore()
    expect(alerts.consecutiveAbsences(10)).toBe(0)
  })

  it('counts 3 consecutive Reds', () => {
    seedReports([
      { id: 1, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red', date: '2026-03-10' },
      { id: 2, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red', date: '2026-03-09' },
      { id: 3, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red', date: '2026-03-08' }
    ])
    const alerts = useAlertsStore()
    expect(alerts.consecutiveAbsences(10)).toBe(3)
  })

  it('stops counting at first non-Red', () => {
    seedReports([
      { id: 1, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red',    date: '2026-03-10' },
      { id: 2, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red',    date: '2026-03-09' },
      { id: 3, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Green',  date: '2026-03-08' },
      { id: 4, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red',    date: '2026-03-07' }
    ])
    const alerts = useAlertsStore()
    expect(alerts.consecutiveAbsences(10)).toBe(2)
  })

  it('collapses multiple same-day reports — Red wins', () => {
    seedReports([
      // same day, two reports — one Red, one Green → Red wins
      { id: 1, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Green', date: '2026-03-10' },
      { id: 2, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red',   date: '2026-03-10' },
      // previous day Red
      { id: 3, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red',   date: '2026-03-09' }
    ])
    const alerts = useAlertsStore()
    expect(alerts.consecutiveAbsences(10)).toBe(2)
  })

  it('ignores reports from other reporters (student/self)', () => {
    seedReports([
      { id: 1, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red', date: '2026-03-10' },
      { id: 2, teacherId: 10, reporter_role: 'student',   attendance_rating: 'Red', date: '2026-03-09' },
      { id: 3, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red', date: '2026-03-08' }
    ])
    const alerts = useAlertsStore()
    // Only the two class_rep records count — but 03-09 is skipped, so we still
    // get 2 consecutive because the sort is by date descending and non-class-rep rows are filtered out
    expect(alerts.consecutiveAbsences(10)).toBe(2)
  })

  it('ignores other teachers', () => {
    seedReports([
      { id: 1, teacherId: 10, reporter_role: 'class_rep', attendance_rating: 'Red', date: '2026-03-10' },
      { id: 2, teacherId: 11, reporter_role: 'class_rep', attendance_rating: 'Red', date: '2026-03-09' }
    ])
    const alerts = useAlertsStore()
    expect(alerts.consecutiveAbsences(10)).toBe(1)
    expect(alerts.consecutiveAbsences(11)).toBe(1)
  })
})

describe('alerts.resolveAlert', () => {
  it('marks an alert as resolved and records who did it', () => {
    const alerts = useAlertsStore()
    alerts.replaceAll({
      alerts: [{
        id: 999,
        teacherId: 10,
        teacherName: 'Dr. Tadesse',
        department: 'Computer Science',
        count: 3,
        escalated: false,
        status: 'active',
        createdAt: new Date().toISOString()
      }],
      makeupClasses: []
    })

    alerts.resolveAlert(999, 'Admin User')

    const a = alerts.alerts.find(x => x.id === 999)
    expect(a.status).toBe('resolved')
    expect(a.resolvedBy).toBe('Admin User')
    expect(a.resolvedAt).toBeTruthy()
  })
})