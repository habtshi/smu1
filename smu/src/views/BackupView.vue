<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useAlertsStore } from '@/stores/alerts'
import { useDisputesStore } from '@/stores/disputes'
import { useMessagesStore } from '@/stores/messages'
import { useSettingsStore } from '@/stores/settings'
import { useBackup } from '@/composables/useBackup'
import { useAutoBackup } from '@/composables/useAutoBackup'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { downloadJSON, fmtDateTime, fmtBytes, timeAgo } from '@/utils/format'

const directory = useDirectoryStore()
const reports   = useReportsStore()
const alerts    = useAlertsStore()
const disputes  = useDisputesStore()
const messages  = useMessagesStore()
const settings  = useSettingsStore()
const toast     = useToast()

const backup     = useBackup()
const autoBackup = useAutoBackup()

/* ══════════════════════════════════════════════════
   LIVE CLOCK — for "next run in ..." countdown
   ══════════════════════════════════════════════════ */
const now = ref(Date.now())
let clock = null
onMounted(() => { clock = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (clock) clearInterval(clock) })

/* ══════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════ */
const totalRecords = computed(() =>
  directory.users.length +
  reports.reports.length +
  disputes.disputes.length +
  alerts.alerts.length +
  messages.messages.length
)

const lastBackup  = computed(() => settings.backups[0] || null)
const currentYear = computed(() => settings.settings.academicYear || '2025/2026')

const autoCount   = computed(() => settings.backups.filter(b => b.trigger === 'auto').length)
const manualCount = computed(() => settings.backups.filter(b => b.trigger !== 'auto').length)

/* ══════════════════════════════════════════════════
   AUTO-SCHEDULE FORM (local draft)
   ══════════════════════════════════════════════════ */
const draft = ref({ ...autoBackup.config.value })

// Recompute next preview run whenever the draft changes
const previewNextRun = computed(() => {
  // Temporarily build a fake config to preview the next run
  const fake = { ...draft.value, enabled: true }
  const saved = { ...autoBackup.config.value }
  Object.assign(autoBackup.config.value, fake)
  const next = autoBackup.config.value.nextRunAt
  Object.assign(autoBackup.config.value, saved)
  // Use local calc instead
  const now = Date.now()
  const [hh, mm] = String(fake.time || '02:00').split(':').map(n => Number(n) || 0)
  const d = new Date(now)

  if (fake.frequency === 'hourly') {
    const t = new Date(now); t.setMinutes(mm, 0, 0)
    if (t <= now) t.setHours(t.getHours() + 1)
    return t.getTime()
  }
  if (fake.frequency === 'daily') {
    const t = new Date(now); t.setHours(hh, mm, 0, 0)
    if (t <= now) t.setDate(t.getDate() + 1)
    return t.getTime()
  }
  if (fake.frequency === 'weekly') {
    const t = new Date(now); t.setHours(hh, mm, 0, 0)
    const target = Number(fake.dayOfWeek) || 0
    const diff = (target - t.getDay() + 7) % 7
    t.setDate(t.getDate() + diff)
    if (t <= now) t.setDate(t.getDate() + 7)
    return t.getTime()
  }
  if (fake.frequency === 'monthly') {
    const day = Math.min(28, Math.max(1, Number(fake.dayOfMonth) || 1))
    const t = new Date(now.getFullYear(), now.getMonth(), day, hh, mm, 0, 0)
    if (t <= now) t.setMonth(t.getMonth() + 1)
    return t.getTime()
  }
  if (fake.frequency === 'custom') {
    const days = Math.max(1, Number(fake.customDays) || 7)
    const t = new Date(now); t.setHours(hh, mm, 0, 0)
    if (t <= now) t.setDate(t.getDate() + days)
    return t.getTime()
  }
  return null
})

/* Countdown display */
const countdownText = computed(() => {
  if (!draft.value.enabled) return 'Disabled'
  const next = draft.value.enabled && autoBackup.config.value.enabled
    ? autoBackup.config.value.nextRunAt
    : previewNextRun.value
  if (!next) return '—'
  const diff = Math.max(0, next - now.value)
  const s = Math.floor(diff / 1000)
  if (s < 60) return `in ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `in ${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `in ${d}d ${h % 24}h`
})

/* Human description of the schedule */
const scheduleSummary = computed(() => {
  const d = draft.value
  const t = d.time || '02:00'
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  switch (d.frequency) {
    case 'hourly':  return `Every hour at :${String(t.split(':')[1] || '00').padStart(2, '0')}`
    case 'daily':   return `Every day at ${t}`
    case 'weekly':  return `Every ${dayNames[d.dayOfWeek] || 'Monday'} at ${t}`
    case 'monthly': return `On the ${ordinal(d.dayOfMonth)} of every month at ${t}`
    case 'custom':  return `Every ${d.customDays} day${d.customDays > 1 ? 's' : ''} at ${t}`
  }
  return ''
})

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

/* Save auto-backup settings */
function saveAutoSchedule() {
  autoBackup.saveConfig({ ...draft.value })
  toast.ok('Auto-backup schedule saved')
}

function toggleEnabled() {
  draft.value.enabled = !draft.value.enabled
  autoBackup.setEnabled(draft.value.enabled)
  toast.ok(draft.value.enabled ? 'Auto-backup enabled' : 'Auto-backup disabled')
}

/* Reset draft to match config */
function revertDraft() {
  draft.value = { ...autoBackup.config.value }
}

/* Run automatic backup right now (test) */
async function runAutoNow() {
  const rec = backup.createSnapshot({
    trigger: 'auto',
    download: draft.value.download,
    label: 'Manual test of Auto'
  })
  // Update the last/next run in the config
  autoBackup.config.value.lastRunAt = new Date().toISOString()
  autoBackup.config.value.runs = [
    { at: autoBackup.config.value.lastRunAt, status: 'success' },
    ...(autoBackup.config.value.runs || []).slice(0, 19)
  ]
  autoBackup.refreshNextRun()
  toast.ok(`Auto backup #${rec.id} created`)
}

/* ══════════════════════════════════════════════════
   MANUAL BACKUP
   ══════════════════════════════════════════════════ */
const manualBusy = ref(false)

function createManualBackup() {
  manualBusy.value = true
  try {
    const rec = backup.createSnapshot({ trigger: 'manual', download: true })
    toast.ok(`Backup #${rec.id} created & downloaded`)
  } finally {
    manualBusy.value = false
  }
}

function downloadBackup(rec) {
  const data = settings.getBackupData(rec.id)
  if (!data) { toast.err('Backup data not found'); return }
  downloadJSON(data, rec.name)
  settings.audit('Download Backup', 'Backup', `Downloaded backup #${rec.id}`)
  toast.ok('Backup downloaded')
}

/* ══════════════════════════════════════════════════
   RESTORE / DELETE
   ══════════════════════════════════════════════════ */
const restoring = ref(null)
const deleting  = ref(null)

function askRestore(rec)  { restoring.value = rec }
function askDelete(rec)   { deleting.value = rec }

function confirmRestore() {
  const rec = restoring.value
  if (!rec) return
  const ok = backup.restoreSnapshot(rec.id)
  if (!ok) { toast.err('Backup data missing'); restoring.value = null; return }
  toast.ok('Backup restored — reloading…')
  restoring.value = null
  setTimeout(() => window.location.reload(), 700)
}

function confirmDelete() {
  const rec = deleting.value
  if (!rec) return
  settings.deleteBackup(rec.id)
  settings.audit('Delete Backup', 'Backup', `Deleted backup #${rec.id}`)
  toast.ok('Backup deleted')
  deleting.value = null
}
</script>

<template>
  <div>
    <!-- ═══════════ PAGE HEADER ═══════════ -->
    <div class="page-hd">
      <div>
        <h1>Backup &amp; Restore Center</h1>
        <div class="sub">Schedule automatic backups or create one manually — every snapshot is restorable</div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-primary" :disabled="manualBusy" @click="createManualBackup">
          <i class="bi bi-cloud-arrow-down-fill"></i> Create Manual Backup
        </button>
      </div>
    </div>

    <!-- ═══════════ STATS STRIP ═══════════ -->
    <div class="backup-stats">
      <div class="backup-stat">
        <div class="ico"><i class="bi bi-database-fill"></i></div>
        <div><div class="val">{{ totalRecords }}</div><div class="lbl">Records Protected</div></div>
      </div>
      <div class="backup-stat">
        <div class="ico success"><i class="bi bi-clock-history"></i></div>
        <div>
          <div class="val">{{ lastBackup ? timeAgo(lastBackup.createdAt) : 'Never' }}</div>
          <div class="lbl">Last Backup</div>
        </div>
      </div>
      <div class="backup-stat">
        <div class="ico warning"><i class="bi bi-collection-fill"></i></div>
        <div><div class="val">{{ settings.backups.length }}</div><div class="lbl">Saved Snapshots</div></div>
      </div>
      <div class="backup-stat">
        <div class="ico purple"><i class="bi bi-calendar2-check"></i></div>
        <div><div class="val">{{ currentYear }}</div><div class="lbl">Academic Year</div></div>
      </div>
    </div>

    <!-- ═══════════ AUTO-BACKUP SCHEDULE ═══════════ -->
    <div class="card mb-4" style="border:1px solid var(--brand-100);background:linear-gradient(135deg,#fff,#f5f8ff)">
      <div class="card-hd">
        <div>
          <h3><i class="bi bi-clock-fill"></i> Automatic Backup Schedule</h3>
          <div class="sub">Let the system snapshot your data automatically</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span class="badge-x" :class="draft.enabled ? 'b-green' : 'b-gray'">
            <i :class="draft.enabled ? 'bi bi-check-circle-fill' : 'bi bi-pause-circle'"></i>
            {{ draft.enabled ? 'Enabled' : 'Disabled' }}
          </span>
          <label class="switch">
            <input type="checkbox" :checked="draft.enabled" @change="toggleEnabled" />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="card-bd">
        <!-- Frequency pills -->
        <div class="form-row">
          <label>Frequency</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button
              v-for="f in [
                { v:'hourly',  l:'Hourly',  i:'clock' },
                { v:'daily',   l:'Daily',   i:'calendar-day' },
                { v:'weekly',  l:'Weekly',  i:'calendar-week' },
                { v:'monthly', l:'Monthly', i:'calendar-month' },
                { v:'custom',  l:'Custom',  i:'sliders' }
              ]"
              :key="f.v"
              class="btn btn-sm"
              :class="draft.frequency === f.v ? 'btn-primary' : 'btn-secondary'"
              @click="draft.frequency = f.v"
            >
              <i :class="`bi bi-${f.i}`"></i> {{ f.l }}
            </button>
          </div>
        </div>

        <div class="row g-3">
          <!-- Day of week (weekly) -->
          <div v-if="draft.frequency === 'weekly'" class="col-md-4">
            <div class="form-row">
              <label>Day of the week</label>
              <select v-model.number="draft.dayOfWeek" class="inp">
                <option :value="0">Sunday</option>
                <option :value="1">Monday</option>
                <option :value="2">Tuesday</option>
                <option :value="3">Wednesday</option>
                <option :value="4">Thursday</option>
                <option :value="5">Friday</option>
                <option :value="6">Saturday</option>
              </select>
            </div>
          </div>

          <!-- Day of month (monthly) -->
          <div v-if="draft.frequency === 'monthly'" class="col-md-4">
            <div class="form-row">
              <label>Day of the month</label>
              <input v-model.number="draft.dayOfMonth" type="number" min="1" max="28" class="inp" />
            </div>
          </div>

          <!-- Custom days -->
          <div v-if="draft.frequency === 'custom'" class="col-md-4">
            <div class="form-row">
              <label>Every N days</label>
              <input v-model.number="draft.customDays" type="number" min="1" max="90" class="inp" />
            </div>
          </div>

          <!-- Time picker -->
          <div v-if="draft.frequency !== 'hourly'" class="col-md-4">
            <div class="form-row">
              <label>Time of day</label>
              <input v-model="draft.time" type="time" class="inp" />
            </div>
          </div>

          <!-- Hourly minute picker -->
          <div v-else class="col-md-4">
            <div class="form-row">
              <label>Minute past the hour</label>
              <input v-model="draft.time" type="time" class="inp" />
            </div>
          </div>

          <!-- Keep last N -->
          <div class="col-md-4">
            <div class="form-row">
              <label>Keep last N backups</label>
              <input v-model.number="draft.keepLast" type="number" min="3" max="50" class="inp" />
            </div>
          </div>
        </div>

        <!-- Download toggle -->
        <div class="setting-row" style="padding:12px 0">
          <div class="info">
            <h4>Auto-download .json file</h4>
            <p>Automatically download the backup file to your computer when it runs.</p>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="draft.download" />
            <span class="slider"></span>
          </label>
        </div>

        <!-- Preview + actions -->
        <div class="row g-3 mt-2">
          <div class="col-md-6">
            <div style="padding:14px 16px;background:var(--ink-25);border-radius:12px;border:1px solid var(--border)">
              <div style="font-size:11.5px;font-weight:700;color:var(--ink-400);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px">
                Schedule Preview
              </div>
              <div style="font-size:14px;font-weight:700;color:var(--ink-900)">
                {{ scheduleSummary || '—' }}
              </div>
              <div style="font-size:12.5px;color:var(--ink-500);margin-top:6px">
                <i class="bi bi-arrow-repeat"></i>
                Next run: <b>{{ countdownText }}</b>
              </div>
            </div>
          </div>
          <div class="col-md-6" style="display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" @click="revertDraft">
              <i class="bi bi-arrow-counterclockwise"></i> Reset Form
            </button>
            <button class="btn btn-secondary btn-sm" @click="runAutoNow">
              <i class="bi bi-play-fill"></i> Run Now (test)
            </button>
            <button class="btn btn-primary btn-sm" @click="saveAutoSchedule">
              <i class="bi bi-check2"></i> Save Schedule
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ BACKUP HISTORY ═══════════ -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-archive-fill"></i> Backup History</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="badge-x b-brand">{{ settings.backups.length }} total</span>
          <span class="badge-x b-green">{{ manualCount }} manual</span>
          <span class="badge-x b-amber">{{ autoCount }} auto</span>
        </div>
      </div>

      <div v-if="!settings.backups.length">
        <EmptyState icon="database" title="No backups yet"
                    text="Create your first protected snapshot to get started." />
      </div>

      <div v-else class="backup-list">
        <div v-for="b in settings.backups" :key="b.id" class="backup-list-item">
          <div class="b-icon" :class="{ auto: b.trigger === 'auto' }">
            <i :class="b.trigger === 'auto' ? 'bi bi-clock-history' : 'bi bi-file-earmark-zip-fill'"></i>
          </div>
          <div class="b-info">
            <div class="b-title">
              {{ b.name }}
              <span class="badge-x" :class="b.trigger === 'auto' ? 'b-amber' : 'b-brand'">
                <i :class="b.trigger === 'auto' ? 'bi bi-clock-history' : 'bi bi-hand-index-thumb'"></i>
                {{ b.trigger === 'auto' ? 'Auto' : 'Manual' }}
              </span>
              <span class="badge-x b-green">
                <i class="bi bi-check-circle-fill"></i> {{ b.status || 'completed' }}
              </span>
            </div>
            <div class="b-meta">
              <span><i class="bi bi-calendar-event"></i> {{ fmtDateTime(b.createdAt) }}</span>
              <span><i class="bi bi-hdd"></i> {{ fmtBytes(b.size) }}</span>
              <span><i class="bi bi-mortarboard"></i> {{ b.year }}</span>
              <span><i class="bi bi-people"></i> {{ b.records?.users || 0 }} users</span>
              <span><i class="bi bi-journal-text"></i> {{ b.records?.reports || 0 }} reports</span>
            </div>
          </div>
          <div class="b-actions">
            <button class="btn btn-secondary btn-sm" @click="downloadBackup(b)">
              <i class="bi bi-download"></i> Download
            </button>
            <button class="btn btn-primary btn-sm" @click="askRestore(b)">
              <i class="bi bi-arrow-counterclockwise"></i> Restore
            </button>
            <button class="btn btn-danger btn-sm" @click="askDelete(b)" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ RESTORE CONFIRM ═══════════ -->
    <ConfirmDialog v-if="restoring"
                   title="Restore Backup"
                   confirm-label="Yes, Restore"
                   danger
                   @cancel="restoring = null"
                   @confirm="confirmRestore">
      Restore the system from <b>{{ restoring.name }}</b>? This will overwrite the current users, reports,
      disputes, alerts, and settings. The audit trail is preserved.
    </ConfirmDialog>

    <!-- ═══════════ DELETE CONFIRM ═══════════ -->
    <ConfirmDialog v-if="deleting"
                   title="Delete Backup"
                   confirm-label="Delete"
                   danger
                   @cancel="deleting = null"
                   @confirm="confirmDelete">
      Delete snapshot <b>{{ deleting.name }}</b>? This cannot be undone.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.backup-list-item .b-icon.auto {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  box-shadow: 0 4px 12px rgba(217, 119, 6, .25);
}
</style>