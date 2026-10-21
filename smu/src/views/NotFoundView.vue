<template>
  <div class="auth-wrap">
    <div class="auth-card" style="text-align:center">
      <h2 style="font-size:22px;margin-bottom:6px">Page not found</h2>
      <p class="auth-sub">This page doesn't exist.</p>
      <RouterLink to="/dashboard" class="btn btn-primary" style="justify-content:center">
        Back to Dashboard
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'
</script>