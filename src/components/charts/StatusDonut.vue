<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  counts: { pending: number; accepted: number; rejected: number };
}>();

const total = computed(
  () =>
    props.counts.pending + props.counts.accepted + props.counts.rejected || 1,
);
const a = computed(() => (props.counts.accepted / total.value) * 100);
const r = computed(() => (props.counts.rejected / total.value) * 100);
const gradient = computed(
  () =>
    `conic-gradient(var(--good) 0 ${a.value}%, var(--bad) ${a.value}% ${a.value + r.value}%, var(--warn) ${a.value + r.value}% 100%)`,
);

const segs = computed(() => [
  {
    color: "var(--good)",
    label: "Qabul qilingan",
    count: props.counts.accepted,
  },
  { color: "var(--bad)", label: "Rad etilgan", count: props.counts.rejected },
  { color: "var(--warn)", label: "Kutilmoqda", count: props.counts.pending },
]);
</script>

<template>
  <div class="donut-wrap">
    <div class="donut" :style="{ background: gradient }">
      <div class="donut-center">
        <div class="dc-v num">{{ total }}</div>
        <div class="dc-l">jami lot</div>
      </div>
    </div>
    <div class="donut-legend">
      <div v-for="s in segs" :key="s.label" class="dl-item">
        <span class="dl-dot" :style="{ background: s.color }" />
        <span class="dl-name">{{ s.label }}</span>
        <span class="dl-v num">{{ s.count }}</span>
      </div>
    </div>
  </div>
</template>
