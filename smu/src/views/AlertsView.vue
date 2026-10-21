<script setup>
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useAlertsStore } from '@/stores/alerts'
import { useDirectoryStore } from '@/stores/directory'
import { useSettingsStore } from '@/stores/settings'
import KpiCard from '@/components/common/KpiCard.vue'
import Modal from '@/components/common/Modal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import RatingBadge from '@/components/common/RatingBadge.vue'
import { useToast } from '@/composables/useToast'
import { fmtDate, fmtDateTime } from '@/utils/format'

const session   = useSessionStore()
const alerts    = useAlertsStore()
const directory = useDirectoryStore()
const settings  = useSettingsStore()
const toast     = useToast()

const scope = computed(() =>
  session.role === 'dept_head' ? session.department : null
)

/* ═══════════════════════════════════════════════════
   Helper — look up teacher's division from directory
   ═══════════════════════════════════════════════════ */
function divisionOf(teacherId) {
  const t = directory.userById(teacherId)
  return t?.division || 'Regular'
}

/* ═══════════════════════════════════════════════════
   Active / resolved alerts (with division attached)
   ═══════════════════════════════════════════════════ */
const active = computed(() =>
  alerts.activeAlertsForDept(scope.value).map(a => ({
    ...a,
    division: divisionOf(a.teacherId)
  }))
)

const resolved = computed(() =>
  alerts.alerts
    .filter(a => a.status === 'resolved' && (!scope.value || a.department === scope.value))
    .sort((a, b) => new Date(b.resolvedAt) - new Date(a.resolvedAt))
    .map(a => ({
      ...a,
      division: divisionOf(a.teacherId)
    }))
)

const warnings  = computed(() => active.value.filter(a => !a.escalated).length)
const escalated = computed(() => active.value.filter(a => a.escalated).length)

/* ═══════════════════════════════════════════════════
   🆕 FILTERS — name / department / division
   ═══════════════════════════════════════════════════ */
const activeQ       = ref('')       // search by teacher name
const activeDept    = ref('')       // filter by department
const activeDiv     = ref('')       // filter by division

const resolvedQ     = ref('')
const resolvedDept  = ref('')
const resolvedDiv   = ref('')

/* Department options (respects dept-head scope) */
const deptOptions = computed(() => {
  if (scope.value) return [scope.value]
  return directory.departments.map(d => d.name).sort()
})

/* Apply all filters to active alerts */
const filteredActive = computed(() => {
  let list = active.value

  /* Name search */
  const term = activeQ.value.toLowerCase()
  if (term) {
    list = list.filter(a =>
      (a.teacherName || '').toLowerCase().includes(term)
    )
  }

  /* Department filter */
  if (activeDept.value) {
    list = list.filter(a => a.department === activeDept.value)
  }

  /* Division filter — 'Regular' shows Regular, 'Extension' shows Extension, 'Both' shows both */
  if (activeDiv.value) {
    list = list.filter(a => {
      const d = a.division
      if (activeDiv.value === 'Both') return d === 'Both'
      return d === activeDiv.value || d === 'Both'
    })
  }

  return list
})

/* Apply all filters to resolved alerts */
const filteredResolved = computed(() => {
  let list = resolved.value

  const term = resolvedQ.value.toLowerCase()
  if (term) {
    list = list.filter(a =>
      (a.teacherName + ' ' + (a.resolvedBy || '')).toLowerCase().includes(term)
    )
  }

  if (resolvedDept.value) {
    list = list.filter(a => a.department === resolvedDept.value)
  }

  if (resolvedDiv.value) {
    list = list.filter(a => {
      const d = a.division
      if (resolvedDiv.value === 'Both') return d === 'Both'
      return d === resolvedDiv.value || d === 'Both'
    })
  }

  return list
})

/* Clear filter buttons */
function clearActiveFilters() {
  activeQ.value = ''
  activeDept.value = ''
  activeDiv.value = ''
}
function clearResolvedFilters() {
  resolvedQ.value = ''
  resolvedDept.value = ''
  resolvedDiv.value = ''
}

/* ═══════════════════════════════════════════════════
   Resolve flow
   ═══════════════════════════════════════════════════ */
const resolving  = ref(null)
const confirming = ref(false)

function openResolve(alert) {
  resolving.value = alert
  confirming.value = true
}
function confirmResolve() {
  const a = resolving.value
  if (!a) return
  alerts.resolveAlert(a.id, session.user?.name || 'Admin')
  toast.ok(`Alert for ${a.teacherName} marked as resolved`)
  confirming.value = false
  resolving.value = null
}
function cancelResolve() {
  confirming.value = false
  resolving.value = null
}

function pillClass(a) {
  if (a.escalated) return 'alert-critical'
  return 'alert-warning'
}
function pillLabel(a) {
  return a.escalated ? 'Escalated · 5+ Reds' : 'Warning · 3+ Reds'
}

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
    <div class="page-hd">
      <div>
        <h1>Alerts</h1>
        <div class="sub">Consecutive absence alerts (3+ = Dept Head · 5+ = Admin escalation)</div>
      </div>
    </div>

    <!-- ═══════════════ KPIs ═══════════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Active Warnings" :value="warnings"
                 sub="3+ consecutive Reds" icon="exclamation-triangle-fill" color="warning" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Escalated" :value="escalated"
                 sub="5+ Reds · admin notified" icon="exclamation-octagon-fill" color="danger" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Resolved" :value="resolved.length"
                 sub="all time" icon="check2-circle" color="success" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Total Alerts" :value="alerts.alerts.length"
                 :sub="scope || 'university-wide'" icon="bell-fill" color="brand" />
      </div>
    </div>

    <!-- ═══════════════ ACTIVE ALERTS ═══════════════ -->
    <div class="card mb-4">
      <div class="card-hd">
        <h3><i class="bi bi-bell-fill" style="color:var(--danger)"></i> Active Alerts</h3>
        <span class="badge-x" :class="active.length ? 'b-red' : 'b-green'">
          {{ filteredActive.length }} of {{ active.length }}
        </span>
      </div>

      <!-- 🆕 Filter toolbar -->
      <div class="tbl-toolbar">
        <div class="tbl-search">
          <i class="bi bi-search"></i>
          <input v-model="activeQ" placeholder="Search by teacher name…" />
        </div>

        <select v-model="activeDept" class="inp" style="max-width:200px;height:34px" :disabled="!!scope">
          <option value="">All departments</option>
          <option v-for="d in deptOptions" :key="d" :value="d">{{ d }}</option>
        </select>

        <select v-model="activeDiv" class="inp" style="max-width:160px;height:34px">
          <option value="">All divisions</option>
          <option value="Regular">Regular</option>
          <option value="Extension">Extension</option>
          <option value="Both">Both</option>
        </select>

        <button
          v-if="activeQ || activeDept || activeDiv"
          class="btn btn-ghost btn-sm"
          @click="clearActiveFilters"
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
              <th class="num">Streak</th>
              <th>Triggered</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filteredActive.length">
              <td colspan="7">
                <EmptyState
                  icon="check2-circle"
                  :title="active.length ? 'No matching alerts' : 'No active alerts'"
                  :text="active.length ? 'Try a different filter.' : 'All clear — no teacher has 3+ consecutive Reds.'"
                />
              </td>
            </tr>
            <tr v-for="a in filteredActive" :key="a.id">
              <td>
                <RouterLink :to="{ name: 'teacher-detail', params: { id: a.teacherId } }"
                            style="color:var(--ink-800);text-decoration:none;font-weight:600">
                  {{ a.teacherName }}
                </RouterLink>
              </td>
              <td class="muted">{{ a.department }}</td>

              <!-- 🆕 Division badge -->
              <td>
                <span class="badge-x" :class="divisionBadge(a.division)">
                  <i :class="`bi ${divisionIcon(a.division)}`"></i>
                  {{ a.division }}
                </span>
              </td>

              <td class="num">
                <span class="badge-x" :class="a.escalated ? 'b-red' : 'b-amber'">
                  {{ a.count }} Reds
                </span>
              </td>
              <td class="muted">{{ fmtDate(a.createdAt) }}</td>
              <td>
                <span class="alert-pill" :class="pillClass(a)">
                  <i :class="a.escalated ? 'bi bi-exclamation-octagon-fill' : 'bi bi-exclamation-triangle-fill'"></i>
                  {{ pillLabel(a) }}
                </span>
              </td>
              <td class="actions">
                <RouterLink :to="{ name: 'teacher-detail', params: { id: a.teacherId } }"
                            class="btn btn-ghost btn-xs">
                  <i class="bi bi-eye"></i> View
                </RouterLink>
                <button class="btn btn-success btn-xs" @click="openResolve(a)">
                  <i class="bi bi-check2"></i> Resolve
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══════════════ RESOLVED HISTORY ═══════════════ -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-clock-history"></i> Resolved History</h3>
        <span class="badge-x b-green">{{ filteredResolved.length }} of {{ resolved.length }}</span>
      </div>

      <!-- 🆕 Filter toolbar -->
      <div class="tbl-toolbar">
        <div class="tbl-search">
          <i class="bi bi-search"></i>
          <input v-model="resolvedQ" placeholder="Search teacher or resolver…" />
        </div>

        <select v-model="resolvedDept" class="inp" style="max-width:200px;height:34px" :disabled="!!scope">
          <option value="">All departments</option>
          <option v-for="d in deptOptions" :key="d" :value="d">{{ d }}</option>
        </select>

        <select v-model="resolvedDiv" class="inp" style="max-width:160px;height:34px">
          <option value="">All divisions</option>
          <option value="Regular">Regular</option>
          <option value="Extension">Extension</option>
          <option value="Both">Both</option>
        </select>

        <button
          v-if="resolvedQ || resolvedDept || resolvedDiv"
          class="btn btn-ghost btn-sm"
          @click="clearResolvedFilters"
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
              <th class="num">Streak</th>
              <th>Resolved On</th>
              <th>Resolved By</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filteredResolved.length">
              <td colspan="6">
                <EmptyState
                  icon="journal"
                  :title="resolved.length ? 'No matching records' : 'No resolved alerts'"
                  :text="resolved.length ? 'Try a different filter.' : ''"
                />
              </td>
            </tr>
            <tr v-for="a in filteredResolved" :key="a.id">
              <td>{{ a.teacherName }}</td>
              <td class="muted">{{ a.department }}</td>

              <!-- 🆕 Division badge -->
              <td>
                <span class="badge-x" :class="divisionBadge(a.division)">
                  <i :class="`bi ${divisionIcon(a.division)}`"></i>
                  {{ a.division }}
                </span>
              </td>

              <td class="num">{{ a.count }}</td>
              <td class="muted">{{ fmtDateTime(a.resolvedAt) }}</td>
              <td>{{ a.resolvedBy || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══════════════ RESOLVE CONFIRMATION ═══════════════ -->
    <Modal v-if="confirming"
           title="Resolve Alert"
           :subtitle="resolving ? `${resolving.teacherName} · ${resolving.department}` : ''"
           @close="cancelResolve">
      <p style="font-size:13.5px;color:var(--ink-700)">
        Mark this alert as resolved? The next non-Red attendance rating will also reset the streak automatically.
      </p>
      <div v-if="resolving" class="info-row">
        <div class="k">Consecutive Reds</div>
        <div class="v">{{ resolving.count }}</div>
      </div>
      <div v-if="resolving" class="info-row">
        <div class="k">Division</div>
        <div class="v">
          <span class="badge-x" :class="divisionBadge(resolving.division)">
            <i :class="`bi ${divisionIcon(resolving.division)}`"></i>
            {{ resolving.division }}
          </span>
        </div>
      </div>
      <div v-if="resolving" class="info-row">
        <div class="k">Status</div>
        <div class="v">
          <span class="alert-pill" :class="pillClass(resolving)">
            {{ resolving.escalated ? 'Escalated' : 'Warning' }}
          </span>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="cancelResolve">Cancel</button>
        <button class="btn btn-success btn-sm" @click="confirmResolve">
          <i class="bi bi-check2-circle"></i> Confirm Resolve
        </button>
      </template>
    </Modal>
  </div>
</template>