<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import { useDisputesStore } from '@/stores/disputes'
import KpiCard from '@/components/common/KpiCard.vue'
import ChartBox from '@/components/common/ChartBox.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import RatingBadge from '@/components/common/RatingBadge.vue'
import { fmtDate, fmtDateTime } from '@/utils/format'
import { ALERT_THRESHOLDS } from '@/utils/constants'

const route     = useRoute()
const router    = useRouter()
const session   = useSessionStore()
const directory = useDirectoryStore()
const reports   = useReportsStore()
const alerts    = useAlertsStore()
const disputes  = useDisputesStore()

/* ---------- resolve teacher ---------- */
const teacher = computed(() => {
  const t = directory.userById(route.params.id)
  return t && t.role === 'teacher' ? t : null
})

/* ---------- access control ---------- */
const denied = computed(() => {
  if (!teacher.value) return 'not-found'
  if (session.role === 'dept_head' && teacher.value.department !== session.department)
    return 'forbidden'
  if (!['admin', 'dept_head'].includes(session.role)) return 'forbidden'
  return null
})

/* ---------- data scoped to this teacher ---------- */
const allReports    = computed(() => teacher.value ? reports.reportsForTeacher(teacher.value.id) : [])
const clsRepReports = computed(() => allReports.value.filter(r => r.reporter_role === 'class_rep'))
const perfReports   = computed(() => allReports.value.filter(r => r.performance_rating))
const classReports  = computed(() => teacher.value ? reports.classReportsForTeacher(teacher.value.id) : [])
const teacherAlerts = computed(() => teacher.value ? alerts.alertsForTeacher(teacher.value.id) : [])
const teacherDisputes = computed(() =>
  teacher.value ? disputes.disputesForTeacher(teacher.value.id) : []
)

/* ---------- KPIs ---------- */
const attRate = computed(() => teacher.value ? reports.attendanceRate(teacher.value.id, 30) : null)
const perfAvg = computed(() => teacher.value ? reports.avgPerformance(teacher.value.id) : null)
const streak  = computed(() => teacher.value ? alerts.consecutiveAbsences(teacher.value.id) : 0)

/* ---------- tabs ---------- */
const tabs = [
  { id: 'overview',     label: 'Overview' },
  { id: 'attendance',   label: 'Attendance' },
  { id: 'performance',  label: 'Performance' },
  { id: 'reports',      label: 'Reports' },
  { id: 'classreports', label: 'Class Reports', badge: 'classReports' },
  { id: 'disputes',     label: 'Disputes',      badge: 'teacherDisputes' },
  { id: 'alerts',       label: 'Alerts',        badge: 'teacherAlerts' }
]
const activeTab = ref('overview')

function tabBadge(key) {
  if (key === 'classReports')   return classReports.value.length
  if (key === 'teacherDisputes') return teacherDisputes.value.length
  if (key === 'teacherAlerts')  return teacherAlerts.value.length
  return 0
}

/* ---------- chart configs ---------- */
const mixConfig = computed(() => {
  const mix = { Green: 0, Blue: 0, Yellow: 0, Red: 0 }
  clsRepReports.value.forEach(r => { if (mix[r.attendance_rating] !== undefined) mix[r.attendance_rating]++ })
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
    options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'bottom' } } }
  }
})

const attendanceTrendConfig = computed(() => {
  const labels = [], scores = []
  const score = r => r === 'Green' ? 5 : r === 'Blue' ? 4 : r === 'Yellow' ? 2 : r === 'Red' ? 1 : null
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    labels.push(d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }))
    const rep = clsRepReports.value.find(r => r.date === iso)
    scores.push(rep ? score(rep.attendance_rating) : null)
  }
  return {
    type: 'line',
    data: { labels, datasets: [{
      label: 'Attendance Score', data: scores,
      borderColor: '#4f6df5', backgroundColor: 'rgba(79,109,245,.10)',
      tension: 0.35, fill: true, pointRadius: 3, borderWidth: 2, spanGaps: true
    }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: 0, max: 5, ticks: { stepSize: 1 }, grid: { color: 'rgba(148,163,184,.15)' } },
        x: { grid: { display: false } }
      }
    }
  }
})

const perfMixConfig = computed(() => {
  const mix = { Green: 0, Blue: 0, Yellow: 0, Red: 0 }
  perfReports.value.forEach(r => { if (mix[r.performance_rating] !== undefined) mix[r.performance_rating]++ })
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
    options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'bottom' } } }
  }
})

const perfSourceConfig = computed(() => {
  const sources = ['class_rep', 'student'].map(role =>
    ['Green', 'Blue', 'Yellow'].map(r =>
      perfReports.value.filter(x => x.reporter_role === role && x.performance_rating === r).length
    )
  )
  return {
    type: 'bar',
    data: {
      labels: ['Green', 'Blue', 'Yellow'],
      datasets: [
        { label: 'Class Rep', data: sources[0], backgroundColor: '#7c3aed', borderRadius: 8, maxBarThickness: 40 },
        { label: 'Students',  data: sources[1], backgroundColor: '#3b82f6', borderRadius: 8, maxBarThickness: 40 }
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
  }
})

/* ---------- helpers ---------- */
function statusPill(streak) {
  if (streak >= ALERT_THRESHOLDS.admin)   return { cls: 'alert-critical', label: 'Escalated', icon: 'exclamation-octagon-fill' }
  if (streak >= ALERT_THRESHOLDS.deptHead) return { cls: 'alert-warning', label: 'Alert', icon: 'exclamation-triangle-fill' }
  return { cls: 'alert-resolved', label: 'Good standing', icon: 'check2-circle' }
}
function disputePill(s) {
  return {
    pending:  { cls: 'alert-warning',  label: 'Pending',  icon: 'hourglass-split' },
    resolved: { cls: 'alert-resolved', label: 'Resolved', icon: 'check2-circle' },
    rejected: { cls: 'alert-critical', label: 'Rejected', icon: 'x-circle' }
  }[s] || { cls: 'b-gray', label: s, icon: 'circle' }
}

function goBack() { router.back() }
</script>

<template>
  <!-- Not found -->
  <div v-if="denied === 'not-found'" class="card">
    <EmptyState icon="person-x" title="Teacher not found"
                text="Only users with the Teacher role can be viewed here.">
      <button class="btn btn-primary btn-sm" @click="goBack">
        <i class="bi bi-arrow-left"></i> Back
      </button>
    </EmptyState>
  </div>

  <!-- Access denied -->
  <div v-else-if="denied === 'forbidden'" class="card">
    <EmptyState icon="shield-lock" title="Access denied"
                :text="`You can only view teachers in your own department (${session.department}).`">
      <button class="btn btn-primary btn-sm" @click="goBack">
        <i class="bi bi-arrow-left"></i> Back
      </button>
    </EmptyState>
  </div>

  <!-- Main content -->
  <div v-else-if="teacher">
    <div class="page-hd">
      <div>
        <h1>{{ teacher.name }}</h1>
        <div class="sub">{{ teacher.position || 'Teacher' }} · {{ teacher.department }}</div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-secondary btn-sm" @click="goBack">
          <i class="bi bi-arrow-left"></i> Back
        </button>
      </div>
    </div>

    <!-- Profile card -->
    <div class="card mb-4" style="padding:24px">
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center">
        <div class="sb-mark" style="width:80px;height:80px;font-size:28px;border-radius:20px">
          {{ (teacher.name || '?').split(' ').filter(Boolean).map(x => x[0]).join('').slice(0,2).toUpperCase() }}
        </div>
        <div style="flex:1;min-width:240px">
          <h2 style="font-size:20px;margin-bottom:6px">{{ teacher.name }}</h2>
          <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--ink-500);margin-bottom:8px">
            <span><i class="bi bi-hash"></i> {{ teacher.staffId }}</span>
            <span><i class="bi bi-building"></i> {{ teacher.department }}</span>
            <span><i class="bi bi-briefcase"></i> {{ teacher.position || '—' }}</span>
            <span><i class="bi bi-envelope"></i> {{ teacher.email }}</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <span class="badge-x b-brand"><i class="bi bi-person-video3"></i> Teacher</span>
            <span class="alert-pill" :class="statusPill(streak).cls">
              <i :class="`bi bi-${statusPill(streak).icon}`"></i>
              {{ statusPill(streak).label }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="row g-3 mb-4">
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Attendance Rate" :value="attRate !== null ? attRate + '%' : '—'"
                 sub="last 30 days" icon="calendar-check" color="success" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Consecutive Absences" :value="streak"
                 :sub="streak >= 3 ? 'alert active' : 'current'"
                 icon="exclamation-triangle"
                 :color="streak >= 3 ? 'danger' : 'info'" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Avg Performance" :value="perfAvg !== null ? perfAvg.toFixed(2) : '—'" unit="/5"
                 sub="external feedback" icon="star-half" color="brand" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Total Reports" :value="allReports.length"
                 sub="all sources" icon="journal-text" color="purple" />
      </div>
    </div>

    <!-- Tabs -->
    <div class="card">
      <div style="padding:0 18px">
        <div class="tabs" role="tablist">
          <button
            v-for="t in tabs"
            :key="t.id"
            :class="{ active: activeTab === t.id }"
            @click="activeTab = t.id"
          >
            {{ t.label }}
            <span v-if="t.badge" class="muted" style="margin-left:4px">
              ({{ tabBadge(t.badge) }})
            </span>
          </button>
        </div>
      </div>

      <div class="card-bd">
        <!-- ── OVERVIEW ── -->
        <template v-if="activeTab === 'overview'">
          <div class="row g-3">
            <div class="col-md-6">
              <h4 style="font-size:14px;margin-bottom:12px">Teacher Details</h4>
              <div class="info-row"><div class="k">Staff ID</div><div class="v mono">{{ teacher.staffId }}</div></div>
              <div class="info-row"><div class="k">Department</div><div class="v">{{ teacher.department }}</div></div>
              <div class="info-row"><div class="k">Position</div><div class="v">{{ teacher.position || '—' }}</div></div>
              <div class="info-row"><div class="k">Email</div><div class="v">{{ teacher.email }}</div></div>
              <div class="info-row"><div class="k">Phone</div><div class="v">{{ teacher.phone || '—' }}</div></div>
            </div>
            <div class="col-md-6">
              <h4 style="font-size:14px;margin-bottom:12px">Attendance Mix (Class Rep Reports)</h4>
              <ChartBox :config="mixConfig" size="sm" />
            </div>
          </div>
        </template>

        <!-- ── ATTENDANCE ── -->
        <template v-else-if="activeTab === 'attendance'">
          <div class="mb-4">
            <ChartBox :config="attendanceTrendConfig" size="lg" />
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Date</th><th>Course</th><th>Attendance</th><th>Reporter</th><th>Comment</th></tr>
              </thead>
              <tbody>
                <tr v-if="!clsRepReports.length">
                  <td colspan="5"><EmptyState icon="calendar" title="No attendance records" /></td>
                </tr>
                <tr v-for="r in clsRepReports.slice(0, 60)" :key="r.id">
                  <td>{{ fmtDate(r.date) }}</td>
                  <td class="muted">{{ r.course }}</td>
                  <td><RatingBadge :rating="r.attendance_rating" kind="attendance" /></td>
                  <td class="muted">{{ r.reporter }}</td>
                  <td class="muted" style="max-width:280px">{{ r.comments || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ── PERFORMANCE ── -->
        <template v-else-if="activeTab === 'performance'">
          <div class="row g-3 mb-4">
            <div class="col-md-6"><ChartBox :config="perfMixConfig" size="sm" /></div>
            <div class="col-md-6"><ChartBox :config="perfSourceConfig" size="sm" /></div>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Date</th><th>Course</th><th>Performance</th><th>Source</th><th>Comment</th></tr>
              </thead>
              <tbody>
                <tr v-if="!perfReports.length">
                  <td colspan="5"><EmptyState icon="chat-dots" title="No performance records" /></td>
                </tr>
                <tr v-for="r in perfReports.slice(0, 60)" :key="r.id">
                  <td>{{ fmtDate(r.date) }}</td>
                  <td class="muted">{{ r.course }}</td>
                  <td><RatingBadge :rating="r.performance_rating" kind="performance" show-label /></td>
                  <td>
                    <span class="badge-x"
                          :class="r.is_self ? 'b-amber' : r.reporter_role === 'student' ? 'b-blue' : 'b-purple'">
                      {{ r.is_self ? 'Self' : r.reporter_role === 'student' ? 'Student' : 'Class Rep' }}
                    </span>
                  </td>
                  <td class="muted" style="max-width:280px">{{ r.comments || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ── REPORTS ── -->
        <template v-else-if="activeTab === 'reports'">
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Date</th><th>Course</th><th>Attendance</th><th>Performance</th><th>Source</th><th>Comment</th></tr>
              </thead>
              <tbody>
                <tr v-if="!allReports.length">
                  <td colspan="6"><EmptyState icon="journal-text" title="No reports" /></td>
                </tr>
                <tr v-for="r in allReports.slice(0, 80)" :key="r.id">
                  <td>{{ fmtDate(r.date) }}</td>
                  <td class="muted">{{ r.course }}</td>
                  <td><RatingBadge :rating="r.attendance_rating" kind="attendance" /></td>
                  <td><RatingBadge :rating="r.performance_rating" kind="performance" show-label /></td>
                  <td>
                    <span class="badge-x"
                          :class="r.is_self ? 'b-amber' : r.reporter_role === 'student' ? 'b-blue' : 'b-purple'">
                      {{ r.is_self ? 'Self' : r.reporter_role === 'student' ? 'Student' : 'Class Rep' }}
                    </span>
                  </td>
                  <td class="muted" style="max-width:280px">{{ r.comments || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ── CLASS REPORTS ── -->
        <template v-else-if="activeTab === 'classreports'">
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Date</th><th>Class</th><th>Topic</th><th>Type</th><th class="num">Present</th><th>Observations</th></tr>
              </thead>
              <tbody>
                <tr v-if="!classReports.length">
                  <td colspan="6"><EmptyState icon="journal-text" title="No class reports" /></td>
                </tr>
                <tr v-for="r in classReports" :key="r.id">
                  <td>{{ fmtDate(r.date) }}</td>
                  <td><b>{{ r.className }}</b></td>
                  <td class="muted">{{ r.topic || '—' }}</td>
                  <td><span class="badge-x b-gray">{{ r.sessionType || '—' }}</span></td>
                  <td class="num">{{ r.studentsPresent || '—' }}</td>
                  <td class="muted" style="max-width:340px">{{ r.observations }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ── DISPUTES ── -->
        <template v-else-if="activeTab === 'disputes'">
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Submitted</th><th>Report Date</th><th>Reason</th><th>Status</th><th>Resolution</th></tr>
              </thead>
              <tbody>
                <tr v-if="!teacherDisputes.length">
                  <td colspan="5"><EmptyState icon="chat-square-text" title="No disputes" /></td>
                </tr>
                <tr v-for="d in teacherDisputes" :key="d.id">
                  <td>{{ fmtDate(d.submittedAt) }}</td>
                  <td>{{ fmtDate(d.reportDate) }}</td>
                  <td style="max-width:360px">{{ d.reason }}</td>
                  <td>
                    <span class="alert-pill" :class="disputePill(d.status).cls">
                      <i :class="`bi bi-${disputePill(d.status).icon}`"></i>
                      {{ disputePill(d.status).label }}
                    </span>
                  </td>
                  <td class="muted">{{ d.resolution || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- ── ALERTS ── -->
        <template v-else-if="activeTab === 'alerts'">
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Created</th><th>Streak</th><th>Status</th><th>Resolved</th></tr>
              </thead>
              <tbody>
                <tr v-if="!teacherAlerts.length">
                  <td colspan="4"><EmptyState icon="bell" title="No alerts" /></td>
                </tr>
                <tr v-for="a in teacherAlerts" :key="a.id">
                  <td>{{ fmtDateTime(a.createdAt) }}</td>
                  <td>
                    <span class="badge-x" :class="a.escalated ? 'b-red' : 'b-amber'">
                      {{ a.count }} Reds
                    </span>
                  </td>
                  <td>
                    <span class="alert-pill"
                          :class="a.status === 'active'
                            ? (a.escalated ? 'alert-critical' : 'alert-warning')
                            : 'alert-resolved'">
                      {{ a.status === 'active' ? (a.escalated ? 'Escalated' : 'Active') : 'Resolved' }}
                    </span>
                  </td>
                  <td class="muted">
                    {{ a.resolvedAt ? fmtDateTime(a.resolvedAt) + ' · ' + (a.resolvedBy || '—') : '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>