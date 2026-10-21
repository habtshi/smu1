<script setup>
import { ref, computed } from 'vue'
import { useDirectoryStore } from '@/stores/directory'
import { useSettingsStore } from '@/stores/settings'
import Modal from '@/components/common/Modal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useToast } from '@/composables/useToast'
import { NAV } from '@/utils/constants'

const directory = useDirectoryStore()
const settings  = useSettingsStore()
const toast     = useToast()

/* ══════════════════════════════════════════════════════
   ROLE METADATA
   ══════════════════════════════════════════════════════ */
const roles = [
  {
    id: 'admin', label: 'Administrator', level: 5,
    icon: 'shield-fill-check',
    gradient: 'linear-gradient(135deg, #dc2626, #ef4444)',
    soft: 'linear-gradient(135deg, #fef2f2, #fff)',
    accent: '#dc2626',
    desc: 'Full system access. Manages users, departments, roles, and all data.',
    tags: ['Full access', 'All modules']
  },
  {
    id: 'dept_head', label: 'Department Head', level: 4,
    icon: 'person-badge-fill',
    gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    soft: 'linear-gradient(135deg, #f5f3ff, #fff)',
    accent: '#7c3aed',
    desc: 'Oversees teachers and reports within their own department.',
    tags: ['Department scope']
  },
  {
    id: 'teacher', label: 'Teacher', level: 3,
    icon: 'person-video3',
    gradient: 'linear-gradient(135deg, #4f6df5, #6366f1)',
    soft: 'linear-gradient(135deg, #eef4ff, #fff)',
    accent: '#4f6df5',
    desc: 'Views personal attendance & performance; submits self-reports and disputes.',
    tags: ['Self-service']
  },
  {
    id: 'class_rep', label: 'Class Representative', level: 2,
    icon: 'person-workspace',
    gradient: 'linear-gradient(135deg, #d97706, #f59e0b)',
    soft: 'linear-gradient(135deg, #fffbeb, #fff)',
    accent: '#d97706',
    desc: 'Submits daily attendance and performance reports for teachers.',
    tags: ['Reports only']
  },
  {
    id: 'student', label: 'Student', level: 1,
    icon: 'mortarboard-fill',
    gradient: 'linear-gradient(135deg, #0284c7, #0ea5e9)',
    soft: 'linear-gradient(135deg, #f0f9ff, #fff)',
    accent: '#0284c7',
    desc: 'Submits performance-only ratings for teachers.',
    tags: ['Rating only']
  }
]

const roleById = id => roles.find(r => r.id === id)

/* ══════════════════════════════════════════════════════
   USER COUNTS
   ══════════════════════════════════════════════════════ */
const roleCount = id => directory.users.filter(u => u.role === id).length
const totalUsers = computed(() => directory.users.length)

/* ══════════════════════════════════════════════════════
   RESOURCES (from NAV)
   ══════════════════════════════════════════════════════ */
const RESOURCES = (() => {
  const map = new Map()
  Object.values(NAV).flat().forEach(sec => {
    (sec.items || []).forEach(i => {
      if (!map.has(i[0])) {
        map.set(i[0], { id: i[0], label: i[1], ico: i[2] || 'circle' })
      }
    })
  })
  if (!map.has('dashboard')) map.set('dashboard', { id: 'dashboard', label: 'Dashboard', ico: 'speedometer2' })
  return Array.from(map.values())
})()

const ACTIONS = [
  { id: 'view',    label: 'View',    icon: 'eye-fill',           color: '#0284c7' },
  { id: 'create',  label: 'Create',  icon: 'plus-circle-fill',   color: '#059669' },
  { id: 'update',  label: 'Update',  icon: 'pencil-fill',        color: '#4f6df5' },
  { id: 'delete',  label: 'Delete',  icon: 'trash-fill',         color: '#dc2626' },
  { id: 'approve', label: 'Approve', icon: 'check-circle-fill',  color: '#059669' },
  { id: 'reject',  label: 'Reject',  icon: 'x-circle-fill',      color: '#dc2626' },
  { id: 'export',  label: 'Export',  icon: 'download',           color: '#7c3aed' },
  { id: 'print',   label: 'Print',   icon: 'printer-fill',       color: '#64748b' },
  { id: 'manage',  label: 'Manage',  icon: 'sliders',            color: '#d97706' }
]

/* ══════════════════════════════════════════════════════
   PERMISSION MATRIX
   ══════════════════════════════════════════════════════ */
function defaultMatrix() {
  const out = {}
  roles.forEach(r => {
    const allowed = new Set((NAV[r.id] || []).flatMap(s => s.items.map(i => i[0])))
    out[r.id] = {}
    RESOURCES.forEach(res => {
      out[r.id][res.id] = {}
      ACTIONS.forEach(a => {
        out[r.id][res.id][a.id] = r.id === 'admin' || (a.id === 'view' && allowed.has(res.id))
      })
    })
  })
  return out
}

const matrix = ref((() => {
  const saved = settings.settings.rolePermissions
  return saved ? JSON.parse(JSON.stringify(saved)) : defaultMatrix()
})())

/* ══════════════════════════════════════════════════════
   STATS
   ══════════════════════════════════════════════════════ */
function totalPermissionsForRole(roleId) {
  let n = 0
  RESOURCES.forEach(res => {
    ACTIONS.forEach(a => {
      if (matrix.value[roleId]?.[res.id]?.[a.id]) n++
    })
  })
  return n
}

function resourcesVisibleForRole(roleId) {
  return RESOURCES.filter(res => matrix.value[roleId]?.[res.id]?.view).length
}

const maxPermissions = computed(() => RESOURCES.length * ACTIONS.length)

function coveragePercent(roleId) {
  return Math.round((totalPermissionsForRole(roleId) / maxPermissions.value) * 100)
}

/* ══════════════════════════════════════════════════════
   EDITOR
   ══════════════════════════════════════════════════════ */
const editingRole = ref(null)
const draft       = ref(null)
const draftTab    = ref('matrix')

function openEditor(roleId) {
  editingRole.value = roleId
  draft.value = JSON.parse(JSON.stringify(matrix.value[roleId]))
  draftTab.value = 'matrix'
}

function closeEditor() {
  editingRole.value = null
  draft.value = null
}

function toggleAll() {
  for (const res of RESOURCES) {
    for (const a of ACTIONS) draft.value[res.id][a.id] = true
  }
}
function clearAll() {
  for (const res of RESOURCES) {
    for (const a of ACTIONS) draft.value[res.id][a.id] = false
  }
}
function toggleResourceAll(resId) {
  const anyOff = ACTIONS.some(a => !draft.value[resId][a.id])
  ACTIONS.forEach(a => { draft.value[resId][a.id] = anyOff })
}
function toggleActionAcrossAll(actionId) {
  const anyOff = RESOURCES.some(res => !draft.value[res.id][actionId])
  RESOURCES.forEach(res => { draft.value[res.id][actionId] = anyOff })
}

function saveDraft() {
  matrix.value[editingRole.value] = JSON.parse(JSON.stringify(draft.value))
  settings.saveSettings({ rolePermissions: matrix.value })
  settings.audit('Role Permissions Updated', 'RBAC', `Updated role ${editingRole.value}`)
  toast.ok(`${roleById(editingRole.value).label} permissions saved`)
  closeEditor()
}

/* ---------- sidebar preview ---------- */
const draftSidebarPreview = computed(() => {
  if (!editingRole.value || !draft.value) return []
  const role = editingRole.value
  return (NAV[role] || []).map(sec => ({
    section: sec.section,
    items: sec.items.filter(i => draft.value[i[0]]?.view)
  })).filter(sec => sec.items.length > 0)
})

function draftVisibleCount() {
  if (!draft.value) return 0
  return RESOURCES.filter(res => draft.value[res.id]?.view).length
}

/* ══════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════ */
function countOn(roleId, resId) {
  return ACTIONS.filter(a => matrix.value[roleId]?.[resId]?.[a.id]).length
}

function roleBadgeClass(id) {
  return {
    admin: 'b-red', dept_head: 'b-purple',
    teacher: 'b-brand', class_rep: 'b-amber', student: 'b-blue'
  }[id] || 'b-gray'
}

function matrixCellClass(roleId, resId) {
  const n = countOn(roleId, resId)
  if (n === ACTIONS.length) return 'mt-full'
  if (n === 0) return 'mt-none'
  return 'mt-partial'
}
</script>

<template>
  <div>
    <!-- ═══════════ PAGE HEADER ═══════════ -->
    <div class="page-hd">
      <div>
        <h1>
          Roles &amp; Permissions
          <span class="page-hd-pill">
            <i class="bi bi-shield-lock-fill"></i> RBAC
          </span>
        </h1>
        <div class="sub">
          {{ roles.length }} roles · {{ directory.users.length }} users · {{ RESOURCES.length }} resources · {{ maxPermissions }} total permissions
        </div>
      </div>
    </div>

    <!-- ═══════════ ROLE CARDS ═══════════ -->
    <div class="row g-3 mb-4">
      <div v-for="(r, i) in roles" :key="r.id" class="col-xl-4 col-md-6">
        <div
          class="role-card"
          :style="{ '--gradient': r.gradient, '--soft': r.soft, '--accent': r.accent, animationDelay: (i * 60) + 'ms' }"
        >
          <!-- Animated top bar -->
          <div class="rc-bar-top" :style="{ background: r.gradient }"></div>

          <!-- Header -->
          <div class="rc-top">
            <div class="rc-avatar" :style="{ background: r.gradient }">
              <i :class="`bi bi-${r.icon}`"></i>
            </div>
            <div class="rc-info">
              <div class="rc-name">{{ r.label }}</div>
              <div class="rc-meta">
                <span class="rc-level">
                  <i class="bi bi-bar-chart-fill"></i> Level {{ r.level }}
                </span>
                <span v-if="roleCount(r.id)" class="rc-count">
                  <i class="bi bi-people-fill"></i> {{ roleCount(r.id) }} user{{ roleCount(r.id) === 1 ? '' : 's' }}
                </span>
              </div>
            </div>
            <button class="rc-edit" @click="openEditor(r.id)" title="Edit permissions">
              <i class="bi bi-sliders"></i>
            </button>
          </div>

          <!-- Description -->
          <p class="rc-desc">{{ r.desc }}</p>

          <!-- Tags -->
          <div class="rc-tags">
            <span v-for="tag in r.tags" :key="tag" class="rc-tag">
              <i class="bi bi-check2"></i> {{ tag }}
            </span>
          </div>

          <!-- Stats grid -->
          <div class="rc-stats">
            <div class="rc-stat">
              <div class="rc-stat-ico" :style="{ background: r.accent + '15', color: r.accent }">
                <i class="bi bi-people-fill"></i>
              </div>
              <div class="rc-stat-body">
                <b>{{ roleCount(r.id) }}</b>
                <span>Users</span>
              </div>
            </div>
            <div class="rc-stat">
              <div class="rc-stat-ico" :style="{ background: r.accent + '15', color: r.accent }">
                <i class="bi bi-grid-3x3-gap-fill"></i>
              </div>
              <div class="rc-stat-body">
                <b>{{ resourcesVisibleForRole(r.id) }}</b>
                <span>Pages</span>
              </div>
            </div>
            <div class="rc-stat">
              <div class="rc-stat-ico" :style="{ background: r.accent + '15', color: r.accent }">
                <i class="bi bi-shield-check"></i>
              </div>
              <div class="rc-stat-body">
                <b>{{ totalPermissionsForRole(r.id) }}</b>
                <span>Perms</span>
              </div>
            </div>
          </div>

          <!-- Coverage bar -->
          <div class="rc-coverage">
            <div class="rc-coverage-hd">
              <span>Permission coverage</span>
              <b :style="{ color: r.accent }">{{ coveragePercent(r.id) }}%</b>
            </div>
            <div class="rc-bar">
              <div
                class="rc-bar-fill"
                :style="{
                  width: coveragePercent(r.id) + '%',
                  background: r.gradient
                }"
              ></div>
            </div>
          </div>

          <!-- Action -->
          <button
            class="rc-btn"
            :style="{ color: r.accent, borderColor: r.accent + '33' }"
            @click="openEditor(r.id)"
          >
            <i class="bi bi-pencil-square"></i> Edit Permissions
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════ PERMISSION MATRIX ═══════════ -->
    <div class="card mb-4">
      <div class="card-hd">
        <div>
          <h3><i class="bi bi-grid-3x3-gap-fill"></i> Permission Matrix</h3>
          <div class="sub">Number of enabled actions per role / resource</div>
        </div>
        <div class="matrix-legend-inline">
          <span><i class="mt-legend-dot mt-full"></i> Full</span>
          <span><i class="mt-legend-dot mt-partial"></i> Partial</span>
          <span><i class="mt-legend-dot mt-none"></i> None</span>
        </div>
      </div>
      <div class="tbl-wrap">
        <table class="tbl matrix-tbl">
          <thead>
            <tr>
              <th style="min-width:180px;position:sticky;left:0;background:var(--ink-25);z-index:2">
                Role / Resource
              </th>
              <th
                v-for="res in RESOURCES"
                :key="res.id"
                style="text-align:center;min-width:110px"
              >
                <div class="mt-header">
                  <i :class="`bi bi-${res.ico}`"></i>
                  <span>{{ res.label }}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in roles" :key="r.id">
              <td style="position:sticky;left:0;background:var(--surface);z-index:1">
                <div class="mt-role">
                  <div class="mt-avatar" :style="{ background: r.gradient }">
                    <i :class="`bi bi-${r.icon}`"></i>
                  </div>
                  <div>
                    <b>{{ r.label }}</b>
                    <div class="t-xs muted">Level {{ r.level }}</div>
                  </div>
                </div>
              </td>
              <td v-for="res in RESOURCES" :key="res.id" style="text-align:center">
                <button
                  class="mt-cell"
                  :class="matrixCellClass(r.id, res.id)"
                  @click="openEditor(r.id)"
                  :title="`${countOn(r.id, res.id)} of ${ACTIONS.length} actions enabled — click to edit ${r.label}`"
                >
                  <span v-if="countOn(r.id, res.id) === ACTIONS.length">
                    <i class="bi bi-check-lg"></i>
                  </span>
                  <span v-else-if="countOn(r.id, res.id) === 0">—</span>
                  <span v-else>{{ countOn(r.id, res.id) }}</span>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="matrix-legend">
        <span><i class="mt-legend-dot mt-full"></i> Full access (all actions)</span>
        <span><i class="mt-legend-dot mt-partial"></i> Partial access</span>
        <span><i class="mt-legend-dot mt-none"></i> No access</span>
        <span class="muted" style="margin-left:auto">
          <i class="bi bi-lightbulb"></i> Click any cell to edit the role
        </span>
      </div>
    </div>

    <!-- ═══════════ USERS BY ROLE ═══════════ -->
    <div class="card">
      <div class="card-hd">
        <h3><i class="bi bi-people-fill"></i> Users by Role</h3>
        <span class="badge-x b-brand">{{ totalUsers }} total users</span>
      </div>
      <div class="tbl-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Role</th>
              <th class="num">Users</th>
              <th>Share</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in roles" :key="r.id">
              <td>
                <div class="ubr-role">
                  <div class="ubr-avatar" :style="{ background: r.gradient }">
                    <i :class="`bi bi-${r.icon}`"></i>
                  </div>
                  <div>
                    <b>{{ r.label }}</b>
                    <div class="t-xs muted">Level {{ r.level }}</div>
                  </div>
                </div>
              </td>
              <td class="num">
                <span class="ubr-count">{{ roleCount(r.id) }}</span>
              </td>
              <td>
                <div class="share-wrap">
                  <div class="share-bar">
                    <div class="share-fill"
                         :style="{
                           width: (totalUsers ? (roleCount(r.id) / totalUsers * 100) : 0) + '%',
                           background: r.gradient
                         }">
                    </div>
                  </div>
                  <span class="share-pct">
                    {{ totalUsers ? Math.round(roleCount(r.id) / totalUsers * 100) : 0 }}%
                  </span>
                </div>
              </td>
              <td class="actions">
                <RouterLink :to="{ name: 'users', query: { role: r.id } }" class="btn btn-ghost btn-xs">
                  <i class="bi bi-eye"></i> View
                </RouterLink>
                <button class="btn btn-primary btn-xs" @click="openEditor(r.id)">
                  <i class="bi bi-sliders"></i> Permissions
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ═══════════ EDITOR MODAL ═══════════ -->
    <Modal v-if="editingRole"
           :title="`Edit ${roleById(editingRole).label} Permissions`"
           :subtitle="`${roleCount(editingRole)} users · ${draftVisibleCount()} pages visible`"
           size="xwide"
           @close="closeEditor">

      <!-- Role mini banner -->
      <div class="editor-banner" :style="{ background: roleById(editingRole).soft }">
        <div class="eb-avatar" :style="{ background: roleById(editingRole).gradient }">
          <i :class="`bi bi-${roleById(editingRole).icon}`"></i>
        </div>
        <div class="eb-info">
          <div class="eb-name">{{ roleById(editingRole).label }}</div>
          <div class="eb-desc">{{ roleById(editingRole).desc }}</div>
        </div>
        <div class="eb-stats">
          <div class="eb-stat">
            <b>{{ draftVisibleCount() }}</b>
            <span>Pages</span>
          </div>
          <div class="eb-stat">
            <b>{{ draft ? Object.values(draft).reduce((s, res) => s + Object.values(res).filter(Boolean).length, 0) : 0 }}</b>
            <span>Perms</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs" style="margin:16px 0 14px">
        <button :class="{ active: draftTab === 'matrix' }" @click="draftTab = 'matrix'">
          <i class="bi bi-grid-3x3-gap-fill"></i> Permissions
        </button>
        <button :class="{ active: draftTab === 'sidebar' }" @click="draftTab = 'sidebar'">
          <i class="bi bi-list-ul"></i> Sidebar Preview
        </button>
      </div>

      <!-- ══════ MATRIX TAB ══════ -->
      <div v-if="draftTab === 'matrix'">
        <!-- Quick actions -->
        <div class="quick-actions">
          <div class="qa-left">
            <button class="btn btn-secondary btn-xs" @click="toggleAll">
              <i class="bi bi-check2-all"></i> Select all
            </button>
            <button class="btn btn-secondary btn-xs" @click="clearAll">
              <i class="bi bi-x-lg"></i> Clear all
            </button>
          </div>

          <div class="qa-right">
            <span class="qa-label">Quick toggle:</span>
            <button
              v-for="a in ACTIONS.slice(0, 5)"
              :key="a.id"
              class="btn btn-ghost btn-xs"
              :style="{ color: a.color }"
              :title="`Toggle '${a.label}' for all resources`"
              @click="toggleActionAcrossAll(a.id)"
            >
              <i :class="`bi bi-${a.icon}`"></i> {{ a.label }}
            </button>
          </div>
        </div>

        <!-- Resources grid -->
        <div class="perm-grid">
          <div v-for="res in RESOURCES" :key="res.id" class="perm-card">
            <div class="perm-card-hd">
              <div class="perm-card-title">
                <div class="pct-ico">
                  <i :class="`bi bi-${res.ico}`"></i>
                </div>
                <span>{{ res.label }}</span>
              </div>
              <button
                class="perm-hd-btn"
                @click="toggleResourceAll(res.id)"
                title="Toggle all actions"
              >
                <i class="bi bi-check2-square"></i>
              </button>
            </div>
            <div class="perm-card-body">
              <label
                v-for="a in ACTIONS"
                :key="a.id"
                class="perm-toggle"
                :class="{ on: draft[res.id]?.[a.id] }"
              >
                <input
                  type="checkbox"
                  :checked="draft[res.id]?.[a.id]"
                  @change="draft[res.id][a.id] = $event.target.checked"
                >
                <span class="pt-check">
                  <i :class="draft[res.id]?.[a.id] ? 'bi bi-check2' : ''"></i>
                </span>
                <span class="pt-label">{{ a.label }}</span>
                <i :class="`bi bi-${a.icon} pt-icon`" :style="{ color: a.color }"></i>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- ══════ SIDEBAR PREVIEW TAB ══════ -->
      <div v-else>
        <div class="sidebar-preview">
          <div class="sp-info">
            <i class="bi bi-info-circle-fill"></i>
            <div>
              <b>This is what {{ roleById(editingRole).label }}s will see in their sidebar.</b>
              <div class="muted t-xs" style="margin-top:2px">
                Based on which pages have <b>View</b> permission enabled.
              </div>
            </div>
          </div>

          <div v-if="!draftSidebarPreview.length" class="sp-empty">
            <EmptyState icon="list" title="No pages visible" text="This role has no page access." />
          </div>

          <div v-else class="sp-mock">
            <!-- Mock topbar -->
            <div class="spm-topbar">
              <i class="bi bi-list"></i>
              <span class="spm-crumb">{{ roleById(editingRole).label }}</span>
              <div style="flex:1"></div>
              <i class="bi bi-bell"></i>
              <i class="bi bi-person-circle"></i>
            </div>

            <!-- Sidebar + content -->
            <div class="spm-body">
              <aside class="spm-sidebar">
                <div class="spm-brand">
                  <div class="spm-mark">SMU</div>
                  <div class="spm-brand-txt">
                    <b>SMU TMS</b>
                    <span>Teacher Monitoring</span>
                  </div>
                </div>

                <div v-for="sec in draftSidebarPreview" :key="sec.section" class="sp-section">
                  <div class="sp-sec-lbl">{{ sec.section }}</div>
                  <div
                    v-for="item in sec.items"
                    :key="item[0]"
                    class="sp-item"
                  >
                    <i :class="`bi bi-${item[2]}`"></i>
                    <span>{{ item[1] }}</span>
                    <i class="bi bi-check-circle-fill sp-check"></i>
                  </div>
                </div>
              </aside>

              <div class="spm-content">
                <div class="spm-page-hd">
                  <b>{{ draftSidebarPreview[0].items[0][1] }}</b>
                  <div class="t-xs muted">Content preview</div>
                </div>
                <div class="spm-cards">
                  <div class="spm-card"></div>
                  <div class="spm-card"></div>
                  <div class="spm-card"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="sp-footer">
            <span class="badge-x b-brand">
              <i class="bi bi-file-earmark"></i>
              {{ draftSidebarPreview.reduce((s, sec) => s + sec.items.length, 0) }} pages
            </span>
            <span class="badge-x b-gray">
              <i class="bi bi-list-ul"></i>
              {{ draftSidebarPreview.length }} sections
            </span>
          </div>
        </div>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="closeEditor">Cancel</button>
        <button class="btn btn-primary btn-sm" @click="saveDraft">
          <i class="bi bi-check2-circle"></i> Save Permissions
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
/* ═══════════════ PAGE HEADER PILL ═══════════════ */
.page-hd-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, #eef4ff, #f5f3ff);
  border: 1px solid var(--brand-100);
  color: var(--brand-700);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
  margin-left: 10px;
  vertical-align: middle;
}

/* ═══════════════ ROLE CARDS ═══════════════ */
.role-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: transform .22s cubic-bezier(.2, .8, .2, 1), box-shadow .22s, border-color .22s;
  position: relative;
  overflow: hidden;
  animation: rcFadeIn .4s cubic-bezier(.2, .8, .2, 1) backwards;
}
@keyframes rcFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}
.role-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--soft);
  opacity: 0;
  transition: opacity .22s;
  pointer-events: none;
  z-index: 0;
}
.role-card > * {
  position: relative;
  z-index: 1;
}
.role-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px -12px rgba(15, 23, 42, .18);
  border-color: var(--accent);
}
.role-card:hover::before {
  opacity: 1;
}

/* Top accent bar */
.rc-bar-top {
  position: absolute !important;
  top: 0; left: 0; right: 0;
  height: 4px;
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  z-index: 2;
}

/* Header */
.rc-top {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding-top: 4px;
}
.rc-avatar {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 20px;
  flex: none;
  box-shadow: 0 8px 20px rgba(15, 23, 42, .18);
  transition: transform .22s;
}
.role-card:hover .rc-avatar {
  transform: scale(1.06) rotate(-3deg);
}
.rc-info {
  flex: 1;
  min-width: 0;
  padding-top: 2px;
}
.rc-name {
  font-weight: 800;
  font-size: 15px;
  color: var(--ink-900);
  margin-bottom: 4px;
  letter-spacing: -.01em;
}
.rc-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--ink-500);
}
.rc-level,
.rc-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.rc-level i,
.rc-count i {
  font-size: 10px;
  opacity: .7;
}
.rc-edit {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--ink-500);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: .14s;
  font-size: 14px;
}
.rc-edit:hover {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  transform: rotate(90deg);
}

.rc-desc {
  font-size: 12.5px;
  color: var(--ink-600);
  line-height: 1.6;
  margin: 0;
}

/* Tags */
.rc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rc-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--ink-25);
  color: var(--ink-500);
  border: 1px solid var(--border);
}
.rc-tag i {
  font-size: 10px;
  color: var(--accent);
}

/* Stats grid */
.rc-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.rc-stat {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.rc-stat-ico {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  font-size: 13px;
  flex: none;
}
.rc-stat-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rc-stat-body b {
  font-size: 15px;
  font-weight: 800;
  color: var(--ink-900);
  font-family: 'JetBrains Mono', monospace;
  line-height: 1;
  letter-spacing: -.02em;
}
.rc-stat-body span {
  font-size: 9.5px;
  color: var(--ink-400);
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-top: 3px;
  font-weight: 700;
}

/* Coverage */
.rc-coverage {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rc-coverage-hd {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11px;
  color: var(--ink-500);
  font-weight: 600;
  letter-spacing: .02em;
}
.rc-coverage-hd b {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 800;
}
.rc-bar {
  height: 6px;
  background: var(--ink-50);
  border-radius: 999px;
  overflow: hidden;
}
.rc-bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width .7s cubic-bezier(.2, .8, .2, 1);
}

/* Button */
.rc-btn {
  width: 100%;
  padding: 9px;
  border-radius: 10px;
  border: 1.5px solid;
  background: transparent;
  font-weight: 700;
  font-size: 12.5px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: .14s;
  font-family: inherit;
  margin-top: auto;
  letter-spacing: -.005em;
}
.rc-btn:hover {
  background: var(--accent);
  color: #fff !important;
  border-color: var(--accent) !important;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px -4px var(--accent);
}

/* ═══════════════ PERMISSION MATRIX ═══════════════ */
.matrix-tbl thead th {
  vertical-align: middle;
  padding: 14px 10px;
}
.mt-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: .03em;
  text-transform: uppercase;
  color: var(--ink-500);
}
.mt-header i {
  font-size: 15px;
  color: var(--brand-600);
}

.mt-role {
  display: flex;
  align-items: center;
  gap: 10px;
}
.mt-avatar {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 13px;
  flex: none;
  box-shadow: 0 4px 10px rgba(15, 23, 42, .12);
}
.mt-role b {
  font-size: 13px;
  color: var(--ink-900);
  font-weight: 700;
}

.mt-cell {
  width: 44px;
  height: 34px;
  border-radius: 9px;
  border: 1.5px solid transparent;
  cursor: pointer;
  font-weight: 700;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  transition: transform .14s cubic-bezier(.2, .8, .2, 1), box-shadow .14s, border-color .14s;
  display: inline-grid;
  place-items: center;
  position: relative;
}
.mt-cell:hover {
  transform: scale(1.15);
  box-shadow: 0 6px 16px -4px rgba(15, 23, 42, .2);
  border-color: rgba(255, 255, 255, .5);
  z-index: 5;
}
.mt-cell i {
  font-size: 14px;
}
.mt-full {
  background: linear-gradient(135deg, #6ee7b7, #10b981);
  color: #fff;
  box-shadow: 0 2px 6px -2px rgba(16, 185, 129, .4);
}
.mt-partial {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #fff;
  box-shadow: 0 2px 6px -2px rgba(245, 158, 11, .4);
}
.mt-none {
  background: var(--ink-50);
  color: var(--ink-400);
}
.mt-none:hover {
  background: var(--ink-100);
  color: var(--ink-600);
}

/* Legend in card header */
.matrix-legend-inline {
  display: flex;
  gap: 14px;
  font-size: 11px;
  color: var(--ink-500);
  font-weight: 600;
}
.matrix-legend-inline > span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.matrix-legend {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  background: var(--surface-2);
  font-size: 12px;
  color: var(--ink-500);
  flex-wrap: wrap;
}
.matrix-legend > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mt-legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  display: inline-block;
}

/* ═══════════════ USERS BY ROLE ═══════════════ */
.ubr-role {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ubr-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 14px;
  flex: none;
  box-shadow: 0 4px 10px rgba(15, 23, 42, .12);
}
.ubr-count {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 14px;
  color: var(--ink-900);
}
.share-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.share-bar {
  flex: 1;
  max-width: 160px;
  height: 6px;
  background: var(--ink-50);
  border-radius: 999px;
  overflow: hidden;
}
.share-fill {
  height: 100%;
  border-radius: 999px;
  transition: width .7s cubic-bezier(.2, .8, .2, 1);
}
.share-pct {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ink-500);
  min-width: 36px;
  text-align: right;
}

/* ═══════════════ EDITOR: BANNER ═══════════════ */
.editor-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid var(--border);
}
.eb-avatar {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 22px;
  flex: none;
  box-shadow: 0 8px 20px rgba(15, 23, 42, .15);
}
.eb-info {
  flex: 1;
  min-width: 0;
}
.eb-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--ink-900);
  margin-bottom: 3px;
  letter-spacing: -.01em;
}
.eb-desc {
  font-size: 12.5px;
  color: var(--ink-500);
  line-height: 1.5;
}
.eb-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.eb-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.eb-stat b {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 16px;
  color: var(--ink-900);
  line-height: 1;
}
.eb-stat span {
  font-size: 10px;
  color: var(--ink-400);
  text-transform: uppercase;
  letter-spacing: .06em;
  font-weight: 700;
  margin-top: 3px;
}

/* ═══════════════ EDITOR: QUICK ACTIONS ═══════════════ */
.quick-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  background: linear-gradient(135deg, #f8fafc, #fff);
  border-radius: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  border: 1px solid var(--border);
}
.qa-left {
  display: flex;
  gap: 6px;
}
.qa-right {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-wrap: wrap;
}
.qa-label {
  font-size: 11.5px;
  color: var(--ink-400);
  font-weight: 600;
  letter-spacing: .02em;
  margin-right: 4px;
}

/* ═══════════════ EDITOR: PERM GRID ═══════════════ */
.perm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.perm-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
  transition: border-color .15s, box-shadow .15s;
}
.perm-card:hover {
  border-color: var(--brand-200);
  box-shadow: 0 6px 16px -8px rgba(79, 109, 245, .25);
}
.perm-card-hd {
  padding: 11px 13px;
  background: linear-gradient(135deg, #eef4ff, #fbfcfe);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.perm-card-title {
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 700;
  font-size: 12.5px;
  color: var(--ink-900);
}
.pct-ico {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid var(--brand-100);
  display: grid;
  place-items: center;
  color: var(--brand-600);
  font-size: 13px;
  flex: none;
}
.perm-hd-btn {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink-400);
  cursor: pointer;
  display: grid;
  place-items: center;
  font-size: 13px;
  transition: .12s;
}
.perm-hd-btn:hover {
  background: var(--brand-50);
  color: var(--brand-600);
  border-color: var(--brand-200);
}

.perm-card-body {
  padding: 6px;
}
.perm-toggle {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--ink-500);
  transition: .12s;
  user-select: none;
}
.perm-toggle:hover {
  background: var(--ink-25);
}
.perm-toggle input {
  display: none;
}
.pt-check {
  width: 16px;
  height: 16px;
  border-radius: 5px;
  border: 1.5px solid var(--ink-200);
  background: #fff;
  display: grid;
  place-items: center;
  font-size: 11px;
  color: #fff;
  transition: .14s;
  flex: none;
}
.perm-toggle.on .pt-check {
  background: var(--brand-600);
  border-color: var(--brand-600);
}
.pt-label {
  flex: 1;
}
.pt-icon {
  font-size: 12px;
  opacity: .35;
  transition: .14s;
}
.perm-toggle.on {
  color: var(--ink-900);
  font-weight: 600;
  background: var(--brand-50);
}
.perm-toggle.on .pt-icon {
  opacity: 1;
}

/* ═══════════════ SIDEBAR PREVIEW ═══════════════ */
.sidebar-preview {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sp-info {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #eef4ff, #fff);
  border: 1px solid var(--brand-100);
  border-radius: 12px;
  font-size: 13px;
  color: var(--ink-700);
}
.sp-info i {
  color: var(--brand-600);
  font-size: 18px;
  flex: none;
}
.sp-empty {
  padding: 30px;
  text-align: center;
}

/* Mock layout (topbar + sidebar + content) */
.sp-mock {
  background: #06090f;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid #0a101e;
  box-shadow: 0 12px 32px -12px rgba(0, 0, 0, .4);
}
.spm-topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(15, 23, 42, .92);
  border-bottom: 1px solid rgba(255, 255, 255, .05);
  color: #94a3b8;
  font-size: 13px;
}
.spm-topbar > i {
  font-size: 15px;
}
.spm-crumb {
  font-weight: 600;
  color: #cbd5e1;
  font-size: 12.5px;
}

.spm-body {
  display: flex;
  min-height: 320px;
}
.spm-sidebar {
  width: 220px;
  flex: none;
  background: linear-gradient(180deg, #0d1424, #0a1020);
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 460px;
  overflow-y: auto;
}
.spm-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, .06);
  margin-bottom: 6px;
}
.spm-mark {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: linear-gradient(135deg, #4f6df5, #2a3fae);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 10px;
  flex: none;
}
.spm-brand-txt b {
  color: #fff;
  font-size: 12px;
  display: block;
  font-weight: 700;
}
.spm-brand-txt span {
  color: rgba(148, 163, 184, .55);
  font-size: 9px;
  letter-spacing: .1em;
  text-transform: uppercase;
}

.sp-section {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sp-sec-lbl {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, .55);
  padding: 8px 10px 3px;
}
.sp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 7px;
  color: rgba(226, 232, 240, .72);
  font-size: 12.5px;
  font-weight: 500;
  transition: .14s;
}
.sp-item:hover {
  background: rgba(255, 255, 255, .05);
  color: #fff;
}
.sp-item i:first-child {
  font-size: 14px;
  width: 18px;
  text-align: center;
  opacity: .85;
}
.sp-item span {
  flex: 1;
}
.sp-check {
  color: #34d399;
  opacity: .8;
  font-size: 11px;
}

.spm-content {
  flex: 1;
  background: #0a101e;
  padding: 20px 24px;
  min-width: 0;
}
.spm-page-hd {
  color: #e2e8f0;
  font-size: 14px;
  margin-bottom: 4px;
}
.spm-page-hd b {
  font-weight: 800;
}
.spm-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 20px;
}
.spm-card {
  height: 70px;
  background: rgba(255, 255, 255, .03);
  border: 1px solid rgba(255, 255, 255, .05);
  border-radius: 10px;
}

.sp-footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ═══════════════ DARK MODE ═══════════════ */
html[data-theme="dark"] .role-card:hover::before {
  opacity: .15;
}
html[data-theme="dark"] .quick-actions {
  background: linear-gradient(135deg, #0d1728, #0e1524);
}
html[data-theme="dark"] .perm-card-hd {
  background: linear-gradient(135deg, #172554, #0e1524);
}
html[data-theme="dark"] .pct-ico {
  background: #0e1524;
}
html[data-theme="dark"] .pt-check {
  background: #0b1322;
  border-color: var(--border);
}
html[data-theme="dark"] .spm-content {
  background: #06090f;
}
</style>