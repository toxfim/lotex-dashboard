<script setup lang="ts">
import type { DayDecision } from "@/types/stock";

const props = defineProps<{
  data: DayDecision[];
}>();

const max = Math.max(...props.data.map((d) => d.accepted + d.rejected));
</script>

<template>
  <div>
    <div class="bars">
      <div v-for="d in data" :key="d.day" class="bar-col">
        <div
          class="bar-stack"
          :style="{ height: ((d.accepted + d.rejected) / max) * 100 + '%' }"
        >
          <div
            class="bar-seg"
            :style="{
              height: (d.rejected / (d.accepted + d.rejected)) * 100 + '%',
              background: 'var(--bad)',
            }"
          />
          <div
            class="bar-seg"
            :style="{
              height: (d.accepted / (d.accepted + d.rejected)) * 100 + '%',
              background: 'var(--good)',
            }"
          />
        </div>
        <div class="bar-label">{{ d.day }}</div>
      </div>
    </div>
    <div class="chart-legend" style="margin-top: 14px">
      <span class="lg-item"
        ><span class="lg-dot" style="background: var(--good)" />Qabul
        qilingan</span
      >
      <span class="lg-item"
        ><span class="lg-dot" style="background: var(--bad)" />Rad etilgan</span
      >
    </div>
  </div>
</template>
