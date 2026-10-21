<script setup>
import { ref, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import Modal from '@/components/common/Modal.vue'
import RatingBadge from '@/components/common/RatingBadge.vue'
import { useToast } from '@/composables/useToast'
import { todayISO, fmtDate } from '@/utils/format'
import { ALERT_THRESHOLDS } from '@/utils/constants'

const session   = useSessionStore()
const directory = useDirectoryStore()
const reports   = useReportsStore()
const alerts    = useAlertsStore()
const toast     = useToast()
const router    = useRouter()

/* ---------- form state ---------- */
const teacherId = ref('')
const course    = ref('')
const date      = ref(todayISO())
const attendance = ref('')      // Green / Blue / Yellow / Red
const performance = ref('')     // Green / Blue / Yellow
const comments  = ref('')

const submitting = ref(false)
const submittedReport = ref(null)   // payload after submit, for the modal

/* ---------- teacher dropdown ---------- */
const teachers = computed(() =>
  directory.teachers.filter(t => t.department === session.department)
)

/* ---------- rating options ---------- */
const attendanceOptions = [
  { value: 'Green',  cls: 'sw-green',  icon: 'check-circle-fill',         title: 'Green — Present, on time',       sub: 'No issues during the session' },
  { value: 'Blue',   cls: 'sw-blue',   icon: 'hand-thumbs-up-fill',       title: 'Blue — Present, minor issues',   sub: 'Slight delay, minor concern' },
  { value: 'Yellow', cls: 'sw-yellow', icon: 'exclamation-triangle-fill', title: 'Yellow — Present but issues',    sub: 'Late, unprepared, or disrupted' },
  { value: 'Red',    cls: 'sw-red',    icon: 'x-octagon-fill',            title: 'Red — Absent',                   sub: 'Teacher did not attend (3+ triggers alert)' }
]

const performanceOptions = [
  { value: 'Green',  cls: 'sw-green',  icon: 'check-circle-fill',         title: 'Green — Excellent',         sub: 'Well-prepared, engaging, clear' },
  { value: 'Blue',   cls: 'sw-blue',   icon: 'hand-thumbs-up-fill',       title: 'Blue — Good',               sub: 'Adequate delivery, minor concerns' },
  { value: 'Yellow', cls: 'sw-yellow', icon: 'exclamation-triangle-fill', title: 'Yellow — Needs Improvement', sub: 'Unclear, rushed, or disengaged' }
]

/* ---------- submit ---------- */
function validate() {
  if (!teacherId.value) { toast.err('Please select a teacher'); return false }
  if (!course.value.trim()) { toast.err('Please enter the course name'); return false }
  if (!date.value) { toast.err('Please select a date'); return false }
  if (!attendance.value) { toast.err('Please select an attendance rating'); return false }
  if (!performance.value) { toast.err('Please select a performance rating'); return false }
  return true
}

function submit() {
  if (!validate()) return

  const teacher = directory.userById(+teacherId.value)
  if (!teacher) { toast.err('Teacher not found'); return }

  const courseObj = directory.courses.find(c => c.teacherId === teacher.id)

  const payload = {
    date: date.value,
    teacherId: teacher.id,
    teacher: teacher.name,
    course: course.value.trim(),
    courseId: courseObj?.id || null,
    department: teacher.department,
    attendance_rating: attendance.value,
    performance_rating: performance.value,
    comments: comments.value.trim() || 'No comment',
    reporterId: session.userId,
    reporter: session.user?.name,
    reporter_role: 'class_rep',
    is_self: false,
    _createdAt: new Date().toISOString()
  }

  reports.addReport(payload)
  alerts.recompute()

  const streak = alerts.consecutiveAbsences(teacher.id)
  submittedReport.value = { ...payload, streak }
  submitting.value = false
}

function submitAnother() {
  submittedReport.value = null
  teacherId.value = ''
  course.value = ''
  date.value = todayISO()
  attendance.value = ''
  performance.value = ''
  comments.value = ''
}

function goDashboard() {
  submittedReport.value = null
  router.push({ name: 'dashboard' })
}

/* ---------- modal state from submitted report ---------- */
const alertState = computed(() => {
  if (!submittedReport.value) return null
  const streak = submittedReport.value.streak
  if (submittedReport.value.attendance_rating !== 'Red') return null
  if (streak >= ALERT_THRESHOLDS.admin)      return 'escalated'
  if (streak >= ALERT_THRESHOLDS.deptHead)   return 'warning'
  return 'info'
})
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Submit Daily Report</h1>
        <div class="sub">Record attendance and performance for a session</div>
      </div>
    </div>

    <div class="row g-3">
      <!-- ── Form ── -->
      <div class="col-xl-8">
        <div class="card">
          <div class="card-bd">
            <div class="row g-3 mb-2">
              <div class="col-md-5">
                <div class="form-row">
                  <label>Teacher <span class="req">*</span></label>
                  <select v-model="teacherId" class="inp">
                    <option value="">Select teacher…</option>
                    <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
                  </select>
                </div>
              </div>
              <div class="col-md-4">
                <div class="form-row">
                  <label>Course <span class="req">*</span></label>
                  <input v-model="course" class="inp" placeholder="e.g. Software Engineering" />
                </div>
              </div>
              <div class="col-md-3">
                <div class="form-row">
                  <label>Date <span class="req">*</span></label>
                  <input v-model="date" type="date" class="inp" />
                </div>
              </div>
            </div>

            <!-- Attendance -->
            <div class="sec-hd" style="margin-top:8px">
              <h3>Attendance Rating</h3><div class="line"></div>
            </div>
            <div
              v-for="o in attendanceOptions"
              :key="o.value"
              class="rate-opt"
              :class="{ sel: attendance === o.value }"
              role="radio"
              tabindex="0"
              @click="attendance = o.value"
              @keydown.enter.prevent="attendance = o.value"
              @keydown.space.prevent="attendance = o.value"
            >
              <div class="swatch" :class="o.cls"><i :class="`bi bi-${o.icon}`"></i></div>
              <div class="t"><strong>{{ o.title }}</strong><span>{{ o.sub }}</span></div>
              <i class="bi bi-check-circle-fill tick"></i>
            </div>

            <!-- Performance -->
            <div class="sec-hd">
              <h3>Performance Rating</h3><div class="line"></div>
            </div>
            <div
              v-for="o in performanceOptions"
              :key="o.value"
              class="rate-opt"
              :class="{ sel: performance === o.value }"
              role="radio"
              tabindex="0"
              @click="performance = o.value"
              @keydown.enter.prevent="performance = o.value"
              @keydown.space.prevent="performance = o.value"
            >
              <div class="swatch" :class="o.cls"><i :class="`bi bi-${o.icon}`"></i></div>
              <div class="t"><strong>{{ o.title }}</strong><span>{{ o.sub }}</span></div>
              <i class="bi bi-check-circle-fill tick"></i>
            </div>

            <div class="form-row mt-3">
              <label>Optional Comments</label>
              <textarea v-model="comments" class="inp" rows="3" placeholder="Any additional context…"></textarea>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
              <button class="btn btn-secondary" @click="submitAnother">Clear</button>
              <button class="btn btn-primary" :disabled="submitting" @click="submit">
                <i class="bi bi-send"></i> Submit Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Help panel ── -->
      <div class="col-xl-4">
        <div class="card mb-3">
          <div class="card-hd"><h3><i class="bi bi-info-circle"></i> How ratings work</h3></div>
          <div class="card-bd" style="font-size:13px;line-height:1.7">
            <p class="muted" style="margin-bottom:10px">Your report creates two independent ratings for the same session.</p>
            <div style="margin-bottom:8px"><b>Attendance:</b> G / B / Y / R</div>
            <div style="margin-bottom:12px"><b>Performance:</b> G / B / Y (no Red)</div>
            <div class="alert-pill alert-warning" style="display:inline-flex;margin-bottom:6px">
              <i class="bi bi-exclamation-triangle-fill"></i> 3+ consecutive Reds → dept head alerted
            </div>
            <div class="alert-pill alert-critical" style="display:inline-flex">
              <i class="bi bi-exclamation-octagon-fill"></i> 5+ Reds → escalated to admin
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-hd"><h3><i class="bi bi-lightbulb"></i> Reminders</h3></div>
          <div class="card-bd" style="font-size:13px;line-height:1.7;color:var(--ink-600)">
            <ul style="padding-left:18px;margin:0">
              <li>Submit reports <b>immediately after class</b></li>
              <li>Add a comment for any non-Green rating</li>
              <li>Anonymity is preserved — dept head sees your name only if follow-up is needed</li>
              <li>You can edit within 24 hours</li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Submission confirmation modal ── -->
    <Modal v-if="submittedReport"
           title="Report Submitted"
           :subtitle="`${submittedReport.teacher} · ${fmtDate(submittedReport.date)}`"
           @close="goDashboard">
      <div style="text-align:center;margin-bottom:14px">
        <i class="bi bi-check-circle-fill" style="font-size:44px;color:var(--success)"></i>
      </div>
      <p style="font-size:13.5px;color:var(--ink-600);margin-bottom:14px">
        Your report for <b>{{ submittedReport.teacher }}</b> has been recorded.
      </p>

      <div class="info-row"><div class="k">Course</div><div class="v">{{ submittedReport.course }}</div></div>
      <div class="info-row"><div class="k">Date</div><div class="v">{{ fmtDate(submittedReport.date) }}</div></div>
      <div class="info-row">
        <div class="k">Attendance</div>
        <div class="v"><RatingBadge :rating="submittedReport.attendance_rating" kind="attendance" /></div>
      </div>
      <div class="info-row">
        <div class="k">Performance</div>
        <div class="v"><RatingBadge :rating="submittedReport.performance_rating" kind="performance" show-label /></div>
      </div>

      <div v-if="alertState" style="margin-top:14px;padding:12px 14px;border-radius:10px;"
           :style="{
             background: alertState === 'escalated' ? 'var(--danger-50)' : alertState === 'warning' ? 'var(--warning-50)' : 'var(--ink-25)',
             borderLeft: '4px solid ' + (alertState === 'escalated' ? 'var(--danger)' : alertState === 'warning' ? 'var(--warning)' : 'var(--ink-300)')
           }">
        <b style="display:block;margin-bottom:4px;font-size:13px">
          Consecutive absences: {{ submittedReport.streak }}
        </b>
        <span style="font-size:12.5px;color:var(--ink-600)">
          <template v-if="alertState === 'escalated'">Escalated to Administrator (5+).</template>
          <template v-else-if="alertState === 'warning'">Department Head has been notified.</template>
          <template v-else>No alert yet — 3+ triggers an alert.</template>
        </span>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="goDashboard">Close</button>
        <button class="btn btn-primary btn-sm" @click="submitAnother">
          <i class="bi bi-plus-circle"></i> Submit another
        </button>
      </template>
    </Modal>
  </div>
</template>