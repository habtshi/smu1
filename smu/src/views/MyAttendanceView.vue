<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import KpiCard from '@/components/common/KpiCard.vue'
import RatingBadge from '@/components/common/RatingBadge.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { fmtDate } from '@/utils/format'

const session = useSessionStore()
const reports = useReportsStore()
const alerts  = useAlertsStore()

const mine = computed(() =>
  reports.reportsForTeacher(session.userId).filter(r => r.reporter_role === 'class_rep')
)

const streak = computed(() => alerts.consecutiveAbsences(session.userId))
const rate   = computed(() => reports.attendanceRate(session.userId, 30))
const redCount = computed(() => mine.value.filter(r => r.attendance_rating === 'Red').length)

/* ---------- pagination state ---------- */
const page     = ref(1)
const pageSize = ref(10)

const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return mine.value.slice(start, start + pageSize.value)
})

function onSize(v) {
  pageSize.value = v
  page.value = 1
}

/* reset to page 1 when the data changes */
watch(mine, () => { page.value = 1 })
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>My Attendance</h1>
        <div class="sub">Attendance ratings from class representatives</div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="row g-3 mb-4">
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Attendance Rate" :value="rate !== null ? rate + '%' : '—'"
                 sub="last 30 days" icon="calendar-check" color="success" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Total Reports" :value="mine.length"
                 sub="class rep reports" icon="journal-text" color="info" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Red Ratings" :value="redCount"
                 sub="absences" icon="exclamation-triangle" color="danger" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Consecutive Absences" :value="streak"
                 :sub="streak >= 3 ? 'alert triggered' : 'current'"
                 icon="fire" :color="streak >= 3 ? 'danger' : 'info'" />
      </div>
    </div>

    <!-- Table with pagination -->
    <div class="card">
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Course</th>
              <th>Attendance</th>
              <th>Reporter</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td colspan="5">
                <EmptyState icon="calendar" title="No attendance records"
                            text="Your attendance ratings will appear here once submitted by your class representative." />
              </td>
            </tr>
            <tr v-for="r in pageRows" :key="r.id">
              <td>{{ fmtDate(r.date) }}</td>
              <td class="muted">{{ r.course }}</td>
              <td><RatingBadge :rating="r.attendance_rating" kind="attendance" /></td>
              <td>
                <span class="badge-x b-purple">
                  <i class="bi bi-person-badge"></i> Class Rep
                </span>
              </td>
              <td class="muted" style="max-width:280px">{{ r.comments || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ← THE PAGINATION BAR -->
      <Pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="mine.length"
        :sizes="[10, 25, 50, 100]"
      />
    </div>
  </div>
</template>