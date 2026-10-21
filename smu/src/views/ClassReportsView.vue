<script setup>
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useReportsStore } from '@/stores/reports'
import { useDirectoryStore } from '@/stores/directory'
import { useSettingsStore } from '@/stores/settings'
import KpiCard from '@/components/common/KpiCard.vue'
import Modal from '@/components/common/Modal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { fmtDate, fmtDateTime, todayISO, debounce } from '@/utils/format'

const session   = useSessionStore()
const reports   = useReportsStore()
const directory = useDirectoryStore()
const settings  = useSettingsStore()
const toast     = useToast()

const isTeacher = computed(() => session.role === 'teacher')
const isAdmin   = computed(() => session.role === 'admin')
const isHead    = computed(() => session.role === 'dept_head')

/* ═══════════════════════════════════════════════════════
   Helper — look up teacher's division
   ═══════════════════════════════════════════════════════ */
function divisionOf(teacherId) {
  const t = directory.userById(teacherId)
  return t?.division || 'Regular'
}

/* ═══════════════════════════════════════════════════════
   TEACHER — submit form + own history
   ═══════════════════════════════════════════════════════ */
const className       = ref('')
const date            = ref(todayISO())
const topic           = ref('')
const sessionType     = ref('lecture')
const studentsPresent = ref('')
const observations    = ref('')
const submitting      = ref(false)

function submitTeacherReport() {
  if (!className.value.trim()) { toast.err('Please enter a class / course'); return }
  if (!date.value) { toast.err('Please select a date'); return }
  if (!observations.value.trim()) { toast.err('Please write your observations'); return }

  submitting.value = true
  reports.addClassReport({
    teacherId: session.userId,
    teacherName: session.user?.name,
    department: session.department,
    division: session.user?.division || 'Regular',      // 🆕
    className: className.value.trim(),
    date: date.value,
    topic: topic.value.trim(),
    sessionType: sessionType.value,
    studentsPresent: Number(studentsPresent.value) || null,
    observations: observations.value.trim()
  })
  settings.audit('Submit Class Report', 'Teacher Portal',
    `${session.user?.name} submitted class report for ${className.value}`)

  toast.ok('Class report submitted')
  resetTeacherForm()
  submitting.value = false
}

function resetTeacherForm() {
  className.value = ''
  date.value = todayISO()
  topic.value = ''
  sessionType.value = 'lecture'
  studentsPresent.value = ''
  observations.value = ''
}

const myClassReports = computed(() =>
  reports.classReports
    .filter(r => r.teacherId === session.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
)

/* ═══════════════════════════════════════════════════════
   ADMIN / DEPT HEAD — read-only with filters
   ═══════════════════════════════════════════════════════ */
const scope = computed(() =>
  isHead.value ? session.department : null
)

/* Attach division to each record */
const allReports = computed(() =>
  reports.classReports
    .filter(r => !scope.value || r.department === scope.value)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(r => ({
      ...r,
      division: r.division || divisionOf(r.teacherId)
    }))
)

/* ═══════════════════════════════════════════════════════
   🆕 FILTERS — search / teacher / department / division
   ═══════════════════════════════════════════════════════ */
const q             = ref('')      // search topic / class / observations
const filterTeacher = ref('')      // filter by teacher
const filterDept    = ref('')      // 🆕 filter by department
const filterDiv     = ref('')      // 🆕 filter by division

/* Department options */
const deptOptions = computed(() => {
  if (scope.value) return [scope.value]
  return directory.departments.map(d => d.name).sort()
})

/* Teacher options (respects current dept filter) */
const teachers = computed(() =>
  directory.teachers.filter(t => {
    if (scope.value) return t.department === scope.value
    if (filterDept.value) return t.department === filterDept.value
    return true
  })
)

/* Apply all filters */
const filtered = computed(() => {
  let list = allReports.value

  /* Teacher filter */
  if (filterTeacher.value) {
    list = list.filter(r => String(r.teacherId) === String(filterTeacher.value))
  }

  /* 🆕 Department filter */
  if (filterDept.value) {
    list = list.filter(r => r.department === filterDept.value)
  }

  /* 🆕 Division filter */
  if (filterDiv.value) {
    list = list.filter(r => {
      const div = r.division
      if (filterDiv.value === 'Both') return div === 'Both'
      return div === filterDiv.value || div === 'Both'
    })
  }

  /* Search by class / topic / observations / teacher */
  const term = q.value.toLowerCase()
  if (term) {
    list = list.filter(r =>
      (r.teacherName + ' ' + r.className + ' ' + (r.topic || '') + ' ' + (r.observations || ''))
        .toLowerCase().includes(term)
    )
  }

  return list
})

const onSearch = debounce(e => { q.value = e.target.value }, 180)

/* Clear all filters */
function clearFilters() {
  q.value = ''
  filterTeacher.value = ''
  filterDept.value = ''
  filterDiv.value = ''
}

/* Reset teacher when dept changes */
import { watch } from 'vue'
watch(filterDept, () => { filterTeacher.value = '' })

/* KPI calculations */
const avgStudents = computed(() => {
  const rows = allReports.value.filter(r => r.studentsPresent != null)
  if (!rows.length) return 0
  return Math.round(rows.reduce((s, r) => s + r.studentsPresent, 0) / rows.length)
})

const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)

/* ---------- view detail ---------- */
const viewing = ref(null)
function openView(row) { viewing.value = row }
function closeView() { viewing.value = null }

/* Division badge helper */
function divisionBadge(d) {
  return {
    Regular:   'b-blue',
    Extension: 'b-purple',
    Both:      'b-brand'
  }[d] || 'b-gray'
}
function divisionIcon(d) {
  if (d === 'Extension') return 'bi-moon-stars'
  if (d === 'Both')      return 'bi-arrow-left-right'
  return 'bi-sun'
}
</script>

<template>
  <div>
    <!-- ══════════════ TEACHER VIEW ══════════════ -->
    <template v-if="isTeacher">
      <div class="page-hd">
        <div>
          <h1>Class Reports</h1>
          <div class="sub">Write observations about your teaching sessions</div>
        </div>
      </div>

      <div class="row g-3">
        <!-- Form -->
        <div class="col-xl-5">
          <div class="card">
            <div class="card-hd"><h3><i class="bi bi-pencil-square"></i> New Class Report</h3></div>
            <div class="card-bd">
              <div class="row g-3">
                <div class="col-md-6">
                  <div class="form-row">
                    <label>Class / Course <span class="req">*</span></label>
                    <input v-model="className" class="inp" placeholder="e.g. CoSc3061 — Section A" />
                  </div>
                </div>
                <div class="col-md-6">
                  <div class="form-row">
                    <label>Date <span class="req">*</span></label>
                    <input v-model="date" type="date" class="inp" />
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-row">
                    <label>Students Present</label>
                    <input v-model="studentsPresent" type="number" min="0" class="inp mono" placeholder="e.g. 24" />
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-row">
                    <label>Topic Covered</label>
                    <input v-model="topic" class="inp" placeholder="e.g. Agile methodology" />
                  </div>
                </div>
                <div class="col-md-4">
                  <div class="form-row">
                    <label>Session Type</label>
                    <select v-model="sessionType" class="inp">
                      <option value="lecture">Lecture</option>
                      <option value="lab">Lab</option>
                      <option value="tutorial">Tutorial</option>
                      <option value="seminar">Seminar</option>
                    </select>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <label>Observations <span class="req">*</span></label>
                <textarea v-model="observations" class="inp" rows="5"
                          placeholder="Describe how the session went, student engagement, challenges encountered, follow-up needed…"></textarea>
              </div>

              <div style="display:flex;justify-content:flex-end;gap:8px">
                <button class="btn btn-secondary" @click="resetTeacherForm">Clear</button>
                <button class="btn btn-primary" :disabled="submitting" @click="submitTeacherReport">
                  <i class="bi bi-send"></i> Submit Report
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- History -->
        <div class="col-xl-7">
          <div class="card">
            <div class="card-hd">
              <h3><i class="bi bi-clock-history"></i> My Class Reports</h3>
              <span class="badge-x b-brand">{{ myClassReports.length }}</span>
            </div>
            <div class="tbl-wrap">
              <table class="tbl">
                <thead>
                  <tr><th>Date</th><th>Class</th><th>Topic</th><th>Type</th><th class="num">Present</th><th>Submitted</th></tr>
                </thead>
                <tbody>
                  <tr v-if="!myClassReports.length">
                    <td colspan="6">
                      <EmptyState icon="journal-text" title="No class reports yet"
                                  text="Submit your first class observation report." />
                    </td>
                  </tr>
                  <tr v-for="r in myClassReports" :key="r.id">
                    <td>{{ fmtDate(r.date) }}</td>
                    <td><b>{{ r.className }}</b></td>
                    <td class="muted">{{ r.topic || '—' }}</td>
                    <td><span class="badge-x b-gray">{{ r.sessionType || '—' }}</span></td>
                    <td class="num">{{ r.studentsPresent || '—' }}</td>
                    <td class="muted t-xs">{{ fmtDateTime(r.createdAt) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ══════════════ ADMIN / DEPT HEAD VIEW ══════════════ -->
    <template v-else-if="isAdmin || isHead">
      <div class="page-hd">
        <div>
          <h1>Class Reports</h1>
          <div class="sub">Teacher-submitted session observations{{ scope ? ' · ' + scope : '' }}</div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="row g-3 mb-4">
        <div class="col-xl-3 col-md-6">
          <KpiCard label="Total Reports" :value="allReports.length" sub="all time"
                   icon="journal-text" color="brand" />
        </div>
        <div class="col-xl-3 col-md-6">
          <KpiCard label="Last 7 days"
                   :value="allReports.filter(r => r.date >= weekAgo).length"
                   sub="this week" icon="calendar-week" color="info" />
        </div>
        <div class="col-xl-3 col-md-6">
          <KpiCard label="Teachers Reporting"
                   :value="new Set(allReports.map(r => r.teacherId)).size"
                   sub="unique" icon="person-video3" color="purple" />
        </div>
        <div class="col-xl-3 col-md-6">
          <KpiCard label="Avg Students" :value="avgStudents" sub="per session"
                   icon="people-fill" color="success" />
        </div>
      </div>

      <!-- Table -->
      <div class="card">
        <div class="card-hd">
          <h3><i class="bi bi-journal-text"></i> Class Reports</h3>
          <span class="badge-x b-brand">{{ filtered.length }} of {{ allReports.length }}</span>
        </div>

        <!-- 🆕 Filter toolbar -->
        <div class="tbl-toolbar">
          <div class="tbl-search">
            <i class="bi bi-search"></i>
            <input @input="onSearch" placeholder="Search teacher, class, topic…" />
          </div>

          <select v-model="filterTeacher" class="inp" style="max-width:200px;height:34px">
            <option value="">All teachers</option>
            <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>

          <select v-model="filterDept" class="inp" style="max-width:200px;height:34px" :disabled="!!scope">
            <option value="">All departments</option>
            <option v-for="d in deptOptions" :key="d" :value="d">{{ d }}</option>
          </select>

          <select v-model="filterDiv" class="inp" style="max-width:160px;height:34px">
            <option value="">All divisions</option>
            <option value="Regular">Regular</option>
            <option value="Extension">Extension</option>
            <option value="Both">Both</option>
          </select>

          <button
            v-if="q || filterTeacher || filterDept || filterDiv"
            class="btn btn-ghost btn-sm"
            @click="clearFilters"
          >
            <i class="bi bi-x-lg"></i> Clear
          </button>
        </div>

        <div class="tbl-wrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Teacher</th>
                <th>Department</th>
                <th>Division</th>
                <th>Class</th>
                <th>Topic</th>
                <th>Type</th>
                <th class="num">Present</th>
                <th>Observations</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!filtered.length">
                <td colspan="10">
                  <EmptyState
                    icon="journal-text"
                    :title="allReports.length ? 'No matching reports' : 'No class reports found'"
                    :text="allReports.length ? 'Try a different filter.' : ''"
                  />
                </td>
              </tr>
              <tr v-for="r in filtered" :key="r.id">
                <td>{{ fmtDate(r.date) }}</td>
                <td><b>{{ r.teacherName }}</b></td>
                <td class="muted">{{ r.department }}</td>

                <!-- 🆕 Division badge -->
                <td>
                  <span class="badge-x" :class="divisionBadge(r.division)">
                    <i :class="`bi ${divisionIcon(r.division)}`"></i>
                    {{ r.division }}
                  </span>
                </td>

                <td>{{ r.className }}</td>
                <td class="muted">{{ r.topic || '—' }}</td>
                <td><span class="badge-x b-gray">{{ r.sessionType || '—' }}</span></td>
                <td class="num">{{ r.studentsPresent || '—' }}</td>
                <td class="muted" style="max-width:280px">
                  {{ (r.observations || '').slice(0, 80) }}{{ (r.observations || '').length > 80 ? '…' : '' }}
                </td>
                <td class="actions">
                  <button class="btn btn-ghost btn-xs" @click="openView(r)" title="View">
                    <i class="bi bi-eye"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Detail modal -->
    <Modal v-if="viewing"
           title="Class Report Detail"
           :subtitle="`${viewing.teacherName} · ${fmtDate(viewing.date)}`"
           @close="closeView">
      <div class="info-row"><div class="k">Teacher</div><div class="v">{{ viewing.teacherName }}</div></div>
      <div class="info-row"><div class="k">Department</div><div class="v">{{ viewing.department }}</div></div>
      <div class="info-row">
        <div class="k">Division</div>
        <div class="v">
          <span class="badge-x" :class="divisionBadge(viewing.division)">
            <i :class="`bi ${divisionIcon(viewing.division)}`"></i>
            {{ viewing.division }}
          </span>
        </div>
      </div>
      <div class="info-row"><div class="k">Class / Course</div><div class="v">{{ viewing.className }}</div></div>
      <div class="info-row"><div class="k">Date</div><div class="v">{{ fmtDate(viewing.date) }}</div></div>
      <div class="info-row"><div class="k">Session Type</div><div class="v">{{ viewing.sessionType || '—' }}</div></div>
      <div class="info-row"><div class="k">Topic</div><div class="v">{{ viewing.topic || '—' }}</div></div>
      <div class="info-row"><div class="k">Students Present</div><div class="v">{{ viewing.studentsPresent || '—' }}</div></div>

      <div style="margin-top:14px;padding:14px;background:var(--ink-25);border-radius:10px;font-size:13px;line-height:1.65;white-space:pre-wrap">
        {{ viewing.observations }}
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="closeView">Close</button>
      </template>
    </Modal>
  </div>
</template>