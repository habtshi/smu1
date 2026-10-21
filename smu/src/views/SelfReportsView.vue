<script setup>
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useReportsStore } from '@/stores/reports'
import { useSettingsStore } from '@/stores/settings'
import Modal from '@/components/common/Modal.vue'
import RatingBadge from '@/components/common/RatingBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { fmtDate, todayISO } from '@/utils/format'

const session  = useSessionStore()
const reports  = useReportsStore()
const settings = useSettingsStore()
const toast    = useToast()

/* ---------- form ---------- */
const course    = ref('')
const date      = ref(todayISO())
const rating    = ref('')
const comments  = ref('')
const submitting = ref(false)

const ratingOptions = [
  { value: 'Green',  cls: 'sw-green',  icon: 'check-circle-fill',         title: 'Green — Excellent',              sub: 'Well-prepared, all objectives met' },
  { value: 'Blue',   cls: 'sw-blue',   icon: 'hand-thumbs-up-fill',       title: 'Blue — Good',                    sub: 'Adequate delivery, minor concerns' },
  { value: 'Yellow', cls: 'sw-yellow', icon: 'exclamation-triangle-fill', title: 'Yellow — Needs Improvement',     sub: 'Issues during session' },
  { value: 'Red',    cls: 'sw-red',    icon: 'x-octagon-fill',            title: 'Red — Session not delivered',    sub: 'Absent or cancelled' }
]

/* ---------- my self reports ---------- */
const mine = computed(() =>
  reports.reports
    .filter(r => r.teacherId === session.userId && r.is_self)
    .sort((a, b) => b.date.localeCompare(a.date))
)

/* ---------- submit ---------- */
function validate() {
  if (!course.value.trim()) { toast.err('Please enter a course'); return false }
  if (!date.value) { toast.err('Please select a date'); return false }
  if (!rating.value) { toast.err('Please select a rating'); return false }
  return true
}

function submit() {
  if (!validate()) return
  submitting.value = true

  reports.addReport({
    date: date.value,
    teacherId: session.userId,
    teacher: session.user?.name,
    course: course.value.trim(),
    courseId: null,
    department: session.department,
    attendance_rating: null,
    performance_rating: rating.value,
    comments: comments.value.trim() || 'Self-reported',
    reporterId: session.userId,
    reporter: session.user?.name,
    reporter_role: 'teacher',
    is_self: true
  })

  settings.audit('Self Report', 'Teacher Portal',
    `${session.user?.name} self-reported ${course.value} (${rating.value})`)

  toast.ok('Self report submitted')
  reset()
  submitting.value = false
}

function reset() {
  course.value = ''
  date.value = todayISO()
  rating.value = ''
  comments.value = ''
}
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Self Reports</h1>
        <div class="sub">Record your own teaching sessions</div>
      </div>
    </div>

    <div class="row g-3">
      <!-- ── Submit form ── -->
      <div class="col-xl-7">
        <div class="card">
          <div class="card-hd">
            <h3><i class="bi bi-pencil-square"></i> Submit New Self Report</h3>
          </div>
          <div class="card-bd">
            <div class="row g-3 mb-2">
              <div class="col-md-8">
                <div class="form-row">
                  <label>Course / Class <span class="req">*</span></label>
                  <input v-model="course" class="inp" placeholder="e.g. Software Engineering — Section A" />
                </div>
              </div>
              <div class="col-md-4">
                <div class="form-row">
                  <label>Date <span class="req">*</span></label>
                  <input v-model="date" type="date" class="inp" />
                </div>
              </div>
            </div>

            <div class="sec-hd" style="margin-top:8px">
              <h3>Self Assessment</h3><div class="line"></div>
            </div>

            <div v-for="o in ratingOptions" :key="o.value"
                 class="rate-opt"
                 :class="{ sel: rating === o.value }"
                 role="radio"
                 tabindex="0"
                 @click="rating = o.value"
                 @keydown.enter.prevent="rating = o.value"
                 @keydown.space.prevent="rating = o.value">
              <div class="swatch" :class="o.cls"><i :class="`bi bi-${o.icon}`"></i></div>
              <div class="t"><strong>{{ o.title }}</strong><span>{{ o.sub }}</span></div>
              <i class="bi bi-check-circle-fill tick"></i>
            </div>

            <div class="form-row mt-3">
              <label>Comments</label>
              <textarea v-model="comments" class="inp" rows="3"
                        placeholder="Context about the session…"></textarea>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
              <button class="btn btn-secondary" @click="reset">Clear</button>
              <button class="btn btn-primary" :disabled="submitting" @click="submit">
                <i class="bi bi-send"></i> Submit Self Report
              </button>
            </div>
          </div>
        </div>

        <!-- History -->
        <div class="card mt-3">
          <div class="card-hd">
            <h3><i class="bi bi-clock-history"></i> My Self Reports</h3>
            <span class="badge-x b-brand">{{ mine.length }}</span>
          </div>
          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Date</th><th>Course</th><th>Rating</th><th>Comment</th></tr>
              </thead>
              <tbody>
                <tr v-if="!mine.length">
                  <td colspan="4"><EmptyState icon="journal" title="No self reports yet" /></td>
                </tr>
                <tr v-for="r in mine.slice(0, 50)" :key="r.id">
                  <td>{{ fmtDate(r.date) }}</td>
                  <td class="muted">{{ r.course }}</td>
                  <td><RatingBadge :rating="r.performance_rating" kind="performance" show-label /></td>
                  <td class="muted" style="max-width:280px">{{ r.comments || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ── Info panel ── -->
      <div class="col-xl-5">
        <div class="card">
          <div class="card-hd">
            <h3><i class="bi bi-info-circle"></i> About self reports</h3>
          </div>
          <div class="card-bd" style="font-size:13px;line-height:1.75;color:var(--ink-600)">
            <p style="margin-bottom:10px">
              Self reports let you document your own sessions alongside class-representative reports.
            </p>
            <ul style="padding-left:18px;margin-bottom:12px">
              <li>Self reports do <b>not</b> trigger absence alerts</li>
              <li>They help explain context for reviewers</li>
              <li>They are <b>excluded</b> from your official performance average</li>
              <li>Class representatives cannot see your self reports</li>
            </ul>
            <div class="alert-pill alert-info" style="display:inline-flex;padding:10px 12px">
              <i class="bi bi-info-circle-fill"></i>
              <span style="margin-left:6px">Use them to explain unusual sessions.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>