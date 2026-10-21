<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import KpiCard from '@/components/common/KpiCard.vue'
import ChartBox from '@/components/common/ChartBox.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { fmtDate } from '@/utils/format'

const session   = useSessionStore()
const directory = useDirectoryStore()
const reports   = useReportsStore()
const alerts    = useAlertsStore()

const myDept = computed(() => session.department)

/* ---------- which teachers can this role see? ---------- */
const visibleTeachers = computed(() => {
  if (session.role === 'dept_head') return directory.teachers.filter(t => t.department === myDept.value)
  if (session.role === 'teacher')   return directory.teachers.filter(t => t.id === session.userId)
  return directory.teachers
})

/* ---------- KPIs (per role) ---------- */
const kpis = computed(() => {
  /* ══════════ ADMIN ══════════ */
  if (session.role === 'admin') {
    const attRates = directory.teachers.map(t => reports.attendanceRate(t.id, 30)).filter(v => v !== null)
    const avgAtt = attRates.length ? Math.round(attRates.reduce((a, b) => a + b, 0) / attRates.length) : 0
    const perfAvgs = directory.teachers.map(t => reports.avgPerformance(t.id)).filter(v => v !== null)
    const avgPerf = perfAvgs.length ? (perfAvgs.reduce((a, b) => a + b, 0) / perfAvgs.length) : 0
    const escalated = alerts.activeAlerts.filter(a => a.escalated).length

    return [
      { label: 'Total Users',      value: directory.users.length, sub: `${directory.teachers.length} teachers · ${directory.students.length} students`, icon: 'people-fill',  color: 'brand', to: { name: 'users' } },
      { label: 'Attendance Rate',  value: avgAtt + '%',           sub: 'last 30 days',                                                                      icon: 'calendar-check', color: 'success', delta: 1.8 },
      { label: 'Active Alerts',    value: alerts.activeAlerts.length, sub: '3+ consecutive Reds',                                                          icon: 'bell-fill',    color: alerts.activeAlerts.length ? 'warning' : 'success', to: { name: 'alerts' } },
      { label: 'Escalated',        value: escalated,              sub: '5+ consecutive Reds',                                                                icon: 'exclamation-octagon-fill', color: escalated ? 'danger' : 'success', to: { name: 'alerts' } },
      { label: 'Avg Performance',  value: avgPerf ? avgPerf.toFixed(1) : '—', unit: '/5', sub: 'all reports',                                            icon: 'star-half',    color: 'brand' },
      { label: 'Departments',      value: directory.departments.length, sub: 'monitored',                                                                     icon: 'building',     color: 'info', to: { name: 'departments' } },
      { label: 'Total Reports',    value: reports.reports.length, sub: 'all submissions',                                                                     icon: 'journal-text', color: 'purple' },
      { label: 'Pending Disputes', value: allDisputes().filter(d => d.status === 'pending').length, sub: 'awaiting review',                               icon: 'chat-square-text', color: 'purple', to: { name: 'disputes' } }
    ]
  }

  /* ══════════ DEPT HEAD ══════════ */
  if (session.role === 'dept_head') {
    const teachers = visibleTeachers.value
    const attRates = teachers.map(t => reports.attendanceRate(t.id, 30)).filter(v => v !== null)
    const avgAtt = attRates.length ? Math.round(attRates.reduce((a, b) => a + b, 0) / attRates.length) : 0
    const perfs = teachers.map(t => reports.avgPerformance(t.id)).filter(v => v !== null)
    const avgPerf = perfs.length ? (perfs.reduce((a, b) => a + b, 0) / perfs.length) : 0
    const deptActive = alerts.activeAlertsForDept(myDept.value).length

    return [
      { label: 'My Teachers',      value: teachers.length, sub: myDept.value,                             icon: 'person-video3',   color: 'brand', to: { name: 'teachers' } },
      { label: 'Attendance',       value: avgAtt + '%',    sub: 'last 30 days',                           icon: 'calendar-check',  color: 'success' },
      { label: 'Active Alerts',    value: deptActive,      sub: 'in my department',                       icon: 'bell-fill',       color: deptActive ? 'warning' : 'success', to: { name: 'alerts' } },
      { label: 'Reports',          value: reports.reportsForDept(myDept.value).length, sub: 'department total', icon: 'journal-text', color: 'purple' },
      { label: 'Avg Performance',  value: avgPerf ? avgPerf.toFixed(1) : '—', unit: '/5', sub: 'all reports', icon: 'star-half', color: 'brand' },
      { label: 'Students',         value: directory.students.filter(s => s.department === myDept.value).length, sub: 'in department', icon: 'mortarboard-fill', color: 'info', to: { name: 'students' } },
      { label: 'Makeup Classes',   value: alerts.makeupClasses.filter(m => m.department === myDept.value).length, sub: 'scheduled', icon: 'calendar-plus', color: 'info', to: { name: 'makeup-classes' } },
      { label: 'Pending Disputes', value: allDisputes().filter(d => d.department === myDept.value && d.status === 'pending').length, sub: 'awaiting review', icon: 'chat-square-text', color: 'purple', to: { name: 'disputes' } }
    ]
  }

  /* ══════════ TEACHER ══════════ */
  if (session.role === 'teacher') {
    const me = session.userId
    const att = reports.attendanceRate(me, 30)
    const perf = reports.avgPerformance(me)
    const streak = alerts.consecutiveAbsences(me)
    const external = reports.reportsForTeacher(me).filter(r => !r.is_self).length

    return [
      { label: 'My Attendance',     value: att !== null ? att + '%' : '—', sub: 'last 30 days',                 icon: 'calendar-check',       color: 'success', to: { name: 'my-attendance' } },
      { label: 'Consecutive Reds',  value: streak, sub: streak >= 3 ? 'alert active' : 'current streak',       icon: 'exclamation-triangle', color: streak >= 3 ? 'danger' : 'info' },
      { label: 'Avg Performance',   value: perf !== null ? perf.toFixed(1) : '—', unit: '/5', sub: 'external feedback', icon: 'star-half',  color: 'brand', to: { name: 'my-performance' } },
      { label: 'Feedback Received', value: external, sub: 'class rep & student',                                icon: 'chat-dots',            color: 'purple' },
      { label: 'Self Reports',      value: reports.reports.filter(r => r.teacherId === me && r.is_self).length, sub: 'submitted by me', icon: 'pencil-square', color: 'warning', to: { name: 'self-reports' } },
      { label: 'Class Reports',     value: reports.classReports.filter(cr => cr.teacherId === me).length, sub: 'class observations', icon: 'journal-text', color: 'info', to: { name: 'class-reports' } },
      { label: 'My Disputes',       value: allDisputes().filter(d => d.teacherId === me).length, sub: 'submitted', icon: 'chat-square-text', color: 'purple', to: { name: 'my-disputes' } },
      { label: 'Messages',          value: messagesUnread(session.user), sub: 'unread', icon: 'envelope', color: 'danger', to: { name: 'messages' } }
    ]
  }

  /* ══════════ CLASS REP ══════════ */
  if (session.role === 'class_rep') {
    const mine = reports.reportsByUser(session.userId)
    const weekAgo = new Date(Date.now() - 7 * 864e5)
    return [
      { label: 'My Reports',     value: mine.length, sub: 'all time', icon: 'file-text', color: 'brand', to: { name: 'history' } },
      { label: 'This Week',      value: mine.filter(r => new Date(r.date) >= weekAgo).length, sub: 'submitted', icon: 'calendar-week', color: 'info' },
      { label: 'Teachers',       value: new Set(mine.map(r => r.teacherId)).size, sub: 'unique reported', icon: 'person-video3', color: 'purple' },
      { label: 'Absences',       value: mine.filter(r => r.attendance_rating === 'Red').length, sub: 'Red ratings', icon: 'exclamation-triangle', color: 'warning' },
      { label: 'Green Ratings',  value: mine.filter(r => r.attendance_rating === 'Green').length, sub: 'excellent', icon: 'check-circle-fill', color: 'success' },
      { label: 'Yellow Ratings', value: mine.filter(r => r.attendance_rating === 'Yellow').length, sub: 'needs attention', icon: 'exclamation-triangle-fill', color: 'warning' },
      { label: 'This Month',     value: mine.filter(r => new Date(r.date) >= new Date(Date.now() - 30 * 864e5)).length, sub: 'submitted', icon: 'calendar-check', color: 'info' },
      { label: 'Reports Today',  value: mine.filter(r => r.date === new Date().toISOString().slice(0, 10)).length, sub: 'today', icon: 'clock-history', color: 'brand' }
    ]
  }

  /* ══════════ STUDENT ══════════ */
  const mine = reports.reports.filter(r => r.reporterId === session.userId && r.reporter_role === 'student')
  const avgGiven = mine.length ? (mine.reduce((s, r) => s + reports.scoreFromPerf(r.performance_rating), 0) / mine.length) : 0
  return [
    { label: 'My Ratings',     value: mine.length, sub: 'all time', icon: 'star-half', color: 'brand', to: { name: 'my-ratings' } },
    { label: 'This Month',     value: mine.filter(r => new Date(r.date) >= new Date(Date.now() - 30 * 864e5)).length, sub: 'submitted', icon: 'calendar-check', color: 'info' },
    { label: 'Teachers Rated', value: new Set(mine.map(r => r.teacherId)).size, sub: 'unique', icon: 'person-video3', color: 'purple' },
    { label: 'Avg Given',      value: avgGiven ? avgGiven.toFixed(1) : '—', unit: '/5', sub: 'rating given', icon: 'graph-up', color: 'success' }
  ]
})

function allDisputes() {
  try { return JSON.parse(localStorage.getItem('tms_disputes') || '[]') } catch { return [] }
}
function messagesUnread(user) {
  if (!user) return 0
  try {
    const msgs = JSON.parse(localStorage.getItem('tms_messages') || '[]')
    return msgs.filter(m => m.toUserId === user.id && !m.read).length
  } catch { return 0 }
}

/* ---------- scope ---------- */
const scopedReports = computed(() => {
  if (session.role === 'admin') return reports.reports
  if (session.role === 'dept_head') return reports.reportsForDept(myDept.value)
  if (session.role === 'teacher') return reports.reportsForTeacher(session.userId)
  if (session.role === 'class_rep') return reports.reportsByUser(session.userId)
  return reports.reports.filter(r => r.reporterId === session.userId && r.reporter_role === 'student')
})

/* Admin department filter for Attendance Mix */
const adminMixDept = ref('')
const mixRows = computed(() => {
  let rows = scopedReports.value
  if (session.role === 'admin' && adminMixDept.value) {
    rows = rows.filter(r => r.department === adminMixDept.value)
  }
  return rows
})

/* ══════════════════════════════════════════════════════
   TREND RANGE SELECTOR (7D / 14D / 30D)
   ══════════════════════════════════════════════════════ */
const trendDays = ref(14)
const trendRange = computed(() => [
  { label: '7D',  value: 7  },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 }
])

/* ══════════════════════════════════════════════════════
   🔴 LIVE MODE — trend + bookmap
   ══════════════════════════════════════════════════════ */
const isLive       = ref(true)
const lastUpdate   = ref(Date.now())
const secondsAgo   = ref(0)
const scanPosition = ref(0)
const newCellKeys  = ref(new Set())
const trendKey     = ref(0)   // 🆕 forces trend chart re-render on refresh

let liveTimer = null, agoTimer = null, scanTimer = null

function flashNewCells() {
  const keys = new Set()
  bookmapData.value.forEach(row => {
    const last = row.cells[row.cells.length - 1]
    if (last && last.count > 0) keys.add(`${row.teacher.id}-${last.iso}`)
  })
  newCellKeys.value = keys
  setTimeout(() => { newCellKeys.value = new Set() }, 2000)

  /* 🆕 Re-render trend chart so it visually refreshes */
  trendKey.value++
}

function startLiveMode() {
  stopLiveMode()
  if (!isLive.value) return

  liveTimer = setInterval(() => {
    flashNewCells()
    lastUpdate.value = Date.now()
  }, 5000)

  agoTimer = setInterval(() => {
    secondsAgo.value = Math.floor((Date.now() - lastUpdate.value) / 1000)
  }, 1000)
}

function stopLiveMode() {
  if (liveTimer) clearInterval(liveTimer)
  if (agoTimer)  clearInterval(agoTimer)
  liveTimer = null
  agoTimer  = null
}

function toggleLive() {
  isLive.value = !isLive.value
  if (isLive.value) {
    lastUpdate.value = Date.now()
    secondsAgo.value = 0
    startLiveMode()
  } else {
    stopLiveMode()
  }
}

/* Watch for real new data */
watch(() => scopedReports.value.length, (n, o) => {
  if (n > o && isLive.value) {
    flashNewCells()
    lastUpdate.value = Date.now()
    secondsAgo.value = 0
  }
})

onMounted(() => {
  startLiveMode()
  scanTimer = setInterval(() => {
    scanPosition.value = (scanPosition.value + 1) % 120
  }, 60)
})

onUnmounted(() => {
  if (scanTimer) clearInterval(scanTimer)
  stopLiveMode()
})

/* ---------- trend chart ---------- */
const trendConfig = computed(() => {
  const days = trendDays.value
  const labels = []
  const attSeries = []
  const perfSeries = []
  const today = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    labels.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }))

    const dayRows = scopedReports.value.filter(r => r.date === iso && r.reporter_role === 'class_rep')
    if (!dayRows.length) { attSeries.push(null); perfSeries.push(null); continue }

    const present = dayRows.filter(r => r.attendance_rating !== 'Red').length
    attSeries.push(Math.round((present / dayRows.length) * 100))

    const dayPerfs = dayRows.filter(r => r.performance_rating).map(r => reports.scoreFromPerf(r.performance_rating))
    perfSeries.push(dayPerfs.length ? (dayPerfs.reduce((a, b) => a + b, 0) / dayPerfs.length) : null)
  }

  return {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Attendance Rate (%)', data: attSeries, borderColor: '#42d4f4', backgroundColor: 'rgba(66,212,244,.10)', tension: .4, fill: true, pointRadius: 3, pointHoverRadius: 7, pointBackgroundColor: '#42d4f4', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y',  spanGaps: true },
        { label: 'Avg Performance',     data: perfSeries, borderColor: '#a855f7', backgroundColor: 'transparent', tension: .4, borderDash: [5, 4], pointRadius: 3, pointHoverRadius: 7, pointBackgroundColor: '#a855f7', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y1', spanGaps: true }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#e2e8f0',
          padding: 10, cornerRadius: 8
        }
      },
      animation: { duration: 400, easing: 'easeOutQuart' },
      scales: {
        y:  { position: 'left',  beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(148,163,184,.15)' } },
        y1: { position: 'right', beginAtZero: true, max: 5,  grid: { display: false } },
        x:  { grid: { display: false } }
      }
    }
  }
})

/* ══════════════════════════════════════════════════════
   ATTENDANCE MIX — doughnut with role-aware center text
   ══════════════════════════════════════════════════════ */
const mixConfig = computed(() => {
  const rows = mixRows.value

  const classRepRows = rows.filter(r => r.reporter_role === 'class_rep')
  const mix = { Green: 0, Blue: 0, Yellow: 0, Red: 0 }
  classRepRows.forEach(r => {
    if (mix[r.attendance_rating] !== undefined) mix[r.attendance_rating]++
  })

  const totalReports    = rows.length
  const attendanceCount = classRepRows.length
  const studentCount    = rows.filter(r => r.reporter_role === 'student').length

  const studentRatings = rows.filter(r => r.reporter_role === 'student' && r.performance_rating)
  const avgStudent = studentRatings.length
    ? studentRatings.reduce((s, r) => s + reports.scoreFromPerf(r.performance_rating), 0) / studentRatings.length
    : null

  let line1 = '', line2 = '', line3 = '', line4 = ''

  if (session.role === 'class_rep') {
    line1 = `${totalReports}`
    line2 = 'MY REPORTS'
    line3 = `${attendanceCount} attendance`
    line4 = `${mix.Green} green · ${mix.Red} red`
  } else if (session.role === 'student') {
    line1 = `${totalReports}`
    line2 = 'MY RATINGS'
    line3 = `${studentRatings.length} with feedback`
    line4 = avgStudent !== null ? `avg ${avgStudent.toFixed(1)}/5 given` : 'no ratings yet'
  } else {
    line1 = avgStudent !== null ? `${avgStudent.toFixed(1)}/5` : '—/5'
    line2 = 'STUDENT AVG'
    line3 = `${totalReports} reports`
    line4 = `${attendanceCount} attendance · ${studentCount} student`
  }

  const centerTextPlugin = {
    id: 'attendanceCenterText',
    afterDraw(chart) {
      const { ctx, chartArea } = chart
      if (!chartArea) return
      const cx = (chartArea.left + chartArea.right) / 2
      const cy = (chartArea.top + chartArea.bottom) / 2
      const dark = document.documentElement.getAttribute('data-theme') === 'dark'
      const mainColor   = dark ? '#f3f6ff' : '#0b1220'
      const subtleColor = dark ? '#94a3b8' : '#64748b'
      const accentColor = '#4f6df5'

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      ctx.fillStyle = mainColor
      ctx.font = '800 24px Inter, -apple-system, sans-serif'
      ctx.fillText(line1, cx, cy - 22)

      ctx.fillStyle = subtleColor
      ctx.font = '700 9.5px Inter, sans-serif'
      ctx.fillText(line2, cx, cy - 4)

      ctx.fillStyle = mainColor
      ctx.font = '700 13px Inter, sans-serif'
      ctx.fillText(line3, cx, cy + 14)

      ctx.fillStyle = accentColor
      ctx.font = '700 10.5px Inter, sans-serif'
      ctx.fillText(line4, cx, cy + 30)

      ctx.restore()
    }
  }

  return {
    type: 'doughnut',
    data: {
      labels: ['Green', 'Blue', 'Yellow', 'Red'],
      datasets: [{
        data: [mix.Green, mix.Blue, mix.Yellow, mix.Red],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
        borderWidth: 0, hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '74%',
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed
              const pct = attendanceCount ? Math.round((v / attendanceCount) * 100) : 0
              return `${ctx.label}: ${v} (${pct}%)`
            }
          }
        }
      }
    },
    plugins: [centerTextPlugin]
  }
})

/* ══════════════════════════════════════════════════════
   BOOKMAP-STYLE REPORT FLOW (colorful)
   ══════════════════════════════════════════════════════ */
const bookmapDays = ref(30)

const bookmapData = computed(() => {
  const teachers = visibleTeachers.value
  const days     = bookmapDays.value
  const today    = new Date()
  today.setHours(0, 0, 0, 0)

  const dates = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d)
  }

  const ratingLevel = { Green: 1, Blue: 2, Yellow: 4, Red: 6 }
  const ratingRank  = { Green: 0, Blue: 1, Yellow: 2, Red: 3 }

  return teachers.map(t => {
    const teacherReports = scopedReports.value.filter(
      r => r.teacherId === t.id && r.reporter_role === 'class_rep'
    )

    const cells = dates.map(d => {
      const iso = d.toISOString().slice(0, 10)
      const dayReports = teacherReports.filter(r => r.date === iso)
      if (!dayReports.length) return { iso, level: 0, rating: null, count: 0 }

      let worst = 'Green', worstRank = -1
      dayReports.forEach(r => {
        const rank = ratingRank[r.attendance_rating] ?? 0
        if (rank > worstRank) { worstRank = rank; worst = r.attendance_rating }
      })

      return {
        iso,
        level: ratingLevel[worst] ?? 1,
        rating: worst,
        count: dayReports.length
      }
    })

    const total   = cells.reduce((s, c) => s + c.count, 0)
    const present = teacherReports.filter(r => r.attendance_rating !== 'Red').length
    const attRate = teacherReports.length ? Math.round((present / teacherReports.length) * 100) : null
    const reds    = cells.filter(c => c.rating === 'Red').length

    return { teacher: t, cells, total, attendance: attRate, reds }
  }).sort((a, b) => (a.teacher.name || '').localeCompare(b.teacher.name || ''))
})

const bookmapDateLabels = computed(() => {
  if (!bookmapData.value.length) return []
  return bookmapData.value[0].cells.map((c, i) => {
    if (i % 5 !== 0 && i !== bookmapData.value[0].cells.length - 1) return ''
    return new Date(c.iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  })
})

const bookmapMonthMarks = computed(() => {
  if (!bookmapData.value.length) return []
  const cells = bookmapData.value[0].cells
  const out = []
  let lastMonth = -1
  cells.forEach((c, i) => {
    const m = new Date(c.iso).getMonth()
    if (m !== lastMonth) {
      lastMonth = m
      out.push({
        col: i,
        label: new Date(c.iso).toLocaleDateString('en-GB', { month: 'short' }).toUpperCase()
      })
    }
  })
  return out
})

const bookmapStats = computed(() => {
  if (!bookmapData.value.length) return { totalReports: 0, totalReds: 0, avgAtt: null }
  const totalReports = bookmapData.value.reduce((s, r) => s + r.total, 0)
  const totalReds    = bookmapData.value.reduce((s, r) => s + r.reds, 0)
  const atts         = bookmapData.value.map(r => r.attendance).filter(v => v !== null)
  const avgAtt       = atts.length ? Math.round(atts.reduce((a, b) => a + b, 0) / atts.length) : null
  return { totalReports, totalReds, avgAtt }
})

/* ---------- department overview rows ---------- */
const deptRows = computed(() => {
  if (session.role !== 'admin') return []
  return directory.departments.map(d => {
    const teachers = directory.teachers.filter(t => t.department === d.name)
    const rates = teachers.map(t => reports.attendanceRate(t.id, 30)).filter(v => v !== null)
    const avg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0
    const perfs = teachers.map(t => reports.avgPerformance(t.id)).filter(v => v !== null)
    const perf = perfs.length ? (perfs.reduce((a, b) => a + b, 0) / perfs.length).toFixed(1) : '—'
    return {
      name: d.name, code: d.code, teachers: teachers.length,
      attendance: avg + '%', performance: perf,
      alerts: alerts.activeAlertsForDept(d.name).length
    }
  })
})

/* ---------- teachers requiring attention ---------- */
const attentionRows = computed(() => {
  return alerts.activeAlerts.map(a => ({
    teacherId: a.teacherId,
    teacherName: a.teacherName,
    department: a.department,
    count: a.count,
    escalated: a.escalated,
    createdAt: a.createdAt
  }))
})

/* ---------- paginators ---------- */
const deptPage = ref(1)
const deptPageSize = ref(10)
const deptPageRows = computed(() => {
  const start = (deptPage.value - 1) * deptPageSize.value
  return deptRows.value.slice(start, start + deptPageSize.value)
})
watch(deptRows, () => { deptPage.value = 1 })

const attnPage = ref(1)
const attnPageSize = ref(10)
const attnPageRows = computed(() => {
  const start = (attnPage.value - 1) * attnPageSize.value
  return attentionRows.value.slice(start, start + attnPageSize.value)
})
watch(attentionRows, () => { attnPage.value = 1 })

const recentPage = ref(1)
const recentPageSize = ref(10)
const recentRows = computed(() => scopedReports.value)
const recentPageRows = computed(() => {
  const start = (recentPage.value - 1) * recentPageSize.value
  return recentRows.value.slice(start, start + recentPageSize.value)
})
watch(recentRows, () => { recentPage.value = 1 })

/* ---------- greeting ---------- */
const heading = computed(() => {
  if (session.role === 'admin') return 'Administrator Dashboard'
  if (session.role === 'dept_head') return `${myDept.value} Department`
  if (session.role === 'teacher') return `Welcome, ${(session.user?.name || '').split(' ').slice(0, 2).join(' ')}`
  return `Welcome, ${session.user?.name}`
})

const subheading = computed(() => {
  if (session.role === 'admin') return `Cross-department teacher attendance & performance monitoring · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`
  if (session.role === 'dept_head') return `Departmental attendance & performance monitoring · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`
  if (session.role === 'teacher') return `${session.user?.position || 'Teacher'} · ${session.user?.department}`
  if (session.role === 'class_rep') return `Class Representative · ${session.user?.department}`
  return `${session.user?.department} · Student feedback portal`
})
</script>

<template>
  <div>
    <!-- ═══════════ PAGE HEADER ═══════════ -->
    <div class="page-hd">
      <div>
        <h1>{{ heading }}</h1>
        <div class="sub">{{ subheading }}</div>
      </div>
      <div class="page-hd-actions">
        <RouterLink v-if="session.role === 'class_rep'" :to="{ name: 'new-report' }" class="btn btn-primary btn-sm">
          <i class="bi bi-plus-lg"></i> Submit Daily Report
        </RouterLink>
        <RouterLink v-if="session.role === 'student'" :to="{ name: 'submit-rating' }" class="btn btn-primary btn-sm">
          <i class="bi bi-plus-lg"></i> Submit Rating
        </RouterLink>
        <RouterLink v-if="session.role === 'teacher'" :to="{ name: 'self-reports' }" class="btn btn-secondary btn-sm">
          <i class="bi bi-pencil-square"></i> Self Report
        </RouterLink>
        <RouterLink v-if="session.role === 'admin' || session.role === 'dept_head'" :to="{ name: 'alerts' }" class="btn btn-secondary btn-sm">
          <i class="bi bi-bell"></i> Alerts
        </RouterLink>
        <RouterLink v-if="session.role === 'admin'" :to="{ name: 'attendance-intel' }" class="btn btn-secondary btn-sm">
          <i class="bi bi-calendar3"></i> Attendance Intel
        </RouterLink>
        <RouterLink v-if="session.role === 'admin'" :to="{ name: 'performance-intel' }" class="btn btn-primary btn-sm">
          <i class="bi bi-graph-up-arrow"></i> Performance Intel
        </RouterLink>
      </div>
    </div>

    <!-- ═══════════ KPI CARDS ═══════════ -->
    <div class="row g-3 mb-4">
      <div v-for="(k, i) in kpis" :key="i" class="col-xl-3 col-md-6">
        <KpiCard v-bind="k" />
      </div>
    </div>

    <!-- ═══════════ TREND + MIX ═══════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-8">
        <div class="card h-100">
          <div class="card-hd">
            <div>
              <h3>
                <i class="bi bi-graph-up"></i> Attendance &amp; Performance Trend
                <span class="live-badge" :class="{ on: isLive }">
                  <span class="live-dot"></span>
                  {{ isLive ? 'LIVE' : 'PAUSED' }}
                </span>
              </h3>
              <div class="sub">
                Last {{ trendDays }} days · {{ scopedReports.length }} reports
                <span class="live-ago" v-if="isLive"> · updated {{ secondsAgo }}s ago</span>
              </div>
            </div>

            <div style="display:flex;gap:6px;align-items:center">
              <!-- 🔴 LIVE toggle -->
              <button
                class="btn btn-xs"
                :class="isLive ? 'btn-danger' : 'btn-success'"
                @click="toggleLive"
              >
                <i :class="isLive ? 'bi bi-pause-fill' : 'bi bi-play-fill'"></i>
                {{ isLive ? 'Pause' : 'Live' }}
              </button>

              <!-- 7D/14D/30D -->
              <button
                v-for="r in trendRange"
                :key="r.value"
                class="btn btn-xs"
                :class="trendDays === r.value ? 'btn-primary' : 'btn-secondary'"
                @click="trendDays = r.value"
              >
                {{ r.label }}
              </button>
            </div>
          </div>
          <div class="card-bd">
            <!-- 🆕 :key forces re-render/animation on live refresh -->
            <ChartBox :key="trendKey" :config="trendConfig" size="lg" />
          </div>
        </div>
      </div>
      <div class="col-xl-4">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-pie-chart"></i> Attendance Mix</h3>

            <select
              v-if="session.role === 'admin'"
              v-model="adminMixDept"
              class="inp"
              style="max-width:170px;height:30px;font-size:12px"
            >
              <option value="">All departments</option>
              <option v-for="d in directory.departments" :key="d.id" :value="d.name">
                {{ d.name }}
              </option>
            </select>
          </div>
          <div class="card-bd"><ChartBox :config="mixConfig" /></div>
        </div>
      </div>
    </div>

    <!-- ═══════════ BOOKMAP REPORT FLOW ═══════════ -->
    <div class="card mb-4">
      <div class="card-hd">
        <div>
          <h3>
            <i class="bi bi-grid-3x3-gap-fill"></i> Report Flow Bookmap
            <span class="live-badge" :class="{ on: isLive }">
              <span class="live-dot"></span>
              {{ isLive ? 'LIVE' : 'PAUSED' }}
            </span>
          </h3>
          <div class="sub">
            Attendance heat by teacher · last {{ bookmapDays }} days · red = worst (absent), cool = best
            <span class="live-ago" v-if="isLive"> · updated {{ secondsAgo }}s ago</span>
          </div>
        </div>

        <div style="display:flex;gap:6px;align-items:center">
          <button
            class="btn btn-xs"
            :class="isLive ? 'btn-danger' : 'btn-success'"
            @click="toggleLive"
          >
            <i :class="isLive ? 'bi bi-pause-fill' : 'bi bi-play-fill'"></i>
            {{ isLive ? 'Pause' : 'Live' }}
          </button>

          <button
            v-for="r in [
              { l: '15D', v: 15 },
              { l: '30D', v: 30 },
              { l: '60D', v: 60 }
            ]"
            :key="r.v"
            class="btn btn-xs"
            :class="bookmapDays === r.v ? 'btn-primary' : 'btn-secondary'"
            @click="bookmapDays = r.v"
          >
            {{ r.l }}
          </button>
        </div>
      </div>

      <div class="card-bd">
        <div class="bookmap-shell">
          <div class="bookmap-header">
            <div class="bookmap-logo">
              <i class="bi bi-bar-chart-fill" style="color:#42d4f4"></i>
              SMU · REPORT FLOW
            </div>
            <div class="bm-h-legend">
              <span class="muted">Less</span>
              <span class="sw bm-0"></span>
              <span class="sw bm-1"></span>
              <span class="sw bm-2"></span>
              <span class="sw bm-3"></span>
              <span class="sw bm-4"></span>
              <span class="sw bm-5"></span>
              <span class="sw bm-6"></span>
              <span class="muted">Hot</span>
            </div>
          </div>

          <div class="bookmap-top-axis">
            <span
              v-for="m in bookmapMonthMarks"
              :key="m.label + m.col"
              :style="{ left: (m.col * 18 + 2) + 'px' }"
            >{{ m.label }}</span>
          </div>

          <div class="bookmap-body">
            <div class="bookmap-left-axis">
              <div
                v-for="row in bookmapData"
                :key="'L' + row.teacher.id"
                class="bm-row-label"
                :title="row.teacher.name"
              >
                {{ row.teacher.name.split(' ').slice(0, 3).join(' ') }}
              </div>
              <div v-if="!bookmapData.length" class="bm-row-label muted">No teachers</div>
            </div>

            <div class="bookmap-grid">
              <div
                v-if="isLive"
                class="bm-scan-beam"
                :style="{ left: scanPosition + 'px' }"
              ></div>

              <div
                v-for="(row, rowIdx) in bookmapData"
                :key="'R' + row.teacher.id"
                class="bm-row"
              >
                <div
                  v-for="(cell, ci) in row.cells"
                  :key="ci"
                  class="bm-cell"
                  :class="[
                    `bm-${cell.level}`,
                    {
                      'bm-has-report': cell.count > 0,
                      'bm-new': newCellKeys.has(`${row.teacher.id}-${cell.iso}`)
                    }
                  ]"
                  :style="{ animationDelay: (rowIdx * 30 + ci * 8) + 'ms' }"
                  :title="`${row.teacher.name} · ${cell.iso} · ${cell.rating || 'No report'} (${cell.count} report${cell.count === 1 ? '' : 's'})`"
                ></div>
              </div>

              <div v-if="!bookmapData.length" class="bm-empty">No teachers in scope</div>
            </div>

            <div class="bookmap-right-axis">
              <div
                v-for="row in bookmapData"
                :key="'S' + row.teacher.id"
                class="bm-stat-row"
              >
                <span class="bm-total">{{ row.total }}</span>
                <span class="bm-att" :class="{ 'att-good': row.attendance >= 90, 'att-warn': row.attendance < 90 && row.attendance >= 70, 'att-bad': row.attendance < 70 }">
                  {{ row.attendance !== null ? row.attendance + '%' : '—' }}
                </span>
                <span class="bm-reds" :class="{ 'has-red': row.reds > 0 }">
                  <i class="bi bi-circle-fill"></i> {{ row.reds }}
                </span>
              </div>
            </div>
          </div>

          <div class="bookmap-bottom-axis">
            <span
              v-for="(d, i) in bookmapDateLabels"
              :key="i"
              class="bm-date-label"
              :style="{ left: (i * 18 + 2) + 'px' }"
            >{{ d }}</span>
          </div>

          <div class="bookmap-footer">
            <div class="bm-foot-stat">
              <i class="bi bi-people-fill"></i>
              <b>{{ bookmapData.length }}</b> teachers
            </div>
            <div class="bm-foot-stat">
              <i class="bi bi-bar-chart-fill"></i>
              <b>{{ bookmapStats.totalReports }}</b> reports
            </div>
            <div class="bm-foot-stat">
              <i class="bi bi-fire"></i>
              <b>{{ bookmapStats.totalReds }}</b> red ratings
            </div>
            <div class="bm-foot-stat">
              <i class="bi bi-graph-up"></i>
              <b>{{ bookmapStats.avgAtt !== null ? bookmapStats.avgAtt + '%' : '—' }}</b> avg attendance
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ DEPT OVERVIEW + TEACHERS REQUIRING ATTENTION ═══════════ -->
    <div v-if="session.role === 'admin' || session.role === 'dept_head'" class="row g-3 mb-4">
      <div :class="session.role === 'admin' ? 'col-xl-6' : 'col-12'">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-building"></i> Department Overview</h3>
            <RouterLink v-if="session.role === 'admin'" :to="{ name: 'departments' }" class="btn btn-ghost btn-xs">
              Manage <i class="bi bi-arrow-right"></i>
            </RouterLink>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Department</th>
                  <th class="num">Teachers</th>
                  <th class="num">Attendance</th>
                  <th class="num">Avg Perf</th>
                  <th class="num">Alerts</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!deptPageRows.length">
                  <td colspan="5"><EmptyState icon="building" title="No departments" /></td>
                </tr>
                <tr v-for="d in deptPageRows" :key="d.code">
                  <td>
                    <span class="badge-x b-brand">{{ d.code }}</span>
                    <b style="margin-left:6px">{{ d.name }}</b>
                  </td>
                  <td class="num">{{ d.teachers }}</td>
                  <td class="num">{{ d.attendance }}</td>
                  <td class="num">{{ d.performance }}</td>
                  <td class="num">
                    <span v-if="d.alerts" class="badge-x b-red">{{ d.alerts }}</span>
                    <span v-else class="muted">0</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pagination v-model:page="deptPage" v-model:page-size="deptPageSize" :total="deptRows.length" :sizes="[5, 10, 25]" />
        </div>
      </div>

      <div :class="session.role === 'admin' ? 'col-xl-6' : 'col-12'">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-bell"></i> Teachers Requiring Attention</h3>
            <RouterLink :to="{ name: 'alerts' }" class="btn btn-ghost btn-xs">
              All alerts <i class="bi bi-arrow-right"></i>
            </RouterLink>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Department</th>
                  <th class="num">Streak</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!attnPageRows.length">
                  <td colspan="4"><EmptyState icon="check2-circle" title="All clear" text="No active alerts" /></td>
                </tr>
                <tr v-for="a in attnPageRows" :key="a.teacherId">
                  <td>
                    <RouterLink :to="{ name: 'teacher-detail', params: { id: a.teacherId } }"
                                style="color:var(--ink-800);text-decoration:none;font-weight:600">
                      {{ a.teacherName }}
                    </RouterLink>
                  </td>
                  <td class="muted">{{ a.department }}</td>
                  <td class="num">{{ a.count }} Reds</td>
                  <td>
                    <span class="alert-pill" :class="a.escalated ? 'alert-critical' : 'alert-warning'">
                      <i :class="a.escalated ? 'bi bi-exclamation-octagon-fill' : 'bi bi-exclamation-triangle-fill'"></i>
                      {{ a.escalated ? 'Escalated' : 'Alert' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pagination v-model:page="attnPage" v-model:page-size="attnPageSize" :total="attentionRows.length" :sizes="[5, 10, 25]" />
        </div>
      </div>
    </div>

    <!-- ═══════════ RECENT ACTIVITY ═══════════ -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-clock-history"></i> Recent Activity</h3>
        <span class="badge-x b-brand">{{ scopedReports.length }} records</span>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Teacher</th>
              <th>Course</th>
              <th>Attendance</th>
              <th>Performance</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!recentPageRows.length">
              <td colspan="6">
                <EmptyState icon="journal" title="No activity yet" text="Reports will appear here once submitted." />
              </td>
            </tr>
            <tr v-for="r in recentPageRows" :key="r.id">
              <td>{{ fmtDate(r.date) }}</td>
              <td><b>{{ r.teacher }}</b><div class="t-xs muted">{{ r.department }}</div></td>
              <td class="muted">{{ r.course }}</td>
              <td>
                <span v-if="r.attendance_rating" class="badge-x"
                      :class="{ 'b-green': r.attendance_rating === 'Green', 'b-blue': r.attendance_rating === 'Blue', 'b-amber': r.attendance_rating === 'Yellow', 'b-red': r.attendance_rating === 'Red' }">
                  {{ r.attendance_rating }}
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <span v-if="r.performance_rating" class="badge-x"
                      :class="{ 'b-green': r.performance_rating === 'Green', 'b-blue': r.performance_rating === 'Blue', 'b-amber': r.performance_rating === 'Yellow', 'b-red': r.performance_rating === 'Red' }">
                  {{ r.performance_rating }}
                </span>
                <span v-else class="muted">—</span>
              </td>
              <td>
                <span class="badge-x"
                      :class="r.reporter_role === 'student' ? 'b-blue' : r.is_self ? 'b-amber' : 'b-purple'">
                  {{ r.is_self ? 'Self' : r.reporter_role === 'student' ? 'Student' : 'Class Rep' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pagination v-model:page="recentPage" v-model:page-size="recentPageSize" :total="recentRows.length" :sizes="[10, 25, 50, 100]" />
    </div>
  </div>
</template>