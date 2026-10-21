import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDirectoryStore } from './directory'
import { useAlertsStore } from './alerts'

const REPORTS_KEY       = 'tms_reports'
const CLASS_REPORTS_KEY = 'tms_classReports'
const SEED_FLAG         = 'tms_reports_seeded_v3'

function load(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback }
  catch { return fallback }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

function scoreFromPerf(r) {
  return r === 'Green' ? 5 : r === 'Blue' ? 4 : r === 'Yellow' ? 2 : r === 'Red' ? 1 : 0
}
function scoreFromAtt(r) {
  return r === 'Green' ? 5 : r === 'Blue' ? 4 : r === 'Yellow' ? 2 : r === 'Red' ? 1 : 0
}

/* ---------- seed generator ---------- */
function generateSeedReports() {
  const dir = useDirectoryStore()
  const rows = []
  const today = new Date()
  let id = 1

  const teachers = dir.users.filter(u => u.role === 'teacher')
  const repsByDept = {}
  dir.users
    .filter(u => u.role === 'class_rep')
    .forEach(r => { repsByDept[r.department] = r })
  const courses = dir.courses

  for (let d = 40; d >= 0; d--) {
    const day = new Date(today)
    day.setDate(day.getDate() - d)
    if (day.getDay() === 0) continue
    const dateStr = day.toISOString().slice(0, 10)

    teachers.forEach(t => {
      const rep = repsByDept[t.department]
      if (!rep) return
      const course = courses.find(c => c.teacherId === t.id) || courses[0]
      if (!course) return

      const seed = (t.id * 7 + d * 13) % 100
      let att = 'Green'
      if (seed >= 92) att = 'Red'
      else if (seed >= 82) att = 'Yellow'
      else if (seed >= 65) att = 'Blue'

      const pseed = (t.id * 11 + d * 17) % 100
      let perf = 'Green'
      if (pseed >= 85) perf = 'Yellow'
      else if (pseed >= 55) perf = 'Blue'

      rows.push({
        id: id++,
        date: dateStr,
        teacherId: t.id,
        teacher: t.name,
        course: course.code + ' · ' + course.name,
        courseId: course.id,
        department: t.department,
        attendance_rating: att,
        performance_rating: perf,
        comments:
          att === 'Red'      ? 'Teacher did not attend the session.' :
          att === 'Yellow'   ? 'Teacher arrived late.' :
          perf === 'Yellow'  ? 'Session was rushed.' :
                                'Session completed as planned.',
        reporterId: rep.id,
        reporter: rep.name,
        reporter_role: 'class_rep',
        is_self: false,
        _createdAt: day.toISOString()
      })

      const deptStudents = dir.users.filter(u =>
        u.role === 'student' && u.department === t.department
      )
      if (deptStudents.length) {
        const student = deptStudents[seed % deptStudents.length]
        const sseed = (t.id * 5 + d * 11) % 100
        let sRating = 'Green'
        if (sseed >= 75) sRating = 'Yellow'
        else if (sseed >= 40) sRating = 'Blue'

        rows.push({
          id: id++,
          date: dateStr,
          teacherId: t.id,
          teacher: t.name,
          course: course.code + ' · ' + course.name,
          courseId: course.id,
          department: t.department,
          attendance_rating: null,
          performance_rating: sRating,
          comments:
            sRating === 'Green' ? 'Clear and engaging session.' :
            sRating === 'Blue'  ? 'Good session overall.' :
                                  'Could be more structured.',
          reporterId: student.id,
          reporter: student.name,
          reporter_role: 'student',
          is_self: false,
          _createdAt: day.toISOString()
        })
      }
    })
  }
  return rows
}

export const useReportsStore = defineStore('reports', () => {
  let initial = load(REPORTS_KEY, null)
  if (!initial || initial.length === 0) {
    try { initial = generateSeedReports() } catch { initial = [] }
    save(REPORTS_KEY, initial)
    localStorage.setItem(SEED_FLAG, '1')
  }

  const reports      = ref(initial)
  const classReports = ref(load(CLASS_REPORTS_KEY, []))

  const dailyReports   = computed(() => reports.value.filter(r => r.reporter_role === 'class_rep'))
  const studentRatings = computed(() => reports.value.filter(r => r.reporter_role === 'student'))
  const selfReports    = computed(() => reports.value.filter(r => r.is_self === true))

  function reportById(id) {
    return reports.value.find(r => r.id === +id) || null
  }
  function reportsForTeacher(id) {
    return reports.value
      .filter(r => r.teacherId === +id)
      .sort((a, b) => b.date.localeCompare(a.date))
  }
  function reportsForDept(dept) {
    return reports.value
      .filter(r => r.department === dept)
      .sort((a, b) => b.date.localeCompare(a.date))
  }
  function reportsByUser(id) {
    return reports.value
      .filter(r => r.reporterId === +id)
      .sort((a, b) => b.date.localeCompare(a.date))
  }
  function classReportsForTeacher(id) {
    return classReports.value.filter(r => r.teacherId === +id)
  }

  function attendanceRate(teacherId, days = 30) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const iso = cutoff.toISOString().slice(0, 10)
    const rows = reports.value.filter(r =>
      r.teacherId === +teacherId &&
      r.reporter_role === 'class_rep' &&
      r.date >= iso
    )
    if (!rows.length) return null
    const present = rows.filter(r => r.attendance_rating !== 'Red').length
    return Math.round((present / rows.length) * 100)
  }

  function avgPerformance(teacherId, { includeSelf = false } = {}) {
    const rows = reports.value.filter(r =>
      r.teacherId === +teacherId &&
      r.performance_rating &&
      (includeSelf || !r.is_self)
    )
    if (!rows.length) return null
    return rows.reduce((s, r) => s + scoreFromPerf(r.performance_rating), 0) / rows.length
  }

  /* ---------- CRUD ---------- */
  function addReport(report) {
    const row = { id: Date.now(), createdAt: new Date().toISOString(), ...report }
    reports.value.unshift(row)
    save(REPORTS_KEY, reports.value)
    try { useAlertsStore().recomputeForTeacher(row.teacherId) } catch {}   // ← CHANGED
    return row
  }

  function updateReport(id, patch) {
    const i = reports.value.findIndex(r => r.id === +id)
    if (i < 0) return null
    reports.value[i] = { ...reports.value[i], ...patch, id: +id }
    save(REPORTS_KEY, reports.value)
    try { useAlertsStore().recomputeForTeacher(reports.value[i].teacherId) } catch {}   // ← CHANGED
    return reports.value[i]
  }

  function deleteReport(id) {
    const row = reports.value.find(r => r.id === +id)
    reports.value = reports.value.filter(r => r.id !== +id)
    save(REPORTS_KEY, reports.value)
    try { if (row) useAlertsStore().recomputeForTeacher(row.teacherId) } catch {}   // ← CHANGED
  }

  function addClassReport(report) {
    const row = { id: Date.now(), createdAt: new Date().toISOString(), ...report }
    classReports.value.unshift(row)
    save(CLASS_REPORTS_KEY, classReports.value)
    return row
  }

  function replaceAll({ reports: r, classReports: c }) {
    if (r) { reports.value = r; save(REPORTS_KEY, r) }
    if (c) { classReports.value = c; save(CLASS_REPORTS_KEY, c) }
  }

  return {
    reports, classReports,
    dailyReports, studentRatings, selfReports,
    reportById, reportsForTeacher, reportsForDept, reportsByUser, classReportsForTeacher,
    attendanceRate, avgPerformance,
    addReport, updateReport, deleteReport, addClassReport,
    replaceAll,
    scoreFromPerf, scoreFromAtt
  }
})