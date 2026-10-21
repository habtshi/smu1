<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

/* Default Chart.js theme — matches the HTML build */
Chart.defaults.font.family       = "'Inter', sans-serif"
Chart.defaults.font.size         = 11.5
Chart.defaults.color             = '#64748b'
Chart.defaults.plugins.legend.labels.usePointStyle = true
Chart.defaults.plugins.legend.labels.boxWidth      = 8
Chart.defaults.plugins.legend.labels.padding       = 14
Chart.defaults.plugins.tooltip.padding            = 10
Chart.defaults.plugins.tooltip.backgroundColor    = '#0f172a'
Chart.defaults.plugins.tooltip.titleColor         = '#fff'
Chart.defaults.plugins.tooltip.bodyColor          = '#e2e8f0'
Chart.defaults.plugins.tooltip.cornerRadius       = 8

const props = defineProps({
  config: { type: Object, required: true },
  size:   { type: String, default: '' } // '', 'sm', 'lg', 'xl'
})

const canvas = ref(null)
let instance = null

function draw() {
  if (instance) { instance.destroy(); instance = null }
  if (!canvas.value || !props.config) return
  instance = new Chart(canvas.value.getContext('2d'), props.config)
}

onMounted(() => nextTick(draw))
watch(() => props.config, () => nextTick(draw), { deep: true })
onBeforeUnmount(() => { if (instance) instance.destroy() })
</script>

<template>
  <div class="chart-box" :class="size">
    <canvas ref="canvas"></canvas>
  </div>
</template>