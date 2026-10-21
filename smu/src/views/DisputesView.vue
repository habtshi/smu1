<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDisputesStore } from '@/stores/disputes'
import { useDirectoryStore } from '@/stores/directory'
import { useSettingsStore } from '@/stores/settings'
import KpiCard from '@/components/common/KpiCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import Modal from '@/components/common/Modal.vue'
import { useToast } from '@/composables/useToast'
import { fmtDate, debounce } from '@/utils/format'

const session   = useSessionStore()
const disputes  = useDisputesStore()
const directory = useDirectoryStore()
const settings  = useSettingsStore()
const toast     = useToast()

const scope = computed(() =>
  session.role === 'dept_head' ? session.department : null
)

/* ═══════════════════════════════════════════════════
   Helper — look up teacher's division
   ═══════════════════════════════════════════════════ */
function divisionOf(teacherId) {
  const t = directory.userById(teacherId)
  return t?.division || 'Regular'
}

/* ═══════════════════════════════════════════════════
   All disputes for this user's scope (with division)
   ═══════════════════════════════════════════════════ */
const scoped = computed(() =>
  disputes.disputesForDept(scope.value).map(d => ({
    ...d,
    division: divisionOf(d.teacherId)
  }))
)

/* ---------- KPIs ---------- */
const pendingCount  = computed(() => scoped.value.filter(d => d.status === 'pending').length)
const resolvedCount = computed(() => scoped.value.filter(d => d.status === 'resolved').length)
const rejectedCount = computed(() => scoped.value.filter(d => d.status === 'rejected').length)

/* ═══════════════════════════════════════════════════
   🆕 FILTERS — name / status / department / division
   ═══════════════════════════════════════════════════ */
const q           = ref('')       // search by teacher name / reason / report
const status      = ref('')       // pending / resolved / rejected
const deptFilter  = ref('')       // department
const divFilter   = ref('')       // division

/* Department options (respects dept-head scope) */
const deptOptions = computed(() => {
  if (scope.value) return [scope.value]
  return directory.departments.map(d => d.name).sort()
})

/* Apply all filters */
const filtered = computed(() => {
  let list = scoped.value

  /* Status filter */
  if (status.value) {
    list = list.filter(d => d.status === status.value)
  }

  /* Department filter */
  if (deptFilter.value) {
    list = list.filter(d => d.department === deptFilter.value)
  }

  /* Division filter */
  if (divFilter.value) {
    list = list.filter(d => {
      const div = d.division
      if (divFilter.value === 'Both') return div === 'Both'
      return div === divFilter.value || div === 'Both'
    })
  }

  /* Search by name / reason / report */
  const term = q.value.toLowerCase()
  if (term) {
    list = list.filter(d =>
      (d.teacherName + ' ' + (d.reason || '') + ' ' + (d.reportSummary || '') + ' ' + (d.status || ''))
        .toLowerCase().includes(term)
    )
  }

  return list
})

const onSearch = debounce(e => { q.value = e.target.value }, 180)

/* Clear all filters */
function clearFilters() {
  q.value = ''
  status.value = ''
  deptFilter.value = ''
  divFilter.value = ''
}

/* ═══════════════════════════════════════════════════
   Pagination
   ═══════════════════════════════════════════════════ */
const page     = ref(1)
const pageSize = ref(10)

const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

function onSize(v) {
  pageSize.value = v
  page.value = 1
}

watch([filtered, q, status, deptFilter, divFilter], () => { page.value = 1 })

/* ═══════════════════════════════════════════════════
   Resolve / Reject modal
   ═══════════════════════════════════════════════════ */
const open       = ref(false)
const activeRow  = ref(null)
const action     = ref('resolved')   // 'resolved' | 'rejected'
const note       = ref('')

function openResolve(row, kind) {
  activeRow.value = row
  action.value = kind
  note.value = ''
  open.value = true
}

function confirm() {
  const r = activeRow.value
  if (!r) return

  disputes.resolveDispute(r.id, {
    status: action.value,
    resolution: note.value.trim() || (action.value === 'resolved' ? 'Resolved' : 'Rejected'),
    resolverName: session.user?.name || 'Admin'
  })

  toast.ok(`Dispute ${action.value}`)
  open.value = false
  activeRow.value = null
}

/* ---------- status pill ---------- */
function pillFor(status) {
  return {
    pending:  { cls: 'alert-warning',  label: 'Pending',  icon: 'hourglass-split' },
    resolved: { cls: 'alert-resolved', label: 'Resolved', icon: 'check2-circle' },
    rejected: { cls: 'alert-critical', label: 'Rejected', icon: 'x-circle' }
  }[status] || { cls: 'b-gray', label: status, icon: 'circle' }
}

/* ---------- division badge ---------- */
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
    <div class="page-hd">
      <div>
        <h1>Disputes</h1>
        <div class="sub">
          Review disputes submitted by teachers{{ scope ? ' · ' + scope : '' }}
        </div>
      </div>
    </div>

    <!-- ═══════════════ KPIs ═══════════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-4 col-md-6">
        <KpiCard label="Pending" :value="pendingCount" sub="awaiting review"
                 icon="hourglass-split" color="warning" />
      </div>
      <div class="col-xl-4 col-md-6">
        <KpiCard label="Resolved" :value="resolvedCount" sub="all time"
                 icon="check2-circle" color="success" />
      </div>
      <div class="col-xl-4 col-md-6">
        <KpiCard label="Rejected" :value="rejectedCount" sub="all time"
                 icon="x-circle" color="danger" />
      </div>
    </div>

    <!-- ═══════════════ TABLE ═══════════════ -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-chat-square-text"></i> All Disputes</h3>
        <span class="badge-x b-brand">{{ filtered.length }} of {{ scoped.length }}</span>
      </div>

      <!-- 🆕 Filter toolbar -->
      <div class="tbl-toolbar">
        <div class="tbl-search">
          <i class="bi bi-search"></i>
          <input :value="q" @input="onSearch" placeholder="Search teacher, reason…" />
        </div>

        <select v-model="status" class="inp" style="max-width:160px;height:34px">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
          <option value="rejected">Rejected</option>
        </select>

        <select v-model="deptFilter" class="inp" style="max-width:200px;height:34px" :disabled="!!scope">
          <option value="">All departments</option>
          <option v-for="d in deptOptions" :key="d" :value="d">{{ d }}</option>
        </select>

        <select v-model="divFilter" class="inp" style="max-width:160px;height:34px">
          <option value="">All divisions</option>
          <option value="Regular">Regular</option>
          <option value="Extension">Extension</option>
          <option value="Both">Both</option>
        </select>

        <button
          v-if="q || status || deptFilter || divFilter"
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
              <th>Teacher</th>
              <th>Department</th>
              <th>Division</th>
              <th>Report Date</th>
              <th>Report</th>
              <th>Reason</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td colspan="8">
                <EmptyState
                  icon="chat-square-text"
                  :title="scoped.length ? 'No matching disputes' : 'No disputes found'"
                  :text="scoped.length ? 'Try a different filter.' : 'Teachers haven\'t submitted any disputes matching your filters.'"
                />
              </td>
            </tr>
            <tr v-for="d in pageRows" :key="d.id">
              <td>
                <RouterLink :to="{ name: 'teacher-detail', params: { id: d.teacherId } }"
                            style="color:var(--ink-800);text-decoration:none;font-weight:600">
                  {{ d.teacherName }}
                </RouterLink>
              </td>
              <td class="muted">{{ d.department }}</td>

              <!-- 🆕 Division badge -->
              <td>
                <span class="badge-x" :class="divisionBadge(d.division)">
                  <i :class="`bi ${divisionIcon(d.division)}`"></i>
                  {{ d.division }}
                </span>
              </td>

              <td>{{ fmtDate(d.reportDate) }}</td>
              <td class="muted">{{ d.reportSummary }}</td>
              <td style="max-width:280px;font-size:12.5px">{{ d.reason }}</td>
              <td>
                <span class="alert-pill" :class="pillFor(d.status).cls">
                  <i :class="`bi bi-${pillFor(d.status).icon}`"></i>
                  {{ pillFor(d.status).label }}
                </span>
              </td>
              <td class="actions">
                <template v-if="d.status === 'pending'">
                  <button class="btn btn-success btn-xs" @click="openResolve(d, 'resolved')">
                    <i class="bi bi-check2"></i> Resolve
                  </button>
                  <button class="btn btn-danger btn-xs" @click="openResolve(d, 'rejected')">
                    <i class="bi bi-x"></i> Reject
                  </button>
                </template>
                <span v-else class="muted" style="font-size:12px">
                  {{ d.resolvedBy || '—' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="filtered.length"
        :sizes="[10, 25, 50, 100]"
      />
    </div>

    <!-- ═══════════════ RESOLVE / REJECT MODAL ═══════════════ -->
    <Modal
      v-if="open"
      :title="action === 'resolved' ? 'Resolve Dispute' : 'Reject Dispute'"
      :subtitle="activeRow ? `${activeRow.teacherName} · ${fmtDate(activeRow.reportDate)}` : ''"
      @close="open = false"
    >
      <div v-if="activeRow">
        <div class="info-row"><div class="k">Teacher</div><div class="v">{{ activeRow.teacherName }}</div></div>
        <div class="info-row">
          <div class="k">Department</div>
          <div class="v">{{ activeRow.department }}</div>
        </div>
        <div class="info-row">
          <div class="k">Division</div>
          <div class="v">
            <span class="badge-x" :class="divisionBadge(activeRow.division)">
              <i :class="`bi ${divisionIcon(activeRow.division)}`"></i>
              {{ activeRow.division }}
            </span>
          </div>
        </div>
        <div class="info-row"><div class="k">Report</div><div class="v">{{ activeRow.reportSummary }}</div></div>
        <div class="info-row">
          <div class="k">Reason</div>
          <div class="v" style="font-weight:500">{{ activeRow.reason }}</div>
        </div>
      </div>

      <div class="form-row mt-3">
        <label>Your note / resolution</label>
        <textarea v-model="note" class="inp" rows="3"
                  placeholder="Explain the decision…"></textarea>
      </div>

      <div class="alert-pill"
           :class="action === 'resolved' ? 'alert-resolved' : 'alert-critical'"
           style="display:inline-flex;padding:10px 12px">
        <i :class="action === 'resolved' ? 'bi bi-check2-circle' : 'bi bi-x-circle'"></i>
        <span style="margin-left:6px">
          <template v-if="action === 'resolved'">The teacher will be notified that the dispute is accepted.</template>
          <template v-else>The teacher will be notified that the dispute is rejected.</template>
        </span>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="open = false">Cancel</button>
        <button class="btn btn-sm"
                :class="action === 'resolved' ? 'btn-success' : 'btn-danger'"
                @click="confirm">
          <i class="bi bi-check2"></i>
          Confirm {{ action === 'resolved' ? 'Resolve' : 'Reject' }}
        </button>
      </template>
    </Modal>
  </div>
</template>