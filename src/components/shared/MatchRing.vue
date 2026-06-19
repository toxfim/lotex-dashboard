<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  value: number
  size?: number
}>(), {
  size: 42,
})

const r = computed(() => (props.size - 6) / 2)
const c = computed(() => 2 * Math.PI * r.value)
const offset = computed(() => c.value - (props.value / 100) * c.value)
const color = computed(() => {
  if (props.value >= 90) return 'var(--good)'
  if (props.value >= 75) return 'var(--accent)'
  if (props.value >= 55) return 'var(--warn)'
  return 'var(--bad)'
})
</script>

<template>
  <div class="ring" :style="{ width: size + 'px', height: size + 'px' }">
    <svg :viewBox="`0 0 ${size} ${size}`">
      <circle
        class="ring-bg"
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        stroke-width="3.5"
      />
      <circle
        class="ring-fg"
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        stroke-width="3.5"
        :stroke="color"
        :stroke-dasharray="c"
        :stroke-dashoffset="offset"
      />
    </svg>
    <span class="ring-val" :style="{ color }">{{ value }}</span>
  </div>
</template>
