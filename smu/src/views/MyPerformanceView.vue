<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useReportsStore } from '@/stores/reports'
import KpiCard from '@/components/common/KpiCard.vue'
import RatingBadge from '@/components/common/RatingBadge.vue'
import ChartBox from '@/components/common/ChartBox.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { fmtDate } from '@/utils/format'

const session = useSessionStore()
const reports = useReportsStore()

/* ---------- all feedback about me ---------- */
const all      = computed(() => reports.reportsForTeacher(session.userId))
const clsRep   = computed(() => all.value.filter(r => r.reporter_role === 'class_rep' && r.performance_rating))
const students = computed(() => all.value.filter(r => r.reporter_role === 'student' && r.performance_rating))
const selfReps = computed(() => all.value.filter(r => r.is_self && r.performance_rating))
const perfAll  = computed(() => all.value.filter(r => r.performance_rating))

const avg = computed(() => reports.avgPerformance(session.userId))

/* ---------- pagination ---------- */
const page     = ref(1)
const pageSize = ref(10)

const pageRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return perfAll.value.slice(start, start + pageSize.value)
})

function onSize(v) {
  pageSize.value = v
  page.value = 1
}

watch(perfAll, () => { page.value = 1 })

/* ---------- chart: rating distribution ---------- */
const mixConfig = computed(() => {
  const mix = { Green: 0, Blue: 0, Yellow: 0, Red: 0 }
  perfAll.value.forEach(r => {
    if (mix[r.performance_rating] !== undefined) mix[r.performance_rating]++
  })
  return {
    type: 'doughnut',
    data: {
      labels: ['Green (Excellent)', 'Blue (Good)', 'Yellow (Needs Improvement)', 'Red (Not Delivered)'],
      datasets: [{
        data: [mix.Green, mix.Blue, mix.Yellow, mix.Red],
        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
        borderWidth: 0, hoverOffset: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '66%',
      plugins: { legend: { position: 'bottom' } }
    }
  }
})

/* ---------- chart: by source ---------- */
const sourceConfig = computed(() => {
  const labels = ['Green', 'Blue', 'Yellow']
  const srcRep = labels.map(r => clsRep.value.filter(x => x.performance_rating === r).length)
  const srcStu = labels.map(r => students.value.filter(x => x.performance_rating === r).length)

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Class Rep', data: srcRep, backgroundColor: '#7c3aed', borderRadius: 8, maxBarThickness: 40 },
        { label: 'Students',  data: srcStu, backgroundColor: '#3b82f6', borderRadius: 8, maxBarThickness: 40 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', align: 'end' } },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(148,163,184,.15)' } },
        x: { grid: { display: false } }
      }
    }
  }
})
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>My Performance</h1>
        <div class="sub">Feedback from students and class representatives</div>
      </div>
    </div>

    <!-- KPIs -->
    <div class="row g-3 mb-4">
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Avg Performance" :value="avg !== null ? avg.toFixed(2) + '/5' : '—'"
                 sub="external feedback" icon="star-half" color="brand" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Class Rep Ratings" :value="clsRep.length"
                 sub="from representatives" icon="person-badge" color="purple" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Student Ratings" :value="students.length"
                 sub="from students" icon="people" color="info" />
      </div>
      <div class="col-xl-3 col-md-6">
        <KpiCard label="Self Reports" :value="selfReps.length"
                 sub="excluded from average" icon="pencil-square" color="warning" />
      </div>
    </div>

    <!-- Charts -->
    <div class="row g-3 mb-4">
      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd"><h3><i class="bi bi-pie-chart"></i> Rating Distribution</h3></div>
          <div class="card-bd"><ChartBox :config="mixConfig" /></div>
        </div>
      </div>
      <div class="col-xl-6">
        <div class="card h-100">
          <div class="card-hd"><h3><i class="bi bi-bar-chart"></i> By Rating Source</h3></div>
          <div class="card-bd"><ChartBox :config="sourceConfig" /></div>
        </div>
      </div>
    </div>

    <!-- Table with pagination -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-chat-dots"></i> All Feedback</h3>
        <span class="badge-x b-brand">{{ perfAll.length }} records</span>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Date</th>
              <th>Course</th>
              <th>Performance</th>
              <th>Source</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!pageRows.length">
              <td colspan="5">
                <EmptyState icon="chat-dots" title="No feedback yet"
                            text="Performance ratings will appear here once students or class reps submit them." />
              </td>
            </tr>
            <tr v-for="r in pageRows" :key="r.id">
              <td>{{ fmtDate(r.date) }}</td>
              <td class="muted">{{ r.course }}</td>
              <td><RatingBadge :rating="r.performance_rating" kind="performance" show-label /></td>
              <td>
                <span class="badge-x"
                      :class="r.is_self ? 'b-amber' : r.reporter_role === 'student' ? 'b-blue' : 'b-purple'">
                  <i :class="r.is_self ? 'bi bi-person' : r.reporter_role === 'student' ? 'bi bi-mortarboard' : 'bi bi-person-badge'"></i>
                  {{ r.is_self ? 'Self' : r.reporter_role === 'student' ? 'Student' : 'Class Rep' }}
                </span>
              </td>
              <td class="muted" style="max-width:340px">{{ r.comments || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ← THE PAGINATION BAR -->
      <Pagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="perfAll.length"
        :sizes="[10, 25, 50, 100]"
      />
    </div>
  </div>
</template>