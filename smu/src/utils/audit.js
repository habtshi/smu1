import { useSessionStore } from '@/stores/session'
import { useSettingsStore } from '@/stores/settings'

/* ============================================================
   Audit helper
   ------------------------------------------------------------
   Records an action in the settings store's auditLog. Every
   mutation in the app should call this so we keep a
   chronological record of what happened, who did it, and when.

   Usage inside a component or store:

     import { audit } from '@/utils/audit'

     audit('Submit Report', 'Daily Report', 'Reported Dr. X — G/B')
     audit('Login Failed',  'Auth',         'bad password', 'failure')
   ============================================================ */
export function audit(action, module, detail = '', result = 'success') {
  try {
    const session  = useSessionStore()
    const settings = useSettingsStore()

    const user = session?.user || null

    settings.audit(action, module, detail, result, user)
  } catch (err) {
    // Never let auditing break a user action
    console.warn('[audit] failed:', err)
  }
}

/* ============================================================
   Convenience wrappers for common events
   ============================================================ */
export function auditLogin(user) {
  audit('Login', 'Auth', `${user?.name || 'unknown'} signed in`)
}

export function auditLogout(user) {
  audit('Logout', 'Auth', `${user?.name || 'unknown'} signed out`)
}

export function auditLoginFailure(username) {
  audit('Login Failed', 'Auth', `Failed login attempt for "${username}"`, 'failure')
}

export function auditCrud(verb, module, target) {
  // verb: 'Create' | 'Update' | 'Delete'
  audit(`${verb} ${module}`, module, target)
}

export function auditPasswordReset(targetName) {
  audit('Reset Password', 'Users', `Password reset for ${targetName}`)
}

export function auditRouteBlocked(page) {
  audit('Unauthorized Route', 'RBAC', `Attempted to open "${page}"`, 'failure')
}

/* ============================================================
   Composable
   ============================================================ */
export function useAudit() {
  return {
    audit,
    auditLogin,
    auditLogout,
    auditLoginFailure,
    auditCrud,
    auditPasswordReset,
    auditRouteBlocked
  }
}