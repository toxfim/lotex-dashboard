<script setup lang="ts">
import { ref } from "vue";
import type { Lot } from "@/types/lot";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import MatchRing from "@/components/shared/MatchRing.vue";
import { api } from "@/lib/api";
import { compactSom, deadline } from "@/lib/formatters";
import { useI18n } from "@/composables/useI18n";

const props = defineProps<{
  lot: Lot;
  selected?: boolean;
  leaving?: boolean;
}>();

// Rasmsiz lotlarda backend 404 qaytaradi — thumbnailni yashiramiz.
// Kartochka `:key="lot.id"` bilan render bo'lgani uchun lot almashganda tiklanadi.
const isImageVisible = ref(true);

defineEmits<{
  click: [];
}>();

const { t } = useI18n();

const VIAB: Record<string, { cls: string; labelKey: string; icon: string }> = {
  good: { cls: "good", labelKey: "lotCard.viab.good", icon: "trendUp" },
  edge: { cls: "edge", labelKey: "lotCard.viab.edge", icon: "alert" },
  bad: { cls: "bad", labelKey: "lotCard.viab.bad", icon: "x" },
};
</script>

<template>
  <div
    :class="['lot-card', { sel: selected, leaving }]"
    @click="$emit('click')"
  >
    <div class="lc-top">
      <div v-if="isImageVisible" class="lc-thumb">
        <img
          :src="api.lotImageUrl(lot.id, 'average')"
          alt=""
          loading="lazy"
          @error="isImageVisible = false"
        />
      </div>
      <div style="min-width: 0; flex: 1">
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
        ><BaseIcon name="coins" />{{ compactSom(lot.maxPrice) }}
        {{ t("currency.som") }}</span
      >
      <span :class="['chip', VIAB[lot.pricing.verdict].cls]">
        <BaseIcon :name="VIAB[lot.pricing.verdict].icon" />{{
          t(VIAB[lot.pricing.verdict].labelKey)
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
        <BaseIcon name="clock" />{{ t("time.closed") }}
      </span>
    </div>
  </div>
</template>
