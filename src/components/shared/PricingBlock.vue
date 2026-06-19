<script setup lang="ts">
import type { Lot } from "@/types/lot";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { fmtSom, fmtNum, computePricing } from "@/lib/formatters";

const props = defineProps<{
  lot: Lot;
}>();

const VIAB: Record<string, { cls: string; label: string; icon: string }> = {
  good: { cls: "good", label: "Foydali", icon: "trendUp" },
  edge: { cls: "edge", label: "Chegarada", icon: "alert" },
  bad: { cls: "bad", label: "Foydasiz", icon: "x" },
};
</script>

<template>
  <div class="panel">
    <div class="price-grid">
      <div class="price-row">
        <span class="pr-label">
          Tender maksimal narxi
          <span class="pr-sub"
            >/ {{ fmtSom(lot.pricing.maxPrice / lot.pricing.qty) }} so'm
            birlik</span
          >
        </span>
        <span class="pr-val mono">{{ fmtSom(lot.pricing.maxPrice) }}</span>
      </div>
      <div class="price-row">
        <span class="pr-label">
          Bizning taklif narxi
          <span class="pr-sub"
            >{{ fmtNum(lot.pricing.qty) }} {{ lot.unit }} ×
            {{ fmtSom(lot.pricing.bidUnit) }}</span
          >
        </span>
        <span class="pr-val mono">{{
          fmtSom(computePricing(lot.pricing).bidTotal)
        }}</span>
      </div>
      <div class="price-row minus">
        <span class="pr-label">
          Tannarx (zaxiradan)
          <span class="pr-sub"
            >{{ fmtSom(lot.pricing.unitCost) }} ×
            {{ fmtNum(lot.pricing.qty) }}</span
          >
        </span>
        <span class="pr-val mono"
          >− {{ fmtSom(computePricing(lot.pricing).costTotal) }}</span
        >
      </div>
      <div class="price-row minus">
        <span class="pr-label">
          <BaseIcon
            name="shield"
            :style="{ width: '14px', height: '14px', opacity: 0.6 }"
          />
          Ishtirok kafolati / to'lov
        </span>
        <span class="pr-val mono">− {{ fmtSom(lot.pricing.fee) }}</span>
      </div>
      <div
        :class="[
          'price-row',
          'total',
          computePricing(lot.pricing).net >= 0 ? 'good' : 'bad',
        ]"
      >
        <span class="pr-label">
          Sof foyda
          <span :class="['margin-tag', lot.pricing.verdict]">
            {{ computePricing(lot.pricing).net >= 0 ? "+" : ""
            }}{{ computePricing(lot.pricing).netPct.toFixed(1) }}%
          </span>
        </span>
        <span class="pr-val mono">
          {{ computePricing(lot.pricing).net >= 0 ? "" : "− "
          }}{{ fmtSom(Math.abs(computePricing(lot.pricing).net)) }} so'm
        </span>
      </div>
    </div>
    <div :class="['viab-banner', VIAB[lot.pricing.verdict].cls]">
      <div class="vb-icon">
        <BaseIcon :name="VIAB[lot.pricing.verdict].icon" />
      </div>
      <div class="vb-text">
        <div class="vb-title">
          {{ VIAB[lot.pricing.verdict].label
          }}{{
            lot.pricing.verdict === "good"
              ? " — ishtirok tavsiya etiladi"
              : lot.pricing.verdict === "edge"
                ? " — diqqat bilan ko'rib chiqing"
                : " — ishtirok tavsiya etilmaydi"
          }}
        </div>
        <div class="vb-sub">
          <template v-if="lot.pricing.verdict === 'good'">
            Taklif narxi maksimaldan
            {{
              (
                100 -
                (computePricing(lot.pricing).bidTotal / lot.pricing.maxPrice) *
                  100
              ).toFixed(1)
            }}% past, marja barqaror.
          </template>
          <template v-else-if="lot.pricing.verdict === 'edge'">
            Marja past — narx yoki tannarxdagi kichik o'zgarish foydani
            yo'qotishi mumkin.
          </template>
          <template v-else>
            Tannarx va to'lovlar bilan ishtirok zarar keltiradi.
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
