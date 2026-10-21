<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useSectionsStore } from '@/stores/sections'
import { useSettingsStore } from '@/stores/settings'
import KpiCard from '@/components/common/KpiCard.vue'
import Modal from '@/components/common/Modal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'
import { exportCSV } from '@/utils/format'

const session   = useSessionStore()
const directory = useDirectoryStore()
const sections  = useSectionsStore()
const settings  = useSettingsStore()
const toast     = useToast()

const scope = computed(() =>
  session.role === 'dept_head' ? session.department : null
)

/* ══════════════════════════════════════════════════
   FILTERS
   ══════════════════════════════════════════════════ */
const q        = ref('')
const deptF    = ref(scope.value || '')
const divF     = ref('')
const levelF   = ref('')
const statusF  = ref('')       // '', 'complete', 'incomplete'
const teacherF = ref('')

const depts = computed(() => {
  if (scope.value) return [scope.value]
  return directory.departments.map(d => d.name)
})

const scopedClasses = computed(() =>
  sections.classesWithStats.filter(c => !scope.value || c.department === scope.value)
)

/* ---------- filtered classes ---------- */
const filteredClasses = computed(() => {
  const term = q.value.toLowerCase()
  return scopedClasses.value
    .filter(c => !deptF.value  || c.department === deptF.value)
    .filter(c => !divF.value   || c.division === divF.value)
    .filter(c => !levelF.value || String(c.yearLevel) === String(levelF.value))
    .filter(c => {
      if (statusF.value === 'complete')   return c.unassignedCourses === 0
      if (statusF.value === 'incomplete') return c.unassignedCourses > 0
      return true
    })
    .filter(c => {
      if (!teacherF.value) return true
      return (c.courses || []).some(cr => String(cr.teacherId) === String(teacherF.value))
    })
    .filter(c => {
      if (!term) return true
      const coursesText = (c.courses || []).map(cr => cr.courseCode + ' ' + cr.courseName).join(' ')
      return (c.code + ' ' + c.department + ' ' + c.division + ' ' + coursesText)
        .toLowerCase().includes(term)
    })
    .sort((a, b) => a.code.localeCompare(b.code))
})

/* ---------- KPIs ---------- */
const totalClasses      = computed(() => scopedClasses.value.length)
const totalSlots        = computed(() => scopedClasses.value.reduce((s, c) => s + c.totalCourses, 0))
const assignedSlots     = computed(() => scopedClasses.value.reduce((s, c) => s + c.assignedCourses, 0))
const unassignedSlots   = computed(() => scopedClasses.value.reduce((s, c) => s + c.unassignedCourses, 0))
const coverage          = computed(() => totalSlots.value ? Math.round((assignedSlots.value / totalSlots.value) * 100) : 0)
const incompleteClasses = computed(() => scopedClasses.value.filter(c => c.unassignedCourses > 0).length)

const teachersInScope = computed(() =>
  directory.teachers.filter(t => !scope.value || t.department === scope.value)
)

/* ---------- KPI click ---------- */
function kpiAll()        { statusF.value = ''; teacherF.value = '' }
function kpiComplete()   { statusF.value = 'complete';   teacherF.value = '' }
function kpiIncomplete() { statusF.value = 'incomplete'; teacherF.value = '' }
function kpiTeachers()   { document.getElementById('workload-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

/* ══════════════════════════════════════════════════
   PAGINATION — Classes
   ══════════════════════════════════════════════════ */
const page     = ref(1)
const pageSize = ref(12)
const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredClasses.value.slice(start, start + pageSize.value)
})
function onSize(v) { pageSize.value = v; page.value = 1 }
watch([q, deptF, divF, levelF, statusF, teacherF], () => { page.value = 1 })

/* ══════════════════════════════════════════════════
   PAGINATION — Teacher Workload
   ══════════════════════════════════════════════════ */
const workloadPage     = ref(1)
const workloadPageSize = ref(10)

const filteredWorkload = computed(() =>
  sections.teacherWorkload.filter(t => !scope.value || t.teacher.department === scope.value)
)

const workloadPageRows = computed(() => {
  const start = (workloadPage.value - 1) * workloadPageSize.value
  return filteredWorkload.value.slice(start, start + workloadPageSize.value)
})

function onWorkloadSize(v) {
  workloadPageSize.value = v
  workloadPage.value = 1
}

watch(filteredWorkload, () => { workloadPage.value = 1 })

/* ---------- view helpers ---------- */
function teacherName(id) {
  if (!id) return null
  return directory.userById(id)?.name || null
}
function divBadge(d) {
  return { Regular: 'b-blue', Extension: 'b-purple', Both: 'b-brand' }[d] || 'b-gray'
}
function levelLabel(n) {
  return ['', '1st', '2nd', '3rd', '4th', '5th'][n] || `${n}`
}
function progressClass(c) {
  if (c.unassignedCourses === 0) return 'b-green'
  if (c.assignedCourses === 0)   return 'b-red'
  return 'b-amber'
}
function clearFilters() {
  q.value = ''
  deptF.value = scope.value || ''
  divF.value = ''
  levelF.value = ''
  statusF.value = ''
  teacherF.value = ''
}

/* ══════════════════════════════════════════════════
   CLASS DETAIL MODAL
   ══════════════════════════════════════════════════ */
const viewingClass = ref(null)

function openClass(c) {
  viewingClass.value = { ...c }
}
function closeClass() {
  viewingClass.value = null
}

/* Refresh viewingClass from store */
function refreshViewingClass() {
  if (!viewingClass.value) return
  const fresh = sections.classById(viewingClass.value.id)
  if (!fresh) { viewingClass.value = null; return }

  const total    = (fresh.courses || []).length
  const assigned = (fresh.courses || []).filter(x => x.teacherId).length
  viewingClass.value = {
    ...fresh,
    totalCourses: total,
    assignedCourses: assigned,
    unassignedCourses: total - assigned
  }
}

/* ══════════════════════════════════════════════════
   ASSIGN TEACHER MODAL
   ══════════════════════════════════════════════════ */
const assigning = ref(null)
const pickedTeacher = ref('')

function openAssign(c, cr) {
  assigning.value = {
    classId: c.id,
    classCode: c.code,
    courseId: cr.courseId,
    courseCode: cr.courseCode,
    courseName: cr.courseName,
    currentTeacherId: cr.teacherId || ''
  }
  pickedTeacher.value = cr.teacherId || ''
}
function closeAssign() {
  assigning.value = null
  pickedTeacher.value = ''
}
function saveAssign() {
  if (!assigning.value) return
  const a = assigning.value
  const t = directory.userById(+pickedTeacher.value)
  sections.assignCourseTeacher(a.classId, a.courseId, pickedTeacher.value || null)

  refreshViewingClass()

  settings.audit(
    'Assign Course Teacher',
    'Teacher Assignments',
    `${t?.name || 'Nobody'} → ${a.classCode} · ${a.courseCode}`
  )
  toast.ok(pickedTeacher.value
    ? `${t?.name} assigned to ${a.courseCode}`
    : `Unassigned ${a.courseCode}`)
  closeAssign()
}

/* ══════════════════════════════════════════════════
   ADD COURSE MODAL
   ══════════════════════════════════════════════════ */
const addCourseOpen  = ref(false)
const pickedCourse   = ref('')
const pickedTeacherForNewCourse = ref('')

const availableCourses = computed(() => {
  if (!viewingClass.value) return []
  const existing = new Set((viewingClass.value.courses || []).map(c => c.courseId))
  return directory.courses
    .filter(c => c.department === viewingClass.value.department)
    .filter(c => !existing.has(c.id))
})

function openAddCourse() {
  pickedCourse.value = ''
  pickedTeacherForNewCourse.value = ''
  addCourseOpen.value = true
}
function closeAddCourse() {
  addCourseOpen.value = false
  pickedCourse.value = ''
  pickedTeacherForNewCourse.value = ''
}
function saveNewCourse() {
  if (!pickedCourse.value || !viewingClass.value) return
  const c = viewingClass.value

  const result = sections.addCourseToClass(
    c.id,
    pickedCourse.value,
    pickedTeacherForNewCourse.value || null
  )

  if (result?.error === 'duplicate') {
    toast.err('This course is already in the class')
    return
  }

  refreshViewingClass()

  const course = directory.courses.find(x => x.id === +pickedCourse.value)
  settings.audit(
    'Add Course to Class',
    'Teacher Assignments',
    `${course?.code || 'Course'} added to ${c.code}`
  )
  toast.ok(`${course?.code} added to ${c.code}`)
  closeAddCourse()
}

/* ══════════════════════════════════════════════════
   REMOVE COURSE
   ══════════════════════════════════════════════════ */
const removingCourse = ref(null)

function askRemoveCourse(cr) {
  removingCourse.value = cr
}
function confirmRemoveCourse() {
  const cr = removingCourse.value
  if (!cr || !viewingClass.value) return
  const c = viewingClass.value

  sections.removeCourseFromClass(c.id, cr.courseId)
  refreshViewingClass()

  settings.audit(
    'Remove Course from Class',
    'Teacher Assignments',
    `${cr.courseCode} removed from ${c.code}`
  )
  toast.warn(`${cr.courseCode} removed from ${c.code}`)
  removingCourse.value = null
}

/* ══════════════════════════════════════════════════
   DELETE CLASS
   ══════════════════════════════════════════════════ */
const deletingClass = ref(null)
function askDeleteClass(c) { deletingClass.value = c }
function confirmDeleteClass() {
  if (!deletingClass.value) return
  sections.deleteClass(deletingClass.value.id)
  settings.audit('Delete Class', 'Teacher Assignments', `Removed ${deletingClass.value.code}`)
  toast.warn(`Class ${deletingClass.value.code} deleted`)
  deletingClass.value = null
}

/* ---------- filter by teacher ---------- */
function filterByTeacher(id) {
  teacherF.value = String(teacherF.value) === String(id) ? '' : id
}

/* ---------- export ---------- */
function onExport() {
  const rows = []
  filteredClasses.value.forEach(c => {
    (c.courses || []).forEach(cr => {
      rows.push({
        Class:      c.code,
        Department: c.department,
        Division:   c.division,
        YearLevel:  c.yearLevel,
        Section:    c.section,
        Course:     cr.courseCode,
        CourseName: cr.courseName,
        Teacher:    teacherName(cr.teacherId) || 'UNASSIGNED'
      })
    })
  })
  if (exportCSV(rows, 'class-course-assignments')) toast.ok('Export started')
}
</script>

<template>
  <div>
    <!-- ═══════════ PAGE HEADER ═══════════ -->
    <div class="page-hd">
      <div>
        <h1>Teacher Assignments</h1>
        <div class="sub">
          Each class has multiple courses · one teacher per course · {{ scope || 'university-wide' }}
        </div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-secondary btn-sm" @click="onExport">
          <i class="bi bi-download"></i> Export
        </button>
      </div>
    </div>

    <!-- ═══════════ CLICKABLE KPIs ═══════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-3 col-md-6">
        <div @click="kpiAll" style="cursor:pointer">
          <KpiCard label="Total Classes" :value="totalClasses"
                   :sub="totalSlots + ' course slots'"
                   icon="grid-3x3-gap-fill" color="brand"
                   :class="{ 'kpi-active': !statusF && !teacherF }" />
        </div>
      </div>
      <div class="col-xl-3 col-md-6">
        <div @click="kpiComplete" style="cursor:pointer">
          <KpiCard label="Assigned Courses" :value="assignedSlots"
                   :sub="coverage + '% coverage'"
                   icon="check-circle-fill" color="success"
                   :class="{ 'kpi-active': statusF === 'complete' }" />
        </div>
      </div>
      <div class="col-xl-3 col-md-6">
        <div @click="kpiIncomplete" style="cursor:pointer">
          <KpiCard label="Unassigned Courses" :value="unassignedSlots"
                   :sub="incompleteClasses + ' classes affected'"
                   icon="exclamation-octagon-fill"
                   :color="unassignedSlots ? 'danger' : 'success'"
                   :class="{ 'kpi-active': statusF === 'incomplete' }" />
        </div>
      </div>
      <div class="col-xl-3 col-md-6">
        <div @click="kpiTeachers" style="cursor:pointer">
          <KpiCard label="Teachers" :value="teachersInScope.length"
                   sub="view workload ↓"
                   icon="person-check-fill" color="purple" />
        </div>
      </div>
    </div>

    <!-- ═══════════ 🚨 ALERT ═══════════ -->
    <div v-if="unassignedSlots && statusF !== 'complete'" class="unassigned-card">
      <div class="un-header">
        <div class="un-badge">
          <i class="bi bi-exclamation-octagon-fill"></i>
        </div>
        <div style="flex:1">
          <h3>
            {{ unassignedSlots }} Course Slot{{ unassignedSlots === 1 ? '' : 's' }} Have No Teacher
          </h3>
          <p>
            {{ incompleteClasses }} class{{ incompleteClasses === 1 ? '' : 'es' }} still need one or more teachers
            assigned to their courses.
          </p>
        </div>
        <button
          v-if="statusF !== 'incomplete'"
          class="btn btn-danger btn-sm"
          @click="kpiIncomplete"
        >
          <i class="bi bi-filter"></i> Show affected classes
        </button>
      </div>
    </div>

    <!-- ═══════════ FILTERS ═══════════ -->
    <div class="filter-bar">
      <div class="tbl-search" style="max-width:260px">
        <i class="bi bi-search"></i>
        <input v-model="q" placeholder="Search class code or course…" />
      </div>

      <select v-model="deptF" class="inp" style="max-width:180px;height:34px" :disabled="!!scope">
        <option value="">All departments</option>
        <option v-for="d in depts" :key="d" :value="d">{{ d }}</option>
      </select>

      <select v-model="divF" class="inp" style="max-width:130px;height:34px">
        <option value="">All divisions</option>
        <option value="Regular">Regular</option>
        <option value="Extension">Extension</option>
      </select>

      <select v-model="levelF" class="inp" style="max-width:150px;height:34px">
        <option value="">All year levels</option>
        <option value="1">1st Year</option>
        <option value="2">2nd Year</option>
        <option value="3">3rd Year</option>
        <option value="4">4th Year</option>
        <option value="5">5th Year</option>
      </select>

      <select v-model="statusF" class="inp" style="max-width:180px;height:34px">
        <option value="">All classes</option>
        <option value="incomplete">🚨 Incomplete only</option>
        <option value="complete">✅ Fully assigned</option>
      </select>

      <select v-model="teacherF" class="inp" style="max-width:200px;height:34px">
        <option value="">All teachers</option>
        <option v-for="t in teachersInScope" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>

      <button
        v-if="q || deptF !== (scope || '') || divF || levelF || statusF || teacherF"
        class="btn btn-ghost btn-sm"
        @click="clearFilters"
      >
        <i class="bi bi-x-lg"></i> Clear
      </button>
    </div>

    <!-- ═══════════ CLASSES TABLE ═══════════ -->
    <div class="card mb-4">
      <div class="card-hd">
        <h3><i class="bi bi-grid-3x3-gap-fill"></i> Classes</h3>
        <span class="badge-x b-brand">{{ filteredClasses.length }} of {{ totalClasses }}</span>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Class Code</th>
              <th>Department</th>
              <th>Division</th>
              <th>Year Level</th>
              <th class="num">Students</th>
              <th class="num">Courses</th>
              <th>Coverage</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td colspan="8">
                <EmptyState icon="grid" title="No classes match your filters" />
              </td>
            </tr>
            <tr v-for="c in pageRows" :key="c.id"
                :class="{ 'row-incomplete': c.unassignedCourses > 0 }">
              <td>
                <span class="mono" style="font-weight:700">{{ c.code }}</span>
                <div class="t-xs muted">Room {{ c.room }}</div>
              </td>
              <td class="muted">{{ c.department }}</td>
              <td>
                <span class="badge-x" :class="divBadge(c.division)">
                  <i :class="c.division === 'Extension' ? 'bi bi-moon-stars' : 'bi bi-sun'"></i>
                  {{ c.division }}
                </span>
              </td>
              <td><span class="badge-x b-gray">{{ levelLabel(c.yearLevel) }} Year</span></td>
              <td class="num">{{ c.studentCount }}</td>
              <td class="num">
                <span class="badge-x" :class="progressClass(c)">
                  {{ c.assignedCourses }} / {{ c.totalCourses }}
                </span>
              </td>
              <td>
                <div class="cov-bar">
                  <div class="cov-fill"
                       :class="c.unassignedCourses === 0 ? 'full' : c.assignedCourses === 0 ? 'empty' : 'partial'"
                       :style="{ width: (c.totalCourses ? (c.assignedCourses / c.totalCourses) * 100 : 0) + '%' }">
                  </div>
                </div>
              </td>
              <td class="actions">
                <button class="btn btn-primary btn-xs" @click="openClass(c)">
                  <i class="bi bi-pencil-square"></i> Manage
                </button>
                <button class="btn btn-danger btn-xs" @click="askDeleteClass(c)" title="Delete class">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <Pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="filteredClasses.length"
        :sizes="[12, 25, 50, 100]"
        @update:page-size="onSize"
      />
    </div>

    <!-- ═══════════ TEACHER WORKLOAD ═══════════ -->
    <div id="workload-section" class="card">
      <div class="card-hd">
        <h3><i class="bi bi-people-fill"></i> Teacher Workload</h3>
        <span class="badge-x b-brand">{{ filteredWorkload.length }} teachers</span>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Department</th>
              <th>Division</th>
              <th class="num">Courses</th>
              <th class="num">Classes</th>
              <th>Workload</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!workloadPageRows.length">
              <td colspan="7"><EmptyState icon="people" title="No teachers" /></td>
            </tr>
            <tr
              v-for="row in workloadPageRows"
              :key="row.teacher.id"
              :class="{ 'row-selected': String(teacherF) === String(row.teacher.id) }"
            >
              <td>
                <RouterLink :to="{ name: 'teacher-detail', params: { id: row.teacher.id } }"
                            style="color:var(--ink-800);text-decoration:none;font-weight:600">
                  {{ row.teacher.name }}
                </RouterLink>
              </td>
              <td class="muted">{{ row.teacher.department }}</td>
              <td>
                <span class="badge-x"
                      :class="row.teacher.division === 'Extension' ? 'b-purple' :
                              row.teacher.division === 'Both' ? 'b-brand' : 'b-blue'">
                  {{ row.teacher.division || 'Regular' }}
                </span>
              </td>
              <td class="num">
                <span class="badge-x"
                      :class="row.courseCount === 0 ? 'b-gray' :
                              row.courseCount >= 8 ? 'b-red' :
                              row.courseCount >= 5 ? 'b-amber' : 'b-green'">
                  {{ row.courseCount }}
                </span>
              </td>
              <td class="num">
                <span class="badge-x b-brand">{{ row.classCount }}</span>
              </td>
              <td>
                <div class="workload-bar">
                  <div class="wb-fill"
                       :style="{ width: Math.min(100, row.courseCount * 10) + '%' }"
                       :class="row.courseCount >= 8 ? 'high' : row.courseCount >= 5 ? 'mid' : 'low'"></div>
                </div>
              </td>
              <td class="actions">
                <button
                  class="btn btn-ghost btn-xs"
                  :title="String(teacherF) === String(row.teacher.id) ? 'Clear filter' : 'Show classes they teach'"
                  @click="filterByTeacher(row.teacher.id)"
                >
                  <i :class="String(teacherF) === String(row.teacher.id) ? 'bi bi-x-lg' : 'bi bi-filter'"></i>
                  {{ String(teacherF) === String(row.teacher.id) ? 'Clear' : 'Filter' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        v-model:page="workloadPage"
        v-model:page-size="workloadPageSize"
        :total="filteredWorkload.length"
        :sizes="[5, 10, 25, 50, 100]"
        @update:page-size="onWorkloadSize"
      />
    </div>

    <!-- ═══════════ CLASS DETAIL MODAL ═══════════ -->
    <Modal v-if="viewingClass"
           :title="`Manage Class · ${viewingClass.code}`"
           :subtitle="`${viewingClass.department} · ${levelLabel(viewingClass.yearLevel)} Year · Section ${viewingClass.section}`"
           size="wide"
           @close="closeClass">

      <div class="class-summary">
        <div class="cs-item">
          <span class="cs-lbl">Division</span>
          <span class="badge-x" :class="divBadge(viewingClass.division)">{{ viewingClass.division }}</span>
        </div>
        <div class="cs-item">
          <span class="cs-lbl">Students</span>
          <span class="cs-val">{{ viewingClass.studentCount }}</span>
        </div>
        <div class="cs-item">
          <span class="cs-lbl">Room</span>
          <span class="cs-val">{{ viewingClass.room }}</span>
        </div>
        <div class="cs-item">
          <span class="cs-lbl">Coverage</span>
          <span class="badge-x" :class="progressClass(viewingClass)">
            {{ viewingClass.assignedCourses }} / {{ viewingClass.totalCourses }}
          </span>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 10px">
        <h4 style="font-size:13.5px;margin:0;font-weight:700">
          Courses in this class
          <span class="badge-x b-brand" style="margin-left:8px">{{ viewingClass.courses.length }}</span>
        </h4>
        <button class="btn btn-primary btn-xs" @click="openAddCourse">
          <i class="bi bi-plus-lg"></i> Add Course
        </button>
      </div>

      <div class="tbl-wrap" style="border:1px solid var(--border);border-radius:10px;max-height:420px;overflow:auto">
        <table class="tbl">
          <thead>
            <tr>
              <th>Course</th>
              <th>Name</th>
              <th>Teacher</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cr in viewingClass.courses" :key="cr.courseId"
                :class="{ 'row-incomplete': !cr.teacherId }">
              <td><span class="mono" style="font-weight:700">{{ cr.courseCode }}</span></td>
              <td>{{ cr.courseName }}</td>
              <td>
                <span v-if="cr.teacherId" class="badge-x b-green">
                  <i class="bi bi-check-circle-fill"></i>
                  {{ teacherName(cr.teacherId) }}
                </span>
                <span v-else class="badge-x b-red">
                  <i class="bi bi-exclamation-octagon-fill"></i> Unassigned
                </span>
              </td>
              <td class="actions">
                <button class="btn btn-primary btn-xs" @click="openAssign(viewingClass, cr)">
                  <i :class="cr.teacherId ? 'bi bi-arrow-repeat' : 'bi bi-person-plus'"></i>
                  {{ cr.teacherId ? 'Reassign' : 'Assign' }}
                </button>
                <button class="btn btn-danger btn-xs" @click="askRemoveCourse(cr)" title="Remove course">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
            <tr v-if="!viewingClass.courses || !viewingClass.courses.length">
              <td colspan="4"><EmptyState icon="journal" title="No courses in this class" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="closeClass">Close</button>
      </template>
    </Modal>

    <!-- ═══════════ ADD COURSE MODAL ═══════════ -->
    <Modal v-if="addCourseOpen && viewingClass"
           title="Add Course to Class"
           :subtitle="`${viewingClass.code} · ${viewingClass.department}`"
           @close="closeAddCourse">

      <div class="assign-info" style="margin-bottom:16px">
        <div class="ai-row">
          <span class="ai-lbl">Class</span>
          <span class="ai-val mono">{{ viewingClass.code }}</span>
        </div>
        <div class="ai-row">
          <span class="ai-lbl">Department</span>
          <span class="ai-val">{{ viewingClass.department }}</span>
        </div>
        <div class="ai-row">
          <span class="ai-lbl">Available</span>
          <span class="ai-val">{{ availableCourses.length }} course{{ availableCourses.length === 1 ? '' : 's' }}</span>
        </div>
      </div>

      <div class="form-row">
        <label>Course <span class="req">*</span></label>
        <select v-model="pickedCourse" class="inp">
          <option value="">Select a course…</option>
          <option v-for="c in availableCourses" :key="c.id" :value="c.id">
            {{ c.code }} · {{ c.name }}
          </option>
        </select>
        <div v-if="!availableCourses.length" class="muted t-xs" style="margin-top:6px">
          <i class="bi bi-info-circle"></i>
          All courses from this department are already added to this class.
        </div>
      </div>

      <div class="form-row">
        <label>Assign Teacher <span class="muted" style="font-weight:400">(optional)</span></label>
        <select v-model="pickedTeacherForNewCourse" class="inp">
          <option value="">— Leave unassigned —</option>
          <option v-for="t in teachersInScope" :key="t.id" :value="t.id">
            {{ t.name }} · {{ t.division || 'Regular' }}
          </option>
        </select>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="closeAddCourse">Cancel</button>
        <button
          class="btn btn-primary btn-sm"
          :disabled="!pickedCourse"
          @click="saveNewCourse"
        >
          <i class="bi bi-plus-lg"></i> Add Course
        </button>
      </template>
    </Modal>

    <!-- ═══════════ ASSIGN TEACHER MODAL ═══════════ -->
    <Modal v-if="assigning"
           :title="assigning.currentTeacherId ? 'Reassign Teacher' : 'Assign Teacher'"
           :subtitle="`${assigning.classCode} · ${assigning.courseCode}`"
           @close="closeAssign">

      <div class="assign-info">
        <div class="ai-row">
          <span class="ai-lbl">Class</span>
          <span class="ai-val mono">{{ assigning.classCode }}</span>
        </div>
        <div class="ai-row">
          <span class="ai-lbl">Course</span>
          <span class="ai-val">{{ assigning.courseCode }} · {{ assigning.courseName }}</span>
        </div>
        <div class="ai-row">
          <span class="ai-lbl">Currently</span>
          <span class="ai-val">
            <span v-if="assigning.currentTeacherId" class="badge-x b-green">
              <i class="bi bi-check-circle-fill"></i>
              {{ teacherName(assigning.currentTeacherId) }}
            </span>
            <span v-else class="badge-x b-red">
              <i class="bi bi-exclamation-octagon-fill"></i> Unassigned
            </span>
          </span>
        </div>
      </div>

      <div class="form-row" style="margin-top:16px">
        <label>Select Teacher</label>
        <select v-model="pickedTeacher" class="inp">
          <option value="">— Unassign —</option>
          <option v-for="t in teachersInScope" :key="t.id" :value="t.id">
            {{ t.name }} · {{ t.department }} · {{ t.division || 'Regular' }}
          </option>
        </select>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="closeAssign">Cancel</button>
        <button class="btn btn-primary btn-sm" @click="saveAssign">
          <i class="bi bi-check2"></i>
          {{ pickedTeacher ? 'Save Assignment' : 'Unassign' }}
        </button>
      </template>
    </Modal>

    <!-- ═══════════ REMOVE COURSE CONFIRM ═══════════ -->
    <ConfirmDialog v-if="removingCourse"
                   title="Remove Course"
                   confirm-label="Remove Course"
                   danger
                   @cancel="removingCourse = null"
                   @confirm="confirmRemoveCourse">
      Remove <b>{{ removingCourse.courseCode }} · {{ removingCourse.courseName }}</b>
      from this class? The teacher assignment will also be removed.
    </ConfirmDialog>

    <!-- ═══════════ DELETE CLASS CONFIRM ═══════════ -->
    <ConfirmDialog v-if="deletingClass"
                   title="Delete Class"
                   confirm-label="Delete Class"
                   danger
                   @cancel="deletingClass = null"
                   @confirm="confirmDeleteClass">
      Delete class <b>{{ deletingClass.code }}</b> and all its course assignments?
      This cannot be undone.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.kpi-active {
  outline: 2px solid var(--brand-500);
  outline-offset: 3px;
  border-radius: var(--r-lg);
}

.unassigned-card {
  background: linear-gradient(135deg, #fef2f2 0%, #fff 60%);
  border: 1px solid rgba(220, 38, 38, .25);
  border-radius: var(--r-xl);
  padding: 20px 22px;
  margin-bottom: 18px;
  box-shadow: 0 8px 24px rgba(220, 38, 38, .08);
}
.un-header {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}
.un-badge {
  width: 48px; height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #dc2626, #ef4444);
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 22px;
  flex: none;
  box-shadow: 0 8px 20px rgba(220, 38, 38, .3);
  animation: unPulse 1.6s ease-in-out infinite;
}
@keyframes unPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.06); }
}
.un-header h3 {
  font-size: 17px;
  color: #991b1b;
  margin-bottom: 4px;
}
.un-header p {
  font-size: 13px;
  color: #7f1d1d;
  opacity: .85;
  margin: 0;
}

.tbl tbody tr.row-incomplete {
  background: rgba(220, 38, 38, .04);
}
.tbl tbody tr.row-incomplete:hover {
  background: rgba(220, 38, 38, .08);
}
.tbl tbody tr.row-selected {
  background: rgba(79, 109, 245, .08);
}

.cov-bar {
  width: 100%;
  max-width: 120px;
  height: 8px;
  background: var(--ink-50);
  border-radius: 999px;
  overflow: hidden;
}
.cov-fill {
  height: 100%;
  border-radius: 999px;
  transition: width .4s ease;
}
.cov-fill.full    { background: linear-gradient(90deg, #6ee7b7, #10b981); }
.cov-fill.partial { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.cov-fill.empty   { background: linear-gradient(90deg, #f87171, #dc2626); }

.workload-bar {
  width: 100%;
  max-width: 160px;
  height: 8px;
  background: var(--ink-50);
  border-radius: 999px;
  overflow: hidden;
}
.wb-fill {
  height: 100%;
  border-radius: 999px;
  transition: width .4s ease;
}
.wb-fill.low  { background: linear-gradient(90deg, #6ee7b7, #10b981); }
.wb-fill.mid  { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
.wb-fill.high { background: linear-gradient(90deg, #f87171, #dc2626); }

.assign-info {
  background: var(--ink-25);
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
}
.ai-row {
  display: flex;
  padding: 6px 0;
  font-size: 13px;
  align-items: center;
}
.ai-row + .ai-row { border-top: 1px solid var(--border); }
.ai-lbl {
  width: 100px;
  flex: 0 0 100px;
  color: var(--ink-400);
  font-weight: 500;
}
.ai-val {
  flex: 1;
  font-weight: 600;
  color: var(--ink-800);
}

.class-summary {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  padding: 14px 16px;
  background: linear-gradient(135deg, #eef4ff, #fff);
  border: 1px solid var(--brand-100);
  border-radius: 12px;
}
.cs-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.cs-lbl {
  color: var(--ink-400);
  font-weight: 500;
}
.cs-val {
  font-weight: 700;
  color: var(--ink-900);
  font-family: 'JetBrains Mono', monospace;
}
</style>