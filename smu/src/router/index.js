import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from './routes'
import { useSessionStore } from '@/stores/session'
import { useUiStore } from '@/stores/ui'

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0 }
  }
})

// ----------------------------------------------------------------
// Global navigation guard
// ----------------------------------------------------------------
router.beforeEach((to) => {
  const session = useSessionStore()
  const ui      = useUiStore()

  // Restore session from localStorage on first navigation
  if (!session.user) session.restore()

  // Always close any open overlay when navigating
  ui.closeAll()

  const isPublic = to.meta.public === true
  const roles    = to.meta.roles   // undefined = any signed-in user

  // 1. Not signed in + protected route → go to login
  if (!isPublic && !session.user) {
    return {
      name: 'login',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined
    }
  }

  // 2. Signed in + trying to see a public-only page (landing / login / reset)
  //    → send back to dashboard (except reset-password, which is allowed)
  if (
    session.user &&
    isPublic &&
    to.name !== 'reset' &&
    (to.name === 'login' || to.name === 'landing' || to.name === 'forgot')
  ) {
    return { name: 'dashboard' }
  }

  // 3. Signed in but wrong role for this route → go to dashboard
  if (roles && session.user && !roles.includes(session.user.role)) {
    return { name: 'dashboard' }
  }

  return true
})

// ----------------------------------------------------------------
// Document title
// ----------------------------------------------------------------
router.afterEach((to) => {
  const base = 'SMU TMS'
  document.title = to.meta.title
    ? `${to.meta.title} · ${base}`
    : `SMU · Teacher Monitoring System`
})

export default router