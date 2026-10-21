<script setup>
import Modal from './Modal.vue'

defineProps({
  title:        { type: String, default: 'Confirm' },
  subtitle:     { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel:  { type: String, default: 'Cancel' },
  danger:       { type: Boolean, default: false },
  busy:         { type: Boolean, default: false }
})
const emit = defineEmits(['cancel', 'confirm'])
</script>

<template>
  <Modal :title="title" :subtitle="subtitle" @close="emit('cancel')">
    <p style="font-size:13.5px;color:var(--ink-700)">
      <slot />
    </p>

    <template #footer>
      <button
        class="btn btn-secondary btn-sm"
        :disabled="busy"
        @click="emit('cancel')"
      >
        {{ cancelLabel }}
      </button>
      <button
        class="btn btn-sm"
        :class="danger ? 'btn-danger' : 'btn-primary'"
        :disabled="busy"
        @click="emit('confirm')"
      >
        <i v-if="busy" class="bi bi-arrow-clockwise"></i>
        {{ confirmLabel }}
      </button>
    </template>
  </Modal>
</template>