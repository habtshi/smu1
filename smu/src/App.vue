<script setup>
import { onMounted, ref, onErrorCaptured } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const route = useRoute()

const err = ref(null)
onErrorCaptured((e) => {
  console.error('[App error boundary]', e)
  err.value = e
  return false
})

onMounted(() => session.restore())
</script>

<template>
  <RouterView v-slot="{ Component, route: r }">
    <component v-if="r.meta.public" :is="Component" />

    <AppShell v-else>
      <div v-if="err" class="card" style="padding:48px 24px;text-align:center">
        <i class="bi bi-exclamation-octagon-fill"
           style="font-size:52px;color:var(--danger);display:block;margin-bottom:14px"></i>
        <h2 style="font-size:20px;margin-bottom:6px">Something went wrong</h2>
        <p class="muted" style="font-size:13.5px;margin-bottom:18px">
          {{ err.message || 'An unexpected error occurred.' }}
        </p>
        <button class="btn btn-primary btn-sm" @click="err = null">
          <i class="bi bi-arrow-clockwise"></i> Try again
        </button>
      </div>

      <component v-else :is="Component" />
    </AppShell>
  </RouterView>
</template>