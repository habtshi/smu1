<script setup>
import { ref, computed, watch } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useMessagesStore } from '@/stores/messages'
import { useDirectoryStore } from '@/stores/directory'
import Modal from '@/components/common/Modal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { fmtDateTime } from '@/utils/format'
import { ROLE_LABEL } from '@/utils/constants'

const session   = useSessionStore()
const messages  = useMessagesStore()
const directory = useDirectoryStore()
const toast     = useToast()

/* ══════════════════════════════════════════════════
   CAN COMPOSE
   ══════════════════════════════════════════════════ */
const canCompose = computed(() =>
  session.role === 'admin' || session.role === 'dept_head'
)

const isAdmin = computed(() => session.role === 'admin')

/* ══════════════════════════════════════════════════
   INBOX
   ══════════════════════════════════════════════════ */
const inbox  = computed(() => messages.messagesForUser(session.userId))
const unread = computed(() => messages.unreadMessages(session.userId))

function markRead(m) {
  if (!m.read) messages.markMessageRead(m.id)
}

/* ══════════════════════════════════════════════════
   INBOX FILTERS
   ══════════════════════════════════════════════════ */
const inboxQ      = ref('')
const inboxUnread = ref(false)

const inboxFiltered = computed(() => {
  let list = inbox.value
  if (inboxUnread.value) list = list.filter(m => !m.read)
  const term = inboxQ.value.toLowerCase()
  if (term) {
    list = list.filter(m =>
      (m.subject + ' ' + m.body + ' ' + m.fromName).toLowerCase().includes(term)
    )
  }
  return list
})

/* ══════════════════════════════════════════════════
   COMPOSE MODAL
   ══════════════════════════════════════════════════ */
const composeOpen = ref(false)
const draft       = ref({ dept: '', division: '', toId: '', subject: '', body: '' })

/* ══════════════════════════════════════════════════
   DEPARTMENT OPTIONS
   - Admin: can pick any department
   - Dept Head: locked to their department
   ══════════════════════════════════════════════════ */
const departmentOptions = computed(() => {
  const list = directory.departments.map(d => d.name)
  const extras = directory.users.map(u => u.department).filter(Boolean)
  const all = Array.from(new Set([...list, ...extras])).sort()
  return all
})

/* ══════════════════════════════════════════════════
   DIVISION OPTIONS
   ══════════════════════════════════════════════════ */
const DIVISIONS = [
  { value: '',          label: 'All divisions',        icon: 'people-fill' },
  { value: 'Regular',   label: 'Regular',              icon: 'sun' },
  { value: 'Extension', label: 'Extension',            icon: 'moon-stars' },
  { value: 'Both',      label: 'Both',                 icon: 'arrow-left-right' }
]

/* ══════════════════════════════════════════════════
   RECIPIENTS — filtered by department + division
   ══════════════════════════════════════════════════ */
const recipients = computed(() => {
  const deptScope = isAdmin.value
    ? (draft.value.dept || null)
    : session.department

  const divScope = draft.value.division || null

  return directory.users
    .filter(u => u.id !== session.userId)                        // never self
    .filter(u => !deptScope || u.department === deptScope)       // department filter
    .filter(u => {
      // Division only applies to students, teachers, class reps
      if (!divScope) return true
      const div = u.division
      if (!div) return false                                      // no division = filtered out
      if (divScope === 'Both') return div === 'Both'
      return div === divScope || div === 'Both'
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

/* Count of teachers in the current filter */
const teacherCount = computed(() =>
  recipients.value.filter(u => u.role === 'teacher').length
)

/* Auto-reset recipient when filters change */
watch(() => draft.value.dept, () => { draft.value.toId = '' })
watch(() => draft.value.division, () => { draft.value.toId = '' })

/* ══════════════════════════════════════════════════
   OPEN COMPOSE
   ══════════════════════════════════════════════════ */
function openCompose() {
  draft.value = {
    dept: isAdmin.value ? '' : session.department,
    division: '',
    toId: '',
    subject: '',
    body: ''
  }
  composeOpen.value = true
}

function closeCompose() {
  composeOpen.value = false
  draft.value = { dept: '', division: '', toId: '', subject: '', body: '' }
}

/* ══════════════════════════════════════════════════
   SEND
   ══════════════════════════════════════════════════ */
function send() {
  const d = draft.value
  if (isAdmin.value && !d.dept) { toast.err('Please choose a department first'); return }
  if (!d.toId) { toast.err('Please choose a recipient'); return }
  if (!d.subject.trim()) { toast.err('Please enter a subject'); return }
  if (!d.body.trim())    { toast.err('Please write a message'); return }

  const to = directory.userById(+d.toId)
  if (!to) { toast.err('Recipient not found'); return }

  messages.sendDirectMessage(session.user, to, d.subject.trim(), d.body.trim())
  toast.ok(`Message sent to ${to.name}`)
  closeCompose()
}

/* ══════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════ */
function initials(name) {
  return (name || '?').split(' ').filter(Boolean)
    .map(x => x[0]).join('').slice(0, 2).toUpperCase()
}

/* Recipient preview helpers */
const pickedRecipient = computed(() =>
  draft.value.toId ? directory.userById(+draft.value.toId) : null
)

function roleBadgeClass(role) {
  return {
    admin: 'b-red', dept_head: 'b-purple',
    teacher: 'b-brand', class_rep: 'b-amber', student: 'b-blue'
  }[role] || 'b-gray'
}

function divisionBadgeClass(div) {
  return {
    Regular:   'b-blue',
    Extension: 'b-purple',
    Both:      'b-brand'
  }[div] || 'b-gray'
}
function divisionIcon(div) {
  if (div === 'Extension') return 'bi-moon-stars'
  if (div === 'Both')      return 'bi-arrow-left-right'
  return 'bi-sun'
}
</script>

<template>
  <div>
    <!-- ═══════════════ PAGE HEADER ═══════════════ -->
    <div class="page-hd">
      <div>
        <h1>Messages</h1>
        <div class="sub">
          Private academic communication · {{ unread }} unread
          <span v-if="!isAdmin"> · {{ session.department }}</span>
        </div>
      </div>
      <div v-if="canCompose" class="page-hd-actions">
        <button class="btn btn-primary btn-sm" @click="openCompose">
          <i class="bi bi-send-fill"></i> New Message
        </button>
      </div>
    </div>

    <!-- ═══════════════ TWO COLUMN LAYOUT ═══════════════ -->
    <div class="message-grid">
      <!-- Inbox -->
      <div class="card">
        <div class="card-hd">
          <h3><i class="bi bi-inbox-fill"></i> Inbox</h3>
          <span class="badge-x b-brand">{{ inbox.length }}</span>
        </div>

        <div class="tbl-toolbar">
          <div class="tbl-search">
            <i class="bi bi-search"></i>
            <input v-model="inboxQ" placeholder="Search subject, sender, body…" />
          </div>
          <label class="unread-toggle">
            <input type="checkbox" v-model="inboxUnread" />
            <span>Unread only</span>
          </label>
          <button
            v-if="inboxQ || inboxUnread"
            class="btn btn-ghost btn-sm"
            @click="inboxQ = ''; inboxUnread = false"
          >
            <i class="bi bi-x-lg"></i> Clear
          </button>
        </div>

        <div v-if="!inboxFiltered.length">
          <EmptyState
            icon="envelope-open"
            title="No messages"
            :text="inbox.length ? 'No messages match your filters.' : 'Your private messages will appear here.'"
          />
        </div>

        <div
          v-for="m in inboxFiltered"
          :key="m.id"
          class="message-item"
          :class="{ unread: !m.read }"
          @click="markRead(m)"
        >
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
            <div style="display:flex;align-items:center;gap:10px;min-width:0">
              <div class="msg-avatar">{{ initials(m.fromName) }}</div>
              <div style="min-width:0">
                <div class="message-title">{{ m.subject }}</div>
                <div class="message-meta">
                  From <b>{{ m.fromName }}</b>
                  · {{ ROLE_LABEL[m.fromRole] || m.fromRole }}
                </div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <span v-if="!m.read" class="badge-x b-red">New</span>
              <div class="t-xs muted" style="margin-top:4px">{{ fmtDateTime(m.createdAt) }}</div>
            </div>
          </div>
          <div class="message-body">{{ m.body }}</div>
        </div>
      </div>

      <!-- Policy panel -->
      <div class="card message-compose">
        <div class="card-hd">
          <h3><i class="bi bi-shield-check"></i> Communication Policy</h3>
        </div>
        <div class="card-bd">
          <p class="muted" style="line-height:1.7">
            Messages are private system communications. Teachers receive direct messages
            from their Department Head or Administrator about attendance, performance,
            disputes, follow-up actions and professional matters.
          </p>

          <div class="info-row">
            <div class="k">Unread</div>
            <div class="v">{{ unread }}</div>
          </div>
          <div class="info-row">
            <div class="k">Total</div>
            <div class="v">{{ inbox.length }}</div>
          </div>
          <div class="info-row">
            <div class="k">Access</div>
            <div class="v">Role-based</div>
          </div>
          <div class="info-row">
            <div class="k">You</div>
            <div class="v">{{ session.roleLabel }}</div>
          </div>

          <div
            v-if="isAdmin"
            class="alert-pill alert-info"
            style="display:inline-flex;padding:10px 12px;margin-top:14px"
          >
            <i class="bi bi-info-circle-fill"></i>
            <span style="margin-left:6px">
              As Administrator, you can send messages to any department and division.
            </span>
          </div>

          <div
            v-else-if="session.role === 'dept_head'"
            class="alert-pill alert-warning"
            style="display:inline-flex;padding:10px 12px;margin-top:14px"
          >
            <i class="bi bi-building"></i>
            <span style="margin-left:6px">
              You can only send messages within <b>{{ session.department }}</b>.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════ COMPOSE MODAL ═══════════════ -->
    <Modal
      v-if="composeOpen"
      title="New Message"
      subtitle="Send a private message to a system user"
      size="wide"
      @close="closeCompose"
    >
      <!-- STEP 1: Filter panel -->
      <div class="compose-filter-panel">
        <div class="cfp-label">
          <i class="bi bi-funnel-fill"></i> Filter recipients
        </div>

        <div class="row g-3">
          <!-- Department picker -->
          <div class="col-md-6">
            <div class="form-row" style="margin-bottom:0">
              <label>
                Department
                <span v-if="!isAdmin" class="t-xs muted" style="font-weight:400">
                  · locked
                </span>
                <span v-else class="req">*</span>
              </label>

              <select v-if="isAdmin" v-model="draft.dept" class="inp">
                <option value="">Select a department…</option>
                <option v-for="d in departmentOptions" :key="d" :value="d">{{ d }}</option>
              </select>

              <input
                v-else
                :value="session.department"
                class="inp"
                readonly
                style="background:var(--ink-25);cursor:not-allowed;font-weight:600;color:var(--ink-700)"
              />
            </div>
          </div>

          <!-- Division picker -->
          <div class="col-md-6">
            <div class="form-row" style="margin-bottom:0">
              <label>
                Division
                <span class="t-xs muted" style="font-weight:400">· optional</span>
              </label>
              <select v-model="draft.division" class="inp">
                <option v-for="d in DIVISIONS" :key="d.value" :value="d.value">
                  {{ d.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Quick division pills -->
        <div class="division-pills">
          <button
            v-for="d in DIVISIONS"
            :key="d.value"
            class="div-pill"
            :class="{ active: draft.division === d.value }"
            @click="draft.division = d.value"
          >
            <i :class="`bi bi-${d.icon}`"></i>
            {{ d.label }}
          </button>
        </div>
      </div>

      <!-- STEP 2: Recipient picker -->
      <div class="row g-3" style="margin-top:16px">
        <div class="col-12">
          <div class="form-row">
            <label>
              Recipient <span class="req">*</span>
              <span class="t-xs muted" style="font-weight:400;margin-left:6px">
                ({{ recipients.length }} available · {{ teacherCount }} teacher{{ teacherCount === 1 ? '' : 's' }})
              </span>
            </label>
            <select
              v-model="draft.toId"
              class="inp"
              :disabled="isAdmin && !draft.dept"
            >
              <option value="">
                {{ isAdmin && !draft.dept ? 'Pick a department first…' : 'Select recipient…' }}
              </option>
              <option v-for="r in recipients" :key="r.id" :value="r.id">
                {{ r.name }} — {{ ROLE_LABEL[r.role] || r.role }}
                <template v-if="r.division"> · {{ r.division }}</template>
              </option>
            </select>
            <div v-if="isAdmin && draft.dept && !recipients.length" class="muted t-xs" style="margin-top:6px">
              <i class="bi bi-info-circle"></i>
              No users match the current filters. Try a different division.
            </div>
          </div>
        </div>

        <!-- Recipient preview card -->
        <div v-if="pickedRecipient" class="col-12">
          <div class="recipient-preview">
            <div class="rp-avatar">
              {{ initials(pickedRecipient.name) }}
            </div>
            <div style="flex:1;min-width:0">
              <div class="rp-name">{{ pickedRecipient.name }}</div>
              <div class="rp-meta">
                <span class="badge-x" :class="roleBadgeClass(pickedRecipient.role)">
                  {{ ROLE_LABEL[pickedRecipient.role] }}
                </span>
                <span v-if="pickedRecipient.department" class="badge-x b-gray">
                  <i class="bi bi-building"></i> {{ pickedRecipient.department }}
                </span>
                <span v-if="pickedRecipient.division" class="badge-x" :class="divisionBadgeClass(pickedRecipient.division)">
                  <i :class="divisionIcon(pickedRecipient.division)"></i> {{ pickedRecipient.division }}
                </span>
              </div>
            </div>
            <i class="bi bi-check-circle-fill" style="color: var(--success); font-size: 22px"></i>
          </div>
        </div>

        <!-- Subject -->
        <div class="col-12">
          <div class="form-row">
            <label>Subject <span class="req">*</span></label>
            <input
              v-model.trim="draft.subject"
              class="inp"
              placeholder="e.g. Attendance follow-up"
            />
          </div>
        </div>

        <!-- Body -->
        <div class="col-12">
          <div class="form-row">
            <label>Message <span class="req">*</span></label>
            <textarea
              v-model="draft.body"
              class="inp"
              rows="6"
              placeholder="Write a professional message…"
            ></textarea>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="closeCompose">
          Cancel
        </button>
        <button class="btn btn-primary btn-sm" @click="send">
          <i class="bi bi-send-fill"></i> Send Message
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
/* Message avatar */
.msg-avatar {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--brand-500), var(--accent-500));
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 12px;
  flex-shrink: 0;
}

/* Unread toggle */
.unread-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #fff;
  transition: .14s;
}
.unread-toggle:hover {
  background: var(--ink-25);
}
.unread-toggle input {
  accent-color: var(--brand-600);
}

/* ═══════════════ COMPOSE FILTER PANEL ═══════════════ */
.compose-filter-panel {
  padding: 16px 18px;
  background: linear-gradient(135deg, #eef4ff, #f5f3ff);
  border: 1px solid var(--brand-100);
  border-radius: 14px;
  position: relative;
}
.cfp-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  background: #fff;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--brand-700);
  margin-bottom: 14px;
  box-shadow: 0 2px 6px rgba(79, 109, 245, .12);
  border: 1px solid var(--brand-100);
}
.cfp-label i {
  font-size: 13px;
}

/* Division pills */
.division-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}
.div-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1.5px solid var(--brand-200);
  background: #fff;
  color: var(--ink-600);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: .14s;
  font-family: inherit;
}
.div-pill:hover {
  border-color: var(--brand-500);
  color: var(--brand-700);
  transform: translateY(-1px);
}
.div-pill.active {
  background: linear-gradient(135deg, var(--brand-600), var(--brand-700));
  color: #fff;
  border-color: var(--brand-600);
  box-shadow: 0 6px 16px -4px rgba(58, 84, 216, .4);
}
.div-pill i {
  font-size: 12px;
}

/* ═══════════════ RECIPIENT PREVIEW ═══════════════ */
.recipient-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #f0fdf4, #fff);
  border: 1.5px solid #bbf7d0;
  border-radius: 12px;
  animation: rpFade .25s ease;
}
@keyframes rpFade {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
.rp-avatar {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--brand-600), var(--brand-700));
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: 0 6px 16px rgba(58, 84, 216, .25);
}
.rp-name {
  font-weight: 700;
  font-size: 14.5px;
  color: var(--ink-900);
  margin-bottom: 6px;
}
.rp-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ═══════════════ DARK MODE ═══════════════ */
html[data-theme="dark"] .compose-filter-panel {
  background: linear-gradient(135deg, #172554, #1e1b4b);
  border-color: var(--border);
}
html[data-theme="dark"] .cfp-label {
  background: #0e1524;
  border-color: var(--border);
}
html[data-theme="dark"] .div-pill {
  background: #0e1524;
  border-color: var(--border);
  color: var(--ink-400);
}
html[data-theme="dark"] .recipient-preview {
  background: linear-gradient(135deg, #0d3a2a, #0e1524);
  border-color: #166534;
}
</style>