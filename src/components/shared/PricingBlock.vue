<script setup lang="ts">
import type { Lot } from "@/types/lot";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useI18n } from "@/composables/useI18n";
import { fmtSom, fmtNum, computePricing } from "@/lib/formatters";

const props = defineProps<{
  lot: Lot;
}>();

const { t } = useI18n();

const VIAB: Record<string, { cls: string; labelKey: string; icon: string }> = {
  good: { cls: "good", labelKey: "lotCard.viab.good", icon: "trendUp" },
  edge: { cls: "edge", labelKey: "lotCard.viab.edge", icon: "alert" },
  bad: { cls: "bad", labelKey: "lotCard.viab.bad", icon: "x" },
};
</script>

<template>
  <div class="panel">
    <div class="price-grid">
      <div class="price-row">
        <span class="pr-label">
          {{ t("pricing.maxPriceLabel") }}
          <span class="pr-sub"
            >/ {{ fmtSom(lot.pricing.maxPrice / lot.pricing.qty) }}
            {{ t("currency.som") }} {{ t("pricing.perUnitSuffix") }}</span
          >
        </span>
        <span class="pr-val mono">{{ fmtSom(lot.pricing.maxPrice) }}</span>
      </div>
      <div class="price-row">
        <span class="pr-label">
          {{ t("pricing.ourBidLabel") }}
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
          {{ t("pricing.costLabel") }}
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
          {{ t("pricing.feeLabel") }}
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
          {{ t("pricing.netProfitLabel") }}
          <span :class="['margin-tag', lot.pricing.verdict]">
            {{ computePricing(lot.pricing).net >= 0 ? "+" : ""
            }}{{ computePricing(lot.pricing).netPct.toFixed(1) }}%
          </span>
        </span>
        <span class="pr-val mono">
          {{ computePricing(lot.pricing).net >= 0 ? "" : "− "
          }}{{ fmtSom(Math.abs(computePricing(lot.pricing).net)) }}
          {{ t("currency.som") }}
        </span>
      </div>
    </div>
    <div :class="['viab-banner', VIAB[lot.pricing.verdict].cls]">
      <div class="vb-icon">
        <BaseIcon :name="VIAB[lot.pricing.verdict].icon" />
      </div>
      <div class="vb-text">
        <div class="vb-title">
          {{ t(VIAB[lot.pricing.verdict].labelKey)
          }}{{
            lot.pricing.verdict === "good"
              ? t("pricing.verdict.good.title")
              : lot.pricing.verdict === "edge"
                ? t("pricing.verdict.edge.title")
                : t("pricing.verdict.bad.title")
          }}
        </div>
        <div class="vb-sub">
          <template v-if="lot.pricing.verdict === 'good'">
            {{
              t("pricing.verdict.good.sub", {
                pct: (
                  100 -
                  (computePricing(lot.pricing).bidTotal /
                    lot.pricing.maxPrice) *
                    100
                ).toFixed(1),
              })
            }}
          </template>
          <template v-else-if="lot.pricing.verdict === 'edge'">
            {{ t("pricing.verdict.edge.sub") }}
          </template>
          <template v-else>
            {{ t("pricing.verdict.bad.sub") }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
