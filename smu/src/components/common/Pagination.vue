<script setup>
import { computed } from 'vue'

const props = defineProps({
  page:     { type: Number, default: 1 },
  pageSize: { type: Number, default: 10 },
  total:    { type: Number, default: 0 },
  sizes:    { type: Array,  default: () => [10, 25, 50, 100] }
})
const emit = defineEmits(['update:page', 'update:pageSize'])

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const start      = computed(() => props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1)
const end        = computed(() => Math.min(props.page * props.pageSize, props.total))

const pageList = computed(() => {
  const total = totalPages.value
  const page  = props.page
  const max   = 7
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1)
  const list = [1]
  if (page > 3) list.push('…')
  const from = Math.max(2, page - 1)
  const to   = Math.min(total - 1, page + 1)
  for (let i = from; i <= to; i++) list.push(i)
  if (page < total - 2) list.push('…')
  list.push(total)
  return list
})

function go(p) {
  if (p < 1 || p > totalPages.value || p === props.page) return
  emit('update:page', p)
}
function onSize(e) {
  emit('update:pageSize', +e.target.value)
  emit('update:page', 1)
}
</script>

<template>
  <div class="pagination-bar">
    <div class="pagination-info">
      Showing <b>{{ start }}–{{ end }}</b> of <b>{{ total }}</b> records
    </div>

    <div class="pagination-controls">
      <button :disabled="page === 1" title="Previous" @click="go(page - 1)">
        <i class="bi bi-chevron-left"></i>
      </button>

      <template v-for="(p, i) in pageList" :key="i">
        <span v-if="p === '…'" class="pagination-ellipsis">…</span>
        <button
          v-else
          :class="{ active: p === page }"
          :title="`Page ${p}`"
          @click="go(p)"
        >{{ p }}</button>
      </template>

      <button :disabled="page === totalPages" title="Next" @click="go(page + 1)">
        <i class="bi bi-chevron-right"></i>
      </button>

      <select class="page-size" :value="pageSize" @change="onSize">
        <option v-for="s in sizes" :key="s" :value="s">{{ s }} / page</option>
      </select>
    </div>
  </div>
</template>