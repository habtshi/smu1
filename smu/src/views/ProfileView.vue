<script setup>
import { ref, computed } from 'vue'
import { useSessionStore } from '@/stores/session'
import { useDirectoryStore } from '@/stores/directory'
import { useSettingsStore } from '@/stores/settings'
import Modal from '@/components/common/Modal.vue'
import { useToast } from '@/composables/useToast'
import { initials } from '@/utils/format'
import { ROLE_LABEL } from '@/utils/constants'
import { passwordPolicyValid, passwordPolicyMessage } from '@/utils/validators'

const session   = useSessionStore()
const directory = useDirectoryStore()
const settings  = useSettingsStore()
const toast     = useToast()

const user = computed(() => session.user || {})
const roleLabel = computed(() => ROLE_LABEL[user.value.role] || '—')

/* ══════════════════ EDIT PROFILE ══════════════════ */
const editOpen = ref(false)
const editErr  = ref('')
const draft    = ref({})

function openEdit() {
  editErr.value = ''
  draft.value = {
    firstName: user.value.firstName || (user.value.name || '').split(' ')[0] || '',
    middleName: user.value.middleName || '',
    lastName: user.value.lastName || (user.value.name || '').split(' ').slice(-1)[0] || '',
    email: user.value.email || '',
    phone: user.value.phone || ''
  }
  editOpen.value = true
}

function saveProfile() {
  const d = draft.value
  editErr.value = ''

  if (!d.firstName || !d.lastName) { editErr.value = 'First and last name are required.'; return }
  if (!d.email) { editErr.value = 'Email is required.'; return }

  const email = d.email.toLowerCase()
  if (directory.users.some(u => u.id !== user.value.id && String(u.email).toLowerCase() === email)) {
    editErr.value = 'That email is already in use by another account.'; return
  }

  const newName = [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ')
  const oldName = user.value.name

  directory.updateUser(user.value.id, {
    firstName: d.firstName,
    middleName: d.middleName,
    lastName: d.lastName,
    name: newName,
    email: d.email,
    phone: d.phone
  })

  // cascade name change in reports
  if (oldName !== newName) {
    const updated = directory.users.find(u => u.id === user.value.id)
    session.setUser({ ...updated, password: undefined })
  } else {
    const updated = directory.users.find(u => u.id === user.value.id)
    session.setUser({ ...updated, password: undefined })
  }

  settings.audit('Update Profile', 'Profile', `${newName} updated their profile`)
  toast.ok('Profile updated')
  editOpen.value = false
}

/* ══════════════════ CHANGE PASSWORD ══════════════════ */
const pwOpen   = ref(false)
const showPw   = ref(false)
const pwOld    = ref('')
const pwNew    = ref('')
const pwConf   = ref('')
const pwErr    = ref('')

function openPassword() {
  pwOld.value = ''
  pwNew.value = ''
  pwConf.value = ''
  pwErr.value = ''
  showPw.value = false
  pwOpen.value = true
}

function savePassword() {
  pwErr.value = ''
  const cur = directory.users.find(u => u.id === user.value.id)
  if (!cur) { pwErr.value = 'Account not found.'; return }

  if (pwOld.value !== cur.password) { pwErr.value = 'Current password is incorrect.'; return }
  if (!passwordPolicyValid(pwNew.value)) { pwErr.value = passwordPolicyMessage(); return }
  if (pwNew.value === pwOld.value) { pwErr.value = 'New password must be different from the current one.'; return }
  if (pwNew.value !== pwConf.value) { pwErr.value = 'New passwords do not match.'; return }

  directory.updateUser(user.value.id, { password: pwNew.value })
  settings.audit('Change Password', 'Profile', `${user.value.name} changed their password`)
  toast.ok('Password changed successfully')
  pwOpen.value = false
}
</script>

<template>
  <div>
    <div class="page-hd">
      <div>
        <h1>My Profile</h1>
        <div class="sub">Manage your account information and password</div>
      </div>
      <div class="page-hd-actions">
        <button class="btn btn-secondary btn-sm" @click="openPassword">
          <i class="bi bi-key"></i> Change Password
        </button>
        <button class="btn btn-primary btn-sm" @click="openEdit">
          <i class="bi bi-pencil-square"></i> Edit Profile
        </button>
      </div>
    </div>

    <div class="row g-3">
      <!-- Avatar card -->
      <div class="col-xl-4">
        <div class="card" style="padding:24px;text-align:center">
          <div class="sb-mark"
               style="width:88px;height:88px;font-size:30px;border-radius:24px;margin:0 auto 14px">
            {{ initials(user.name) }}
          </div>
          <h2 style="font-size:18px;margin-bottom:4px">{{ user.name }}</h2>
          <div class="muted" style="font-size:13px;margin-bottom:10px">{{ user.position || roleLabel }}</div>
          <span class="badge-x b-brand">{{ roleLabel }}</span>
        </div>
      </div>

      <!-- Info card -->
      <div class="col-xl-8">
        <div class="card">
          <div class="card-hd"><h3><i class="bi bi-person"></i> Personal Information</h3></div>
          <div class="card-bd">
            <div class="info-row"><div class="k">Full Name</div><div class="v">{{ user.name }}</div></div>
            <div class="info-row"><div class="k">Staff ID</div><div class="v mono">{{ user.staffId || '—' }}</div></div>
            <div class="info-row"><div class="k">Username</div><div class="v mono">{{ user.username }}</div></div>
            <div class="info-row"><div class="k">Email</div><div class="v">{{ user.email }}</div></div>
            <div class="info-row"><div class="k">Phone</div><div class="v">{{ user.phone || '—' }}</div></div>
            <div class="info-row"><div class="k">Department</div><div class="v">{{ user.department || '—' }}</div></div>
            <div class="info-row"><div class="k">Position</div><div class="v">{{ user.position || '—' }}</div></div>
            <div class="info-row"><div class="k">Role</div><div class="v">{{ roleLabel }}</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════ Edit modal ══════ -->
    <Modal v-if="editOpen" title="Edit Profile"
           subtitle="Role and staff ID are managed by the Administrator"
           @close="editOpen = false">
      <div class="row g-3">
        <div class="col-md-6">
          <div class="form-row"><label>First Name <span class="req">*</span></label>
            <input v-model.trim="draft.firstName" class="inp" /></div>
        </div>
        <div class="col-md-6">
          <div class="form-row"><label>Last Name <span class="req">*</span></label>
            <input v-model.trim="draft.lastName" class="inp" /></div>
        </div>
        <div class="col-md-6">
          <div class="form-row"><label>Middle Name</label>
            <input v-model.trim="draft.middleName" class="inp" /></div>
        </div>
        <div class="col-md-6">
          <div class="form-row"><label>Phone</label>
            <input v-model.trim="draft.phone" class="inp" placeholder="+251 …" /></div>
        </div>
        <div class="col-12">
          <div class="form-row"><label>Email <span class="req">*</span></label>
            <input v-model.trim="draft.email" type="email" class="inp" /></div>
        </div>
      </div>

      <div v-if="editErr" class="auth-error show" style="margin-top:12px">
        <i class="bi bi-exclamation-circle"></i> {{ editErr }}
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="editOpen = false">Cancel</button>
        <button class="btn btn-primary btn-sm" @click="saveProfile">
          <i class="bi bi-check2"></i> Save Changes
        </button>
      </template>
    </Modal>

    <!-- ══════ Change Password ══════ -->
    <Modal v-if="pwOpen" title="Change Password" @close="pwOpen = false">
      <div class="form-row">
        <label>Current Password <span class="req">*</span></label>
        <div class="pw-wrap">
          <input v-model="pwOld" :type="showPw ? 'text' : 'password'" class="inp" />
          <button type="button" class="toggle" @click="showPw = !showPw">
            <i :class="showPw ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
          </button>
        </div>
      </div>
      <div class="form-row">
        <label>New Password <span class="req">*</span></label>
        <input v-model="pwNew" :type="showPw ? 'text' : 'password'" class="inp"
               placeholder="minimum 8 characters" />
      </div>
      <div class="form-row">
        <label>Confirm New Password <span class="req">*</span></label>
        <input v-model="pwConf" :type="showPw ? 'text' : 'password'" class="inp" />
      </div>

      <div v-if="pwErr" class="auth-error show">
        <i class="bi bi-exclamation-circle"></i> {{ pwErr }}
      </div>

      <div class="alert-pill alert-warning" style="display:inline-flex;padding:10px 12px">
        <i class="bi bi-shield-lock-fill"></i>
        <span style="margin-left:6px">You will remain signed in after changing your password.</span>
      </div>

      <template #footer>
        <button class="btn btn-secondary btn-sm" @click="pwOpen = false">Cancel</button>
        <button class="btn btn-primary btn-sm" @click="savePassword">
          <i class="bi bi-check2"></i> Update Password
        </button>
      </template>
    </Modal>
  </div>
</template>