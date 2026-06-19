<script setup lang="ts">
import { compactSom } from '@/lib/formatters'

const props = defineProps<{
  data: { name: string; value: number; color: string }[]
}>()

const max = Math.max(...props.data.map(d => d.value))
</script>

<template>
  <div class="hbars">
    <div v-for="d in data" :key="d.name" class="hbar-row">
      <div class="hbar-name">{{ d.name }}</div>
      <div class="hbar-track">
        <div class="hbar-fill" :style="{ width: (d.value / max) * 100 + '%', background: d.color }" />
      </div>
      <div class="hbar-val">{{ compactSom(d.value) }}</div>
    </div>
  </div>
</template>
