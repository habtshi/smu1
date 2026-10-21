<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'
import { useAlertsStore } from '@/stores/alerts'
import { useMessagesStore } from '@/stores/messages'
import { useDirectoryStore } from '@/stores/directory'
import { useSettingsStore } from '@/stores/settings'   /* 🆕 feature flags */
import { useBackup } from '@/composables/useBackup'
import { useAutoBackup } from '@/composables/useAutoBackup'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { NAV, ROLE_LABEL } from '@/utils/constants'
import { useToast } from '@/composables/useToast'
import { initials } from '@/utils/format'

const route   = useRoute()
const router  = useRouter()
const session = useSessionStore()
const ui      = useUiStore()
const alerts  = useAlertsStore()
const msgs    = useMessagesStore()
const dir     = useDirectoryStore()
const settings = useSettingsStore()   /* 🆕 */
const toast   = useToast()

/* ---------------- auto-backup scheduler ---------------- */
const autoBackup = useAutoBackup()
const backup     = useBackup()

onMounted(() => {
  if (session.role === 'admin') {
    autoBackup.start(async () => {
      backup.createSnapshot({
        trigger: 'auto',
        download: autoBackup.config.value.download
      })
    })
  }
})

onUnmounted(() => {
  autoBackup.stop()
})

/* ---------------- navigation model ---------------- */
/* 🆕 Filter out any pages the admin has turned OFF in Settings → Features */
const navGroups = computed(() => {
  const groups = NAV[session.role] || []
  const flags  = settings.settings.featureFlags || {}

  return groups
    .map(g => ({
      ...g,
      items: g.items.filter(i => flags[i[0]] !== false)
    }))
    .filter(g => g.items.length > 0)
})

const currentTitle = computed(() => {
  const all = navGroups.value.flatMap(g => g.items)
  const hit = all.find(i => i[0] === route.name)
  return hit ? hit[1] : (route.meta?.title || 'Dashboard')
})

/* ---------------- badge counts ---------------- */
function badgeFor(itemId) {
  if (itemId === 'alerts')   return alerts.activeAlerts.length || null
  if (itemId === 'messages') return msgs.unreadNotifications(session.user) || null
  if (itemId === 'users')    return dir.users.length || null
  return null
}
function badgeClass(itemId) {
  return itemId === 'messages' ? 'danger' : 'warn'
}

/* ---------------- helpers ---------------- */
function toggleSidebar() {
  if (window.innerWidth <= 991) ui.toggleMobileNav()
  else ui.toggleSidebar()
}

function onSidebarClick() {
  if (window.innerWidth <= 991) ui.closeMobileNav()
}

function goProfile() {
  router.push({ name: 'profile' })
}

/* ---------------- sign out ---------------- */
const confirmSignOut = ref(false)

function onSignOut() {
  confirmSignOut.value = true
}

function doSignOut() {
  session.logout()
  ui.closeAll()
  confirmSignOut.value = false
  toast.ok('Signed out successfully')
  router.push({ name: 'login' })
}

function cancelSignOut() {
  confirmSignOut.value = false
}
</script>

<template>
  <div class="app">
    <!-- ═══════════════ SIDEBAR ═══════════════ -->
    <aside class="sb" :class="{ collapsed: ui.sidebarCollapsed, open: ui.mobileNavOpen }">
      <div class="sb-brand">
        <img src="/st.mary.jpg" alt="SMU" class="sb-logo" />
        <div class="sb-brand-txt"><b>SMU TMS</b><span>Teacher Monitoring</span></div>
      </div>

      <div class="sb-scroll">
        <template v-for="sec in navGroups" :key="sec.section">
          <div class="sb-sec">{{ sec.section }}</div>
          <nav class="sb-nav" aria-label="Primary navigation">
            <RouterLink
              v-for="item in sec.items"
              :key="item[0]"
              :to="{ name: item[0] }"
              :title="item[1]"
              :class="{ active: route.name === item[0] }"
              @click="onSidebarClick"
            >
              <i :class="`bi bi-${item[2]}`"></i>
              <span>{{ item[1] }}</span>
              <span
                v-if="badgeFor(item[0])"
                class="sb-badge"
                :class="badgeClass(item[0])"
              >{{ badgeFor(item[0]) }}</span>
            </RouterLink>
          </nav>
        </template>
      </div>

      <div class="sb-foot">
        <div class="sb-user" @click="goProfile">
          <div class="av">{{ initials(session.user?.name) }}</div>
          <div class="meta">
            <b>{{ session.user?.name }}</b>
            <span>{{ session.roleLabel }}</span>
          </div>
        </div>
      </div>
    </aside>

    <!-- mobile backdrop -->
    <div
      class="sb-backdrop"
      :class="{ show: ui.mobileNavOpen }"
      @click="ui.closeMobileNav()"
    ></div>

    <!-- ═══════════════ MAIN ═══════════════ -->
    <div class="main">
      <header class="tb">
        <button class="tb-btn" aria-label="Toggle navigation" @click="toggleSidebar">
          <i class="bi bi-list"></i>
        </button>

        <div class="tb-crumb d-none d-md-block">
          <b>{{ session.roleLabel }}</b> · {{ currentTitle }}
        </div>

        <div class="tb-spacer"></div>

        <!-- Theme toggle -->
        <button
          class="tb-btn theme-toggle"
          :title="ui.darkMode ? 'Switch to light mode' : 'Enable dark mode'"
          @click="ui.toggleDarkMode()"
        >
          <i :class="ui.darkMode ? 'bi bi-sun' : 'bi bi-moon-stars'"></i>
        </button>

        <!-- Notifications bell -->
        <button
          class="tb-btn"
          aria-label="Notifications"
          @click="router.push({ name: 'messages' })"
        >
          <i class="bi bi-bell"></i>
          <span v-if="msgs.unreadNotifications(session.user)" class="tb-dot"></span>
        </button>

        <!-- Profile -->
        <button
          class="tb-btn"
          aria-label="My profile"
          title="My profile"
          @click="goProfile"
        >
          <i class="bi bi-person-circle"></i>
        </button>

        <!-- Sign out -->
        <button
          class="tb-btn"
          aria-label="Sign out"
          title="Sign out"
          @click="onSignOut"
        >
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </header>

      <main class="content" id="view">
        <slot />
      </main>
    </div>

    <!-- ═══════════════ SIGN OUT CONFIRM ═══════════════ -->
    <ConfirmDialog
      v-if="confirmSignOut"
      title="Sign Out"
      subtitle="You will be returned to the login page"
      confirm-label="Sign Out"
      cancel-label="Stay"
      danger
      @cancel="cancelSignOut"
      @confirm="doSignOut"
    >
      Are you sure you want to sign out of SMU TMS?
    </ConfirmDialog>
  </div>
</template>