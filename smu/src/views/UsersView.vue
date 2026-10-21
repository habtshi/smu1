<script setup>
import { ref, computed } from 'vue'
import { useDirectoryStore } from '@/stores/directory'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import DataTable from '@/components/common/DataTable.vue'
import Modal from '@/components/common/Modal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import KpiCard from '@/components/common/KpiCard.vue'
import { useToast } from '@/composables/useToast'
import { exportCSV, initials } from '@/utils/format'
import { ROLE_LABEL } from '@/utils/constants'

const directory = useDirectoryStore()
const settings  = useSettingsStore()
const session   = useSessionStore()
const toast     = useToast()

/* ---------- filters ---------- */
const q         = ref('')
const role      = ref('')
const dept      = ref('')
const divFilter = ref('')

/* ---------- columns ---------- */
const columns = [
  { key: 'name',       label: 'User' },
  { key: 'username',   label: 'Username' },
  { key: 'role',       label: 'Role', sortable: false },
  { key: 'staffId',    label: 'ID' },
  { key: 'department', label: 'Department' },
  { key: 'extraInfo',  label: 'Class / Program', sortable: false },
  { key: 'position',   label: 'Position' },
  { key: 'email',      label: 'Email' },
  { key: 'actions',    label: '', sortable: false, align: 'right' }
]

const rows = computed(() => {
  const term = q.value.toLowerCase()
  return directory.users
    .filter(u => !role.value || u.role === role.value)
    .filter(u => !dept.value || u.department === dept.value)
    .filter(u => {
      if (!divFilter.value) return true
      const div = u.division
      if (!div) return false
      if (divFilter.value === 'Both') return div === 'Both'
      return div === divFilter.value || div === 'Both'
    })
    .filter(u => {
      if (!term) return true
      const s = [
        u.name, u.firstName, u.middleName, u.lastName, u.username,
        u.email, u.staffId, u.employeeId, u.teacherId, u.headId,
        u.studentId, u.classRepId, u.className, u.program, u.division
      ].filter(Boolean).join(' ').toLowerCase()
      return s.includes(term)
    })
    .map(u => ({
      ...u,
      extraInfo: u.className || u.program || u.assignedCourses || '—'
    }))
})

/* ---------- role tiles ---------- */
const roleTiles = computed(() =>
  Object.keys(ROLE_LABEL).map(r => ({
    role: r,
    label: ROLE_LABEL[r],
    count: directory.users.filter(u => u.role === r).length,
    color: {
      admin:     'danger',
      dept_head: 'purple',
      teacher:   'brand',
      class_rep: 'warning',
      student:   'info'
    }[r]
  }))
)

function roleBadgeClass(r) {
  return {
    admin:     'b-red',
    dept_head: 'b-purple',
    teacher:   'b-brand',
    class_rep: 'b-amber',
    student:   'b-blue'
  }[r] || 'b-gray'
}

function onExport() {
  exportCSV(rows.value.map(u => ({
    StaffId: u.staffId, EmployeeId: u.employeeId || '', StudentId: u.studentId || '',
    TeacherId: u.teacherId || '', DepartmentHeadId: u.headId || '', ClassRepId: u.classRepId || '',
    Division: u.division || '', RegistrationYear: u.year || '',
    FirstName: u.firstName || '', MiddleName: u.middleName || '', LastName: u.lastName || '',
    Name: u.name, Username: u.username, Role: u.role, Department: u.department,
    ClassOrSection: u.className || u.section || '', Program: u.program || '',
    YearLevel: u.yearLevel || '', Section: u.section || '',
    AssignedCourses: u.assignedCourses || '',
    Position: u.position, Email: u.email, Phone: u.phone || ''
  })), 'users')
  toast.ok('Export started')
}

/* ═══════════════ EDITOR ═══════════════ */
const editing = ref(null)

function openEditor(row) {
  if (!row) {
    editing.value = {
      id: null,
      firstName: '', middleName: '', lastName: '', username: '',
      email: '', phone: '', role: 'student', department: '', position: '',
      password: '1234', password2: '1234',
      staffId: '', studentId: '', teacherId: '', headId: '', classRepId: '',
      className: '', section: '', program: '', yearLevel: '', assignedCourses: '',
      employeeId: '',
      division: 'Regular',
      year: new Date().getFullYear()
    }
    return
  }
  editing.value = {
    id: row.id,
    firstName: row.firstName || (row.name || '').split(' ')[0] || '',
    middleName: row.middleName || '',
    lastName: row.lastName || (row.name || '').split(' ').slice(-1)[0] || '',
    username: row.username || '',
    email: row.email || '',
    phone: row.phone || '',
    role: row.role,
    department: row.department || '',
    position: row.position || '',
    staffId: row.staffId || '',
    studentId: row.studentId || '',
    teacherId: row.teacherId || '',
    headId: row.headId || '',
    classRepId: row.classRepId || '',
    className: row.className || '',
    section: row.section || '',
    program: row.program || '',
    yearLevel: row.yearLevel || '',
    assignedCourses: row.assignedCourses || '',
    employeeId: row.employeeId || '',
    division: row.division || 'Regular',
    year: row.year || new Date().getFullYear()
  }
}

const editError = ref('')

function generateStudentIdForEdit() {
  const e = editing.value
  if (!e.department) { toast.err('Select a department first'); return }
  if (!e.year)       { toast.err('Enter the registration year'); return }
  const div = e.division || 'Regular'
  const seq = directory.nextStudentSequence(e.department, div, e.year)
  e.studentId = directory.buildStudentId(e.department, div, e.year, seq)
  e.staffId = e.studentId
  toast.ok(`ID: ${e.studentId}`)
}

async function save() {
  const e = editing.value
  editError.value = ''

  if (!e.firstName || !e.lastName) { editError.value = 'First and last name are required.'; return }
  if (!e.username) { editError.value = 'Username is required.'; return }
  if (!e.email) { editError.value = 'Email is required.'; return }

  const uLower = e.username.toLowerCase()
  const eLower = e.email.toLowerCase()
  if (directory.users.some(u => u.id !== e.id && String(u.username).toLowerCase() === uLower)) {
    editError.value = 'That username is already taken.'; return
  }
  if (directory.users.some(u => u.id !== e.id && String(u.email).toLowerCase() === eLower)) {
    editError.value = 'That email is already in use.'; return
  }

  const requires = {
    student:   ['studentId', 'program'],
    teacher:   ['teacherId'],
    class_rep: ['classRepId', 'className'],
    dept_head: ['headId'],
    admin:     ['employeeId']
  }[e.role] || []

  for (const f of requires) {
    if (!e[f]) {
      editError.value = `The ${f.replace(/([A-Z])/g, ' $1').toLowerCase()} field is required for this role.`
      return
    }
  }

  if (['student', 'teacher', 'class_rep', 'dept_head'].includes(e.role) && !e.department) {
    editError.value = 'Department is required for this role.'; return
  }

  const payload = {
    firstName: e.firstName,
    middleName: e.middleName,
    lastName: e.lastName,
    name: [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' '),
    username: e.username.toLowerCase(),
    email: e.email,
    phone: e.phone,
    role: e.role,
    department: e.department || 'Administration',
    position: e.position,
    staffId: e.staffId || e.studentId || e.teacherId || e.headId || e.classRepId || e.employeeId,

    studentId:  e.role === 'student'   ? e.studentId  : '',
    teacherId:  e.role === 'teacher'   ? e.teacherId  : '',
    headId:     e.role === 'dept_head' ? e.headId     : '',
    classRepId: e.role === 'class_rep' ? e.classRepId : '',
    employeeId: e.employeeId,

    className:  e.role === 'class_rep' ? e.className : '',
    section:    (e.role === 'class_rep' || e.role === 'student') ? e.section : '',
    program:    (e.role === 'class_rep' || e.role === 'student') ? e.program : '',
    yearLevel:  (e.role === 'class_rep' || e.role === 'student') ? e.yearLevel : '',
    assignedCourses: e.role === 'teacher' ? e.assignedCourses : '',

    division: (e.role === 'student' || e.role === 'class_rep' || e.role === 'teacher') ? (e.division || 'Regular') : undefined,
    year:     (e.role === 'student' || e.role === 'class_rep') ? e.year : undefined
  }

  if (e.id) {
    await directory.updateUser(e.id, payload)
    settings.audit('Update User', 'Users', `Updated ${payload.name} (${ROLE_LABEL[e.role]})`)
    toast.ok('User updated')
  } else {
    if (e.password !== e.password2) { editError.value = 'Passwords do not match.'; return }
    if (e.password.length < 4) { editError.value = 'Password must be at least 4 characters.'; return }

    await directory.addUser({ ...payload, password: e.password })
    settings.audit('Create User', 'Users', `Created ${payload.name} (${ROLE_LABEL[e.role]})`)
    toast.ok(`${ROLE_LABEL[e.role]} created`)
  }
  editing.value = null
}

/* ═══════════════ DELETE ═══════════════ */
const deleting = ref(null)

function askDelete(row) {
  if (row.id === session.userId) {
    toast.err('You cannot delete your own account')
    return
  }
  deleting.value = row
}

function confirmDelete() {
  const r = deleting.value
  if (!r) return
  directory.deleteUser(r.id)
  settings.audit('Delete User', 'Users', `Removed ${r.name} (${ROLE_LABEL[r.role]})`)
  toast.ok('User deleted')
  deleting.value = null
}

/* ═══════════════ RESET PASSWORD ═══════════════ */
const resetting = ref(null)
const newPass   = ref('1234')
const newPass2  = ref('1234')

function openReset(row) {
  resetting.value = row
  newPass.value = '1234'
  newPass2.value = '1234'
}

async function confirmReset() {
  if (newPass.value.length < 4) { toast.err('Password must be at least 4 characters'); return }
  if (newPass.value !== newPass2.value) { toast.err('Passwords do not match'); return }
  await directory.updateUser(resetting.value.id, { password: newPass.value })
  settings.audit('Reset Password', 'Users', `Password reset for ${resetting.value.name}`)
  toast.ok('Password reset')
  resetting.value = null
}

/* ---------- password visibility ---------- */
const showPass = ref(false)
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>User Management</h1>
        <div class="sub">{{ directory.users.length }} users · assign roles, edit, and manage accounts</div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-secondary btn-sm" @click="onExport">
          <i class="bi bi-download"></i> Export
        </button>
        <button class="btn btn-primary btn-sm" @click="openEditor(null)">
          <i class="bi bi-person-plus-fill"></i> Add User
        </button>
      </div>
    </div>

    <!-- Role tiles -->
    <div class="row g-3 mb-4">
      <div v-for="t in roleTiles" :key="t.role" class="col-xl col-md-4 col-6">
        <div style="cursor:pointer" @click="role = t.role">
          <KpiCard :label="t.label" :value="t.count" sub="users with this role"
                   icon="people-fill" :color="t.color" />
        </div>
      </div>
    </div>

    <DataTable :columns="columns" :rows="rows"
               empty-icon="people"
               empty-title="No users found"
               empty-text="Try clearing the filters.">
      <template #toolbar>
        <div class="tbl-search">
          <i class="bi bi-search"></i>
          <input v-model="q" placeholder="Search name, username, email…" />
        </div>

        <select v-model="role" class="inp" style="max-width:180px;height:34px">
          <option value="">All roles</option>
          <option v-for="(v, k) in ROLE_LABEL" :key="k" :value="k">{{ v }}</option>
        </select>

        <select v-model="dept" class="inp" style="max-width:200px;height:34px">
          <option value="">All departments</option>
          <option v-for="d in directory.departments" :key="d.id" :value="d.name">{{ d.name }}</option>
          <option value="Administration">Administration</option>
        </select>

        <select v-model="divFilter" class="inp" style="max-width:160px;height:34px">
          <option value="">All divisions</option>
          <option value="Regular">Regular</option>
          <option value="Extension">Extension</option>
          <option value="Both">Both</option>
        </select>

        <button class="btn btn-ghost btn-sm" @click="q=''; role=''; dept=''; divFilter=''">
          <i class="bi bi-x-lg"></i> Clear
        </button>
      </template>

      <template #name="{ row }">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="sb-mark" style="width:34px;height:34px;font-size:12px;border-radius:9px;box-shadow:none">
            {{ initials(row.name) }}
          </div>
          <div>
            <b>{{ row.name }}</b>
            <div class="t-xs muted">{{ row.staffId || '—' }}</div>
          </div>
        </div>
      </template>

      <template #username="{ row }"><span class="mono">{{ row.username }}</span></template>

      <template #role="{ row }">
        <span class="badge-x" :class="roleBadgeClass(row.role)">{{ ROLE_LABEL[row.role] }}</span>
      </template>

      <template #staffId="{ row }">
        <span class="mono">
          {{ row.studentId || row.teacherId || row.headId || row.classRepId || row.employeeId || row.staffId || '—' }}
        </span>
      </template>

      <template #department="{ row }"><span class="muted">{{ row.department || '—' }}</span></template>
      <template #extraInfo="{ row }"><span class="muted t-xs">{{ row.extraInfo }}</span></template>
      <template #position="{ row }">{{ row.position || '—' }}</template>
      <template #email="{ row }"><span class="muted t-xs">{{ row.email }}</span></template>

      <template #actions="{ row }">
        <button class="btn btn-ghost btn-xs" @click="openEditor(row)" title="Edit" aria-label="Edit user">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-ghost btn-xs" @click="openReset(row)" title="Reset password" aria-label="Reset password">
          <i class="bi bi-key"></i>
        </button>
        <button class="btn btn-danger btn-xs" @click="askDelete(row)" title="Delete" aria-label="Delete user">
          <i class="bi bi-trash"></i>
        </button>
      </template>
    </DataTable>

    <!-- ═══════ EDITOR MODAL ═══════ -->
    <Modal v-if="editing"
           :title="editing.id ? 'Edit User' : 'Add User'"
           subtitle="Role-specific fields change automatically"
           size="wide"
           @close="editing = null">
      <div class="alert-pill alert-info" style="margin-bottom:14px;display:inline-flex;padding:10px 12px">
        <i class="bi bi-info-circle-fill"></i>
        <span style="margin-left:7px">Select the role first — the form changes for each role.</span>
      </div>

      <div class="row g-3">
        <div class="col-md-4">
          <div class="form-row"><label>First Name <span class="req">*</span></label>
            <input v-model.trim="editing.firstName" class="inp" /></div>
        </div>
        <div class="col-md-4">
          <div class="form-row"><label>Middle Name</label>
            <input v-model.trim="editing.middleName" class="inp" /></div>
        </div>
        <div class="col-md-4">
          <div class="form-row"><label>Last Name <span class="req">*</span></label>
            <input v-model.trim="editing.lastName" class="inp" /></div>
        </div>

        <div class="col-md-4">
          <div class="form-row"><label>Username <span class="req">*</span></label>
            <input v-model.trim="editing.username" class="inp mono" /></div>
        </div>
        <div class="col-md-4">
          <div class="form-row"><label>Email <span class="req">*</span></label>
            <input v-model.trim="editing.email" type="email" class="inp" /></div>
        </div>
        <div class="col-md-4">
          <div class="form-row"><label>Phone</label>
            <input v-model.trim="editing.phone" class="inp" /></div>
        </div>

        <div class="col-md-4">
          <div class="form-row"><label>Role <span class="req">*</span></label>
            <select v-model="editing.role" class="inp">
              <option v-for="(v, k) in ROLE_LABEL" :key="k" :value="k">{{ v }}</option>
            </select>
          </div>
        </div>
        <div class="col-md-8">
          <div class="form-row"><label>Position / Title</label>
            <input v-model.trim="editing.position" class="inp" placeholder="e.g. Lecturer" /></div>
        </div>

        <!-- ═══════ STUDENT ═══════ -->
        <template v-if="editing.role === 'student'">
          <div class="col-md-4">
            <div class="form-row">
              <label>Department <span class="req">*</span></label>
              <select v-model="editing.department" class="inp">
                <option value="">Select department</option>
                <option v-for="d in directory.departments" :key="d.id" :value="d.name">{{ d.name }}</option>
              </select>
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-row">
              <label>Division <span class="req">*</span></label>
              <select v-model="editing.division" class="inp">
                <option value="Regular">Regular</option>
                <option value="Extension">Extension</option>
              </select>
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-row">
              <label>Registration Year <span class="req">*</span></label>
              <input v-model.number="editing.year" type="number" min="2010" max="2099" class="inp" placeholder="e.g. 2021" />
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-row">
              <label>
                Student ID <span class="req">*</span>
                <span class="t-xs muted" style="font-weight:400">· format: RCD/2021/001</span>
              </label>
              <div style="display:flex;gap:6px">
                <input v-model.trim="editing.studentId" class="inp mono" placeholder="RCD/2021/001" />
                <button type="button" class="btn btn-secondary btn-sm"
                        title="Auto-generate from department + division + year"
                        aria-label="Auto-generate student ID"
                        @click="generateStudentIdForEdit">
                  <i class="bi bi-magic"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-row"><label>Program <span class="req">*</span></label>
              <input v-model.trim="editing.program" class="inp" placeholder="e.g. BSc Computer Science" /></div>
          </div>
          <div class="col-md-2">
            <div class="form-row"><label>Year Level</label>
              <input v-model.trim="editing.yearLevel" class="inp" placeholder="e.g. 4" /></div>
          </div>
          <div class="col-md-2">
            <div class="form-row"><label>Section</label>
              <input v-model.trim="editing.section" class="inp" placeholder="e.g. A" /></div>
          </div>
        </template>

        <!-- ═══════ TEACHER ═══════ -->
        <template v-else-if="editing.role === 'teacher'">
          <div class="col-md-4">
            <div class="form-row"><label>Teacher ID <span class="req">*</span></label>
              <input v-model.trim="editing.teacherId" class="inp mono" placeholder="e.g. T012" /></div>
          </div>
          <div class="col-md-4">
            <div class="form-row"><label>Department <span class="req">*</span></label>
              <select v-model="editing.department" class="inp">
                <option value="">Select department</option>
                <option v-for="d in directory.departments" :key="d.id" :value="d.name">{{ d.name }}</option>
              </select>
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-row"><label>Division <span class="req">*</span></label>
              <select v-model="editing.division" class="inp">
                <option value="Regular">Regular</option>
                <option value="Extension">Extension</option>
                <option value="Both">Both</option>
              </select>
            </div>
          </div>
          <div class="col-md-12">
            <div class="form-row"><label>Assigned Courses</label>
              <input v-model.trim="editing.assignedCourses" class="inp" placeholder="CoSc3061, CoSc3041" /></div>
          </div>
        </template>

        <!-- ═══════ CLASS REP ═══════ -->
        <template v-else-if="editing.role === 'class_rep'">
          <div class="col-md-4">
            <div class="form-row">
              <label>Department <span class="req">*</span></label>
              <select v-model="editing.department" class="inp">
                <option value="">Select department</option>
                <option v-for="d in directory.departments" :key="d.id" :value="d.name">{{ d.name }}</option>
              </select>
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-row">
              <label>Division <span class="req">*</span></label>
              <select v-model="editing.division" class="inp">
                <option value="Regular">Regular</option>
                <option value="Extension">Extension</option>
              </select>
            </div>
          </div>
          <div class="col-md-4">
            <div class="form-row">
              <label>Registration Year <span class="req">*</span></label>
              <input v-model.number="editing.year" type="number" min="2010" max="2099" class="inp" placeholder="e.g. 2020" />
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-row">
              <label>
                Class Rep ID <span class="req">*</span>
                <span class="t-xs muted" style="font-weight:400">· format: RCD/2020/015</span>
              </label>
              <div style="display:flex;gap:6px">
                <input v-model.trim="editing.classRepId" class="inp mono" placeholder="RCD/2020/015" />
                <button type="button" class="btn btn-secondary btn-sm"
                        title="Auto-generate from department + division + year"
                        aria-label="Auto-generate class rep ID"
                        @click="() => { editing.classRepId = ''; generateStudentIdForEdit(); editing.classRepId = editing.studentId; }">
                  <i class="bi bi-magic"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-row">
              <label>Class / Section <span class="req">*</span></label>
              <input v-model.trim="editing.className" class="inp" placeholder="Computer Science 4A" />
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-row">
              <label>Year Level</label>
              <input v-model.trim="editing.yearLevel" class="inp" placeholder="e.g. 4" />
            </div>
          </div>
          <div class="col-md-3">
            <div class="form-row">
              <label>Section</label>
              <input v-model.trim="editing.section" class="inp" placeholder="e.g. A" />
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-row">
              <label>Program</label>
              <input v-model.trim="editing.program" class="inp" placeholder="e.g. BSc Computer Science" />
            </div>
          </div>
        </template>

        <!-- ═══════ DEPT HEAD ═══════ -->
        <template v-else-if="editing.role === 'dept_head'">
          <div class="col-md-4">
            <div class="form-row"><label>Department Head ID <span class="req">*</span></label>
              <input v-model.trim="editing.headId" class="inp mono" placeholder="HOD006" /></div>
          </div>
          <div class="col-md-8">
            <div class="form-row"><label>Department <span class="req">*</span></label>
              <select v-model="editing.department" class="inp">
                <option value="">Select department</option>
                <option v-for="d in directory.departments" :key="d.id" :value="d.name">{{ d.name }}</option>
              </select>
            </div>
          </div>
        </template>

        <!-- ═══════ ADMIN ═══════ -->
        <template v-else-if="editing.role === 'admin'">
          <div class="col-md-4">
            <div class="form-row"><label>Employee ID <span class="req">*</span></label>
              <input v-model.trim="editing.employeeId" class="inp mono" placeholder="ADM002" /></div>
          </div>
          <div class="col-md-8">
            <div class="form-row"><label>Department</label>
              <input v-model.trim="editing.department" class="inp" placeholder="Administration" /></div>
          </div>
        </template>

        <!-- ═══════ PASSWORD (new user only) ═══════ -->
        <template v-if="!editing.id">
          <div class="col-md-6">
            <div class="form-row"><label>Password <span class="req">*</span></label>
              <div class="pw-wrap">
                <input v-model="editing.password" :type="showPass ? 'text' : 'password'" class="inp" />
                <button type="button" class="toggle" @click="showPass = !showPass"
                        :aria-label="showPass ? 'Hide password' : 'Show password'">
                  <i :class="showPass ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="form-row"><label>Confirm Password <span class="req">*</span></label>
              <input v-model="editing.password2" :type="showPass ? 'text' : 'password'" class="inp" /></div>
          </div>
        </template>

        <div v-else class="col-12">
          <div class="alert-pill alert-warning" style="display:inline-flex;padding:10px 12px">
            <i class="bi bi-key-fill"></i>
            <span style="margin-left:6px">Password unchanged. Use the key button to reset.</span>
          </div>
        </div>
      </div>

      <div v-if="editError" class="auth-error show" style="margin-top:12px">
        <i class="bi bi-exclamation-circle"></i> {{ editError }}
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="editing = null">Cancel</button>
        <button class="btn btn-primary btn-sm" @click="save">
          <i class="bi bi-check2"></i>
          {{ editing.id ? 'Save Changes' : 'Create User' }}
        </button>
      </template>
    </Modal>

    <!-- ═══════ RESET PASSWORD ═══════ -->
    <Modal v-if="resetting"
           title="Reset Password"
           :subtitle="resetting.name + ' · ' + resetting.username"
           @close="resetting = null">
      <div class="form-row">
        <label>New Password <span class="req">*</span></label>
        <input v-model="newPass" class="inp mono" />
      </div>
      <div class="form-row">
        <label>Confirm Password <span class="req">*</span></label>
        <input v-model="newPass2" class="inp mono" />
      </div>
      <div class="alert-pill alert-warning" style="display:inline-flex;padding:10px 12px">
        <i class="bi bi-shield-lock-fill"></i>
        <span style="margin-left:6px">Admin-set passwords override the user's current password immediately.</span>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="resetting = null">Cancel</button>
        <button class="btn btn-primary btn-sm" @click="confirmReset">
          <i class="bi bi-check2"></i> Reset Password
        </button>
      </template>
    </Modal>

    <!-- ═══════ DELETE CONFIRM ═══════ -->
    <ConfirmDialog v-if="deleting"
                   title="Delete User"
                   confirm-label="Delete User"
                   danger
                   @cancel="deleting = null"
                   @confirm="confirmDelete">
      Permanently delete <b>{{ deleting.name }}</b> ({{ ROLE_LABEL[deleting.role] }})?
      This action cannot be undone. Reports and history remain for audit purposes.
    </ConfirmDialog>
  </div>
</template>