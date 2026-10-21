<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useSettingsStore } from '@/stores/settings'
import RatingBadge from '@/components/common/RatingBadge.vue'
import { useToast } from '@/composables/useToast'
import { todayISO } from '@/utils/format'

const router    = useRouter()
const session   = useSessionStore()
const directory = useDirectoryStore()
const reports   = useReportsStore()
const settings  = useSettingsStore()
const toast     = useToast()

const teacherId  = ref('')
const course     = ref('')
const date       = ref(todayISO())
const rating     = ref('')
const comments   = ref('')
const submitting = ref(false)

const ratingOptions = [
  { value: 'Green',  cls: 'sw-green',  icon: 'check-circle-fill',         title: 'Green — Excellent',          sub: 'Well-prepared, engaging' },
  { value: 'Blue',   cls: 'sw-blue',   icon: 'hand-thumbs-up-fill',       title: 'Blue — Good',                sub: 'Adequate, minor concerns' },
  { value: 'Yellow', cls: 'sw-yellow', icon: 'exclamation-triangle-fill', title: 'Yellow — Needs Improvement', sub: 'Unclear, rushed, or disengaged' }
]

const teachers = () => directory.teachers

function submit() {
  if (!teacherId.value) { toast.err('Please select a teacher'); return }
  if (!course.value.trim()) { toast.err('Please enter the course name'); return }
  if (!date.value) { toast.err('Please select a date'); return }
  if (!rating.value) { toast.err('Please select a rating'); return }
  if (rating.value === 'Red') { toast.err('Students cannot submit Red ratings'); return }

  submitting.value = true
  const t = directory.userById(+teacherId.value)

  reports.addReport({
    date: date.value,
    teacherId: t.id,
    teacher: t.name,
    course: course.value.trim(),
    courseId: directory.courses.find(c => c.teacherId === t.id)?.id || null,
    department: t.department,
    attendance_rating: null,
    performance_rating: rating.value,
    comments: comments.value.trim() || 'No comment',
    reporterId: session.userId,
    reporter: session.user?.name,
    reporter_role: 'student',
    is_self: false,
    _createdAt: new Date().toISOString()
  })

  settings.audit('Submit Rating', 'Student Feedback',
    `${session.user?.name} rated ${t.name} (${rating.value})`)

  toast.ok('Rating submitted successfully')
  submitting.value = false
  router.push({ name: 'dashboard' })
}

function reset() {
  teacherId.value = ''
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
        <h1>Submit Performance Rating</h1>
        <div class="sub">Rate the quality of a session you attended</div>
      </div>
    </div>

    <div class="row g-3">
      <!-- Form -->
      <div class="col-xl-7">
        <div class="card">
          <div class="card-bd">
            <div class="row g-3 mb-2">
              <div class="col-md-6">
                <div class="form-row">
                  <label>Teacher <span class="req">*</span></label>
                  <select v-model="teacherId" class="inp">
                    <option value="">Select teacher…</option>
                    <option v-for="t in teachers()" :key="t.id" :value="t.id">
                      {{ t.name }} — {{ t.department }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-row">
                  <label>Course <span class="req">*</span></label>
                  <input v-model="course" class="inp" placeholder="e.g. Software Engineering" />
                </div>
              </div>
              <div class="col-md-6">
                <div class="form-row">
                  <label>Date <span class="req">*</span></label>
                  <input v-model="date" type="date" class="inp" />
                </div>
              </div>
            </div>

            <div class="sec-hd" style="margin-top:8px">
              <h3>Performance Rating</h3><div class="line"></div>
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
              <label>Optional Comments</label>
              <textarea v-model="comments" class="inp" rows="3"
                        placeholder="What stood out?"></textarea>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
              <button class="btn btn-secondary" @click="reset">Clear</button>
              <button class="btn btn-primary" :disabled="submitting" @click="submit">
                <i class="bi bi-send"></i> Submit Rating
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Info panel -->
      <div class="col-xl-5">
        <div class="card">
          <div class="card-hd"><h3><i class="bi bi-info-circle"></i> Rating rules</h3></div>
          <div class="card-bd" style="font-size:13px;line-height:1.75;color:var(--ink-600)">
            <p style="margin-bottom:12px">Students submit <b>performance ratings only</b>.</p>
            <p style="margin-bottom:12px">Available ratings:</p>
            <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
              <RatingBadge rating="Green" kind="performance" show-label />
              <RatingBadge rating="Blue"  kind="performance" show-label />
              <RatingBadge rating="Yellow" kind="performance" show-label />
            </div>
            <div class="alert-pill alert-warning"
                 style="display:inline-flex;align-items:flex-start;text-align:left;padding:10px 12px">
              <i class="bi bi-info-circle-fill" style="margin-top:2px"></i>
              <span style="margin-left:6px">
                Attendance ratings (including <b>Red</b>) are submitted only by your Class Representative.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>