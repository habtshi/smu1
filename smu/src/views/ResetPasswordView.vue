<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useDirectoryStore } from '@/stores/directory'
import { useSettingsStore } from '@/stores/settings'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'
import { passwordPolicyValid, passwordPolicyMessage } from '@/utils/validators'

const route     = useRoute()
const router    = useRouter()
const directory = useDirectoryStore()
const settings  = useSettingsStore()
const session   = useSessionStore()
const toast     = useToast()

/* ---------- state ---------- */
const entry   = ref(null)      // { token, userId, email, expires }
const p1      = ref('')
const p2      = ref('')
const showPw  = ref(false)
const error   = ref('')

/* ---------- validate token on mount ---------- */
onMounted(() => {
  const token = route.params.token
  let tokens = {}
  try { tokens = JSON.parse(localStorage.getItem('tms_resetTokens') || '{}') } catch {}
  const e = tokens[token]
  if (e && e.expires > Date.now()) {
    entry.value = { token, ...e }
  }
})

const invalid = computed(() => !entry.value)

/* ---------- submit ---------- */
function submit() {
  error.value = ''

  if (!passwordPolicyValid(p1.value)) {
    error.value = passwordPolicyMessage()
    return
  }
  if (p1.value !== p2.value) {
    error.value = 'Passwords do not match.'
    return
  }

  const users = directory.users
  const idx = users.findIndex(u => u.id === entry.value.userId)
  if (idx === -1) {
    error.value = 'Account no longer exists.'
    return
  }

  // Update password
  directory.updateUser(users[idx].id, { password: p1.value })

  // Invalidate all reset tokens for this user
  let tokens = {}
  try { tokens = JSON.parse(localStorage.getItem('tms_resetTokens') || '{}') } catch {}
  Object.keys(tokens).forEach(k => {
    if (tokens[k].userId === entry.value.userId) delete tokens[k]
  })
  localStorage.setItem('tms_resetTokens', JSON.stringify(tokens))

  // Make sure the user lands on the login page
  session.clear()

  settings.audit('Password Reset', 'Auth', `Password reset for ${entry.value.email}`)
  toast.ok('Password reset successfully. Please sign in.')

  setTimeout(() => router.push({ name: 'login' }), 800)
}
</script>

<template>
  <!-- ══════════════════ INVALID / EXPIRED TOKEN ══════════════════ -->
  <div v-if="invalid" class="auth-wrap">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="mark"><i class="bi bi-mortarboard-fill"></i></div>
        <div class="txt">
          <b>ST. MARY'S UNIVERSITY</b>
          <span>Teacher Monitoring</span>
        </div>
      </div>

      <div style="text-align:center;padding:12px 0 20px">
        <i class="bi bi-x-octagon-fill"
           style="font-size:52px;color:var(--danger);display:block;margin-bottom:14px"></i>
        <h2 style="font-size:20px;margin-bottom:6px">Link expired or invalid</h2>
        <p class="auth-sub" style="margin:0">
          This password reset link is no longer valid.<br>Please request a new one.
        </p>
      </div>

      <RouterLink to="/forgot" class="btn btn-primary"
                  style="width:100%;justify-content:center;height:42px">
        <i class="bi bi-arrow-clockwise"></i> Request New Link
      </RouterLink>

      <div style="text-align:center;margin-top:14px">
        <RouterLink to="/login"
                    style="font-size:13px;color:var(--brand-600);text-decoration:none">
          <i class="bi bi-arrow-left"></i> Back to sign in
        </RouterLink>
      </div>
    </div>
  </div>

  <!-- ══════════════════ VALID TOKEN — SET NEW PASSWORD ══════════════════ -->
  <div v-else class="auth-wrap">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="mark"><i class="bi bi-mortarboard-fill"></i></div>
        <div class="txt">
          <b>ST. MARY'S UNIVERSITY</b>
          <span>Teacher Monitoring</span>
        </div>
      </div>

      <h2>Set a new password</h2>
      <p class="auth-sub">For <b>{{ entry.email }}</b></p>

      <div class="auth-error" :class="{ show: !!error }">{{ error }}</div>

      <form @submit.prevent="submit">
        <div class="form-row">
          <label>New password <span class="req">*</span></label>
          <div class="pw-wrap">
            <input
              v-model="p1"
              :type="showPw ? 'text' : 'password'"
              class="inp"
              placeholder="minimum 8 characters"
              autocomplete="new-password"
              required
            >
            <button type="button" class="toggle" @click="showPw = !showPw">
              <i :class="showPw ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
            </button>
          </div>
        </div>

        <div class="form-row">
          <label>Confirm password <span class="req">*</span></label>
          <div class="pw-wrap">
            <input
              v-model="p2"
              :type="showPw ? 'text' : 'password'"
              class="inp"
              placeholder="retype password"
              autocomplete="new-password"
              required
            >
          </div>
        </div>

        <button type="submit" class="btn btn-primary"
                style="width:100%;justify-content:center;height:42px">
          <i class="bi bi-check2"></i> Reset Password
        </button>
      </form>

      <div style="text-align:center;margin-top:16px">
        <RouterLink to="/login"
                    style="font-size:13px;color:var(--brand-600);text-decoration:none">
          <i class="bi bi-arrow-left"></i> Back to sign in
        </RouterLink>
      </div>
    </div>
  </div>
</template>