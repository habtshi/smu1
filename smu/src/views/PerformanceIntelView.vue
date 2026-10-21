<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import KpiCard from '@/components/common/KpiCard.vue'
import ChartBox from '@/components/common/ChartBox.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { exportCSV } from '@/utils/format'
import { useToast } from '@/composables/useToast'
import { SCORE } from '@/utils/constants'

const route     = useRoute()
const session   = useSessionStore()
const directory = useDirectoryStore()
const reports   = useReportsStore()
const toast     = useToast()

/* ---------- initial state ---------- */
const initialDept = session.role === 'dept_head'
  ? session.department
  : (route.query.dept || '')

const deptFilter    = ref(initialDept)
const teacherFilter = ref('')
const sourceFilter  = ref('')
const divFilter     = ref('')       // 🆕 division filter
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
  let rows = reports.reports.filter(r => r.performance_rating)
  if (deptFilter.value)    rows = rows.filter(r => r.department === deptFilter.value)
  if (teacherFilter.value) rows = rows.filter(r => String(r.teacherId) === String(teacherFilter.value))
  if (sourceFilter.value) {
    if (sourceFilter.value === 'teacher') rows = rows.filter(r => r.is_self)
    else rows = rows.filter(r => r.reporter_role === sourceFilter.value)
  }

  /* 🆕 Division filter */
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
const total     = computed(() => filtered.value.length)
const avgScore  = computed(() => {
  if (!total.value) return 0
  return filtered.value.reduce((s, r) => s + (SCORE[r.performance_rating] || 0), 0) / total.value
})
const greenCount  = computed(() => filtered.value.filter(r => r.performance_rating === 'Green').length)
const yellowCount = computed(() => filtered.value.filter(r => r.performance_rating === 'Yellow').length)
const stuCount    = computed(() => filtered.value.filter(r => r.reporter_role === 'student').length)
const repCount    = computed(() => filtered.value.filter(r => r.reporter_role === 'class_rep').length)

/* ══════════════════════════════════════════════════════
   🔴 LIVE MODE
   ══════════════════════════════════════════════════════ */
const isLive      = ref(true)
const lastUpdate  = ref(Date.now())
const secondsAgo  = ref(0)

let liveTimer = null, agoTimer = null

function startLiveMode() {
  stopLiveMode()
  if (!isLive.value) return

  liveTimer = setInterval(() => {
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
    lastUpdate.value = Date.now()
    secondsAgo.value = 0
  }
})

onMounted(() => { startLiveMode() })
onUnmounted(() => { stopLiveMode() })

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
   PERFORMANCE TREND — LIVE with gradient + glow
   ══════════════════════════════════════════════════════ */
const trendConfig = computed(() => {
  const days = trendDays.value
  const labels = [], scores = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    labels.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }))
    const dayRows = filtered.value.filter(r => r.date === iso)
    scores.push(dayRows.length
      ? dayRows.reduce((s, r) => s + (SCORE[r.performance_rating] || 0), 0) / dayRows.length
      : null)
  }
  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Avg Rating',
        data: scores,
        borderColor: '#a855f7',
        borderWidth: 2.5,
        backgroundColor: (ctx) => {
          const chart = ctx.chart
          const { ctx: c, chartArea } = chart
          if (!chartArea) return 'rgba(168,85,247,.15)'
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, 'rgba(168,85,247,.45)')
          g.addColorStop(1, 'rgba(168,85,247,.02)')
          return g
        },
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 7,
        pointBackgroundColor: '#a855f7',
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
          padding: 10, cornerRadius: 8,
          callbacks: { label: (ctx) => ` ${ctx.parsed.y?.toFixed(2) || '—'} / 5` }
        }
      },
      animation: { duration: 400, easing: 'easeOutQuart' },
      scales: {
        y: { min: 0, max: 5, ticks: { stepSize: 1 }, grid: { color: 'rgba(148,163,184,.15)' } },
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
  filtered.value.forEach(r => { if (mix[r.performance_rating] !== undefined) mix[r.performance_rating]++ })

  const tot = mix.Green + mix.Blue + mix.Yellow + mix.Red
  const avg = tot
    ? (mix.Green * 5 + mix.Blue * 4 + mix.Yellow * 2 + mix.Red * 1) / tot
    : 0

  const centerTextPlugin = {
    id: 'perfCenterText',
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
      ctx.font = '800 26px Inter, -apple-system, sans-serif'
      ctx.fillText(avg ? avg.toFixed(1) : '—', cx, cy - 12)

      ctx.fillStyle = subtleColor
      ctx.font = '700 10px Inter, sans-serif'
      ctx.fillText('/ 5 AVG', cx, cy + 10)

      ctx.fillStyle = subtleColor
      ctx.font = '500 10px Inter, sans-serif'
      ctx.fillText(`${tot} ratings`, cx, cy + 26)

      ctx.restore()
    }
  }

  return {
    type: 'doughnut',
    data: {
      labels: ['Excellent (G)', 'Good (B)', 'Needs Improvement (Y)', 'Not Delivered (R)'],
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
              const pct = tot ? Math.round((v / tot) * 100) : 0
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
   FEEDBACK BY SOURCE — gradient bars + rich tooltips
   ══════════════════════════════════════════════════════ */
const sourceConfig = computed(() => {
  const labels = ['Green', 'Blue', 'Yellow']
  const srcRep = labels.map(r => filtered.value.filter(x => x.reporter_role === 'class_rep' && x.performance_rating === r).length)
  const srcStu = labels.map(r => filtered.value.filter(x => x.reporter_role === 'student' && x.performance_rating === r).length)
  const srcSelf = labels.map(r => filtered.value.filter(x => x.is_self && x.performance_rating === r).length)

  const totals = {
    'Class Rep': srcRep.reduce((a, b) => a + b, 0),
    'Students':  srcStu.reduce((a, b) => a + b, 0),
    'Self':      srcSelf.reduce((a, b) => a + b, 0)
  }

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Class Rep',
          data: srcRep,
          backgroundColor: (ctx) => {
            const { ctx: c, chartArea } = ctx.chart
            if (!chartArea) return '#7c3aed'
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
            g.addColorStop(0, '#a78bfa'); g.addColorStop(1, '#7c3aed')
            return g
          },
          hoverBackgroundColor: '#8b5cf6',
          borderRadius: { topLeft: 8, topRight: 8 },
          borderSkipped: false,
          maxBarThickness: 40,
          shadowOffsetY: 4,
          shadowBlur: 8,
          shadowColor: 'rgba(124, 58, 237, .25)'
        },
        {
          label: 'Students',
          data: srcStu,
          backgroundColor: (ctx) => {
            const { ctx: c, chartArea } = ctx.chart
            if (!chartArea) return '#3b82f6'
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
            g.addColorStop(0, '#60a5fa'); g.addColorStop(1, '#2563eb')
            return g
          },
          hoverBackgroundColor: '#2563eb',
          borderRadius: { topLeft: 8, topRight: 8 },
          borderSkipped: false,
          maxBarThickness: 40,
          shadowOffsetY: 4,
          shadowBlur: 8,
          shadowColor: 'rgba(59, 130, 246, .25)'
        },
        {
          label: 'Self Reports',
          data: srcSelf,
          backgroundColor: (ctx) => {
            const { ctx: c, chartArea } = ctx.chart
            if (!chartArea) return '#f59e0b'
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
            g.addColorStop(0, '#fbbf24'); g.addColorStop(1, '#d97706')
            return g
          },
          hoverBackgroundColor: '#f59e0b',
          borderRadius: { topLeft: 8, topRight: 8 },
          borderSkipped: false,
          maxBarThickness: 40,
          shadowOffsetY: 4,
          shadowBlur: 8,
          shadowColor: 'rgba(245, 158, 11, .25)'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: 'top', align: 'end' },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#e2e8f0',
          padding: 12,
          cornerRadius: 10,
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 12 },
          callbacks: {
            afterBody: (items) => {
              const src = items[0].dataset.label
              const tot = totals[src] || 0
              return ['', `Total from ${src}: ${tot}`]
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
   BY DEPARTMENT — gradient bars + rich tooltips
   ══════════════════════════════════════════════════════ */
const deptChartConfig = computed(() => {
  const depts = directory.departments.map(d => d.name)
  const rows  = depts.map(d => {
    const rs = filtered.value.filter(r => r.department === d)
    const avg = rs.length
      ? rs.reduce((s, r) => s + (SCORE[r.performance_rating] || 0), 0) / rs.length
      : 0
    const dept = directory.departments.find(x => x.name === d) || {}
    return {
      name: d,
      code: dept.code || d,
      avg,
      total: rs.length,
      green: rs.filter(r => r.performance_rating === 'Green').length,
      yellow: rs.filter(r => r.performance_rating === 'Yellow').length
    }
  })

  return {
    type: 'bar',
    data: {
      labels: rows.map(r => r.code),
      datasets: [{
        data: rows.map(r => r.avg),
        backgroundColor: (ctx) => {
          const { ctx: c, chartArea } = ctx.chart
          if (!chartArea) return '#4f6df5'
          const v = rows[ctx.dataIndex]?.avg ?? 0

          const palette = v >= 4.5
            ? ['#34d399', '#10b981', '#059669']
            : v >= 3.5
            ? ['#60a5fa', '#3b82f6', '#2563eb']
            : v >= 2.5
            ? ['#fbbf24', '#f59e0b', '#d97706']
            : ['#f87171', '#ef4444', '#dc2626']

          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          g.addColorStop(0, palette[0])
          g.addColorStop(0.5, palette[1])
          g.addColorStop(1, palette[2])
          return g
        },
        hoverBackgroundColor: rows.map(r =>
          r.avg >= 4.5 ? '#10b981' :
          r.avg >= 3.5 ? '#3b82f6' :
          r.avg >= 2.5 ? '#f59e0b' : '#ef4444'
        ),
        borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        maxBarThickness: 52,
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
                `  Avg Rating: ${r.avg.toFixed(2)} / 5`,
                `  Ratings: ${r.total}`,
                `  ✅ Excellent: ${r.green}`,
                `  ⚠️ Needs work: ${r.yellow}`
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
          min: 0, max: 5,
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

/* ---------- Ranking ---------- */
const ranking = computed(() => {
  return teachers.value
    .map(t => {
      const rs = filtered.value.filter(r => r.teacherId === t.id)
      const cnt = { Green: 0, Blue: 0, Yellow: 0 }
      rs.forEach(r => { if (cnt[r.performance_rating] !== undefined) cnt[r.performance_rating]++ })
      const avg = rs.length
        ? rs.reduce((s, r) => s + (SCORE[r.performance_rating] || 0), 0) / rs.length
        : 0
      return { teacher: t, avg, cnt, total: rs.length }
    })
    .filter(x => x.total > 0)
    .sort((a, b) => b.avg - a.avg)
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
  sourceFilter.value = ''
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
    Performance: r.performance_rating,
    Source: r.is_self ? 'Self' : r.reporter_role,
    Comment: r.comments
  }))
  if (exportCSV(rows, 'performance-report')) toast.ok('Export started')
}

function scoreBadgeClass(avg) {
  return avg >= 4.5 ? 'b-green' : avg >= 3.5 ? 'b-blue' : avg >= 2.5 ? 'b-amber' : 'b-red'
}
</script>

<template>
  <div>
    <!-- ═══════════ PAGE HEADER ═══════════ -->
    <div class="page-hd">
      <div>
        <h1>Performance Intelligence</h1>
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

      <select v-model="sourceFilter" class="inp" style="max-width:180px;height:34px">
        <option value="">All sources</option>
        <option value="class_rep">Class Representative</option>
        <option value="student">Student</option>
        <option value="teacher">Self Report</option>
      </select>

      <!-- 🆕 Division filter -->
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
        <KpiCard label="Avg Rating"
                 :value="avgScore ? avgScore.toFixed(2) : '—'" unit="/5"
                 :sub="total + ' reports'" icon="star-half" color="brand" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Excellent" :value="greenCount" sub="Green ratings"
                 icon="check-circle-fill" color="success" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Needs Improvement" :value="yellowCount" sub="Yellow ratings"
                 icon="exclamation-triangle-fill" color="warning" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="By Source"
                 :value="`${repCount} / ${stuCount}`"
                 sub="class rep / student"
                 icon="people" color="purple" />
      </div>
    </div>

    <!-- ═══════════ TREND + DISTRIBUTION ═══════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-8">
        <div class="card h-100">
          <div class="card-hd">
            <div>
              <h3>
                <i class="bi bi-graph-up"></i> Performance Trend
                <span class="live-badge" :class="{ on: isLive }">
                  <span class="live-dot"></span>
                  {{ isLive ? 'LIVE' : 'PAUSED' }}
                </span>
              </h3>
              <div class="sub">
                Last {{ trendDays }} days · {{ total }} reports
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

    <!-- ═══════════ SOURCE + DEPARTMENT ═══════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd"><h3><i class="bi bi-people"></i> Feedback by Source</h3></div>
          <div class="card-bd"><ChartBox :config="sourceConfig" /></div>
        </div>
      </div>
      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-building"></i> By Department</h3>
            <span class="muted t-xs">click a bar to filter</span>
          </div>
          <div class="card-bd"><ChartBox :config="deptChartConfig" /></div>
        </div>
      </div>
    </div>

    <!-- ═══════════ RANKING ═══════════ -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-bar-chart-steps"></i> Teacher Performance Ranking</h3>
        <span class="badge-x b-brand">{{ ranking.length }} teachers</span>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Department</th>
              <th>Division</th>
              <th class="num">Avg Rating</th>
              <th class="num">Excellent</th>
              <th class="num">Good</th>
              <th class="num">Needs Improvement</th>
              <th class="num">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td colspan="8"><EmptyState icon="people" title="No data" /></td>
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
              <td class="num">
                <span class="badge-x" :class="scoreBadgeClass(r.avg)">
                  {{ r.avg.toFixed(2) }}/5
                </span>
              </td>
              <td class="num">{{ r.cnt.Green }}</td>
              <td class="num">{{ r.cnt.Blue }}</td>
              <td class="num">{{ r.cnt.Yellow }}</td>
              <td class="num">{{ r.total }}</td>
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