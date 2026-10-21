import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMessagesStore } from './messages'
import { useSettingsStore } from './settings'

const KEY = 'tms_disputes'

function load() {
  try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : [] }
  catch { return [] }
}
function save(value) {
  try { localStorage.setItem(KEY, JSON.stringify(value)) } catch {}
}

export const useDisputesStore = defineStore('disputes', () => {
  const disputes = ref(load())

  const pendingDisputes  = computed(() => disputes.value.filter(d => d.status === 'pending'))
  const resolvedDisputes = computed(() => disputes.value.filter(d => d.status === 'resolved'))
  const rejectedDisputes = computed(() => disputes.value.filter(d => d.status === 'rejected'))

  function disputesForTeacher(teacherId) {
    return disputes.value
      .filter(d => d.teacherId === +teacherId)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
  }

  function disputesForDept(dept) {
    return disputes.value
      .filter(d => !dept || d.department === dept)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
  }

  function submitDispute({
    reportId, teacherId, teacherName, department,
    reportDate, reportSummary, reason
  }) {
    const row = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      reportId,
      teacherId,
      teacherName,
      department,
      reportDate,
      reportSummary,
      reason,
      status: 'pending',
      resolution: '',
      submittedAt: new Date().toISOString(),
      resolvedBy: ''
    }
    disputes.value.unshift(row)
    save(disputes.value)

    try {
      useMessagesStore().pushNotification(
        'dept_head', 'dispute',
        `New dispute from ${teacherName}`,
        'warning',
        { department }
      )
    } catch {}

    try {
      useSettingsStore().audit(
        'Submit Dispute', 'Teacher Portal',
        `${teacherName} disputed report #${reportId}`
      )
    } catch {}

    return row
  }

  function resolveDispute(id, { status, resolution, resolverName }) {
    const idx = disputes.value.findIndex(d => String(d.id) === String(id))
    if (idx < 0) return null

    const d = disputes.value[idx]
    disputes.value[idx] = {
      ...d,
      status,
      resolution,
      resolvedBy: resolverName,
      resolvedAt: new Date().toISOString()
    }
    save(disputes.value)

    try {
      useMessagesStore().pushNotification(
        'teacher', 'dispute',
        `Your dispute was ${status}`,
        status === 'resolved' ? 'success' : 'danger',
        { userId: d.teacherId }
      )
    } catch {}

    try {
      useSettingsStore().audit(
        status === 'resolved' ? 'Resolve Dispute' : 'Reject Dispute',
        'Disputes',
        `#${id} for ${d.teacherName}`
      )
    } catch {}

    return disputes.value[idx]
  }

  function replaceAll(rows) {
    disputes.value = rows
    save(rows)
  }

  return {
    disputes,
    pendingDisputes, resolvedDisputes, rejectedDisputes,
    disputesForTeacher, disputesForDept,
    submitDispute, resolveDispute,
    replaceAll
  }
})