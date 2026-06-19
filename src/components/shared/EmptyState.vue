<script setup lang="ts">
import BaseIcon from '@/components/shared/BaseIcon.vue'

defineProps<{
  icon: string
  title: string
  description: string
}>()
</script>

<template>
  <div class="empty">
    <div class="empty-mark"><BaseIcon :name="icon" /></div>
    <div>
      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
  </div>
</template>
