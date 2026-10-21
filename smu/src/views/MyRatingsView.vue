<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useReportsStore } from '@/stores/reports'
import RatingBadge from '@/components/common/RatingBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { fmtDate, debounce } from '@/utils/format'

const session = useSessionStore()
const reports = useReportsStore()

/* ---------- my ratings ---------- */
const mine = computed(() =>
  reports.reports
    .filter(r => r.reporterId === session.userId && r.reporter_role === 'student')
    .sort((a, b) => b.date.localeCompare(a.date))
)

/* ---------- search ---------- */
const q = ref('')

const filtered = computed(() => {
  const term = q.value.toLowerCase()
  if (!term) return mine.value
  return mine.value.filter(r =>
    (r.teacher + ' ' + r.course + ' ' + (r.comments || '')).toLowerCase().includes(term)
  )
})

const onSearch = debounce(e => { q.value = e.target.value }, 180)

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

/* reset to page 1 when filter changes */
watch([filtered, q], () => { page.value = 1 })
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>My Ratings</h1>
        <div class="sub">{{ mine.length }} ratings submitted</div>
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
          Showing {{ filtered.length }} of {{ mine.length }} ratings
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
              <th>Rating</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td colspan="5">
                <EmptyState
                  icon="star"
                  title="No ratings yet"
                  text="Submit your first rating to see it here."
                />
              </td>
            </tr>
            <tr v-for="r in pageRows" :key="r.id">
              <td>{{ fmtDate(r.date) }}</td>
              <td><b>{{ r.teacher }}</b></td>
              <td class="muted">{{ r.course }}</td>
              <td>
                <RatingBadge :rating="r.performance_rating" kind="performance" show-label />
              </td>
              <td class="muted" style="max-width:320px">{{ r.comments || '—' }}</td>
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
  </div>
</template>