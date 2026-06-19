<script setup lang="ts">
import type { Lot } from "@/types/lot";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import MatchRing from "@/components/shared/MatchRing.vue";
import { compactSom, deadline } from "@/lib/formatters";

const props = defineProps<{
  lot: Lot;
  selected?: boolean;
  leaving?: boolean;
}>();

defineEmits<{
  click: [];
}>();

const VIAB: Record<string, { cls: string; label: string; icon: string }> = {
  good: { cls: "good", label: "Foydali", icon: "trendUp" },
  edge: { cls: "edge", label: "Chegarada", icon: "alert" },
  bad: { cls: "bad", label: "Foydasiz", icon: "x" },
};
</script>

<template>
  <div
    :class="['lot-card', { sel: selected, leaving }]"
    @click="$emit('click')"
  >
    <div class="lc-top">
      <div style="min-width: 0">
        <div class="lc-cat">{{ lot.category }}</div>
        <div class="lc-title">{{ lot.title }}</div>
      </div>
      <MatchRing :value="lot.match.overall" />
    </div>
    <div class="lc-cust">
      <BaseIcon name="building" />
      <span>{{ lot.customer }}</span>
    </div>
    <div class="lc-foot">
      <span class="chip"
        ><BaseIcon name="coins" />{{ compactSom(lot.maxPrice) }} so'm</span
      >
      <span :class="['chip', VIAB[lot.pricing.verdict].cls]">
        <BaseIcon :name="VIAB[lot.pricing.verdict].icon" />{{
          VIAB[lot.pricing.verdict].label
        }}
      </span>
      <span
        v-if="!deadline(lot.deadlineH).closed"
        :class="['chip', { bad: deadline(lot.deadlineH).urgent }]"
        style="margin-left: auto"
      >
        <BaseIcon name="clock" />{{ deadline(lot.deadlineH).text }}
      </span>
      <span v-else class="chip" style="margin-left: auto">
        <BaseIcon name="clock" />Yopilgan
      </span>
    </div>
  </div>
</template>
