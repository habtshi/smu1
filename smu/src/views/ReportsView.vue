<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import { useDisputesStore } from '@/stores/disputes'
import { useSettingsStore } from '@/stores/settings'
import Modal from '@/components/common/Modal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { useToast } from '@/composables/useToast'
import { exportCSV, fmtDate } from '@/utils/format'

const session   = useSessionStore()
const directory = useDirectoryStore()
const reports   = useReportsStore()
const alerts    = useAlertsStore()
const disputes  = useDisputesStore()
const settings  = useSettingsStore()
const toast     = useToast()

const scope = computed(() =>
  session.role === 'dept_head' ? session.department : null
)

/* ---------- report catalogue ---------- */
const catalogue = [
  { id: 'attendance',  title: 'Attendance Report',          ico: 'calendar-check',    desc: 'Attendance ratings by teacher and department' },
  { id: 'performance', title: 'Performance Report',         ico: 'graph-up-arrow',    desc: 'Performance ratings from all sources' },
  { id: 'department',  title: 'Department Report',          ico: 'building',          desc: 'Department-level attendance and performance' },
  { id: 'teacher',     title: 'Teacher Report',             ico: 'person-video3',     desc: 'Per-teacher attendance and performance summary' },
  { id: 'alert',       title: 'Alert Report',               ico: 'bell',              desc: 'Active and resolved consecutive-absence alerts' },
  { id: 'student',     title: 'Student Feedback Report',    ico: 'people',            desc: 'Ratings submitted by students' },
  { id: 'classrep',    title: 'Class Rep Report',           ico: 'person-badge',      desc: 'Ratings submitted by class representatives' },
  { id: 'classreport', title: 'Class Report Summary',       ico: 'journal-text',      desc: 'Teacher-submitted class observations' },
  { id: 'dispute',     title: 'Dispute Report',             ico: 'chat-square-text',  desc: 'All teacher disputes and outcomes' },
  { id: 'selfreport',  title: 'Self Report Summary',        ico: 'pencil-square',     desc: 'Self reports submitted by teachers' },
  { id: 'audit',       title: 'Audit Report',               ico: 'shield-check',      desc: 'System activity trail' }
]

/* ---------- modal state ---------- */
const open        = ref(false)
const current     = ref(null)
const reportRows  = ref([])

const headers = computed(() =>
  reportRows.value.length ? Object.keys(reportRows.value[0]) : ['Info']
)

/* ══════════════════════════════════════════════════════
   🆕 PAGINATION for the report modal
   ══════════════════════════════════════════════════════ */
const page     = ref(1)
const pageSize = ref(25)

const totalRows = computed(() => reportRows.value.length)

const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return reportRows.value.slice(start, start + pageSize.value)
})

/* Reset to page 1 when a report opens */
watch(open, (v) => { if (v) { page.value = 1; pageSize.value = 25 } })

/* Also reset on rows change (e.g., new report opened) */
watch(reportRows, () => { page.value = 1 })

/* ---------- scoped helpers ---------- */
function scopedReports() {
  return scope.value
    ? reports.reports.filter(r => r.department === scope.value)
    : reports.reports
}
function scopedClassReports() {
  return scope.value
    ? reports.classReports.filter(r => r.department === scope.value)
    : reports.classReports
}

/* ---------- report generator ---------- */
function generate(id) {
  const meta = catalogue.find(c => c.id === id)
  current.value = meta
  let rows = []
  const reps = scopedReports()

  switch (id) {
    case 'attendance':
      rows = reps.filter(r => r.attendance_rating && r.reporter_role === 'class_rep')
        .map(r => ({
          Date: r.date, Teacher: r.teacher, Department: r.department,
          Course: r.course, Rating: r.attendance_rating,
          Reporter: 'Anonymous Class Representative', Comment: r.comments
        }))
      break

    case 'performance':
      rows = reps.filter(r => r.performance_rating)
        .map(r => ({
          Date: r.date, Teacher: r.teacher, Department: r.department, Course: r.course,
          Rating: r.performance_rating,
          Source: r.is_self ? 'Self' : r.reporter_role,
          Comment: r.comments
        }))
      break

    case 'department':
      rows = directory.departments
        .filter(d => !scope.value || d.name === scope.value)
        .map(d => {
          const ts = directory.users.filter(u => u.role === 'teacher' && u.department === d.name)
          const dr = reps.filter(r => r.department === d.name)
          const rates = ts.map(t => reports.attendanceRate(t.id, 30)).filter(v => v !== null)
          const perfs = ts.map(t => reports.avgPerformance(t.id)).filter(v => v !== null)
          return {
            Department: d.name, Code: d.code, Teachers: ts.length,
            AttendanceRate: rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) + '%' : '—',
            AvgPerformance: perfs.length ? (perfs.reduce((a, b) => a + b, 0) / perfs.length).toFixed(2) : '—',
            ActiveAlerts: alerts.activeAlertsForDept(d.name).length,
            TotalReports: dr.length
          }
        })
      break

    case 'teacher':
      rows = directory.users
        .filter(u => u.role === 'teacher' && (!scope.value || u.department === scope.value))
        .map(t => ({
          StaffId: t.staffId, Name: t.name, Department: t.department, Position: t.position || '—',
          Division: t.division || 'Regular',
          AttendanceRate: reports.attendanceRate(t.id, 30) !== null
            ? reports.attendanceRate(t.id, 30) + '%' : '—',
          AvgPerformance: reports.avgPerformance(t.id) !== null
            ? reports.avgPerformance(t.id).toFixed(2) : '—',
          ConsecutiveAbsences: alerts.consecutiveAbsences(t.id)
        }))
      break

    case 'alert':
      rows = alerts.alerts
        .filter(a => !scope.value || a.department === scope.value)
        .map(a => ({
          Teacher: a.teacherName, Department: a.department, Streak: a.count,
          Escalated: a.escalated ? 'Yes' : 'No', Status: a.status,
          CreatedAt: fmtDate(a.createdAt),
          ResolvedAt: a.resolvedAt ? fmtDate(a.resolvedAt) : '—',
          ResolvedBy: a.resolvedBy || '—'
        }))
      break

    case 'student':
      rows = reps.filter(r => r.reporter_role === 'student')
        .map(r => ({
          Date: r.date, Teacher: r.teacher, Course: r.course,
          Rating: r.performance_rating, Comment: r.comments
        }))
      break

    case 'classrep':
      rows = reps.filter(r => r.reporter_role === 'class_rep')
        .map(r => ({
          Date: r.date, Teacher: r.teacher, Department: r.department, Course: r.course,
          Attendance: r.attendance_rating, Performance: r.performance_rating,
          Comment: r.comments
        }))
      break

    case 'classreport':
      rows = scopedClassReports().map(r => ({
        Date: r.date, Teacher: r.teacherName, Class: r.className,
        Topic: r.topic || '—', Type: r.sessionType || '—',
        StudentsPresent: r.studentsPresent || '—',
        Observations: r.observations
      }))
      break

    case 'dispute':
      rows = disputes.disputes
        .filter(d => !scope.value || d.department === scope.value)
        .map(d => ({
          Submitted: fmtDate(d.submittedAt), Teacher: d.teacherName,
          Department: d.department, ReportDate: fmtDate(d.reportDate),
          Report: d.reportSummary, Reason: d.reason,
          Status: d.status, Resolution: d.resolution || '—',
          ResolvedBy: d.resolvedBy || '—'
        }))
      break

    case 'selfreport':
      rows = reps.filter(r => r.is_self)
        .map(r => ({
          Date: r.date, Teacher: r.teacher, Course: r.course,
          Rating: r.performance_rating, Comment: r.comments
        }))
      break

    case 'audit':
      rows = settings.auditLog.slice(0, 500).map(l => ({
        Timestamp: l.timestamp, User: l.user, Role: l.role,
        Action: l.action, Module: l.module, Detail: l.detail, IP: l.ip
      }))
      break
  }

  reportRows.value = rows
  page.value = 1
  open.value = true
}

function closeReport() {
  open.value = false
  reportRows.value = []
  current.value = null
  page.value = 1
}

function printReport() {
  window.print()
}

function onExport() {
  if (!reportRows.value.length) { toast.warn('No data to export'); return }
  const filename = (current.value?.id || 'report') + '-report'
  if (exportCSV(reportRows.value, filename)) toast.ok('Export started')
}

function onSize(v) {
  pageSize.value = v
  page.value = 1
}
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Reports</h1>
        <div class="sub">Generate, view, and export · {{ scope || 'university-wide' }}</div>
      </div>
    </div>

    <!-- Report catalogue -->
    <div class="row g-3">
      <div v-for="r in catalogue" :key="r.id" class="col-xl-4 col-md-6">
        <div class="card" style="cursor:pointer" @click="generate(r.id)">
          <div class="card-bd">
            <div style="display:flex;gap:12px;align-items:flex-start">
              <div class="kpi-ico brand"><i :class="`bi bi-${r.ico}`"></i></div>
              <div style="flex:1">
                <h3 style="font-size:14px;margin-bottom:3px">{{ r.title }}</h3>
                <p class="muted" style="font-size:12.5px;margin:0">{{ r.desc }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ REPORT VIEWER MODAL ═══════════ -->
    <Modal v-if="open"
           :title="current ? current.title : 'Report'"
           :subtitle="`${totalRows} rows`"
           size="xwide"
           @close="closeReport">

      <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" @click="printReport">
          <i class="bi bi-printer"></i> Print
        </button>
        <button class="btn btn-secondary btn-sm" @click="onExport">
          <i class="bi bi-filetype-csv"></i> Export CSV
        </button>

        <!-- 🆕 Live row count -->
        <span class="badge-x b-brand" style="margin-left:auto">
          {{ totalRows }} total records
        </span>
      </div>

      <!-- Table with paginated rows -->
      <div class="tbl-wrap"
           style="max-height:520px;border:1px solid var(--border);border-radius:10px;overflow:auto">
        <table class="tbl">
          <thead>
            <tr><th v-for="h in headers" :key="h">{{ h }}</th></tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td :colspan="headers.length">
                <EmptyState icon="inbox" title="No data" />
              </td>
            </tr>
            <tr v-for="(r, i) in pageRows" :key="i">
              <td v-for="h in headers" :key="h">{{ r[h] }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 🆕 PAGINATION BAR -->
      <div style="margin-top:14px">
        <Pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="totalRows"
          :sizes="[10, 25, 50, 100, 250]"
          @update:page-size="onSize"
        />
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="closeReport">Close</button>
      </template>
    </Modal>
  </div>
</template>