<script setup lang="ts">
import type { FunnelStage } from '@/types/stock'
import { fmtNum } from '@/lib/formatters'

const props = defineProps<{
  data: FunnelStage[]
}>()

const max = Math.max(...props.data.map(d => d.value))
</script>

<template>
  <div class="funnel">
    <div v-for="(d, i) in data" :key="d.label" class="funnel-row">
      <div
        class="funnel-bar"
        :style="{
          width: Math.max(30, (Math.log(d.value) / Math.log(max)) * 100) + '%',
          background: d.color,
        }"
      >
        <span class="num">{{ fmtNum(d.value) }}</span>
      </div>
      <div class="funnel-meta">
        {{ d.label }}
        <template v-if="i > 0"> · <b>{{ Math.round((d.value / data[i - 1].value) * 100) }}%</b></template>
      </div>
    </div>
  </div>
</template>
