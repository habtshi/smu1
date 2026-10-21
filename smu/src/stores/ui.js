import { defineStore } from 'pinia'
import { ref } from 'vue'

/* ============================================================
   UI store — sidebar, mobile nav, overlays, dark mode
   ============================================================ */

const SIDEBAR_KEY = 'tms_ui_sidebar'
const THEME_KEY   = 'tms_ui_dark'

function loadBool(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : raw === '1'
  } catch { return fallback }
}
function saveBool(key, value) {
  try { localStorage.setItem(key, value ? '1' : '0') } catch {}
}

export const useUiStore = defineStore('ui', () => {
  /* ---------------- state ---------------- */
  const sidebarCollapsed   = ref(loadBool(SIDEBAR_KEY, false))
  const mobileNavOpen      = ref(false)
  const commandPaletteOpen = ref(false)
  const notifPanelOpen     = ref(false)
  const userMenuOpen       = ref(false)
  const darkMode           = ref(loadBool(THEME_KEY, false))

  /* ---------------- sidebar ---------------- */
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    saveBool(SIDEBAR_KEY, sidebarCollapsed.value)
  }
  function setSidebarCollapsed(v) {
    sidebarCollapsed.value = !!v
    saveBool(SIDEBAR_KEY, sidebarCollapsed.value)
  }

  /* ---------------- mobile nav ---------------- */
  function toggleMobileNav() {
    mobileNavOpen.value = !mobileNavOpen.value
    if (mobileNavOpen.value) {
      notifPanelOpen.value = false
      userMenuOpen.value = false
      commandPaletteOpen.value = false
    }
  }
  function openMobileNav()  { mobileNavOpen.value = true }
  function closeMobileNav() { mobileNavOpen.value = false }

  /* ---------------- command palette ---------------- */
  function openCommandPalette() {
    commandPaletteOpen.value = true
    notifPanelOpen.value = false
    userMenuOpen.value = false
    mobileNavOpen.value = false
  }
  function closeCommandPalette() { commandPaletteOpen.value = false }
  function toggleCommandPalette() {
    commandPaletteOpen.value ? closeCommandPalette() : openCommandPalette()
  }

  /* ---------------- notification panel ---------------- */
  function toggleNotifPanel() {
    notifPanelOpen.value = !notifPanelOpen.value
    if (notifPanelOpen.value) {
      userMenuOpen.value = false
      commandPaletteOpen.value = false
      mobileNavOpen.value = false
    }
  }
  function closeNotifPanel() { notifPanelOpen.value = false }

  /* ---------------- user menu ---------------- */
  function toggleUserMenu() {
    userMenuOpen.value = !userMenuOpen.value
    if (userMenuOpen.value) {
      notifPanelOpen.value = false
      commandPaletteOpen.value = false
      mobileNavOpen.value = false
    }
  }
  function closeUserMenu() { userMenuOpen.value = false }

  /* ---------------- dark mode (FIXED) ---------------- */
  // The CSS theme uses html[data-theme="dark"], so we set the attribute.
  function applyDarkMode() {
    document.documentElement.setAttribute(
      'data-theme',
      darkMode.value ? 'dark' : 'light'
    )
  }
  function setDarkMode(v) {
    darkMode.value = !!v
    saveBool(THEME_KEY, darkMode.value)
    applyDarkMode()
  }
  function toggleDarkMode() {
    setDarkMode(!darkMode.value)
  }

  /* ---------------- close everything ---------------- */
  function closeAll() {
    mobileNavOpen.value = false
    commandPaletteOpen.value = false
    notifPanelOpen.value = false
    userMenuOpen.value = false
  }

  /* ---------------- bootstrap ---------------- */
  // Apply the theme on store init so a fresh page load keeps the preference
  applyDarkMode()

  return {
    /* state */
    sidebarCollapsed, mobileNavOpen, commandPaletteOpen,
    notifPanelOpen, userMenuOpen, darkMode,

    /* sidebar */
    toggleSidebar, setSidebarCollapsed,

    /* mobile */
    toggleMobileNav, openMobileNav, closeMobileNav,

    /* command palette */
    openCommandPalette, closeCommandPalette, toggleCommandPalette,

    /* notifications */
    toggleNotifPanel, closeNotifPanel,

    /* user menu */
    toggleUserMenu, closeUserMenu,

    /* theme */
    toggleDarkMode, setDarkMode, applyDarkMode,

    /* misc */
    closeAll
  }
})