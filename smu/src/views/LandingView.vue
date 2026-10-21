<script setup>
import { RouterLink } from 'vue-router'
const year = new Date().getFullYear()
</script>

<template>
  <div class="landing-wrap">
    <div class="landing-nav">
      <div class="brand">
        <div class="logo-mark"><i class="bi bi-mortarboard-fill"></i></div>
        <div>
          <b>ST. MARY'S UNIVERSITY</b>
          <span>Teacher Monitoring System</span>
        </div>
      </div>
      <RouterLink to="/login" class="btn-hero ghost">
        <i class="bi bi-box-arrow-in-right"></i> Sign In
      </RouterLink>
    </div>

    <div class="landing-hero">
      <h1>Teacher Attendance &amp; Performance Monitoring System</h1>
      <p class="sub">
        A centralized platform that digitizes daily classroom reporting, automates
        consecutive-absence alerts, and provides role-specific dashboards for class
        representatives, teachers, department heads, and administrators.
      </p>
      <div class="actions">
        <RouterLink to="/login" class="btn-hero primary">
          <i class="bi bi-box-arrow-in-right"></i> Sign In to Portal
        </RouterLink>
      </div>
    </div>

    <div class="landing-features">
      <div class="landing-feature">
        <div class="ico"><i class="bi bi-pencil-square"></i></div>
        <h4>Daily Digital Reporting</h4>
        <p>Class representatives submit attendance and performance ratings in seconds.</p>
      </div>
      <div class="landing-feature">
        <div class="ico"><i class="bi bi-bell-fill"></i></div>
        <h4>Automated Alerts</h4>
        <p>3+ consecutive Red ratings notify the Department Head; 5+ escalate to Admin.</p>
      </div>
      <div class="landing-feature">
        <div class="ico"><i class="bi bi-graph-up-arrow"></i></div>
        <h4>Role-Based Dashboards</h4>
        <p>Every stakeholder sees the analytics they need — from personal to cross-departmental.</p>
      </div>
      <div class="landing-feature">
        <div class="ico"><i class="bi bi-shield-check"></i></div>
        <h4>Fair &amp; Transparent</h4>
        <p>Formal dispute mechanism and a full audit trail for accountability.</p>
      </div>
    </div>

    <div class="landing-foot">
      © {{ year }} St. Mary's University · Teacher Attendance &amp; Performance Monitoring
    </div>
  </div>
</template>