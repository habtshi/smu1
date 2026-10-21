<script setup>
import { ref, computed } from 'vue'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import { useSettingsStore } from '@/stores/settings'
import DataTable from '@/components/common/DataTable.vue'
import Modal from '@/components/common/Modal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'

const directory = useDirectoryStore()
const reports   = useReportsStore()
const alerts    = useAlertsStore()
const settings  = useSettingsStore()
const toast     = useToast()

const q = ref('')

/* ---------- table columns ---------- */
const columns = [
  { key: 'code',        label: 'Code' },
  { key: 'name',        label: 'Department' },
  { key: 'head',        label: 'Head of Department' },
  { key: 'teachers',    label: 'Teachers', align: 'right' },
  { key: 'classReps',   label: 'Class Reps', align: 'right' },
  { key: 'students',    label: 'Students', align: 'right' },
  { key: 'alerts',      label: 'Alerts',   align: 'right' },
  { key: 'actions',     label: '', sortable: false, align: 'right' }
]

const rows = computed(() => {
  const term = q.value.toLowerCase()
  return directory.departments
    .filter(d => !term ||
      d.name.toLowerCase().includes(term) ||
      (d.code || '').toLowerCase().includes(term))
    .map(d => {
      const teachers = directory.users.filter(u => u.role === 'teacher' && u.department === d.name).length
      const reps     = directory.users.filter(u => u.role === 'class_rep' && u.department === d.name).length
      const students = directory.users.filter(u => u.role === 'student' && u.department === d.name).length
      const alertCount = alerts.activeAlertsForDept(d.name).length
      return {
        id: d.id,
        code: d.code || '—',
        name: d.name,
        head: d.head || '',
        teachers, classReps: reps, students,
        alerts: alertCount,
        _raw: d
      }
    })
})

/* ---------- editor ---------- */
const editing = ref(null)

function openEditor(row) {
  editing.value = row
    ? { id: row._raw.id, name: row._raw.name, code: row._raw.code, head: row._raw.head }
    : { id: null, name: '', code: '', head: '' }
}

function save() {
  const e = editing.value
  if (!e.name || !e.code) { toast.err('Name and code are required'); return }

  const existing = directory.departments.find(d =>
    d.name.toLowerCase() === e.name.toLowerCase() && d.id !== e.id
  )
  if (existing) { toast.err('A department with that name already exists'); return }

  if (e.id) {
    const old = directory.departments.find(d => d.id === e.id)
    const oldName = old.name
    directory.updateDepartment(e.id, { name: e.name, code: e.code.toUpperCase(), head: e.head })

    if (oldName !== e.name) {
      // cascade renames across users / reports / alerts / classReports
      directory.users.forEach(u => { if (u.department === oldName) u.department = e.name })
      directory.persistUsers()
      reports.reports.forEach(r => { if (r.department === oldName) r.department = e.name })
      reports.classReports.forEach(r => { if (r.department === oldName) r.department = e.name })
      alerts.alerts.forEach(a => { if (a.department === oldName) a.department = e.name })
      alerts.makeupClasses.forEach(m => { if (m.department === oldName) m.department = e.name })
    }
    settings.audit('Update Department', 'Departments', `Updated ${e.name} (${e.code})`)
    toast.ok('Department updated')
  } else {
    directory.addDepartment({
      name: e.name,
      code: e.code.toUpperCase(),
      head: e.head
    })
    settings.audit('Create Department', 'Departments', `Created ${e.name} (${e.code})`)
    toast.ok('Department created')
  }
  editing.value = null
}

/* ---------- deletion ---------- */
const deleting = ref(null)

function askDelete(row) {
  const assigned = directory.users.filter(u => u.department === row.name).length
  if (assigned) {
    toast.err(`Cannot delete — ${assigned} user(s) still assigned`)
    return
  }
  deleting.value = row
}

function confirmDelete() {
  const r = deleting.value
  if (!r) return
  directory.deleteDepartment(r.id)
  settings.audit('Delete Department', 'Departments', `Removed ${r.name}`)
  toast.ok('Department deleted')
  deleting.value = null
}

/* ---------- dept heads for the select ---------- */
const deptHeads = computed(() => directory.deptHeads)
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Departments</h1>
        <div class="sub">{{ directory.departments.length }} departments · manage structure & heads</div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-primary btn-sm" @click="openEditor(null)">
          <i class="bi bi-plus-lg"></i> Add Department
        </button>
      </div>
    </div>

    <DataTable :columns="columns" :rows="rows" empty-icon="building" empty-title="No departments">
      <template #toolbar>
        <div class="tbl-search">
          <i class="bi bi-search"></i>
          <input v-model="q" placeholder="Search by name or code…" />
        </div>
      </template>

      <template #code="{ row }">
        <span class="badge-x b-brand">{{ row.code }}</span>
      </template>

      <template #name="{ row }"><b>{{ row.name }}</b></template>

      <template #head="{ row }">
        <span v-if="row.head">{{ row.head }}</span>
        <span v-else class="muted">Not assigned</span>
      </template>

      <template #alerts="{ row }">
        <span v-if="row.alerts" class="badge-x b-red">{{ row.alerts }}</span>
        <span v-else class="muted">0</span>
      </template>

      <template #actions="{ row }">
        <RouterLink :to="{ name: 'attendance-intel', query: { dept: row.name } }"
                    class="btn btn-ghost btn-xs" title="Attendance Intel">
          <i class="bi bi-calendar3"></i>
        </RouterLink>
        <button class="btn btn-ghost btn-xs" @click="openEditor(row)" title="Edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-danger btn-xs" @click="askDelete(row)" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </template>
    </DataTable>

    <!-- Editor modal -->
    <Modal v-if="editing"
           :title="editing.id ? 'Edit Department' : 'Add Department'"
           @close="editing = null">
      <div class="row g-3">
        <div class="col-md-8">
          <div class="form-row">
            <label>Department Name <span class="req">*</span></label>
            <input v-model.trim="editing.name" class="inp" placeholder="e.g. Computer Science" />
          </div>
        </div>
        <div class="col-md-4">
          <div class="form-row">
            <label>Code <span class="req">*</span></label>
            <input v-model.trim="editing.code" class="inp" placeholder="e.g. CS" maxlength="6" />
          </div>
        </div>
      </div>

      <div class="form-row">
        <label>Head of Department</label>
        <select v-model="editing.head" class="inp">
          <option value="">— Not assigned —</option>
          <option v-for="h in deptHeads" :key="h.id" :value="h.name">
            {{ h.name }}
            <template v-if="directory.departments.some(d => d.head === h.name && d.id !== editing.id)">
              (already assigned)
            </template>
          </option>
        </select>
      </div>

      <div class="alert-pill alert-warning" style="display:inline-flex;padding:10px 12px;margin-top:4px">
        <i class="bi bi-info-circle-fill"></i>
        <span style="margin-left:6px">
          Heads must be existing users with role "Department Head". Manage users first if the list is empty.
        </span>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="editing = null">Cancel</button>
        <button class="btn btn-primary btn-sm" @click="save">
          <i class="bi bi-check2"></i>
          {{ editing.id ? 'Save Changes' : 'Create' }}
        </button>
      </template>
    </Modal>

    <!-- Delete confirm -->
    <ConfirmDialog
      v-if="deleting"
      title="Delete Department"
      confirm-label="Delete"
      danger
      @cancel="deleting = null"
      @confirm="confirmDelete"
    >
      Delete <b>{{ deleting.name }}</b> ({{ deleting.code }})? This cannot be undone.
    </ConfirmDialog>
  </div>
</template>