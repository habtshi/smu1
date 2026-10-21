<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  title:    { type: String, default: '' },
  subtitle: { type: String, default: '' },
  size:     { type: String, default: '' }, // '', 'wide', 'xwide'
  closeOnBackdrop: { type: Boolean, default: true }
})
const emit = defineEmits(['close'])

function onKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}
function onBackdrop() {
  if (props.closeOnBackdrop) emit('close')
}

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="modal-ov" role="dialog" aria-modal="true" @click.self="onBackdrop">
    <div class="modal-x" :class="size">
      <div class="modal-hd">
        <div>
          <h3 v-html="title"></h3>
          <div v-if="subtitle" class="sub">{{ subtitle }}</div>
        </div>
        <button
          class="modal-close"
          type="button"
          aria-label="Close dialog"
          @click="emit('close')"
        >
          <i class="bi bi-x-lg"></i>
        </button>
      </div>

      <div class="modal-bd"><slot /></div>

      <div v-if="$slots.footer" class="modal-ft">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>