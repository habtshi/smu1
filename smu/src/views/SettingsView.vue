<script setup>
import { ref, computed } from 'vue'
import { useDirectoryStore } from '@/stores/directory'
import { useReportsStore } from '@/stores/reports'
import { useDisputesStore } from '@/stores/disputes'
import { useAlertsStore } from '@/stores/alerts'
import { useMessagesStore } from '@/stores/messages'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { useSessionStore } from '@/stores/session'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'
import { exportCSV } from '@/utils/format'
import { NAV } from '@/utils/constants'

const directory = useDirectoryStore()
const reports   = useReportsStore()
const disputes  = useDisputesStore()
const alerts    = useAlertsStore()
const messages  = useMessagesStore()
const settings  = useSettingsStore()
const ui        = useUiStore()
const session   = useSessionStore()
const toast     = useToast()

/* ---------- tabs ---------- */
const activeTab = ref('general')

const tabs = [
  { id: 'general',     label: 'General',      icon: 'sliders' },
  { id: 'features',    label: 'Features',     icon: 'grid-3x3-gap-fill' },
  { id: 'security',    label: 'Security',     icon: 'shield-lock' },
  { id: 'behavior',    label: 'Behavior',     icon: 'toggle-on' },
  { id: 'maintenance', label: 'Maintenance',  icon: 'tools' }
]

/* ---------- local form ---------- */
const form = ref({
  ...settings.settings,
  featureFlags: { ...(settings.settings.featureFlags || {}) }
})
const originalForm = ref(JSON.stringify(form.value))

const hasChanges = computed(() => JSON.stringify(form.value) !== originalForm.value)

function saveSettings() {
  settings.saveSettings(form.value)
  settings.audit('Update Settings', 'System', 'System settings updated')
  originalForm.value = JSON.stringify(form.value)
  toast.ok('Settings saved')
}

function resetForm() {
  form.value = { ...settings.settings, featureFlags: { ...(settings.settings.featureFlags || {}) } }
}

function resetToDefaults() {
  if (!confirm('Reset all settings to their default values?')) return
  settings.resetSettings()
  form.value = { ...settings.settings, featureFlags: {} }
  originalForm.value = JSON.stringify(form.value)
  toast.warn('Settings reset to defaults')
}

/* ---------- KPIs ---------- */
const stats = computed(() => ({
  users:         directory.users.length,
  reports:       reports.reports.length,
  departments:   directory.departments.length,
  auditEntries:  settings.auditLog.length
}))

/* ---------- danger zone ---------- */
const clearingAudit = ref(false)
const factoryReset  = ref(false)

function confirmClearAudit() {
  settings.clearAudit()
  settings.audit('Clear Audit Log', 'System', 'All audit entries cleared')
  toast.warn('Audit log cleared')
  clearingAudit.value = false
}

function confirmFactoryReset() {
  settings.factoryReset()
  session.clear()
  toast.warn('System reset — reloading…')
  setTimeout(() => window.location.reload(), 700)
}

/* ---------- maintenance ---------- */
function recomputeAlerts() {
  alerts.recompute()
  settings.audit('Recompute Alerts', 'System', 'Alert list rebuilt')
  toast.ok('Alerts recomputed')
}

function clearTokens() {
  localStorage.removeItem('tms_resetTokens')
  settings.audit('Clear Reset Tokens', 'System', 'All password reset tokens invalidated')
  toast.ok('Reset tokens cleared')
}

function clearLockouts() {
  localStorage.removeItem('tms_loginLockout')
  settings.audit('Clear Lockouts', 'System', 'All login lockouts cleared')
  toast.ok('Login lockouts cleared')
}

/* ---------- exports ---------- */
function exportUsers() {
  exportCSV(directory.users.map(u => ({
    Name: u.name, Username: u.username, Role: u.role,
    Department: u.department, Email: u.email, Phone: u.phone || ''
  })), 'all-users')
  toast.ok('Export started')
}

function exportReports() {
  exportCSV(reports.reports.map(r => ({
    Date: r.date, Teacher: r.teacher, Department: r.department, Course: r.course,
    Attendance: r.attendance_rating || '', Performance: r.performance_rating || '',
    Reporter: r.reporter, Source: r.reporter_role, Comment: r.comments
  })), 'all-reports')
  toast.ok('Export started')
}

function exportAudit() {
  exportCSV(settings.auditLog.map(l => ({
    Timestamp: l.timestamp, User: l.user, Role: l.role,
    Action: l.action, Module: l.module, Detail: l.detail, IP: l.ip
  })), 'audit-log')
  toast.ok('Export started')
}

function exportSettings() {
  const blob = new Blob([JSON.stringify(settings.settings, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'tms-settings.json'
  a.click()
  URL.revokeObjectURL(url)
  toast.ok('Settings exported')
}

/* ---------- counters ---------- */
const resetTokenCount = computed(() => {
  try {
    const map = JSON.parse(localStorage.getItem('tms_resetTokens') || '{}')
    return Object.keys(map).length
  } catch { return 0 }
})

const lockedCount = computed(() => {
  try {
    const map = JSON.parse(localStorage.getItem('tms_loginLockout') || '{}')
    return Object.keys(map).length
  } catch { return 0 }
})

/* ══════════════════════════════════════════════════
   FEATURE FLAGS — turn pages ON / OFF
   ══════════════════════════════════════════════════ */
const FEATURE_GROUPS = computed(() => {
  const seen = new Set()
  const groups = []

  Object.values(NAV).forEach(sections => {
    sections.forEach(sec => {
      sec.items.forEach(([id, label, icon]) => {
        if (seen.has(id)) return
        seen.add(id)
        let grp = groups.find(g => g.name === sec.section)
        if (!grp) { grp = { name: sec.section, items: [] }; groups.push(grp) }
        grp.items.push({ id, label, icon })
      })
    })
  })

  return groups
})

function featureOn(id) {
  return form.value.featureFlags?.[id] !== false
}

function toggleFeatureFlag(id, enabled) {
  const next = { ...(form.value.featureFlags || {}) }
  next[id] = !!enabled
  form.value = { ...form.value, featureFlags: next }
}

function resetFeatureFlags() {
  form.value = { ...form.value, featureFlags: {} }
}

const disabledFeatureCount = computed(() =>
  Object.values(form.value.featureFlags || {}).filter(v => v === false).length
)

/* ══════════════════════════════════════════════════
   🆕 ALERT THRESHOLDS (editable numbers)
   ══════════════════════════════════════════════════ */
const deptHeadThreshold = computed({
  get: () => Number(form.value.alertThresholdDeptHead) || 3,
  set: (v) => {
    const n = Math.max(1, Math.min(10, Number(v) || 3))
    form.value.alertThresholdDeptHead = n
    /* Ensure admin threshold is always greater */
    if (Number(form.value.alertThresholdAdmin) <= n) {
      form.value.alertThresholdAdmin = n + 1
    }
  }
})

const adminThreshold = computed({
  get: () => Number(form.value.alertThresholdAdmin) || 5,
  set: (v) => {
    const min = (Number(form.value.alertThresholdDeptHead) || 3) + 1
    const n = Math.max(min, Math.min(15, Number(v) || 5))
    form.value.alertThresholdAdmin = n
  }
})

/* ══════════════════════════════════════════════════
   🆕 DEFAULT LANDING PAGE
   ══════════════════════════════════════════════════ */
const LANDING_OPTIONS = [
  { id: 'dashboard',         label: 'Dashboard',          icon: 'speedometer2' },
  { id: 'teachers',          label: 'Teachers',           icon: 'person-video3' },
  { id: 'alerts',            label: 'Alerts',             icon: 'bell' },
  { id: 'reports',           label: 'Reports',            icon: 'file-earmark-text' },
  { id: 'attendance-intel',  label: 'Attendance Intel',   icon: 'calendar3' },
  { id: 'performance-intel', label: 'Performance Intel',  icon: 'graph-up-arrow' }
]
</script>

<template>
  <div>
    <!-- ═══════════ PAGE HEADER ═══════════ -->
    <div class="page-hd">
      <div>
        <h1>
          System Settings
          <span v-if="hasChanges" class="unsaved-pill">
            <i class="bi bi-exclamation-circle-fill"></i> Unsaved changes
          </span>
        </h1>
        <div class="sub">Configuration, security, appearance, and maintenance</div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-ghost btn-sm" @click="exportSettings">
          <i class="bi bi-download"></i> Export settings
        </button>
        <button class="btn btn-secondary btn-sm" :disabled="!hasChanges" @click="resetForm">
          <i class="bi bi-arrow-counterclockwise"></i> Reset form
        </button>
        <button class="btn btn-primary btn-sm" :disabled="!hasChanges" @click="saveSettings">
          <i class="bi bi-check2"></i> Save Settings
        </button>
      </div>
    </div>

    <!-- ═══════════ KPI STRIP ═══════════ -->
    <div class="kpi-strip">
      <div class="ks-card">
        <div class="ks-ico brand"><i class="bi bi-people-fill"></i></div>
        <div>
          <div class="ks-val">{{ stats.users }}</div>
          <div class="ks-lbl">Total Users</div>
        </div>
      </div>
      <div class="ks-card">
        <div class="ks-ico success"><i class="bi bi-journal-text"></i></div>
        <div>
          <div class="ks-val">{{ stats.reports }}</div>
          <div class="ks-lbl">Reports</div>
        </div>
      </div>
      <div class="ks-card">
        <div class="ks-ico info"><i class="bi bi-building"></i></div>
        <div>
          <div class="ks-val">{{ stats.departments }}</div>
          <div class="ks-lbl">Departments</div>
        </div>
      </div>
      <div class="ks-card">
        <div class="ks-ico purple"><i class="bi bi-shield-check"></i></div>
        <div>
          <div class="ks-val">{{ stats.auditEntries }}</div>
          <div class="ks-lbl">Audit Entries</div>
        </div>
      </div>
    </div>

    <!-- ═══════════ TABS ═══════════ -->
    <div class="settings-tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="st-btn"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
      >
        <i :class="`bi bi-${t.icon}`"></i>
        {{ t.label }}
      </button>
    </div>

    <!-- ═══════════════════════════════════════════════════
         GENERAL TAB
         ═══════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'general'">

      <!-- Appearance -->
      <div class="card setting-card">
        <div class="setting-card-hd">
          <div class="sch-ico" style="background: linear-gradient(135deg, #a855f7, #7c3aed)">
            <i class="bi bi-palette-fill"></i>
          </div>
          <div>
            <h3>Appearance</h3>
            <p>Theme and visual preferences</p>
          </div>
        </div>
        <div class="setting-card-bd">
          <div class="setting-row">
            <div class="info">
              <h4><i class="bi bi-moon-stars-fill"></i> Dark Mode</h4>
              <p>Switch between light and dark theme. Preference is saved locally.</p>
            </div>
            <label class="switch">
              <input type="checkbox" :checked="ui.darkMode" @change="ui.toggleDarkMode()" />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Organization -->
      <div class="card setting-card">
        <div class="setting-card-hd">
          <div class="sch-ico" style="background: linear-gradient(135deg, #4f6df5, #2a3fae)">
            <i class="bi bi-building-fill"></i>
          </div>
          <div>
            <h3>Organization</h3>
            <p>Institution identity and time settings</p>
          </div>
        </div>
        <div class="setting-card-bd">
          <div class="setting-row">
            <div class="info">
              <h4>Organization Name</h4>
              <p>Displayed on login and reports.</p>
            </div>
            <input v-model="form.orgName" class="inp" style="max-width: 320px" />
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Timezone</h4>
              <p>Used for all timestamps.</p>
            </div>
            <input v-model="form.timezone" class="inp" style="max-width: 320px" />
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Working Days</h4>
              <p>Used for attendance calculations.</p>
            </div>
            <input v-model="form.workingDays" class="inp" style="max-width: 320px" />
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Academic Year</h4>
              <p>Current academic period.</p>
            </div>
            <input v-model="form.academicYear" class="inp" style="max-width: 320px" />
          </div>
        </div>
      </div>

      <!-- 🆕 Academic Term -->
      <div class="card setting-card">
        <div class="setting-card-hd">
          <div class="sch-ico" style="background: linear-gradient(135deg, #0ea5a4, #0d9488)">
            <i class="bi bi-calendar2-range"></i>
          </div>
          <div>
            <h3>Academic Term</h3>
            <p>Semester dates and default landing page</p>
          </div>
        </div>
        <div class="setting-card-bd">
          <div class="setting-row">
            <div class="info">
              <h4>Current Semester</h4>
              <p>Which semester is currently active.</p>
            </div>
            <select v-model="form.semester" class="inp" style="max-width: 220px">
              <option value="Semester I">Semester I</option>
              <option value="Semester II">Semester II</option>
              <option value="Summer">Summer</option>
            </select>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Term Start Date</h4>
              <p>Beginning of the current term.</p>
            </div>
            <input v-model="form.termStart" type="date" class="inp" style="max-width: 220px" />
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Term End Date</h4>
              <p>End of the current term.</p>
            </div>
            <input v-model="form.termEnd" type="date" class="inp" style="max-width: 220px" />
          </div>

          <div class="setting-row">
            <div class="info">
              <h4><i class="bi bi-house-door-fill"></i> Default Landing Page</h4>
              <p>Page shown after login for admins &amp; department heads.</p>
            </div>
            <select v-model="form.defaultLanding" class="inp" style="max-width: 240px">
              <option v-for="opt in LANDING_OPTIONS" :key="opt.id" :value="opt.id">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         FEATURES TAB
         ═══════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'features'">

      <!-- Info banner -->
      <div class="card setting-card" style="background:linear-gradient(135deg,#eef4ff,#f5f3ff);border-color:var(--brand-100)">
        <div class="setting-card-bd" style="padding:18px 22px">
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <div style="width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#4f6df5,#7c3aed);color:#fff;display:grid;place-items:center;font-size:20px;flex:none">
              <i class="bi bi-info-circle-fill"></i>
            </div>
            <div style="flex:1;min-width:240px">
              <b style="font-size:14px">Turn pages ON / OFF system-wide</b>
              <p class="muted" style="font-size:12.5px;margin:4px 0 0;line-height:1.55">
                Disabled pages disappear from every sidebar and cannot be accessed. Changes apply after you click Save.
              </p>
            </div>
            <div style="text-align:right;flex:none">
              <div style="font-family:'JetBrains Mono',monospace;font-size:22px;font-weight:800;color:var(--danger);line-height:1">
                {{ disabledFeatureCount }}
              </div>
              <div class="t-xs muted" style="text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-top:4px">
                disabled
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature groups -->
      <div v-for="grp in FEATURE_GROUPS" :key="grp.name" class="card setting-card">
        <div class="setting-card-hd">
          <div class="sch-ico" style="background:linear-gradient(135deg,#4f6df5,#2a3fae)">
            <i class="bi bi-grid-3x3-gap-fill"></i>
          </div>
          <div style="flex:1">
            <h3>{{ grp.name }}</h3>
            <p>{{ grp.items.length }} page{{ grp.items.length === 1 ? '' : 's' }}</p>
          </div>
          <span class="badge-x"
                :class="grp.items.filter(i => featureOn(i.id)).length === grp.items.length ? 'b-green' : 'b-amber'">
            {{ grp.items.filter(i => featureOn(i.id)).length }} / {{ grp.items.length }} on
          </span>
        </div>
        <div class="setting-card-bd">
          <div v-for="item in grp.items" :key="item.id" class="feature-row">
            <div class="feature-icon" :class="{ off: !featureOn(item.id) }">
              <i :class="`bi bi-${item.icon}`"></i>
            </div>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column">
              <b style="font-size:13.5px;color:var(--ink-900)">{{ item.label }}</b>
              <span class="mono t-xs muted">{{ item.id }}</span>
            </div>
            <span class="badge-x" :class="featureOn(item.id) ? 'b-green' : 'b-gray'">
              <i :class="featureOn(item.id) ? 'bi bi-check-circle-fill' : 'bi bi-x-circle'"></i>
              {{ featureOn(item.id) ? 'Enabled' : 'Disabled' }}
            </span>
            <label class="switch">
              <input type="checkbox"
                     :checked="featureOn(item.id)"
                     @change="toggleFeatureFlag(item.id, $event.target.checked)" />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Reset -->
      <div v-if="disabledFeatureCount" style="display:flex;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-warning btn-sm" @click="resetFeatureFlags">
          <i class="bi bi-arrow-counterclockwise"></i> Enable all pages
        </button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         SECURITY TAB
         ═══════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'security'">
      <div class="card setting-card">
        <div class="setting-card-hd">
          <div class="sch-ico" style="background: linear-gradient(135deg, #dc2626, #ef4444)">
            <i class="bi bi-shield-lock-fill"></i>
          </div>
          <div>
            <h3>Security &amp; Retention</h3>
            <p>Password policy, session timeout, and data retention</p>
          </div>
        </div>
        <div class="setting-card-bd">
          <div class="setting-row">
            <div class="info">
              <h4>Password Policy</h4>
              <p>Minimum password requirements.</p>
            </div>
            <input v-model="form.passwordPolicy" class="inp" style="max-width: 320px" />
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Session Timeout</h4>
              <p>Idle time before logout (minutes).</p>
            </div>
            <input v-model.number="form.sessionTimeout" type="number" class="inp mono" style="max-width: 120px" />
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Data Retention</h4>
              <p>How long reports and logs are kept.</p>
            </div>
            <input v-model="form.dataRetention" class="inp" style="max-width: 320px" />
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Active Password Reset Tokens</h4>
              <p>Pending reset links.</p>
            </div>
            <span class="badge-x b-amber">
              <i class="bi bi-key-fill"></i> {{ resetTokenCount }} pending
            </span>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Locked Accounts</h4>
              <p>Accounts locked after 5 failed login attempts.</p>
            </div>
            <div style="display: flex; gap: 8px; align-items: center">
              <span class="badge-x" :class="lockedCount ? 'b-red' : 'b-green'">
                <i class="bi bi-lock-fill"></i> {{ lockedCount }} locked
              </span>
              <button class="btn btn-warning btn-xs" @click="clearLockouts">
                <i class="bi bi-unlock"></i> Clear all
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         BEHAVIOR TAB
         ═══════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'behavior'">

      <!-- 🆕 Alert Thresholds -->
      <div class="card setting-card">
        <div class="setting-card-hd">
          <div class="sch-ico" style="background: linear-gradient(135deg, #dc2626, #ef4444)">
            <i class="bi bi-bell-fill"></i>
          </div>
          <div>
            <h3>Alert Thresholds</h3>
            <p>Control when alert notifications are triggered</p>
          </div>
        </div>
        <div class="setting-card-bd">
          <div class="setting-row">
            <div class="info">
              <h4><i class="bi bi-exclamation-triangle-fill" style="color: #d97706"></i> Department Head Alert</h4>
              <p>Notify the department head after this many consecutive Reds.</p>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <input
                v-model.number="deptHeadThreshold"
                type="number"
                min="1"
                max="10"
                class="inp mono"
                style="max-width: 90px"
              />
              <span class="badge-x b-amber">Reds</span>
            </div>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4><i class="bi bi-exclamation-octagon-fill" style="color: #dc2626"></i> Admin Escalation</h4>
              <p>Escalate the alert to the administrator after this many consecutive Reds.</p>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <input
                v-model.number="adminThreshold"
                type="number"
                :min="deptHeadThreshold + 1"
                max="15"
                class="inp mono"
                style="max-width: 90px"
              />
              <span class="badge-x b-red">Reds</span>
            </div>
          </div>

          <div class="setting-row" style="background: var(--ink-25); padding: 12px 16px; border-radius: 10px; border: 1px dashed var(--border); margin-top: 8px">
            <div class="info">
              <h4 style="color: var(--brand-700)"><i class="bi bi-info-circle-fill"></i> Current Flow</h4>
              <p>
                <b>{{ deptHeadThreshold }}</b> consecutive Reds → 🟡 Dept Head alert ·
                <b>{{ adminThreshold }}</b> consecutive Reds → 🔴 Admin escalation
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- System Behavior -->
      <div class="card setting-card">
        <div class="setting-card-hd">
          <div class="sch-ico" style="background: linear-gradient(135deg, #059669, #10b981)">
            <i class="bi bi-toggle-on"></i>
          </div>
          <div>
            <h3>System Behavior</h3>
            <p>Notifications and feature toggles</p>
          </div>
        </div>
        <div class="setting-card-bd">
          <div class="setting-row">
            <div class="info">
              <h4><i class="bi bi-envelope-fill"></i> Email Notifications</h4>
              <p>Send emails when alerts or disputes are triggered.</p>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="form.emailNotifications" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4><i class="bi bi-arrow-up-circle-fill"></i> Auto-Escalation</h4>
              <p>Automatically escalate alerts to admin at the configured threshold.</p>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="form.autoEscalation" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4><i class="bi bi-pencil-square"></i> Allow Teacher Self Reports</h4>
              <p>Teachers can submit self-reports.</p>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="form.allowSelfReports" />
              <span class="slider"></span>
            </label>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4><i class="bi bi-chat-square-text-fill"></i> Allow Teacher Disputes</h4>
              <p>Teachers can dispute unfair ratings.</p>
            </div>
            <label class="switch">
              <input type="checkbox" v-model="form.allowDisputes" />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         MAINTENANCE TAB
         ═══════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'maintenance'">

      <!-- Data export -->
      <div class="card setting-card">
        <div class="setting-card-hd">
          <div class="sch-ico" style="background: linear-gradient(135deg, #0284c7, #0ea5e9)">
            <i class="bi bi-download"></i>
          </div>
          <div>
            <h3>Data Export</h3>
            <p>Download CSV bundles of system data</p>
          </div>
        </div>
        <div class="setting-card-bd">
          <div class="setting-row">
            <div class="info">
              <h4>Users</h4>
              <p>All user accounts with roles and departments.</p>
            </div>
            <button class="btn btn-secondary btn-sm" @click="exportUsers">
              <i class="bi bi-download"></i> Export
            </button>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Reports</h4>
              <p>All submitted reports.</p>
            </div>
            <button class="btn btn-secondary btn-sm" @click="exportReports">
              <i class="bi bi-download"></i> Export
            </button>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Audit Log</h4>
              <p>Full activity trail.</p>
            </div>
            <button class="btn btn-secondary btn-sm" @click="exportAudit">
              <i class="bi bi-download"></i> Export
            </button>
          </div>
        </div>
      </div>

      <!-- System maintenance -->
      <div class="card setting-card">
        <div class="setting-card-hd">
          <div class="sch-ico" style="background: linear-gradient(135deg, #d97706, #f59e0b)">
            <i class="bi bi-tools"></i>
          </div>
          <div>
            <h3>System Maintenance</h3>
            <p>Rebuild data, clear tokens, and reset system state</p>
          </div>
        </div>
        <div class="setting-card-bd">
          <div class="setting-row">
            <div class="info">
              <h4>Recompute Alerts</h4>
              <p>Rebuild the alert list from current reports.</p>
            </div>
            <button class="btn btn-warning btn-sm" @click="recomputeAlerts">
              <i class="bi bi-arrow-clockwise"></i> Recompute
            </button>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Clear Password Reset Tokens</h4>
              <p>Invalidate all pending reset links.</p>
            </div>
            <button class="btn btn-warning btn-sm" @click="clearTokens">
              <i class="bi bi-shield-x"></i> Clear Tokens
            </button>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Reset Settings to Defaults</h4>
              <p>Restore the original configuration values.</p>
            </div>
            <button class="btn btn-warning btn-sm" @click="resetToDefaults">
              <i class="bi bi-arrow-counterclockwise"></i> Reset Defaults
            </button>
          </div>
        </div>
      </div>

      <!-- Danger zone -->
      <div class="card danger-card">
        <div class="setting-card-hd danger-hd">
          <div class="sch-ico" style="background: linear-gradient(135deg, #dc2626, #b91c1c)">
            <i class="bi bi-exclamation-octagon-fill"></i>
          </div>
          <div>
            <h3>Danger Zone</h3>
            <p>These actions cannot be undone</p>
          </div>
        </div>
        <div class="setting-card-bd">
          <div class="setting-row">
            <div class="info">
              <h4>Clear Audit Log</h4>
              <p>Permanently remove all audit entries.</p>
            </div>
            <button class="btn btn-danger btn-sm" @click="clearingAudit = true">
              <i class="bi bi-trash"></i> Clear Log
            </button>
          </div>

          <div class="setting-row">
            <div class="info">
              <h4>Factory Reset</h4>
              <p>Wipe all local data and restore the demo seed.</p>
            </div>
            <button class="btn btn-danger btn-sm" @click="factoryReset = true">
              <i class="bi bi-exclamation-octagon"></i> Factory Reset
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ STICKY SAVE BAR ═══════════ -->
    <Transition name="save-bar">
      <div v-if="hasChanges" class="save-bar">
        <div class="sb-info">
          <i class="bi bi-exclamation-circle-fill"></i>
          <b>Unsaved changes</b>
          <span class="muted">·</span>
          <span>Your edits are not saved yet</span>
        </div>
        <div class="sb-actions">
          <button class="btn btn-secondary btn-sm" @click="resetForm">
            <i class="bi bi-x-lg"></i> Discard
          </button>
          <button class="btn btn-primary btn-sm" @click="saveSettings">
            <i class="bi bi-check2"></i> Save Settings
          </button>
        </div>
      </div>
    </Transition>

    <!-- ═══════════ CONFIRMATIONS ═══════════ -->
    <ConfirmDialog v-if="clearingAudit"
                   title="Clear Audit Log"
                   confirm-label="Clear Log"
                   danger
                   @cancel="clearingAudit = false"
                   @confirm="confirmClearAudit">
      Are you sure you want to permanently delete all audit log entries? This action cannot be undone.
    </ConfirmDialog>

    <ConfirmDialog v-if="factoryReset"
                   title="Factory Reset"
                   confirm-label="Yes, Reset Everything"
                   danger
                   @cancel="factoryReset = false"
                   @confirm="confirmFactoryReset">
      This will <b>permanently delete</b> all users, reports, disputes, alerts, notifications,
      and audit logs, then restore the original demo data set.
      <br><br>You will be signed out immediately after.
    </ConfirmDialog>
  </div>
</template>

<style scoped>
/* ═══════════════ UNSAVED PILL ═══════════════ */
.unsaved-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border: 1px solid #fde68a;
  color: #b45309;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .04em;
  margin-left: 10px;
  vertical-align: middle;
  animation: pulsePill 2s ease-in-out infinite;
}
@keyframes pulsePill {
  0%, 100% { opacity: 1; }
  50%      { opacity: .75; }
}

/* ═══════════════ KPI STRIP ═══════════════ */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 22px;
}
.ks-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 16px 18px;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: transform .18s, box-shadow .18s;
}
.ks-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--sh-2);
}
.ks-ico {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 20px;
  flex: none;
}
.ks-ico.brand   { background: var(--brand-50);   color: var(--brand-600); }
.ks-ico.success { background: var(--success-50); color: var(--success); }
.ks-ico.info    { background: var(--info-50);    color: var(--info); }
.ks-ico.purple  { background: var(--purple-50);  color: var(--purple); }
.ks-val {
  font-size: 22px;
  font-weight: 800;
  color: var(--ink-900);
  font-family: 'JetBrains Mono', monospace;
  line-height: 1;
  letter-spacing: -.02em;
}
.ks-lbl {
  font-size: 11.5px;
  color: var(--ink-400);
  font-weight: 600;
  letter-spacing: .05em;
  text-transform: uppercase;
  margin-top: 4px;
}

/* ═══════════════ TABS ═══════════════ */
.settings-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
  padding: 6px;
  background: var(--ink-25);
  border-radius: 14px;
  border: 1px solid var(--border);
  overflow-x: auto;
}
.st-btn {
  flex: 1;
  min-width: 140px;
  padding: 11px 16px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-500);
  cursor: pointer;
  transition: .14s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: inherit;
  white-space: nowrap;
}
.st-btn:hover {
  color: var(--ink-800);
  background: var(--surface);
}
.st-btn.active {
  background: var(--surface);
  color: var(--brand-700);
  border-color: var(--brand-100);
  box-shadow: 0 2px 6px rgba(15, 23, 42, .06);
}
.st-btn i {
  font-size: 15px;
}

/* ═══════════════ SETTING CARDS ═══════════════ */
.setting-card {
  margin-bottom: 18px;
  overflow: hidden;
}
.setting-card-hd {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, var(--surface-2), var(--surface));
}
.sch-ico {
  width: 46px; height: 46px;
  border-radius: 13px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 20px;
  flex: none;
  box-shadow: 0 6px 16px rgba(15, 23, 42, .15);
}
.setting-card-hd h3 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 3px;
  color: var(--ink-900);
}
.setting-card-hd p {
  font-size: 12.5px;
  color: var(--ink-500);
  margin: 0;
}
.setting-card-bd {
  padding: 4px 22px;
}

/* ═══════════════ SETTING ROWS ═══════════════ */
.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.setting-row:last-child {
  border-bottom: none;
}
.setting-row .info {
  flex: 1;
  min-width: 200px;
}
.setting-row .info h4 {
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 3px;
  color: var(--ink-900);
  display: flex;
  align-items: center;
  gap: 7px;
}
.setting-row .info h4 i {
  color: var(--brand-600);
  font-size: 14px;
}
.setting-row .info p {
  font-size: 12.5px;
  color: var(--ink-500);
  margin: 0;
  line-height: 1.5;
}

/* ═══════════════ FEATURE ROWS ═══════════════ */
.feature-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}
.feature-row:last-child { border-bottom: none; }

.feature-icon {
  width: 40px; height: 40px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 17px;
  flex: none;
  background: linear-gradient(135deg, #eef4ff, #dbe7ff);
  color: var(--brand-600);
  transition: .14s;
}
.feature-icon.off {
  background: var(--ink-50);
  color: var(--ink-400);
  opacity: .55;
}

html[data-theme="dark"] .feature-icon {
  background: linear-gradient(135deg, #1e3a8a, #1e293b);
  color: #c7d2fe;
}
html[data-theme="dark"] .feature-icon.off {
  background: #0b1322;
}

/* ═══════════════ DANGER ZONE ═══════════════ */
.danger-card {
  border: 1px solid rgba(220, 38, 38, .25);
  background: linear-gradient(135deg, #fef2f2, #fff);
}
.danger-hd {
  background: linear-gradient(180deg, #fff5f5, #fef2f2);
  border-bottom-color: rgba(220, 38, 38, .2);
}
.danger-card .setting-row .info h4 {
  color: #991b1b;
}

/* ═══════════════ STICKY SAVE BAR ═══════════════ */
.save-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 18px 12px 16px;
  background: linear-gradient(135deg, #0f172a, #111a2e);
  color: #fff;
  border-radius: 14px;
  box-shadow: 0 12px 32px -8px rgba(15, 23, 42, .4);
  min-width: 420px;
  max-width: calc(100vw - 40px);
  animation: sbSlideUp .28s cubic-bezier(.2, .8, .2, 1);
}
@keyframes sbSlideUp {
  from { opacity: 0; transform: translate(-50%, 20px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
.sb-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  flex: 1;
}
.sb-info i {
  color: #fbbf24;
  font-size: 16px;
}
.sb-info b {
  color: #fff;
  font-weight: 700;
}
.sb-info .muted {
  color: rgba(226, 232, 240, .5);
}
.sb-actions {
  display: flex;
  gap: 8px;
}
.save-bar .btn-secondary {
  background: rgba(255, 255, 255, .08);
  color: #fff;
  border-color: rgba(255, 255, 255, .15);
}
.save-bar .btn-secondary:hover {
  background: rgba(255, 255, 255, .15);
  color: #fff;
  border-color: rgba(255, 255, 255, .25);
}
.save-bar .btn-primary {
  background: #fff;
  color: #0f172a;
  border-color: #fff;
}
.save-bar .btn-primary:hover {
  background: #e8eeff;
  color: #0f172a;
}

.save-bar-enter-active,
.save-bar-leave-active {
  transition: opacity .2s ease, transform .2s ease;
}
.save-bar-enter-from,
.save-bar-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}

/* ═══════════════ DARK MODE ═══════════════ */
html[data-theme="dark"] .danger-card {
  background: linear-gradient(135deg, #1a0a0a, #0e1524);
  border-color: rgba(220, 38, 38, .35);
}
html[data-theme="dark"] .danger-hd {
  background: linear-gradient(180deg, #1a0a0a, #150808);
}
html[data-theme="dark"] .ks-card:hover {
  border-color: var(--border-strong);
}
html[data-theme="dark"] .settings-tabs {
  background: #0b1322;
}
html[data-theme="dark"] .st-btn.active {
  background: #0e1524;
}
html[data-theme="dark"] .save-bar {
  background: linear-gradient(135deg, #0e1524, #111a2b);
  border: 1px solid var(--border);
}

/* ═══════════════ RESPONSIVE ═══════════════ */
@media (max-width: 640px) {
  .save-bar {
    flex-direction: column;
    align-items: stretch;
    min-width: auto;
    width: calc(100vw - 24px);
    padding: 14px;
  }
  .sb-actions {
    justify-content: stretch;
  }
  .sb-actions .btn {
    flex: 1;
    justify-content: center;
  }
  .setting-row {
    flex-direction: column;
    align-items: flex-start;
  }
  .setting-row .inp {
    max-width: 100% !important;
    width: 100%;
  }
}
</style>