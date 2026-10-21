<script setup>
import { ref, computed, watch } from 'vue'
import Pagination from './Pagination.vue'
import EmptyState from './EmptyState.vue'

const props = defineProps({
  columns: {
    type: Array,
    required: true
    /* each column:
       { key, label, sortable?: boolean, align?: 'right', width?: string } */
  },
  rows:           { type: Array,   default: () => [] },
  emptyIcon:      { type: String,  default: 'inbox' },
  emptyTitle:     { type: String,  default: 'No records found' },
  emptyText:      { type: String,  default: '' },
  rowKey:         { type: String,  default: 'id' },
  initialSortKey: { type: String,  default: '' },
  initialSortDir: { type: String,  default: 'asc' },
  pageSize:       { type: Number,  default: 10 },
  pageSizeOptions:{ type: Array,   default: () => [10, 25, 50, 100] }
})

const page     = ref(1)
const _pageSize = ref(props.pageSize)
const sortKey  = ref(props.initialSortKey)
const sortDir  = ref(props.initialSortDir)

/* ---------------- sorting ---------------- */
const sortedRows = computed(() => {
  if (!sortKey.value) return props.rows
  const k = sortKey.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const va = a[k], vb = b[k]
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va ?? '').localeCompare(String(vb ?? '')) * dir
  })
})

/* ---------------- paging ---------------- */
const pageRows = computed(() => {
  const start = (page.value - 1) * _pageSize.value
  return sortedRows.value.slice(start, start + _pageSize.value)
})

/* ---------------- interactions ---------------- */
function toggleSort(col) {
  if (col.sortable === false) return
  if (sortKey.value === col.key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = col.key
    sortDir.value = 'asc'
  }
}
function sortClassFor(col) {
  if (sortKey.value !== col.key) return ''
  return sortDir.value === 'asc' ? 'sort-asc' : 'sort-desc'
}
function onSize(v) { _pageSize.value = v; page.value = 1 }

function keyOf(row, i) {
  return row[props.rowKey] ?? i
}

/* Reset to page 1 when rows change */
watch(() => props.rows, () => { page.value = 1 }, { deep: false })
</script>

<template>
  <div class="card">
    <!-- optional toolbar slot -->
    <div v-if="$slots.toolbar" class="tbl-toolbar">
      <slot name="toolbar" />
    </div>

    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              :class="[
                c.sortable !== false && 'sortable',
                sortClassFor(c),
                c.align === 'right' && 'num'
              ]"
              :style="c.width ? { width: c.width } : null"
              @click="toggleSort(c)"
            >{{ c.label }}</th>
          </tr>
        </thead>

        <tbody>
          <tr v-if="!pageRows.length">
            <td :colspan="columns.length">
              <EmptyState
                :icon="emptyIcon"
                :title="emptyTitle"
                :text="emptyText"
              />
            </td>
          </tr>

          <tr v-for="(row, i) in pageRows" :key="keyOf(row, i)">
            <td
              v-for="c in columns"
              :key="c.key"
              :class="c.align === 'right' && 'num'"
            >
              <slot :name="c.key" :row="row" :value="row[c.key]">
                {{ row[c.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Pagination
      v-model:page="page"
      v-model:page-size="_pageSize"
      :total="sortedRows.length"
      :sizes="pageSizeOptions"
    />
  </div>
</template>