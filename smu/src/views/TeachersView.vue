<script setup>
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import DataTable from '@/components/common/DataTable.vue'

const session   = useSessionStore()
const directory = useDirectoryStore()
const reports   = useReportsStore()
const alerts    = useAlertsStore()

/* ---------- filters ---------- */
const q      = ref('')             // search by name / position / ID / email
const deptF  = ref('')             // filter by department
const divF   = ref('')             // filter by division (Regular / Extension / Both)

const scope = computed(() =>
  session.role === 'dept_head' ? session.department : null
)

const columns = [
  { key: 'name',        label: 'Teacher' },
  { key: 'department',  label: 'Department' },
  { key: 'division',    label: 'Division' },
  { key: 'position',    label: 'Position' },
  { key: 'attendance',  label: 'Attendance',  align: 'right' },
  { key: 'performance', label: 'Avg Rating',  align: 'right' },
  { key: 'streak',      label: 'Streak',      align: 'right' },
  { key: 'status',      label: 'Status',      sortable: false },
  { key: 'actions',     label: '',            sortable: false, align: 'right' }
]

const rows = computed(() => {
  const term = q.value.toLowerCase()

  return directory.teachers
    /* RBAC scope */
    .filter(t => !scope.value || t.department === scope.value)

    /* 🆕 Department filter */
    .filter(t => !deptF.value || t.department === deptF.value)

    /* 🆕 Division filter
       - 'Regular'   → shows teachers marked 'Regular' OR 'Both'
       - 'Extension' → shows teachers marked 'Extension' OR 'Both'
       - 'Both'      → shows ONLY teachers marked 'Both'
    */
    .filter(t => {
      if (!divF.value) return true
      const d = t.division || 'Regular'
      if (divF.value === 'Both') return d === 'Both'
      return d === divF.value || d === 'Both'
    })

    /* Search by name, position, department, staff ID, email */
    .filter(t => {
      if (!term) return true
      const haystack = [
        t.name, t.position, t.department, t.staffId, t.email, t.division
      ].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(term)
    })

    .map(t => {
      const att    = reports.attendanceRate(t.id, 30)
      const perf   = reports.avgPerformance(t.id)
      const streak = alerts.consecutiveAbsences(t.id)
      return {
        id: t.id,
        name: t.name,
        staffId: t.staffId,
        department: t.department,
        division: t.division || 'Regular',
        position: t.position || '—',
        attendance: att !== null ? att + '%' : '—',
        performance: perf !== null ? perf.toFixed(1) + '/5' : '—',
        streak,
        _att: att,
        _perf: perf
      }
    })
})

/* Division badge color + icon */
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

/* Clear all filters */
function clearFilters() {
  q.value = ''
  deptF.value = ''
  divF.value = ''
}
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>{{ scope ? 'My Teachers' : 'Teachers' }}</h1>
        <div class="sub">
          {{ rows.length }} teachers{{ scope ? ' · ' + scope : ' across all departments' }}
        </div>
      </div>
    </div>

    <DataTable
      :columns="columns"
      :rows="rows"
      empty-icon="people"
      empty-title="No teachers found"
      empty-text="Try a different search or clear the filters."
    >
      <template #toolbar>
        <!-- 🔍 Search -->
        <div class="tbl-search">
          <i class="bi bi-search"></i>
          <input v-model="q" placeholder="Search name, position, ID…" />
        </div>

        <!-- Department filter -->
        <select
          v-model="deptF"
          class="inp"
          style="max-width:200px;height:34px"
          :disabled="!!scope"
        >
          <option value="">All departments</option>
          <option v-for="d in directory.departments" :key="d.id" :value="d.name">
            {{ d.name }}
          </option>
        </select>

        <!-- Division filter -->
        <select v-model="divF" class="inp" style="max-width:160px;height:34px">
          <option value="">All divisions</option>
          <option value="Regular">Regular</option>
          <option value="Extension">Extension</option>
          <option value="Both">Both</option>
        </select>

        <button
          v-if="q || deptF || divF"
          class="btn btn-ghost btn-sm"
          @click="clearFilters"
        >
          <i class="bi bi-x-lg"></i> Clear
        </button>
      </template>

      <template #name="{ row }">
        <RouterLink :to="{ name: 'teacher-detail', params: { id: row.id } }"
                    style="color:var(--ink-800);text-decoration:none;font-weight:600">
          {{ row.name }}
        </RouterLink>
        <div class="t-xs muted">{{ row.staffId }}</div>
      </template>

      <template #department="{ row }">
        <span class="muted">{{ row.department }}</span>
      </template>

      <!-- Division badge column -->
      <template #division="{ row }">
        <span class="badge-x" :class="divisionBadge(row.division)">
          <i :class="`bi ${divisionIcon(row.division)}`"></i>
          {{ row.division }}
        </span>
      </template>

      <template #position="{ row }">
        {{ row.position }}
      </template>

      <template #status="{ row }">
        <span
          class="badge-x"
          :class="row.streak >= 5 ? 'b-red' : row.streak >= 3 ? 'b-amber' : 'b-green'"
        >
          <span class="dot"
                :class="row.streak >= 5 ? 'red' : row.streak >= 3 ? 'amber' : 'green'"
                style="margin-right:4px"></span>
          {{ row.streak >= 5 ? 'Escalated' : row.streak >= 3 ? 'Alert' : 'Good' }}
        </span>
      </template>

      <template #actions="{ row }">
        <RouterLink :to="{ name: 'teacher-detail', params: { id: row.id } }"
                    class="btn btn-ghost btn-xs">
          <i class="bi bi-eye"></i> View
        </RouterLink>
      </template>
    </DataTable>
  </div>
</template>