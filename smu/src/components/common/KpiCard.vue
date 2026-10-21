<script setup>
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], default: '—' },
  unit:  { type: String, default: '' },
  sub:   { type: String, default: '' },
  icon:  { type: String, default: 'graph-up' },
  color: { type: String, default: 'brand' },
  delta: { type: Number, default: null },
  to:    { type: [String, Object], default: null }
})

const deltaClass = computed(() =>
  props.delta > 0 ? 'up' : props.delta < 0 ? 'down' : 'flat'
)
const deltaIcon = computed(() =>
  props.delta > 0 ? 'arrow-up-short'
  : props.delta < 0 ? 'arrow-down-short'
  : 'dash'
)
</script>

<template>
  <component
    :is="to ? RouterLink : 'div'"
    :to="to || undefined"
    class="kpi"
    style="text-decoration:none;color:inherit"
  >
    <div class="kpi-top">
      <div>
        <div class="kpi-label">{{ label }}</div>
        <div class="kpi-val" style="margin-top:6px">
          {{ value }}<small v-if="unit">{{ unit }}</small>
        </div>
      </div>
      <div class="kpi-ico" :class="color">
        <i :class="`bi bi-${icon}`"></i>
      </div>
    </div>
    <div class="kpi-meta">
      <span v-if="delta !== null" class="kpi-delta" :class="deltaClass">
        <i :class="`bi bi-${deltaIcon}`"></i>
        {{ Math.abs(delta).toFixed(1) }}%
      </span>
      <span v-if="sub">{{ sub }}</span>
    </div>
  </component>
</template>