<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import KpiCard from '@/components/common/KpiCard.vue'
import ChartBox from '@/components/common/ChartBox.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { exportCSV, fmtDate } from '@/utils/format'
import { useToast } from '@/composables/useToast'

const route     = useRoute()
const session   = useSessionStore()
const directory = useDirectoryStore()
const reports   = useReportsStore()
const alerts    = useAlertsStore()
const toast     = useToast()

/* ---------- initial state ---------- */
const initialDept = session.role === 'dept_head'
  ? session.department
  : (route.query.dept || '')

const deptFilter    = ref(initialDept)
const teacherFilter = ref('')
const divFilter     = ref('')
const fromDate      = ref('')
const toDate        = ref('')

const isDeptHead = computed(() => session.role === 'dept_head')

/* ---------- teachers dropdown ---------- */
const teachers = computed(() =>
  directory.teachers.filter(t => {
    if (deptFilter.value && t.department !== deptFilter.value) return false
    if (divFilter.value) {
      const div = t.division || 'Regular'
      if (divFilter.value === 'Both') return div === 'Both'
      return div === divFilter.value || div === 'Both'
    }
    return true
  })
)

/* ---------- helper — division of teacher ---------- */
function divisionOf(teacherId) {
  const t = directory.userById(teacherId)
  return t?.division || 'Regular'
}

/* ---------- filtered rows ---------- */
const filtered = computed(() => {
  let rows = reports.reports.filter(r => r.reporter_role === 'class_rep')
  if (deptFilter.value)    rows = rows.filter(r => r.department === deptFilter.value)
  if (teacherFilter.value) rows = rows.filter(r => String(r.teacherId) === String(teacherFilter.value))

  if (divFilter.value) {
    rows = rows.filter(r => {
      const div = divisionOf(r.teacherId)
      if (divFilter.value === 'Both') return div === 'Both'
      return div === divFilter.value || div === 'Both'
    })
  }

  if (fromDate.value) rows = rows.filter(r => r.date >= fromDate.value)
  if (toDate.value)   rows = rows.filter(r => r.date <= toDate.value)
  return rows
})

/* ---------- KPIs ---------- */
const totalRows = computed(() => filtered.value.length)
const rate = computed(() => {
  if (!totalRows.value) return 0
  const present = filtered.value.filter(r => r.attendance_rating !== 'Red').length
  return Math.round((present / totalRows.value) * 100)
})
const greenCount = computed(() => filtered.value.filter(r => r.attendance_rating === 'Green').length)
const redCount   = computed(() => filtered.value.filter(r => r.attendance_rating === 'Red').length)
const activeStreaks = computed(() =>
  teachers.value.filter(t => alerts.consecutiveAbsences(t.id) >= 3).length
)

/* ══════════════════════════════════════════════════════
   🔴 LIVE — trend chart + bookmap refresh
   ══════════════════════════════════════════════════════ */
const isLive       = ref(true)
const lastUpdate   = ref(Date.now())
const secondsAgo   = ref(0)
const scanPosition = ref(0)
const newCellKeys  = ref(new Set())

let liveTimer = null, agoTimer = null, scanTimer = null

function flashNewCells() {
  const keys = new Set()
  bookmapData.value.forEach(row => {
    const last = row.cells[row.cells.length - 1]
    if (last && last.hasRed) keys.add(`${row.teacher.id}-${last.iso}`)
  })
  newCellKeys.value = keys
  setTimeout(() => { newCellKeys.value = new Set() }, 2000)
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

watch(() => filtered.value.length, (n, o) => {
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

/* ══════════════════════════════════════════════════════
   TREND RANGE SELECTOR (7D / 14D / 30D)
   ══════════════════════════════════════════════════════ */
const trendDays = ref(30)
const trendRange = computed(() => [
  { label: '7D',  value: 7  },
  { label: '14D', value: 14 },
  { label: '30D', value: 30 }
])

/* ══════════════════════════════════════════════════════
   TREND CHART — LIVE with gradient + glow
   ══════════════════════════════════════════════════════ */
const trendConfig = computed(() => {
  const days = trendDays.value
  const labels = []
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    labels.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }))
    const dayRows = filtered.value.filter(r => r.date === iso)
    const p = dayRows.filter(r => r.attendance_rating !== 'Red').length
    series.push(dayRows.length ? Math.round((p / dayRows.length) * 100) : null)
  }

  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Attendance %',
        data: series,
        borderColor: '#42d4f4',
        borderWidth: 2.5,
        backgroundColor: (ctx) => {
          const chart = ctx.chart
          const { ctx: c, chartArea } = chart
          if (!chartArea) return 'rgba(66,212,244,.15)'
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, 'rgba(66,212,244,.45)')
          g.addColorStop(1, 'rgba(66,212,244,.02)')
          return g
        },
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 7,
        pointBackgroundColor: '#42d4f4',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        spanGaps: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#e2e8f0',
          padding: 10,
          cornerRadius: 8,
          callbacks: { label: (ctx) => ` ${ctx.parsed.y}% attendance` }
        }
      },
      animation: { duration: 400, easing: 'easeOutQuart' },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(148,163,184,.15)' } },
        x: { grid: { display: false } }
      }
    }
  }
})

/* ══════════════════════════════════════════════════════
   RATING DISTRIBUTION — doughnut with center number
   ══════════════════════════════════════════════════════ */
const distConfig = computed(() => {
  const mix = { Green: 0, Blue: 0, Yellow: 0, Red: 0 }
  filtered.value.forEach(r => { if (mix[r.attendance_rating] !== undefined) mix[r.attendance_rating]++ })

  const total = mix.Green + mix.Blue + mix.Yellow + mix.Red
  const present = mix.Green + mix.Blue + mix.Yellow
  const attendanceRate = total ? Math.round((present / total) * 100) : 0

  const centerTextPlugin = {
    id: 'distCenterText',
    afterDraw(chart) {
      const { ctx, chartArea } = chart
      if (!chartArea) return
      const cx = (chartArea.left + chartArea.right) / 2
      const cy = (chartArea.top + chartArea.bottom) / 2
      const dark = document.documentElement.getAttribute('data-theme') === 'dark'
      const mainColor   = dark ? '#f3f6ff' : '#0b1220'
      const subtleColor = dark ? '#94a3b8' : '#64748b'

      ctx.save()
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      ctx.fillStyle = mainColor
      ctx.font = '800 28px Inter, -apple-system, sans-serif'
      ctx.fillText(`${attendanceRate}%`, cx, cy - 10)

      ctx.fillStyle = subtleColor
      ctx.font = '700 10px Inter, sans-serif'
      ctx.fillText('ATTENDANCE', cx, cy + 14)

      ctx.fillStyle = subtleColor
      ctx.font = '500 10px Inter, sans-serif'
      ctx.fillText(`${total} reports`, cx, cy + 30)

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
      responsive: true, maintainAspectRatio: false, cutout: '72%',
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed
              const pct = total ? Math.round((v / total) * 100) : 0
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
   BY DEPARTMENT — gradient bars + rich tooltips
   ══════════════════════════════════════════════════════ */
const deptChartConfig = computed(() => {
  const depts = directory.departments.map(d => d.name)
  const rows  = depts.map(d => {
    const rs = filtered.value.filter(r => r.department === d)
    const present = rs.filter(r => r.attendance_rating !== 'Red').length
    const rate = rs.length ? Math.round((present / rs.length) * 100) : 0
    const dept = directory.departments.find(x => x.name === d) || {}
    return {
      name: d,
      code: dept.code || d,
      rate,
      total: rs.length,
      green: rs.filter(r => r.attendance_rating === 'Green').length,
      red:   rs.filter(r => r.attendance_rating === 'Red').length
    }
  })

  return {
    type: 'bar',
    data: {
      labels: rows.map(r => r.code),
      datasets: [{
        data: rows.map(r => r.rate),
        backgroundColor: (ctx) => {
          const chart = ctx.chart
          const { ctx: c, chartArea } = chart
          if (!chartArea) return '#4f6df5'
          const v = rows[ctx.dataIndex]?.rate ?? 0

          const palette = v >= 90
            ? ['#34d399', '#10b981', '#059669']
            : v >= 75
            ? ['#60a5fa', '#3b82f6', '#2563eb']
            : v >= 60
            ? ['#fbbf24', '#f59e0b', '#d97706']
            : ['#f87171', '#ef4444', '#dc2626']

          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, palette[0])
          g.addColorStop(0.5, palette[1])
          g.addColorStop(1, palette[2])
          return g
        },
        hoverBackgroundColor: rows.map(r =>
          r.rate >= 90 ? '#10b981' :
          r.rate >= 75 ? '#3b82f6' :
          r.rate >= 60 ? '#f59e0b' : '#ef4444'
        ),
        borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        maxBarThickness: 52,
        shadowOffsetX: 0,
        shadowOffsetY: 6,
        shadowBlur: 12,
        shadowColor: 'rgba(15, 23, 42, .15)'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#e2e8f0',
          padding: 12,
          cornerRadius: 10,
          displayColors: false,
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12 },
          callbacks: {
            title: (items) => rows[items[0].dataIndex].name,
            label: (ctx) => {
              const r = rows[ctx.dataIndex]
              return [
                `  Attendance: ${r.rate}%`,
                `  Reports: ${r.total}`,
                `  ✅ Green: ${r.green}`,
                `  🚨 Red: ${r.red}`
              ]
            }
          }
        }
      },
      onClick: (e, els) => {
        if (els.length && !isDeptHead.value) {
          deptFilter.value = depts[els[0].index]
        }
      },
      scales: {
        y: {
          beginAtZero: true, max: 100,
          ticks: { callback: v => v + '%', color: '#94a3b8', font: { size: 11, weight: '600' } },
          grid: { color: 'rgba(148,163,184,.12)', drawBorder: false }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 12, weight: '700' } }
        }
      }
    }
  }
})

/* ══════════════════════════════════════════════════════
   CONSECUTIVE ABSENCE ANALYSIS — glowing gradient bars
   ══════════════════════════════════════════════════════ */
const streakConfig = computed(() => {
  const buckets = { zero: 0, low: 0, mid: 0, high: 0 }
  const names   = { zero: [], low: [], mid: [], high: [] }

  teachers.value.forEach(t => {
    const s = alerts.consecutiveAbsences(t.id)
    if (s === 0)     { buckets.zero++; names.zero.push(t.name) }
    else if (s <= 2) { buckets.low++;  names.low.push(`${t.name} (${s})`) }
    else if (s <= 4) { buckets.mid++;  names.mid.push(`${t.name} (${s})`) }
    else             { buckets.high++; names.high.push(`${t.name} (${s})`) }
  })

  return {
    type: 'bar',
    data: {
      labels: ['0 Reds', '1–2 Reds', '3–4 Reds', '5+ Reds'],
      datasets: [{
        data: [buckets.zero, buckets.low, buckets.mid, buckets.high],
        backgroundColor: (ctx) => {
          const chart = ctx.chart
          const { ctx: c, chartArea } = chart
          if (!chartArea) return '#10b981'

          const palette = [
            ['#6ee7b7', '#10b981', '#047857'],
            ['#7dd3fc', '#3b82f6', '#1e40af'],
            ['#fde047', '#f59e0b', '#b45309'],
            ['#fca5a5', '#ef4444', '#991b1b']
          ][ctx.dataIndex] || ['#10b981', '#10b981', '#10b981']

          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, palette[0])
          g.addColorStop(0.5, palette[1])
          g.addColorStop(1, palette[2])
          return g
        },
        hoverBackgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
        borderRadius: { topLeft: 12, topRight: 12 },
        borderSkipped: false,
        maxBarThickness: 68,
        shadowOffsetX: 0,
        shadowOffsetY: 8,
        shadowBlur: 14,
        shadowColor: 'rgba(15, 23, 42, .18)'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutBounce' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#e2e8f0',
          padding: 12,
          cornerRadius: 10,
          displayColors: false,
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12 },
          callbacks: {
            title: (items) => {
              const labels = [
                'Healthy — no streak',
                'Watch — 1 to 2',
                'Alert — 3 to 4 (Dept Head notified)',
                'Escalated — 5+ (Admin notified)'
              ]
              return labels[items[0].dataIndex]
            },
            label: (ctx) => {
              const key = ['zero', 'low', 'mid', 'high'][ctx.dataIndex]
              const list = names[key]
              const head = `${list.length} teacher${list.length === 1 ? '' : 's'}`
              if (!list.length) return head
              const preview = list.slice(0, 4).join(', ')
              const more = list.length > 4 ? ` +${list.length - 4} more` : ''
              return [head, ' ', preview + more]
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#94a3b8', font: { size: 11, weight: '600' } },
          grid: { color: 'rgba(148,163,184,.12)', drawBorder: false }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { size: 12, weight: '700' } }
        }
      }
    }
  }
})

/* ══════════════════════════════════════════════════════
   🔴 RED-ONLY BOOKMAP — only Reds appear, count = intensity
   ══════════════════════════════════════════════════════ */
const bookmapDays = ref(30)

const bookmapData = computed(() => {
  const ts    = teachers.value
  const days  = bookmapDays.value
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dates = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    dates.push(d)
  }

  return ts.map(t => {
    const teacherReports = filtered.value.filter(r => r.teacherId === t.id)

    const cells = dates.map(d => {
      const iso = d.toISOString().slice(0, 10)
      const dayReports = teacherReports.filter(r => r.date === iso)
      const redCount   = dayReports.filter(r => r.attendance_rating === 'Red').length

      let level = 0
      if (redCount === 1)      level = 1
      else if (redCount === 2) level = 2
      else if (redCount >= 3)  level = 3

      return {
        iso,
        level,
        redCount,
        count: dayReports.length,
        hasRed: redCount > 0
      }
    })

    const total   = cells.reduce((s, c) => s + c.count, 0)
    const present = teacherReports.filter(r => r.attendance_rating !== 'Red').length
    const attRate = teacherReports.length ? Math.round((present / teacherReports.length) * 100) : null
    const reds    = teacherReports.filter(r => r.attendance_rating === 'Red').length

    return { teacher: t, cells, total, attendance: attRate, reds }
  }).sort((a, b) => b.reds - a.reds || (a.teacher.name || '').localeCompare(b.teacher.name || ''))
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

/* ---------- Ranking table ---------- */
const ranking = computed(() => {
  return teachers.value.map(t => {
    const rs = filtered.value.filter(r => r.teacherId === t.id)
    const cnt = { Green: 0, Blue: 0, Yellow: 0, Red: 0 }
    rs.forEach(r => { if (cnt[r.attendance_rating] !== undefined) cnt[r.attendance_rating]++ })
    const rate = rs.length ? Math.round(((cnt.Green + cnt.Blue + cnt.Yellow) / rs.length) * 100) : 0
    const streak = alerts.consecutiveAbsences(t.id)
    return { teacher: t, cnt, rate, streak, total: rs.length }
  }).sort((a, b) => b.rate - a.rate)
})

/* ---------- pagination for ranking ---------- */
const page     = ref(1)
const pageSize = ref(10)
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return ranking.value.slice(start, start + pageSize.value)
})
function onSize(v) { pageSize.value = v; page.value = 1 }
watch(ranking, () => { page.value = 1 })

/* ---------- Actions ---------- */
function resetFilters() {
  teacherFilter.value = ''
  divFilter.value = ''
  fromDate.value = ''
  toDate.value = ''
  if (!isDeptHead.value) deptFilter.value = ''
}

watch(deptFilter, () => { teacherFilter.value = '' })
watch(divFilter, () => { teacherFilter.value = '' })

function onExport() {
  const rows = filtered.value.map(r => ({
    Date: r.date, Teacher: r.teacher, Department: r.department,
    Division: divisionOf(r.teacherId),
    Course: r.course,
    Attendance: r.attendance_rating, Performance: r.performance_rating, Reporter: r.reporter
  }))
  if (exportCSV(rows, 'attendance-report')) toast.ok('Export started')
}
</script>

<template>
  <div>
    <!-- ═══════════ PAGE HEADER ═══════════ -->
    <div class="page-hd">
      <div>
        <h1>Attendance Intelligence</h1>
        <div class="sub">Interactive analytics · {{ deptFilter || 'university-wide' }}</div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-secondary btn-sm" @click="onExport">
          <i class="bi bi-download"></i> Export
        </button>
      </div>
    </div>

    <!-- ═══════════ FILTERS ═══════════ -->
    <div class="filter-bar">
      <select v-model="deptFilter" :disabled="isDeptHead" class="inp" style="max-width:200px;height:34px">
        <option value="">All departments</option>
        <option v-for="d in directory.departments" :key="d.id" :value="d.name">{{ d.name }}</option>
      </select>

      <select v-model="teacherFilter" class="inp" style="max-width:220px;height:34px">
        <option value="">All teachers</option>
        <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>

      <!-- Division filter -->
      <select v-model="divFilter" class="inp" style="max-width:160px;height:34px">
        <option value="">All divisions</option>
        <option value="Regular">Regular</option>
        <option value="Extension">Extension</option>
        <option value="Both">Both</option>
      </select>

      <input v-model="fromDate" type="date" class="inp" style="max-width:160px;height:34px" />
      <input v-model="toDate" type="date" class="inp" style="max-width:160px;height:34px" />

      <button class="btn btn-ghost btn-sm" @click="resetFilters">
        <i class="bi bi-arrow-clockwise"></i> Reset
      </button>
    </div>

    <!-- ═══════════ KPIs ═══════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Attendance Rate" :value="rate + '%'" :sub="totalRows + ' reports'"
                 icon="calendar-check" color="success" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Green Ratings" :value="greenCount" sub="excellent"
                 icon="check-circle-fill" color="brand" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Red Ratings" :value="redCount" sub="absences"
                 icon="x-octagon-fill" color="danger" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Active Streaks" :value="activeStreaks" sub="teachers with 3+"
                 icon="fire" color="warning" :to="{ name: 'alerts' }" />
      </div>
    </div>

    <!-- ═══════════ TREND + DISTRIBUTION ═══════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-8">
        <div class="card h-100">
          <div class="card-hd">
            <div>
              <h3>
                <i class="bi bi-graph-up"></i> Attendance Trend
                <span class="live-badge" :class="{ on: isLive }">
                  <span class="live-dot"></span>
                  {{ isLive ? 'LIVE' : 'PAUSED' }}
                </span>
              </h3>
              <div class="sub">
                Last {{ trendDays }} days · {{ totalRows }} reports
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
            <ChartBox :config="trendConfig" size="lg" />
          </div>
        </div>
      </div>
      <div class="col-xl-4">
        <div class="card h-100">
          <div class="card-hd"><h3><i class="bi bi-pie-chart"></i> Rating Distribution</h3></div>
          <div class="card-bd"><ChartBox :config="distConfig" /></div>
        </div>
      </div>
    </div>

    <!-- ═══════════ DEPARTMENT + STREAK ═══════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-building"></i> By Department</h3>
            <span class="muted t-xs">click a bar to filter</span>
          </div>
          <div class="card-bd"><ChartBox :config="deptChartConfig" /></div>
        </div>
      </div>
      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd"><h3><i class="bi bi-bar-chart-steps"></i> Consecutive Absence Analysis</h3></div>
          <div class="card-bd"><ChartBox :config="streakConfig" /></div>
        </div>
      </div>
    </div>

    <!-- ═══════════ 🔴 RED-ONLY LIVE BOOKMAP ═══════════ -->
    <div class="card mb-4">
      <div class="card-hd">
        <div>
          <h3>
            <i class="bi bi-grid-3x3-gap-fill"></i> Absence Bookmap
            <span class="live-badge" :class="{ on: isLive }">
              <span class="live-dot"></span>
              {{ isLive ? 'LIVE' : 'PAUSED' }}
            </span>
          </h3>
          <div class="sub">
            Red intensity by teacher · last {{ bookmapDays }} days · only absences shown
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
        <div class="bookmap-shell bookmap-red">
          <div class="bookmap-header">
            <div class="bookmap-logo">
              <i class="bi bi-bar-chart-fill" style="color:#ff5555"></i>
              SMU · ABSENCE RADAR
            </div>
            <div class="bm-h-legend">
              <span class="muted">None</span>
              <span class="sw bm-empty-cell"></span>
              <span class="sw bm-red-1"></span>
              <span class="sw bm-red-2"></span>
              <span class="sw bm-red-3"></span>
              <span class="muted">Absent</span>
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
                    cell.hasRed ? `bm-red-${cell.level}` : 'bm-empty-cell',
                    {
                      'bm-hot': cell.level >= 3,
                      'bm-new': newCellKeys.has(`${row.teacher.id}-${cell.iso}`)
                    }
                  ]"
                  :style="{ animationDelay: (rowIdx * 30 + ci * 8) + 'ms' }"
                  :title="cell.hasRed
                    ? `${row.teacher.name} · ${cell.iso} · 🚨 ${cell.redCount} Red${cell.redCount > 1 ? 's' : ''}`
                    : `${row.teacher.name} · ${cell.iso} · No absence`"
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
              <i class="bi bi-fire" style="color:#ff5555"></i>
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

    <!-- ═══════════ RANKING ═══════════ -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-people"></i> Teacher Attendance Ranking</h3>
        <span class="badge-x b-brand">{{ ranking.length }} teachers</span>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Department</th>
              <th>Division</th>
              <th class="num">Attendance Rate</th>
              <th class="num">Green</th>
              <th class="num">Blue</th>
              <th class="num">Yellow</th>
              <th class="num">Red</th>
              <th class="num">Streak</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td colspan="9"><EmptyState icon="people" title="No data" /></td>
            </tr>
            <tr v-for="r in pageRows" :key="r.teacher.id">
              <td>
                <RouterLink :to="{ name: 'teacher-detail', params: { id: r.teacher.id } }"
                            style="color:var(--ink-800);text-decoration:none;font-weight:600">
                  {{ r.teacher.name }}
                </RouterLink>
              </td>
              <td class="muted">{{ r.teacher.department }}</td>
              <td>
                <span class="badge-x"
                      :class="r.teacher.division === 'Extension' ? 'b-purple' :
                              r.teacher.division === 'Both' ? 'b-brand' : 'b-blue'">
                  <i :class="r.teacher.division === 'Extension' ? 'bi bi-moon-stars' :
                             r.teacher.division === 'Both' ? 'bi bi-arrow-left-right' : 'bi bi-sun'"></i>
                  {{ r.teacher.division || 'Regular' }}
                </span>
              </td>
              <td class="num">{{ r.rate }}%</td>
              <td class="num">{{ r.cnt.Green }}</td>
              <td class="num">{{ r.cnt.Blue }}</td>
              <td class="num">{{ r.cnt.Yellow }}</td>
              <td class="num">{{ r.cnt.Red }}</td>
              <td class="num">
                <span v-if="r.streak >= 3" class="badge-x b-red">{{ r.streak }}</span>
                <span v-else>{{ r.streak }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="ranking.length"
        :sizes="[10, 25, 50, 100]"
        @update:page-size="onSize"
      />
    </div>
  </div>
</template>