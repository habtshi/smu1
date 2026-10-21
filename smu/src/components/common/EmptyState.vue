<script setup>
defineProps({
  icon:  { type: String, default: 'inbox' },
  title: { type: String, default: 'Nothing here' },
  text:  { type: String, default: '' }
})
</script>

<template>
  <div class="empty">
    <i :class="`bi bi-${icon}`"></i>
    <h5>{{ title }}</h5>
    <p v-if="text">{{ text }}</p>
    <slot />
  </div>
</template>