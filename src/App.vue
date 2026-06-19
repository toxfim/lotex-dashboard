<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
import ToastContainer from '@/components/shared/ToastContainer.vue'
</script>

<template>
  <div class="app">
    <AppSidebar />
    <div class="main">
      <RouterView />
    </div>
    <ToastContainer />
  </div>
</template>
