<script setup>
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()

function iconFor(type) {
  switch (type) {
    case 'ok':   return 'bi-check-circle-fill'
    case 'err':  return 'bi-x-circle-fill'
    case 'info': return 'bi-info-circle-fill'
    default:     return 'bi-exclamation-triangle-fill'
  }
}
</script>

<template>
  <div class="toasts" aria-live="polite" aria-atomic="true">
    <div
      v-for="t in toasts"
      :key="t.id"
      class="toast-x"
      :class="t.type"
      :role="t.type === 'err' ? 'alert' : 'status'"
    >
      <i :class="`bi ${iconFor(t.type)}`"></i>
      <span>{{ t.msg }}</span>
    </div>
  </div>
</template>