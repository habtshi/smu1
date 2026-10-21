<script setup>
import { ref, computed } from 'vue'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import { useDisputesStore } from '@/stores/disputes'
import { useMessagesStore } from '@/stores/messages'
import { useSettingsStore } from '@/stores/settings'
import { useBackup } from '@/composables/useBackup'
import Modal from '@/components/common/Modal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import ChartBox from '@/components/common/ChartBox.vue'
import { useToast } from '@/composables/useToast'
import { downloadJSON, fmtDateTime, fmtDate } from '@/utils/format'

const directory = useDirectoryStore()
const reports   = useReportsStore()
const alerts    = useAlertsStore()
const disputes  = useDisputesStore()
const messages  = useMessagesStore()
const settings  = useSettingsStore()
const backup    = useBackup()
const toast     = useToast()

const current = computed(() => settings.settings.academicYear || '2025/2026')
const next    = computed(() => settings.nextAcademicYear(current.value))
const archives = computed(() => settings.academicYears)

/* ══════════════════════════════════════════════════════
   TIME RANGE SELECTOR (1M / 3M / 6M / 1Y)
   ══════════════════════════════════════════════════════ */
const rangeDays = ref(90)
const ranges = [
  { label: '1M', value: 30,  label2: 'Last month' },
  { label: '3M', value: 90,  label2: 'Last 3 months' },
  { label: '6M', value: 180, label2: 'Last 6 months' },
  { label: '1Y', value: 365, label2: 'Last 12 months' }
]

const rangeLabel = computed(() =>
  (ranges.find(r => r.value === rangeDays.value) || {}).label2 || 'Custom'
)

/* ---------- cutoff dates ---------- */
const cutoffISO = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - rangeDays.value)
  return d.toISOString().slice(0, 10)
})
const cutoffTs = computed(() => {
  const d = new Date()
  d.setDate(d.getDate() - rangeDays.value)
  return d.getTime()
})

/* ---------- ranged data ---------- */
const rangedReports = computed(() =>
  reports.reports.filter(r => r.date >= cutoffISO.value)
)
const rangedClassReports = computed(() =>
  reports.classReports.filter(r => (r.date || '').slice(0, 10) >= cutoffISO.value)
)
const rangedAlerts = computed(() =>
  alerts.alerts.filter(a => new Date(a.createdAt).getTime() >= cutoffTs.value)
)
const rangedDisputes = computed(() =>
  disputes.disputes.filter(d => new Date(d.submittedAt).getTime() >= cutoffTs.value)
)
const rangedMakeup = computed(() =>
  alerts.makeupClasses.filter(m => new Date(m.createdAt).getTime() >= cutoffTs.value)
)

/* ---------- KPI values for range ---------- */
const rangeKpis = computed(() => {
  const rr = rangedReports.value
  const green = rr.filter(r => r.attendance_rating === 'Green').length
  const red   = rr.filter(r => r.attendance_rating === 'Red').length
  const present = rr.filter(r => r.attendance_rating && r.attendance_rating !== 'Red').length
  const attendanceRate = rr.length ? Math.round((present / rr.length) * 100) : 0

  const performanceRows = rr.filter(r => r.performance_rating)
  const perfScore = performanceRows.length
    ? performanceRows.reduce((s, r) => {
        const v = r.performance_rating
        return s + (v === 'Green' ? 5 : v === 'Blue' ? 4 : v === 'Yellow' ? 2 : v === 'Red' ? 1 : 0)
      }, 0) / performanceRows.length
    : 0

  return {
    reports: rr.length,
    classReports: rangedClassReports.value.length,
    alerts: rangedAlerts.value.length,
    escalated: rangedAlerts.value.filter(a => a.escalated).length,
    disputes: rangedDisputes.value.length,
    pendingDisputes: rangedDisputes.value.filter(d => d.status === 'pending').length,
    makeup: rangedMakeup.value.length,
    attendanceRate,
    green, red,
    performance: perfScore
  }
})

/* ---------- Monthly activity buckets ---------- */
const monthlyActivity = computed(() => {
  const months = []
  const now = new Date()
  const monthCount = rangeDays.value <= 30 ? 1 : rangeDays.value <= 90 ? 3 : rangeDays.value <= 180 ? 6 : 12

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
    months.push({ key, label, reports: 0, alerts: 0, disputes: 0 })
  }

  rangedReports.value.forEach(r => {
    const key = (r.date || '').slice(0, 7)
    const m = months.find(x => x.key === key)
    if (m) m.reports++
  })
  rangedAlerts.value.forEach(a => {
    const key = (a.createdAt || '').slice(0, 7)
    const m = months.find(x => x.key === key)
    if (m) m.alerts++
  })
  rangedDisputes.value.forEach(d => {
    const key = (d.submittedAt || '').slice(0, 7)
    const m = months.find(x => x.key === key)
    if (m) m.disputes++
  })

  return months
})

const activityChartConfig = computed(() => ({
  type: 'bar',
  data: {
    labels: monthlyActivity.value.map(m => m.label),
    datasets: [
      {
        label: 'Reports',
        data: monthlyActivity.value.map(m => m.reports),
        backgroundColor: '#4f6df5',
        borderRadius: 6,
        maxBarThickness: 32
      },
      {
        label: 'Alerts',
        data: monthlyActivity.value.map(m => m.alerts),
        backgroundColor: '#f59e0b',
        borderRadius: 6,
        maxBarThickness: 32
      },
      {
        label: 'Disputes',
        data: monthlyActivity.value.map(m => m.disputes),
        backgroundColor: '#7c3aed',
        borderRadius: 6,
        maxBarThickness: 32
      }
    ]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top', align: 'end' } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(148,163,184,.15)' } },
      x: { grid: { display: false } }
    }
  }
}))

/* ---------- Attendance rate by month (line) ---------- */
const attendanceTrendConfig = computed(() => {
  const labels = []
  const values = []
  monthlyActivity.value.forEach(m => {
    const rows = rangedReports.value.filter(r => (r.date || '').slice(0, 7) === m.key)
    labels.push(m.label)
    if (!rows.length) { values.push(null); return }
    const p = rows.filter(r => r.attendance_rating && r.attendance_rating !== 'Red').length
    values.push(Math.round((p / rows.length) * 100))
  })

  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Attendance %',
        data: values,
        borderColor: '#059669',
        backgroundColor: 'rgba(5,150,105,.12)',
        tension: 0.35, fill: true, pointRadius: 4, borderWidth: 2, spanGaps: true
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' }, grid: { color: 'rgba(148,163,184,.15)' } },
        x: { grid: { display: false } }
      }
    }
  }
})

/* ---------- Department activity in range ---------- */
const deptBreakdown = computed(() => {
  return directory.departments.map(d => {
    const dr = rangedReports.value.filter(r => r.department === d.name)
    const present = dr.filter(r => r.attendance_rating && r.attendance_rating !== 'Red').length
    const rate = dr.length ? Math.round((present / dr.length) * 100) : 0
    return {
      name: d.name,
      code: d.code || d.name.slice(0, 3).toUpperCase(),
      reports: dr.length,
      rate,
      alerts: rangedAlerts.value.filter(a => a.department === d.name).length,
      disputes: rangedDisputes.value.filter(x => x.department === d.name).length
    }
  }).sort((a, b) => b.reports - a.reports)
})

const deptChartConfig = computed(() => ({
  type: 'bar',
  data: {
    labels: deptBreakdown.value.map(d => d.code),
    datasets: [{
      data: deptBreakdown.value.map(d => d.reports),
      backgroundColor: deptBreakdown.value.map(d =>
        d.rate >= 90 ? '#10b981' : d.rate >= 75 ? '#4f6df5' : d.rate >= 60 ? '#f59e0b' : '#ef4444'
      ),
      borderRadius: 8, maxBarThickness: 44
    }]
  },
  options: {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(148,163,184,.15)' } },
      x: { grid: { display: false } }
    }
  }
}))

/* ---------- Top teachers (this range) ---------- */
const topTeachers = computed(() => {
  return directory.teachers
    .map(t => {
      const rs = rangedReports.value.filter(r => r.teacherId === t.id)
      const present = rs.filter(r => r.attendance_rating && r.attendance_rating !== 'Red').length
      const rate = rs.length ? Math.round((present / rs.length) * 100) : 0
      const perfRows = rs.filter(r => r.performance_rating)
      const perf = perfRows.length
        ? perfRows.reduce((s, r) => {
            const v = r.performance_rating
            return s + (v === 'Green' ? 5 : v === 'Blue' ? 4 : v === 'Yellow' ? 2 : v === 'Red' ? 1 : 0)
          }, 0) / perfRows.length
        : 0
      return { teacher: t, reports: rs.length, rate, perf }
    })
    .filter(x => x.reports > 0)
    .sort((a, b) => b.rate - a.rate || b.perf - a.perf)
    .slice(0, 5)
})

const attentionTeachers = computed(() => {
  return directory.teachers
    .map(t => {
      const streak = alerts.consecutiveAbsences(t.id)
      const rs = rangedReports.value.filter(r => r.teacherId === t.id)
      const red = rs.filter(r => r.attendance_rating === 'Red').length
      return { teacher: t, streak, red, reports: rs.length }
    })
    .filter(x => x.streak >= 3 || x.red >= 3)
    .sort((a, b) => b.streak - a.streak || b.red - a.red)
    .slice(0, 5)
})

/* ---------- full-year summary (for close/archive) ---------- */
const summary = computed(() => ({
  students:  directory.users.filter(u => u.role === 'student').length,
  teachers:  directory.users.filter(u => u.role === 'teacher').length,
  classReps: directory.users.filter(u => u.role === 'class_rep').length,
  depts:     directory.departments.length,
  reports:   reports.reports.length,
  classReports: reports.classReports.length,
  alerts:    alerts.alerts.length,
  disputes:  disputes.disputes.length,
  messages:  messages.messages.length,
  users:     directory.users.length
}))

/* ---------- backup before close ----------
   Reuses the shared useBackup() composable instead of duplicating
   the snapshot logic. If BACKUP_KEYS ever changes, this stays in sync.
-------------------------------------------------------------- */
function saveBackup() {
  return backup.createSnapshot({
    trigger: 'manual',
    download: false,
    label: `Academic Year Close — ${current.value}`
  })
}

/* ---------- preview ---------- */
const previewOpen = ref(false)
function preview() { previewOpen.value = true }

/* ---------- close year ---------- */
const closing = ref(false)

function askClose() { closing.value = true }

function confirmClose() {
  const rec = saveBackup()
  settings.closeAcademicYear({ summary: summary.value, backupId: rec.id })
  toast.ok(`Academic year changed to ${next.value}`)
  closing.value = false
}

/* ---------- archive download ---------- */
function downloadArchive(a) {
  const data = a.backupId ? settings.getBackupData(a.backupId) : null
  if (!data) { toast.err('Archive data not available'); return }
  downloadJSON(data, `SMU-Archive-${a.year.replace('/', '-')}.json`)
  toast.ok('Archive downloaded')
}
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Academic Year Management</h1>
        <div class="sub">Year analytics, activity review, and transition</div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-secondary btn-sm" @click="preview">
          <i class="bi bi-eye"></i> Preview Impact
        </button>
      </div>
    </div>

    <!-- ═══════ HERO ═══════ -->
    <div class="year-hero">
      <div class="row-inner">
        <div class="yr-block">
          <div class="yr-lbl"><i class="bi bi-calendar2-check-fill"></i> Current Academic Year</div>
          <div class="yr-big">{{ current }}</div>
          <div class="yr-desc">All active data belongs to this year</div>
        </div>
        <div class="arrow-ico"><i class="bi bi-arrow-right-circle-fill"></i></div>
        <div class="yr-block" style="text-align:right">
          <div class="yr-lbl" style="justify-content:flex-end">
            Next Academic Year <i class="bi bi-rocket-takeoff-fill"></i>
          </div>
          <div class="yr-big">{{ next }}</div>
          <div class="yr-desc">Will become active after closing</div>
        </div>
      </div>
    </div>

    <!-- ═══════ RANGE SELECTOR + KPIs ═══════ -->
    <div class="card mb-4">
      <div class="card-hd">
        <div>
          <h3><i class="bi bi-activity"></i> Year Activity — {{ rangeLabel }}</h3>
          <div class="sub">What happened and how much was done</div>
        </div>

        <div style="display:flex;gap:6px">
          <button
            v-for="r in ranges"
            :key="r.value"
            class="btn btn-xs"
            :class="rangeDays === r.value ? 'btn-primary' : 'btn-secondary'"
            @click="rangeDays = r.value"
          >
            {{ r.label }}
          </button>
        </div>
      </div>

      <div class="card-bd">
        <div class="row g-3">
          <div class="col-xl-3 col-md-6">
            <KpiCard label="Reports Submitted" :value="rangeKpis.reports"
                     sub="class rep reports" icon="journal-text" color="brand"
                     :to="{ name: 'reports' }" />
          </div>
          <div class="col-xl-3 col-md-6">
            <KpiCard label="Attendance Rate" :value="rangeKpis.attendanceRate + '%'"
                     :sub="rangeKpis.green + ' green · ' + rangeKpis.red + ' red'"
                     icon="calendar-check" color="success"
                     :to="{ name: 'attendance-intel' }" />
          </div>
          <div class="col-xl-3 col-md-6">
            <KpiCard label="Alerts Raised" :value="rangeKpis.alerts"
                     :sub="rangeKpis.escalated + ' escalated'"
                     icon="bell-fill" color="warning"
                     :to="{ name: 'alerts' }" />
          </div>
          <div class="col-xl-3 col-md-6">
            <KpiCard label="Disputes" :value="rangeKpis.disputes"
                     :sub="rangeKpis.pendingDisputes + ' pending'"
                     icon="chat-square-text" color="purple"
                     :to="{ name: 'disputes' }" />
          </div>

          <div class="col-xl-3 col-md-6">
            <KpiCard label="Class Reports" :value="rangeKpis.classReports"
                     sub="teacher observations" icon="pencil-square" color="info"
                     :to="{ name: 'class-reports' }" />
          </div>
          <div class="col-xl-3 col-md-6">
            <KpiCard label="Makeup Classes" :value="rangeKpis.makeup"
                     sub="scheduled in range" icon="calendar-plus" color="info"
                     :to="{ name: 'makeup-classes' }" />
          </div>
          <div class="col-xl-3 col-md-6">
            <KpiCard label="Avg Performance"
                     :value="rangeKpis.performance ? rangeKpis.performance.toFixed(2) : '—'"
                     unit="/5" sub="external feedback" icon="star-half" color="brand"
                     :to="{ name: 'performance-intel' }" />
          </div>
          <div class="col-xl-3 col-md-6">
            <KpiCard label="Active Teachers" :value="directory.teachers.length"
                     sub="in the institution" icon="person-video3" color="purple"
                     :to="{ name: 'teachers' }" />
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ MONTHLY ACTIVITY CHART ═══════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-8">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-bar-chart-line"></i> Monthly Activity</h3>
            <span class="muted t-xs">Reports · Alerts · Disputes</span>
          </div>
          <div class="card-bd">
            <ChartBox :config="activityChartConfig" size="lg" />
          </div>
        </div>
      </div>
      <div class="col-xl-4">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-graph-up"></i> Attendance Trend</h3>
          </div>
          <div class="card-bd">
            <ChartBox :config="attendanceTrendConfig" />
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ DEPARTMENT BREAKDOWN ═══════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-building"></i> Activity by Department</h3>
            <span class="muted t-xs">total reports in range</span>
          </div>
          <div class="card-bd">
            <ChartBox :config="deptChartConfig" />
          </div>
        </div>
      </div>
      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-list-ul"></i> Department Summary</h3>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Department</th>
                  <th class="num">Reports</th>
                  <th class="num">Attendance</th>
                  <th class="num">Alerts</th>
                  <th class="num">Disputes</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!deptBreakdown.length">
                  <td colspan="5"><EmptyState icon="building" title="No departments" /></td>
                </tr>
                <tr v-for="d in deptBreakdown" :key="d.name">
                  <td>
                    <span class="badge-x b-brand">{{ d.code }}</span>
                    <b style="margin-left:6px">{{ d.name }}</b>
                  </td>
                  <td class="num">{{ d.reports }}</td>
                  <td class="num">
                    <span class="badge-x"
                          :class="d.rate >= 90 ? 'b-green' : d.rate >= 75 ? 'b-blue' : d.rate >= 60 ? 'b-amber' : 'b-red'">
                      {{ d.rate }}%
                    </span>
                  </td>
                  <td class="num">
                    <span v-if="d.alerts" class="badge-x b-amber">{{ d.alerts }}</span>
                    <span v-else class="muted">0</span>
                  </td>
                  <td class="num">
                    <span v-if="d.disputes" class="badge-x b-purple">{{ d.disputes }}</span>
                    <span v-else class="muted">0</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ TOP + ATTENTION ═══════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-trophy"></i> Top Performing Teachers</h3>
            <span class="muted t-xs">{{ rangeLabel }}</span>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Department</th>
                  <th class="num">Attendance</th>
                  <th class="num">Perf</th>
                  <th class="num">Reports</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!topTeachers.length">
                  <td colspan="5"><EmptyState icon="trophy" title="No activity in range" /></td>
                </tr>
                <tr v-for="t in topTeachers" :key="t.teacher.id">
                  <td>
                    <RouterLink :to="{ name: 'teacher-detail', params: { id: t.teacher.id } }"
                                style="color:var(--ink-800);text-decoration:none;font-weight:600">
                      {{ t.teacher.name }}
                    </RouterLink>
                  </td>
                  <td class="muted">{{ t.teacher.department }}</td>
                  <td class="num">
                    <span class="badge-x b-green">{{ t.rate }}%</span>
                  </td>
                  <td class="num">{{ t.perf ? t.perf.toFixed(1) : '—' }}</td>
                  <td class="num">{{ t.reports }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-exclamation-triangle"></i> Teachers Needing Attention</h3>
            <span class="muted t-xs">{{ rangeLabel }}</span>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Department</th>
                  <th class="num">Red</th>
                  <th class="num">Streak</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!attentionTeachers.length">
                  <td colspan="5">
                    <EmptyState icon="check2-circle" title="All clear"
                                text="No teachers with repeated absences in this range." />
                  </td>
                </tr>
                <tr v-for="t in attentionTeachers" :key="t.teacher.id">
                  <td>
                    <RouterLink :to="{ name: 'teacher-detail', params: { id: t.teacher.id } }"
                                style="color:var(--ink-800);text-decoration:none;font-weight:600">
                      {{ t.teacher.name }}
                    </RouterLink>
                  </td>
                  <td class="muted">{{ t.teacher.department }}</td>
                  <td class="num">{{ t.red }}</td>
                  <td class="num">
                    <span :class="t.streak >= 3 ? 'badge-x b-red' : 'badge-x b-amber'">
                      {{ t.streak }}
                    </span>
                  </td>
                  <td>
                    <span class="alert-pill"
                          :class="t.streak >= 5 ? 'alert-critical' : 'alert-warning'">
                      <i :class="t.streak >= 5 ? 'bi bi-exclamation-octagon-fill' : 'bi bi-exclamation-triangle-fill'"></i>
                      {{ t.streak >= 5 ? 'Escalated' : 'Alert' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ SUMMARY CARDS (full year) ═══════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-3 col-md-6"><div class="year-summary-card">
        <div class="ico" style="background:var(--brand-50);color:var(--brand-600)"><i class="bi bi-mortarboard-fill"></i></div>
        <div><div class="val">{{ summary.students }}</div><div class="lbl">Students</div></div>
      </div></div>
      <div class="col-xl-3 col-md-6"><div class="year-summary-card">
        <div class="ico" style="background:var(--purple-50);color:var(--purple)"><i class="bi bi-person-video3"></i></div>
        <div><div class="val">{{ summary.teachers }}</div><div class="lbl">Teachers</div></div>
      </div></div>
      <div class="col-xl-3 col-md-6"><div class="year-summary-card">
        <div class="ico" style="background:var(--warning-50);color:var(--warning)"><i class="bi bi-person-workspace"></i></div>
        <div><div class="val">{{ summary.classReps }}</div><div class="lbl">Class Reps</div></div>
      </div></div>
      <div class="col-xl-3 col-md-6"><div class="year-summary-card">
        <div class="ico" style="background:var(--info-50);color:var(--info)"><i class="bi bi-building"></i></div>
        <div><div class="val">{{ summary.depts }}</div><div class="lbl">Departments</div></div>
      </div></div>
      <div class="col-xl-3 col-md-6"><div class="year-summary-card">
        <div class="ico" style="background:var(--success-50);color:var(--success)"><i class="bi bi-journal-text"></i></div>
        <div><div class="val">{{ summary.reports }}</div><div class="lbl">Reports</div></div>
      </div></div>
      <div class="col-xl-3 col-md-6"><div class="year-summary-card">
        <div class="ico" style="background:var(--danger-50);color:var(--danger)"><i class="bi bi-bell-fill"></i></div>
        <div><div class="val">{{ summary.alerts }}</div><div class="lbl">Alerts</div></div>
      </div></div>
      <div class="col-xl-3 col-md-6"><div class="year-summary-card">
        <div class="ico" style="background:var(--ink-50);color:var(--ink-600)"><i class="bi bi-chat-square-text"></i></div>
        <div><div class="val">{{ summary.disputes }}</div><div class="lbl">Disputes</div></div>
      </div></div>
      <div class="col-xl-3 col-md-6"><div class="year-summary-card">
        <div class="ico" style="background:var(--brand-50);color:var(--brand-600)"><i class="bi bi-archive"></i></div>
        <div><div class="val">{{ archives.length }}</div><div class="lbl">Archived Years</div></div>
      </div></div>
    </div>

    <!-- ═══════ PROCESS + INFO ═══════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-7">
        <div class="card h-100">
          <div class="card-hd">
            <h3><i class="bi bi-diagram-3"></i> Year Transition Process</h3>
            <span class="badge-x b-amber"><i class="bi bi-shield-check"></i> Backup auto-created</span>
          </div>
          <div class="card-bd">
            <div class="timeline-step">
              <div class="timeline-dot">1</div>
              <div class="timeline-line"></div>
              <div class="timeline-content">
                <h4>Create Full Backup</h4>
                <p>A complete snapshot of all data is saved automatically before any changes are made.</p>
              </div>
            </div>
            <div class="timeline-step">
              <div class="timeline-dot">2</div>
              <div class="timeline-line"></div>
              <div class="timeline-content">
                <h4>Archive Current Year</h4>
                <p>Reports, alerts, disputes, and statistics from <b>{{ current }}</b> are frozen in an archive.</p>
              </div>
            </div>
            <div class="timeline-step">
              <div class="timeline-dot">3</div>
              <div class="timeline-line"></div>
              <div class="timeline-content">
                <h4>Keep Historical Access</h4>
                <p>Archived years remain viewable for reports and auditing. Users keep their accounts and departments.</p>
              </div>
            </div>
            <div class="timeline-step">
              <div class="timeline-dot">4</div>
              <div class="timeline-content">
                <h4>Activate New Year</h4>
                <p><b>{{ next }}</b> becomes the active academic year. Users, departments, and settings carry over.</p>
              </div>
            </div>
          </div>
          <div class="card-ft" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="font-size:12.5px;color:var(--ink-500)">
              <i class="bi bi-info-circle"></i> This action is reversible from a backup.
            </div>
            <button class="btn btn-primary" @click="askClose">
              <i class="bi bi-check2-circle"></i> Close {{ current }} &amp; Start {{ next }}
            </button>
          </div>
        </div>
      </div>

      <div class="col-xl-5">
        <div class="card h-100">
          <div class="card-hd"><h3><i class="bi bi-info-circle-fill"></i> What Happens on Close</h3></div>
          <div class="card-bd" style="font-size:13px;line-height:1.7;color:var(--ink-600)">
            <div class="info-row"><div class="k">Reports archived</div><div class="v">{{ summary.reports }}</div></div>
            <div class="info-row"><div class="k">Class reports archived</div><div class="v">{{ summary.classReports }}</div></div>
            <div class="info-row"><div class="k">Alerts archived</div><div class="v">{{ summary.alerts }}</div></div>
            <div class="info-row"><div class="k">Disputes archived</div><div class="v">{{ summary.disputes }}</div></div>
            <div class="info-row"><div class="k">Users preserved</div><div class="v">{{ summary.users }}</div></div>
            <div class="info-row"><div class="k">Departments preserved</div><div class="v">{{ summary.depts }}</div></div>
            <div style="background:var(--warning-50);border-left:4px solid var(--warning);padding:12px 14px;border-radius:8px;margin-top:14px;font-size:12.5px;color:#92400e">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              Do not close the year unless the academic period is officially complete. Records from a closed year remain available but inactive.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ ARCHIVES ═══════ -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-archive-fill"></i> Archived Academic Years</h3>
        <span class="badge-x b-brand">{{ archives.length }} archive{{ archives.length === 1 ? '' : 's' }}</span>
      </div>
      <div class="card-bd">
        <div v-if="!archives.length">
          <EmptyState icon="archive" title="No archived academic years" text="Closed years will appear here." />
        </div>
        <div v-else class="archive-list">
          <div v-for="a in archives" :key="a.id" class="archive-item">
            <div class="a-icon"><i class="bi bi-archive-fill"></i></div>
            <div class="a-info">
              <div class="a-title">
                {{ a.year }}
                <span class="badge-x b-green"><i class="bi bi-check-circle-fill"></i> Archived</span>
              </div>
              <div class="a-meta">
                <span><i class="bi bi-calendar-event"></i> {{ fmtDateTime(a.archivedAt) }}</span>
                <span><i class="bi bi-people"></i> {{ a.summary?.users || 0 }} users</span>
                <span><i class="bi bi-journal-text"></i> {{ a.summary?.reports || 0 }} reports</span>
                <span><i class="bi bi-bell"></i> {{ a.summary?.alerts || 0 }} alerts</span>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" @click="downloadArchive(a)">
                <i class="bi bi-download"></i> Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════ PREVIEW MODAL ═══════ -->
    <Modal v-if="previewOpen"
           title="Preview End-Year Impact"
           size="wide"
           @close="previewOpen = false">
      <p style="font-size:13.5px;color:var(--ink-700);margin-bottom:12px">
        These records will be archived under <b>{{ current }}</b> when you close the year. Nothing is deleted.
      </p>

      <div class="row g-3 mb-3">
        <div class="col-md-6"><div class="info-row"><div class="k">Students</div><div class="v">{{ summary.students }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Teachers</div><div class="v">{{ summary.teachers }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Class Reps</div><div class="v">{{ summary.classReps }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Departments</div><div class="v">{{ summary.depts }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Reports</div><div class="v">{{ summary.reports }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Class Reports</div><div class="v">{{ summary.classReports }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Alerts</div><div class="v">{{ summary.alerts }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Disputes</div><div class="v">{{ summary.disputes }}</div></div></div>
      </div>

      <div class="alert-pill alert-warning" style="display:inline-flex;padding:10px 12px">
        <i class="bi bi-info-circle-fill"></i>
        <span style="margin-left:6px">Next academic year: <b>{{ next }}</b></span>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="previewOpen = false">Close</button>
      </template>
    </Modal>

    <!-- ═══════ CLOSE CONFIRM ═══════ -->
    <Modal v-if="closing"
           title="Confirm Academic Year Transition"
           size="wide"
           @close="closing = false">
      <p style="font-size:13.5px;color:var(--ink-700);margin-bottom:12px">
        You are about to close <b>{{ current }}</b> and start <b>{{ next }}</b>.
        A complete backup will be created automatically before archiving.
      </p>

      <div class="row g-3 mb-3">
        <div class="col-md-6"><div class="info-row"><div class="k">Students</div><div class="v">{{ summary.students }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Teachers</div><div class="v">{{ summary.teachers }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Reports</div><div class="v">{{ summary.reports }}</div></div></div>
        <div class="col-md-6"><div class="info-row"><div class="k">Alerts</div><div class="v">{{ summary.alerts }}</div></div></div>
      </div>

      <div style="background:var(--warning-50);border-left:4px solid var(--warning);padding:12px 14px;border-radius:8px;font-size:12.5px;color:#92400e">
        <i class="bi bi-exclamation-triangle-fill me-1"></i>
        <b>This action cannot be undone from the UI</b> — it can only be reversed from a backup.
        Make sure the academic year is complete.
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="closing = false">Cancel</button>
        <button class="btn btn-primary btn-sm" @click="confirmClose">
          <i class="bi bi-check2-circle"></i> Backup, Archive &amp; Start {{ next }}
        </button>
      </template>
    </Modal>
  </div>
</template>