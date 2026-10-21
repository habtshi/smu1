<script setup>
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useReportsStore } from '@/stores/reports'
import { useDisputesStore } from '@/stores/disputes'
import Modal from '@/components/common/Modal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { fmtDate } from '@/utils/format'

const session  = useSessionStore()
const reports  = useReportsStore()
const disputes = useDisputesStore()
const toast    = useToast()

/* ---------- my disputes ---------- */
const mine = computed(() => disputes.disputesForTeacher(session.userId))

/* ---------- report options ---------- */
const myReports = computed(() =>
  reports.reportsForTeacher(session.userId)
    .filter(r => !r.is_self)
    .slice(0, 30)
)

/* ---------- create modal ---------- */
const open       = ref(false)
const reportId   = ref('')
const reason     = ref('')
const submitting = ref(false)

function openModal() {
  reportId.value = ''
  reason.value = ''
  open.value = true
}

function submit() {
  if (!reportId.value) { toast.err('Please select a report'); return }
  if (!reason.value.trim()) { toast.err('Please enter a reason'); return }

  const rep = myReports.value.find(r => r.id === +reportId.value)
  if (!rep) { toast.err('Report not found'); return }

  disputes.submitDispute({
    reportId: rep.id,
    teacherId: session.userId,
    teacherName: session.user?.name,
    department: session.department,
    reportDate: rep.date,
    reportSummary: `${rep.course} · attendance ${rep.attendance_rating || '—'}`,
    reason: reason.value.trim()
  })

  toast.ok('Dispute submitted — your Department Head will review it')
  open.value = false
}

function pillFor(status) {
  return {
    pending:  { cls: 'alert-warning',  label: 'Pending',  icon: 'hourglass-split' },
    resolved: { cls: 'alert-resolved', label: 'Resolved', icon: 'check2-circle' },
    rejected: { cls: 'alert-critical', label: 'Rejected', icon: 'x-circle' }
  }[status] || { cls: 'b-gray', label: status, icon: 'circle' }
}
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>Disputes</h1>
        <div class="sub">Submit and track disputes for ratings you consider unfair</div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-primary btn-sm" @click="openModal">
          <i class="bi bi-plus-circle"></i> New Dispute
        </button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="row g-3 mb-4">
      <div class="col-xl-4 col-md-6">
        <div class="kpi">
          <div class="kpi-top">
            <div>
              <div class="kpi-label">Pending</div>
              <div class="kpi-val">{{ mine.filter(d => d.status === 'pending').length }}</div>
            </div>
            <div class="kpi-ico warning"><i class="bi bi-hourglass-split"></i></div>
          </div>
          <div class="kpi-meta"><span>awaiting review</span></div>
        </div>
      </div>
      <div class="col-xl-4 col-md-6">
        <div class="kpi">
          <div class="kpi-top">
            <div>
              <div class="kpi-label">Resolved</div>
              <div class="kpi-val">{{ mine.filter(d => d.status === 'resolved').length }}</div>
            </div>
            <div class="kpi-ico success"><i class="bi bi-check2-circle"></i></div>
          </div>
          <div class="kpi-meta"><span>accepted</span></div>
        </div>
      </div>
      <div class="col-xl-4 col-md-6">
        <div class="kpi">
          <div class="kpi-top">
            <div>
              <div class="kpi-label">Rejected</div>
              <div class="kpi-val">{{ mine.filter(d => d.status === 'rejected').length }}</div>
            </div>
            <div class="kpi-ico danger"><i class="bi bi-x-circle"></i></div>
          </div>
          <div class="kpi-meta"><span>not accepted</span></div>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-chat-square-text"></i> My Disputes</h3>
        <span class="badge-x b-brand">{{ mine.length }}</span>
      </div>

      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Submitted</th>
              <th>Report Date</th>
              <th>Report Summary</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Resolution</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!mine.length">
              <td colspan="6">
                <EmptyState icon="chat-square-text" title="No disputes submitted"
                            text="Use the button above to dispute a rating you believe is unfair." />
              </td>
            </tr>
            <tr v-for="d in mine" :key="d.id">
              <td>{{ fmtDate(d.submittedAt) }}</td>
              <td>{{ fmtDate(d.reportDate) }}</td>
              <td class="muted">{{ d.reportSummary }}</td>
              <td style="max-width:300px">{{ d.reason }}</td>
              <td>
                <span class="alert-pill" :class="pillFor(d.status).cls">
                  <i :class="`bi bi-${pillFor(d.status).icon}`"></i>
                  {{ pillFor(d.status).label }}
                </span>
              </td>
              <td class="muted">{{ d.resolution || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create modal -->
    <Modal v-if="open" title="Submit New Dispute" @close="open = false">
      <div class="form-row">
        <label>Select the report you want to dispute <span class="req">*</span></label>
        <select v-model="reportId" class="inp">
          <option value="">Choose a report…</option>
          <option v-for="r in myReports" :key="r.id" :value="r.id">
            {{ fmtDate(r.date) }} · {{ r.course }} · attendance {{ r.attendance_rating || '—' }}
          </option>
        </select>
      </div>

      <div class="form-row">
        <label>Reason for dispute <span class="req">*</span></label>
        <textarea v-model="reason" class="inp" rows="4"
                  placeholder="Explain the circumstances…"></textarea>
      </div>

      <div class="alert-pill alert-warning" style="display:inline-flex;padding:10px 12px">
        <i class="bi bi-info-circle-fill"></i>
        <span style="margin-left:6px">Your dispute will be reviewed by your Department Head.</span>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="open = false">Cancel</button>
        <button class="btn btn-primary btn-sm" :disabled="submitting" @click="submit">
          <i class="bi bi-send"></i> Submit Dispute
        </button>
      </template>
    </Modal>
  </div>
</template>