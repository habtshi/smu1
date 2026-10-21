<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useDirectoryStore } from '@/stores/directory'

const directory = useDirectoryStore()

const email      = ref('')
const error      = ref('')
const submitted  = ref(false)   // true = show the link panel
const token      = ref('')
const resetUrl   = ref('')

function submit() {
  error.value = ''

  const e = email.value.trim().toLowerCase()
  if (!e) { error.value = 'Please enter your email address.'; return }

  // Generate a token
  const t = 'rst_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36)

  // Store token (only if user exists — but we always show success to avoid email enumeration)
  const user = directory.users.find(u => (u.email || '').toLowerCase() === e)
  if (user) {
    let tokens = {}
    try { tokens = JSON.parse(localStorage.getItem('tms_resetTokens') || '{}') } catch {}
    Object.keys(tokens).forEach(k => { if (tokens[k].userId === user.id) delete tokens[k] })
    tokens[t] = {
      userId: user.id,
      email: user.email,
      expires: Date.now() + 30 * 60 * 1000,
      createdAt: new Date().toISOString()
    }
    localStorage.setItem('tms_resetTokens', JSON.stringify(tokens))
    console.log('[ForgotPassword] token created for', user.email, '→', t)
  } else {
    console.warn('[ForgotPassword] unknown email:', e)
  }

  token.value = t
  resetUrl.value = `${window.location.origin}${window.location.pathname}#/reset/${t}`
  submitted.value = true
}

function reset() {
  submitted.value = false
  email.value = ''
  error.value = ''
  token.value = ''
  resetUrl.value = ''
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card">

      <!-- Brand -->
      <div class="auth-brand">
        <img src="/st.mary.jpg" alt="SMU" class="brand-logo" />
        <div class="txt">
          <b>ST. MARY'S UNIVERSITY</b>
          <span>Teacher Monitoring</span>
        </div>
      </div>

      <!-- ══════════════ STEP 1 — FORM ══════════════ -->
      <template v-if="!submitted">
        <h2>Reset your password</h2>
        <p class="auth-sub">Enter your email and we'll send you a reset link</p>

        <div class="auth-error" :class="{ show: !!error }">{{ error }}</div>

        <form @submit.prevent="submit">
          <div class="form-row">
            <label>Email address</label>
            <input
              v-model.trim="email"
              type="email"
              class="inp"
              placeholder="name@smu.edu.et"
              autocomplete="email"
              required
            />
          </div>
          <button
            type="submit"
            class="btn btn-primary"
            style="width:100%;justify-content:center;height:42px;font-size:14px"
          >
            <i class="bi bi-envelope"></i> Send Reset Link
          </button>
        </form>

        <div style="text-align:center;margin-top:16px">
          <RouterLink to="/login"
                      style="font-size:13px;color:var(--brand-600);text-decoration:none">
            <i class="bi bi-arrow-left"></i> Back to sign in
          </RouterLink>
        </div>
      </template>

      <!-- ══════════════ STEP 2 — SUCCESS + RESET LINK ══════════════ -->
      <template v-else>
        <div style="text-align:center;margin-bottom:14px">
          <i class="bi bi-envelope-check"
             style="font-size:56px;color:var(--success);display:block"></i>
        </div>

        <h2 style="font-size:20px;margin-bottom:6px">Check your inbox</h2>
        <p class="auth-sub" style="margin-bottom:16px">
          If an account exists for <b>{{ email }}</b>, a password reset link has been sent.
        </p>

        <div class="auth-demo" style="margin:0 0 14px">
          <div style="font-size:12px;color:var(--ink-500);margin-bottom:8px">
            <i class="bi bi-info-circle"></i> Demo mode — the link below is what would be emailed to you:
          </div>
          <RouterLink
            :to="{ name: 'reset', params: { token } }"
            style="font-size:12.5px;color:var(--brand-600);word-break:break-all;display:block;font-family:'JetBrains Mono',monospace"
          >
            #/reset/{{ token }}
          </RouterLink>
        </div>

        <div class="alert-pill alert-warning"
             style="display:inline-flex;padding:10px 12px;margin-bottom:16px">
          <i class="bi bi-clock"></i>
          <span style="margin-left:6px">Link expires in 30 minutes.</span>
        </div>

        <!-- Big buttons -->
        <RouterLink
          :to="{ name: 'reset', params: { token } }"
          class="btn btn-primary"
          style="width:100%;justify-content:center;height:42px;font-size:14px;margin-bottom:10px"
        >
          <i class="bi bi-box-arrow-up-right"></i> Open reset link
        </RouterLink>

        <button
          type="button"
          class="btn btn-secondary"
          style="width:100%;justify-content:center;height:42px;font-size:14px"
          @click="reset"
        >
          <i class="bi bi-arrow-clockwise"></i> Use a different email
        </button>

        <div style="text-align:center;margin-top:16px">
          <RouterLink to="/login"
                      style="font-size:13px;color:var(--brand-600);text-decoration:none">
            <i class="bi bi-arrow-left"></i> Back to sign in
          </RouterLink>
        </div>
      </template>

    </div>
  </div>
</template>