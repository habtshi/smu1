<script setup>
import { computed } from 'vue'
import { RATING_META, PERF_META } from '@/utils/constants'

const props = defineProps({
  rating: { type: String, default: null },              // Green / Blue / Yellow / Red
  kind:   { type: String, default: 'attendance' },      // 'attendance' | 'performance'
  showLabel: { type: Boolean, default: false }          // show human label instead of the color name
})

const meta = computed(() => {
  if (!props.rating) return null
  return (props.kind === 'performance' ? PERF_META : RATING_META)[props.rating] || null
})

const badgeClass = computed(() => {
  if (!props.rating) return 'b-gray'
  return {
    Green:  'b-green',
    Blue:   'b-blue',
    Yellow: 'b-amber',
    Red:    'b-red'
  }[props.rating] || 'b-gray'
})

const label = computed(() => {
  if (!props.rating) return '—'
  if (props.showLabel) return meta.value?.label || props.rating
  if (props.kind === 'attendance' && props.rating === 'Red') return 'Red (Absent)'
  return props.rating
})
</script>

<template>
  <span v-if="!rating" class="badge-x b-gray">—</span>
  <span
    v-else
    class="badge-x"
    :class="badgeClass"
    :style="meta ? { background: meta.bg, color: meta.color } : {}"
  >
    <span
      class="dot"
      :style="{ background: meta?.color, marginRight: '5px' }"
    ></span>
    {{ label }}
  </span>
</template>