<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import Modal from '@/components/common/Modal.vue'
import RatingBadge from '@/components/common/RatingBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { useToast } from '@/composables/useToast'
import { fmtDate, fmtDateTime, debounce } from '@/utils/format'
import { REPORT_EDIT_WINDOW_MS } from '@/utils/constants'

const session = useSessionStore()
const reports = useReportsStore()
const alerts  = useAlertsStore()
const toast   = useToast()

const q = ref('')

/* ---------- my reports ---------- */
const mine = computed(() => reports.reportsByUser(session.userId))

const filtered = computed(() => {
  const term = q.value.toLowerCase()
  if (!term) return mine.value
  return mine.value.filter(r =>
    (r.teacher + ' ' + r.course + ' ' + (r.comments || '')).toLowerCase().includes(term)
  )
})

/* ---------- pagination ---------- */
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

/* Reset to page 1 whenever the filter or the underlying list changes */
watch([filtered, q], () => { page.value = 1 })

const onSearch = debounce(e => { q.value = e.target.value }, 180)

/* ---------- 24h edit window ---------- */
function canEdit(r) {
  if (session.role === 'admin') return true
  if (r.reporterId !== session.userId) return false
  const created = new Date(r._createdAt || r.createdAt || `${r.date}T00:00:00`)
  return Date.now() - created.getTime() <= REPORT_EDIT_WINDOW_MS
}

/* ---------- edit modal ---------- */
const editing    = ref(null)
const editReason = ref('')

function openEdit(r) {
  if (!canEdit(r)) {
    toast.err('This report can no longer be edited (24-hour window expired)')
    return
  }
  editing.value = r
  editReason.value = r.comments || ''
}

function saveEdit() {
  if (!editing.value) return
  reports.updateReport(editing.value.id, {
    comments: editReason.value.trim() || 'No comment',
    updatedAt: new Date().toISOString()
  })
  alerts.recompute()
  toast.ok('Report updated')
  editing.value = null
}

function cancelEdit() {
  editing.value = null
  editReason.value = ''
}
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>My Report History</h1>
        <div class="sub">
          {{ mine.length }} reports submitted · editable within 24 hours · identity hidden from teachers
        </div>
      </div>
    </div>

    <div class="card">
      <!-- Toolbar -->
      <div class="tbl-toolbar">
        <div class="tbl-search">
          <i class="bi bi-search"></i>
          <input
            :value="q"
            @input="onSearch"
            placeholder="Search by teacher, course, comment…"
          />
        </div>
        <span class="muted t-xs">
          Showing {{ filtered.length }} of {{ mine.length }} reports
        </span>
      </div>

      <!-- Table -->
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Teacher</th>
              <th>Course</th>
              <th>Attendance</th>
              <th>Performance</th>
              <th>Comments</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td colspan="7">
                <EmptyState
                  icon="journal"
                  title="No reports yet"
                  text="Submit your first daily report to see it here."
                />
              </td>
            </tr>
            <tr v-for="r in pageRows" :key="r.id">
              <td>{{ fmtDate(r.date) }}</td>
              <td>
                <RouterLink
                  :to="{ name: 'teacher-detail', params: { id: r.teacherId } }"
                  style="color:var(--ink-800);text-decoration:none;font-weight:600"
                >
                  {{ r.teacher }}
                </RouterLink>
              </td>
              <td class="muted">{{ r.course }}</td>
              <td><RatingBadge :rating="r.attendance_rating" kind="attendance" /></td>
              <td><RatingBadge :rating="r.performance_rating" kind="performance" show-label /></td>
              <td class="muted" style="max-width:280px">{{ r.comments || '—' }}</td>
              <td class="actions">
                <button v-if="canEdit(r)" class="btn btn-ghost btn-xs" @click="openEdit(r)">
                  <i class="bi bi-pencil"></i> Edit
                </button>
                <span
                  v-else
                  class="muted t-xs"
                  title="Editing is only allowed within 24 hours of submission"
                >
                  Locked
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ═══════ PAGINATION ═══════ -->
      <Pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="filtered.length"
        :sizes="[10, 25, 50, 100]"
      />
    </div>

    <!-- ═══════ EDIT MODAL ═══════ -->
    <Modal
      v-if="editing"
      title="Edit Report"
      :subtitle="`${editing.teacher} · ${fmtDate(editing.date)}`"
      @close="cancelEdit"
    >
      <div class="alert-pill alert-warning" style="display:flex;margin-bottom:12px">
        <i class="bi bi-clock"></i>
        <span style="margin-left:6px">
          Editing is available until
          {{ fmtDateTime(new Date(new Date(editing._createdAt || editing.createdAt).getTime() + REPORT_EDIT_WINDOW_MS)) }}.
        </span>
      </div>

      <div class="form-row">
        <label>Comments</label>
        <textarea v-model="editReason" class="inp" rows="4"></textarea>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="cancelEdit">Cancel</button>
        <button class="btn btn-primary btn-sm" @click="saveEdit">
          <i class="bi bi-check2"></i> Save Changes
        </button>
      </template>
    </Modal>
  </div>
</template>