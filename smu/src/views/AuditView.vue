<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'
import { exportCSV, debounce, fmtDateTime } from '@/utils/format'
import { useToast } from '@/composables/useToast'
import { ROLE_LABEL } from '@/utils/constants'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import KpiCard from '@/components/common/KpiCard.vue'

const session  = useSessionStore()
const settings = useSettingsStore()
const toast    = useToast()

/* ══════════════════════════════════════════════
   FILTERS
   ══════════════════════════════════════════════ */
const q        = ref('')
const moduleF  = ref('')
const result   = ref('')
const roleF    = ref('')
const fromDate = ref('')
const toDate   = ref('')

const modules = computed(() => {
  const set = new Set(settings.auditLog.map(l => l.module).filter(Boolean))
  return Array.from(set).sort()
})

const roles = computed(() => {
  const set = new Set(settings.auditLog.map(l => l.role).filter(Boolean))
  return Array.from(set).sort()
})

const filtered = computed(() => {
  const term = q.value.toLowerCase()
  return settings.auditLog
    .filter(l => !moduleF.value || l.module === moduleF.value)
    .filter(l => !result.value  || l.result === result.value)
    .filter(l => !roleF.value   || l.role   === roleF.value)
    .filter(l => {
      if (!fromDate.value && !toDate.value) return true
      const day = (l.timestamp || '').slice(0, 10)
      if (fromDate.value && day < fromDate.value) return false
      if (toDate.value   && day > toDate.value)   return false
      return true
    })
    .filter(l => {
      if (!term) return true
      return (l.user + ' ' + l.action + ' ' + l.module + ' ' + (l.detail || '') + ' ' + (l.ip || ''))
        .toLowerCase().includes(term)
    })
})

/* ══════════════════════════════════════════════
   KPIs
   ══════════════════════════════════════════════ */
const kpis = computed(() => {
  const all = settings.auditLog
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = all.filter(l => (l.timestamp || '').slice(0, 10) === today).length
  const failures   = all.filter(l => l.result === 'failure').length
  const uniqueUsers = new Set(all.map(l => l.user)).size
  return { total: all.length, today: todayCount, failures, uniqueUsers }
})

/* KPI click handlers */
function kpiTotal()      { clearFilters() }
function kpiToday() {
  clearFilters()
  const iso = new Date().toISOString().slice(0, 10)
  fromDate.value = iso
  toDate.value   = iso
}
function kpiFailures()   { clearFilters(); result.value = 'failure' }

/* ══════════════════════════════════════════════
   PAGINATION
   ══════════════════════════════════════════════ */
const page     = ref(1)
const pageSize = ref(25)

const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

function onSize(v) {
  pageSize.value = v
  page.value = 1
}

/* Reset page on filter change */
watch([q, moduleF, result, roleF, fromDate, toDate], () => { page.value = 1 })

const onSearch = debounce(e => { q.value = e.target.value }, 180)

function clearFilters() {
  q.value = ''; moduleF.value = ''; result.value = ''
  roleF.value = ''; fromDate.value = ''; toDate.value = ''
}

/* ══════════════════════════════════════════════
   SELECTION (Bulk delete)
   ══════════════════════════════════════════════ */
const selected = ref(new Set())

const allPageSelected = computed(() =>
  pageRows.value.length > 0 && pageRows.value.every(r => selected.value.has(r.id))
)
const somePageSelected = computed(() =>
  pageRows.value.some(r => selected.value.has(r.id)) && !allPageSelected.value
)
const selectedCount = computed(() => selected.value.size)

function toggleRow(id) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}

function toggleSelectPage() {
  const s = new Set(selected.value)
  if (allPageSelected.value) {
    pageRows.value.forEach(r => s.delete(r.id))
  } else {
    pageRows.value.forEach(r => s.add(r.id))
  }
  selected.value = s
}

function selectAllFiltered() {
  const s = new Set(selected.value)
  filtered.value.forEach(r => s.add(r.id))
  selected.value = s
}

function clearSelection() {
  selected.value = new Set()
}

/* ══════════════════════════════════════════════
   SINGLE DELETE
   ══════════════════════════════════════════════ */
const deleting = ref(null)

function askDelete(row) {
  deleting.value = row
}

function confirmSingleDelete() {
  const r = deleting.value
  if (!r) return
  settings.deleteAuditEntry(r.id)
  const s = new Set(selected.value); s.delete(r.id); selected.value = s
  settings.audit('Delete Audit Entry', 'Audit', `Deleted entry #${r.id}`)
  toast.ok('Audit entry deleted')
  deleting.value = null
}

/* ══════════════════════════════════════════════
   BULK DELETE
   ══════════════════════════════════════════════ */
const bulkDeleteOpen = ref(false)

function askBulkDelete() {
  if (!selectedCount.value) return
  bulkDeleteOpen.value = true
}

function confirmBulkDelete() {
  const ids = Array.from(selected.value)
  const removed = settings.deleteAuditEntries(ids)
  settings.audit('Bulk Delete Audit', 'Audit', `Deleted ${removed} entries`)
  toast.ok(`Deleted ${removed} audit ${removed === 1 ? 'entry' : 'entries'}`)
  clearSelection()
  bulkDeleteOpen.value = false
}

/* ══════════════════════════════════════════════
   CLEAR ALL (filtered)
   ══════════════════════════════════════════════ */
const clearAllOpen = ref(false)

function askClearAll() { clearAllOpen.value = true }

function confirmClearAll() {
  const ids = filtered.value.map(l => l.id)
  const removed = settings.deleteAuditEntries(ids)
  settings.audit('Clear Filtered Audit', 'Audit', `Cleared ${removed} entries`)
  toast.ok(`Cleared ${removed} ${removed === 1 ? 'entry' : 'entries'}`)
  clearSelection()
  clearAllOpen.value = false
}

/* ══════════════════════════════════════════════
   EXPORT
   ══════════════════════════════════════════════ */
function onExport() {
  const rows = filtered.value.map(l => ({
    Timestamp: l.timestamp, User: l.user, Role: l.role,
    Action: l.action, Module: l.module, Detail: l.detail,
    IP: l.ip, Result: l.result
  }))
  if (exportCSV(rows, 'audit-log')) toast.ok('Export started')
}

function onExportSelected() {
  const set = new Set(selected.value)
  const rows = settings.auditLog
    .filter(l => set.has(l.id))
    .map(l => ({
      Timestamp: l.timestamp, User: l.user, Role: l.role,
      Action: l.action, Module: l.module, Detail: l.detail,
      IP: l.ip, Result: l.result
    }))
  if (exportCSV(rows, 'audit-log-selected')) toast.ok('Export started')
}

/* ══════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════ */
function fmtTs(ts) {
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    })
  } catch { return ts }
}

function resultBadgeClass(r) {
  return r === 'success' ? 'b-green' : r === 'failure' ? 'b-red' : 'b-gray'
}

function moduleBadgeClass(m) {
  return {
    Auth: 'b-blue',
    Users: 'b-purple',
    Backup: 'b-amber',
    Audit: 'b-red',
    System: 'b-gray'
  }[m] || 'b-gray'
}

/* Clear selection when filters change */
watch(filtered, () => { clearSelection() })
</script>

<template>
  <div>
    <!-- ═══════════════ PAGE HEADER ═══════════════ -->
    <div class="page-hd">
      <div>
        <h1>Audit Log</h1>
        <div class="sub">
          {{ settings.auditLog.length }} recorded actions
          <span v-if="filtered.length !== settings.auditLog.length"> · {{ filtered.length }} matching</span>
        </div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-secondary btn-sm" @click="onExport">
          <i class="bi bi-download"></i> Export Filtered
        </button>
        <button class="btn btn-danger btn-sm" :disabled="!filtered.length" @click="askClearAll">
          <i class="bi bi-trash3"></i> Clear Filtered
        </button>
      </div>
    </div>

    <!-- ═══════════════ KPI STRIP ═══════════════ -->
    <div class="row g-3 mb-4">
      <div class="col-xl-3 col-md-6">
        <div @click="kpiTotal" style="cursor:pointer">
          <KpiCard label="Total Entries" :value="kpis.total"
                   sub="all time" icon="shield-check" color="brand" />
        </div>
      </div>
      <div class="col-xl-3 col-md-6">
        <div @click="kpiToday" style="cursor:pointer">
          <KpiCard label="Today" :value="kpis.today"
                   sub="actions recorded today" icon="calendar-check" color="info" />
        </div>
      </div>
      <div class="col-xl-3 col-md-6">
        <div @click="kpiFailures" style="cursor:pointer">
          <KpiCard label="Failures" :value="kpis.failures"
                   sub="failed actions" icon="x-octagon-fill"
                   :color="kpis.failures ? 'danger' : 'success'" />
        </div>
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Unique Users" :value="kpis.uniqueUsers"
                 sub="distinct accounts" icon="people-fill" color="purple" />
      </div>
    </div>

    <!-- ═══════════════ BULK ACTIONS BAR ═══════════════ -->
    <Transition name="bulk">
      <div v-if="selectedCount > 0" class="bulk-bar">
        <div class="bulk-info">
          <i class="bi bi-check2-square"></i>
          <b>{{ selectedCount }}</b>
          {{ selectedCount === 1 ? 'entry' : 'entries' }} selected
        </div>
        <div class="bulk-actions">
          <button class="btn btn-ghost btn-sm" @click="selectAllFiltered">
            <i class="bi bi-check2-all"></i>
            Select all {{ filtered.length }} in view
          </button>
          <button class="btn btn-ghost btn-sm" @click="clearSelection">
            <i class="bi bi-x-lg"></i> Clear selection
          </button>
          <button class="btn btn-secondary btn-sm" @click="onExportSelected">
            <i class="bi bi-download"></i> Export Selected
          </button>
          <button class="btn btn-danger btn-sm" @click="askBulkDelete">
            <i class="bi bi-trash3"></i> Delete Selected
          </button>
        </div>
      </div>
    </Transition>

    <!-- ═══════════════ MAIN CARD ═══════════════ -->
    <div class="card">
      <!-- Toolbar -->
      <div class="tbl-toolbar" style="gap:10px">
        <div class="tbl-search">
          <i class="bi bi-search"></i>
          <input :value="q" @input="onSearch" placeholder="Search user, action, module, detail, IP…" />
        </div>

        <select v-model="moduleF" class="inp" style="max-width:170px;height:34px">
          <option value="">All modules</option>
          <option v-for="m in modules" :key="m" :value="m">{{ m }}</option>
        </select>

        <select v-model="result" class="inp" style="max-width:150px;height:34px">
          <option value="">All results</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>

        <select v-model="roleF" class="inp" style="max-width:170px;height:34px">
          <option value="">All roles</option>
          <option v-for="r in roles" :key="r" :value="r">{{ ROLE_LABEL[r] || r }}</option>
        </select>

        <input v-model="fromDate" type="date" class="inp" style="max-width:150px;height:34px" title="From date" />
        <input v-model="toDate" type="date" class="inp" style="max-width:150px;height:34px" title="To date" />

        <button class="btn btn-ghost btn-sm" @click="clearFilters">
          <i class="bi bi-x-lg"></i> Clear
        </button>
      </div>

      <!-- Table -->
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width:40px">
                <input
                  type="checkbox"
                  :checked="allPageSelected"
                  :indeterminate.prop="somePageSelected"
                  @change="toggleSelectPage"
                  aria-label="Select all on this page"
                  style="width:16px;height:16px;accent-color:var(--brand-600);cursor:pointer"
                />
              </th>
              <th>Timestamp</th>
              <th>User</th>
              <th>Action</th>
              <th>Module</th>
              <th>Detail</th>
              <th>IP</th>
              <th>Result</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td colspan="9">
                <EmptyState icon="shield-check" title="No audit entries"
                            text="Try a different filter or clear the search." />
              </td>
            </tr>
            <tr v-for="l in pageRows" :key="l.id" :class="{ 'row-selected': selected.has(l.id) }">
              <td>
                <input
                  type="checkbox"
                  :checked="selected.has(l.id)"
                  @change="toggleRow(l.id)"
                  :aria-label="`Select entry ${l.id}`"
                  style="width:16px;height:16px;accent-color:var(--brand-600);cursor:pointer"
                />
              </td>
              <td class="mono t-xs" style="white-space:nowrap">{{ fmtTs(l.timestamp) }}</td>
              <td>
                <b>{{ l.user }}</b>
                <div class="t-xs muted">{{ ROLE_LABEL[l.role] || l.role }}</div>
              </td>
              <td>{{ l.action }}</td>
              <td>
                <span class="badge-x" :class="moduleBadgeClass(l.module)">
                  {{ l.module }}
                </span>
              </td>
              <td class="muted" style="max-width:340px">{{ l.detail || '—' }}</td>
              <td class="mono t-xs">{{ l.ip || '—' }}</td>
              <td>
                <span class="badge-x" :class="resultBadgeClass(l.result)">
                  <i :class="l.result === 'success' ? 'bi bi-check2' : 'bi bi-x'"></i>
                  {{ l.result === 'success' ? 'OK' : 'Failed' }}
                </span>
              </td>
              <td class="actions">
                <button
                  class="btn btn-danger btn-xs"
                  @click="askDelete(l)"
                  title="Delete entry"
                  aria-label="Delete audit entry"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination (shared component) -->
      <Pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="filtered.length"
        :sizes="[10, 25, 50, 100]"
        @update:page-size="onSize"
      />
    </div>

    <!-- ═══════════════ SINGLE DELETE CONFIRM ═══════════════ -->
    <ConfirmDialog
      v-if="deleting"
      title="Delete Audit Entry"
      confirm-label="Delete"
      danger
      @cancel="deleting = null"
      @confirm="confirmSingleDelete"
    >
      Delete this audit entry?
      <div style="margin-top:10px;padding:12px;background:var(--ink-25);border-radius:8px;font-size:12.5px">
        <div><b>Action:</b> {{ deleting.action }}</div>
        <div><b>User:</b> {{ deleting.user }}</div>
        <div><b>When:</b> {{ fmtDateTime(deleting.timestamp) }}</div>
      </div>
    </ConfirmDialog>

    <!-- ═══════════════ BULK DELETE CONFIRM ═══════════════ -->
    <ConfirmDialog
      v-if="bulkDeleteOpen"
      title="Delete Selected Entries"
      :subtitle="`${selectedCount} entries will be removed`"
      confirm-label="Delete All Selected"
      danger
      @cancel="bulkDeleteOpen = false"
      @confirm="confirmBulkDelete"
    >
      Permanently delete <b>{{ selectedCount }}</b> audit
      {{ selectedCount === 1 ? 'entry' : 'entries' }}?
      This action cannot be undone.
    </ConfirmDialog>

    <!-- ═══════════════ CLEAR ALL CONFIRM ═══════════════ -->
    <ConfirmDialog
      v-if="clearAllOpen"
      title="Clear Filtered Entries"
      :subtitle="`${filtered.length} entries will be removed`"
      confirm-label="Clear All"
      danger
      @cancel="clearAllOpen = false"
      @confirm="confirmClearAll"
    >
      Permanently delete <b>{{ filtered.length }}</b> entries matching the current filters?
      <br><br>
      <span style="color:var(--danger);font-weight:600">
        <i class="bi bi-exclamation-triangle-fill"></i>
        This cannot be undone.
      </span>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
/* Bulk actions bar */
.bulk-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  margin-bottom: 14px;
  background: linear-gradient(135deg, #1e2f7e, #4f6df5);
  color: #fff;
  border-radius: var(--r-lg);
  box-shadow: 0 8px 24px rgba(30, 47, 126, .25);
  flex-wrap: wrap;
}
.bulk-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
}
.bulk-info i {
  font-size: 18px;
  opacity: .9;
}
.bulk-info b {
  font-size: 15px;
}
.bulk-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.bulk-bar .btn-ghost {
  color: rgba(255, 255, 255, .9);
  border: 1px solid rgba(255, 255, 255, .2);
}
.bulk-bar .btn-ghost:hover {
  background: rgba(255, 255, 255, .12);
  color: #fff;
}
.bulk-bar .btn-secondary {
  background: rgba(255, 255, 255, .12);
  color: #fff;
  border-color: rgba(255, 255, 255, .25);
}
.bulk-bar .btn-secondary:hover {
  background: rgba(255, 255, 255, .2);
  color: #fff;
}

/* Transition */
.bulk-enter-active,
.bulk-leave-active {
  transition: opacity .2s ease, transform .2s ease;
}
.bulk-enter-from,
.bulk-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Selected row highlight */
.tbl tbody tr.row-selected {
  background: rgba(79, 109, 245, .06);
}
.tbl tbody tr.row-selected:hover {
  background: rgba(79, 109, 245, .10);
}
</style>