<script setup>
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import DataTable from '@/components/common/DataTable.vue'
import { exportCSV } from '@/utils/format'
import { useToast } from '@/composables/useToast'

const session   = useSessionStore()
const directory = useDirectoryStore()
const toast     = useToast()

const scope = computed(() =>
  session.role === 'dept_head' ? session.department : ''
)

/* ---------- filters ---------- */
const q      = ref('')             // search name, ID, email
const dept   = ref(scope.value)    // department
const divF   = ref('')             // 🆕 division filter (Regular / Extension)

const columns = [
  { key: 'name',       label: 'Student' },
  { key: 'staffId',    label: 'Student ID' },
  { key: 'department', label: 'Department' },
  { key: 'division',   label: 'Division' },     // 🆕 new column
  { key: 'email',      label: 'Email' },
  { key: 'program',    label: 'Program' },
  { key: 'yearLevel',  label: 'Year', align: 'right' },
  { key: 'status',     label: 'Status', sortable: false }
]

const rows = computed(() => {
  const term = q.value.toLowerCase()

  return directory.students
    /* Dept Head scope */
    .filter(s => !scope.value || s.department === scope.value)

    /* Department filter */
    .filter(s => !dept.value || s.department === dept.value)

    /* 🆕 Division filter */
    .filter(s => !divF.value || (s.division || 'Regular') === divF.value)

    /* Search */
    .filter(s => {
      if (!term) return true
      return [
        s.name, s.staffId, s.username, s.email, s.department, s.division, s.program
      ].filter(Boolean).join(' ').toLowerCase().includes(term)
    })
})

/* Clear all filters */
function clearFilters() {
  q.value = ''
  divF.value = ''
  if (!scope.value) dept.value = ''
}

function onExport() {
  const data = rows.value.map(s => ({
    Name: s.name,
    StudentID: s.staffId,
    Department: s.department,
    Division: s.division || 'Regular',
    RegistrationYear: s.year || '',
    Email: s.email,
    Username: s.username
  }))
  if (exportCSV(data, 'students')) toast.ok('Export started')
}

/* Division badge color + icon */
function divisionBadge(d) {
  return {
    Regular:   'b-blue',
    Extension: 'b-purple'
  }[d] || 'b-gray'
}

function divisionIcon(d) {
  return d === 'Extension' ? 'bi-moon-stars' : 'bi-sun'
}
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>{{ scope ? 'Department Students' : 'Students' }}</h1>
        <div class="sub">
          {{ rows.length }} students{{ scope ? ' · ' + scope : '' }}
        </div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-secondary btn-sm" @click="onExport">
          <i class="bi bi-download"></i> Export
        </button>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      empty-icon="mortarboard"
      empty-title="No students found"
      empty-text="Adjust the search or filter."
    >
      <template #toolbar>
        <!-- Search -->
        <div class="tbl-search">
          <i class="bi bi-search"></i>
          <input v-model="q" placeholder="Search name, ID, email…" />
        </div>

        <!-- Department filter -->
        <select v-model="dept" :disabled="!!scope" class="inp" style="max-width:220px;height:34px">
          <option value="">All departments</option>
          <option v-for="d in directory.departments" :key="d.id" :value="d.name">{{ d.name }}</option>
        </select>

        <!-- 🆕 Division filter -->
        <select v-model="divF" class="inp" style="max-width:160px;height:34px">
          <option value="">All divisions</option>
          <option value="Regular">Regular</option>
          <option value="Extension">Extension</option>
        </select>

        <button
          v-if="q || dept || divF"
          class="btn btn-ghost btn-sm"
          @click="clearFilters"
        >
          <i class="bi bi-x-lg"></i> Clear
        </button>
      </template>

      <template #name="{ row }">
        <b>{{ row.name }}</b>
        <div class="t-xs muted">{{ row.username }}</div>
      </template>

      <template #staffId="{ row }">
        <span class="mono">{{ row.staffId || row.studentId }}</span>
      </template>

      <template #department="{ row }">
        <span class="muted">{{ row.department }}</span>
      </template>

      <!-- 🆕 Division badge column -->
      <template #division="{ row }">
        <span class="badge-x" :class="divisionBadge(row.division || 'Regular')">
          <i :class="`bi ${divisionIcon(row.division || 'Regular')}`"></i>
          {{ row.division || 'Regular' }}
        </span>
      </template>

      <template #email="{ row }">
        <span class="muted t-xs">{{ row.email }}</span>
      </template>

      <template #program="{ row }">
        <span class="muted">{{ row.program || '—' }}</span>
      </template>

      <template #yearLevel="{ row }">
        {{ row.yearLevel || '—' }}
      </template>

      <template #status>
        <span class="badge-x b-green"><span class="dot green" style="margin-right:4px"></span>Active</span>
      </template>
    </DataTable>
  </div>
</template>