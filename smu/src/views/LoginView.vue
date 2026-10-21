<script setup>
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useToast } from '@/composables/useToast'

const route   = useRoute()
const router  = useRouter()
const session = useSessionStore()
const toast   = useToast()

const username = ref('')
const password = ref('')
const showPw   = ref(false)
const loading  = ref(false)
const error    = ref('')

async function submit() {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = 'Enter your username and password.'
    return
  }
  loading.value = true
  try {
    const result = await session.login(username.value, password.value)
    if (!result.ok) {
      error.value = result.error
      return
    }
    toast.ok(`Welcome back, ${result.user.name.split(' ')[0]}!`)
    const redirect = route.query.redirect
    router.push(redirect ? String(redirect) : { name: 'dashboard' })
  } finally {
    loading.value = false
  }
}

/* ---------- quick-fill helper ---------- */
function fill(u) {
  username.value = u
  password.value = '1234'
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card">
      <RouterLink to="/" class="d-block text-center t-xs muted mb-3 text-decoration-none">
        <i class="bi bi-arrow-left"></i> Back to home
      </RouterLink>

      <div class="auth-brand">
        <img src="/st.mary.jpg" alt="SMU" class="brand-logo" />
        <div class="txt">
          <b>ST. MARY'S UNIVERSITY</b>
          <span>Teacher Attendance &amp; Performance</span>
        </div>
      </div>

      <h2>Welcome back</h2>
      <p class="auth-sub">Sign in — your role and dashboard are assigned automatically.</p>

      <div v-if="error" class="auth-error show">
        <i class="bi bi-exclamation-circle"></i> {{ error }}
      </div>

      <form @submit.prevent="submit" autocomplete="off">
        <div class="form-row">
          <label>Username</label>
          <input
            v-model="username"
            class="inp"
            placeholder="e.g. admin"
            autocomplete="off"
            name="smu-username"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
          >
        </div>

        <div class="form-row">
          <label>Password</label>
          <div class="pw-wrap">
            <input
              v-model="password"
              class="inp"
              :type="showPw ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="new-password"
              name="smu-password"
            >
            <button
              type="button"
              class="toggle"
              @click="showPw = !showPw"
            >
              <i :class="showPw ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
            </button>
          </div>

          <RouterLink to="/forgot" class="forgot-link">
            Forgot password?
          </RouterLink>
        </div>

        <button
          type="submit"
          class="btn btn-primary w-100 justify-content-center"
          style="height:42px;font-size:14px"
          :disabled="loading"
        >
          <i class="bi bi-box-arrow-in-right"></i>
          {{ loading ? 'Signing in…' : 'Sign In' }}
        </button>
      </form>

      <!-- ═══════════ Demo credentials ═══════════ -->
      <details class="auth-demo">
        <summary>Demo credentials — click any to fill</summary>
        <div style="margin-top:10px;font-size:12px;line-height:2">
          <div style="font-weight:700;color:var(--ink-700);margin-bottom:4px">Administrator</div>
          <div>
            <a href="#" @click.prevent="fill('admin')"><code>admin</code></a> / <code>1234</code>
          </div>

          <div style="font-weight:700;color:var(--ink-700);margin:10px 0 4px">Department Heads</div>
          <div>
            <a href="#" @click.prevent="fill('alemayehu')"><code>alemayehu</code></a> — Computer Science<br>
            <a href="#" @click.prevent="fill('hanna')"><code>hanna</code></a> — Accounting and Finance<br>
            <a href="#" @click.prevent="fill('yonas')"><code>yonas</code></a> — Management<br>
            <a href="#" @click.prevent="fill('bethlehem')"><code>bethlehem</code></a> — Marketing Management<br>
            <a href="#" @click.prevent="fill('meseret')"><code>meseret</code></a> — Economics<br>
            <a href="#" @click.prevent="fill('selamH')"><code>selamH</code></a> — Tourism &amp; Hospitality
          </div>

          <div style="font-weight:700;color:var(--ink-700);margin:10px 0 4px">Teacher &amp; Others</div>
          <div>
            <a href="#" @click.prevent="fill('tadesse')"><code>tadesse</code></a> — Teacher (Computer Science)<br>
            <a href="#" @click.prevent="fill('alemitu')"><code>alemitu</code></a> — Class Representative<br>
            <a href="#" @click.prevent="fill('abebe')"><code>abebe</code></a> — Student
          </div>

          <div style="color:var(--ink-400);margin-top:8px;font-size:11px">
            All passwords are <code>1234</code>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>