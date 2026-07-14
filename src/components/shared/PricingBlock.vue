<script setup lang="ts">
import { computed, ref } from "vue";
import type { Lot } from "@/types/lot";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import { useI18n } from "@/composables/useI18n";
import { fmtSom, fmtNum } from "@/lib/formatters";

// Hisob-kitob YO'Q: hamma qiymatlar backenddan tayyor keladi (lot.pricing, UZS).
// "unit" rejimida jami summalar miqdorga bo'lib KO'RSATILADI (formatlash, hisob emas).
const props = defineProps<{
  lot: Lot;
}>();

const { t } = useI18n();

const p = computed(() => props.lot.pricing);

/** Ko'rsatish rejimi: 1 dona narxlari yoki miqdor bo'yicha jami. */
const mode = ref<"unit" | "total">("unit");

const qty = computed(() => (p.value.qty > 0 ? p.value.qty : 1));

/**
 * Jami qiymatni rejimga moslaydi. Aniq birlik qiymat backendda bor bo'lsa
 * (narxlar) o'shani ishlatamiz; yo'g'ida (komissiya/soliq/foyda) jami/miqdor.
 */
const scaled = (total: number, exactUnit?: number): number =>
  mode.value === "unit"
    ? (exactUnit ?? Math.round(total / qty.value))
    : total;

const VIAB: Record<string, { cls: string; labelKey: string; icon: string }> = {
  good: { cls: "good", labelKey: "lotCard.viab.good", icon: "trendUp" },
  edge: { cls: "edge", labelKey: "lotCard.viab.edge", icon: "alert" },
  bad: { cls: "bad", labelKey: "lotCard.viab.bad", icon: "x" },
};
</script>

<template>
  <div class="panel">
    <div v-if="!p.available" class="pricing-empty">
      <BaseIcon
        name="alert"
        :style="{ width: '16px', height: '16px', opacity: 0.5 }"
      />
      {{ t("pricing.unavailable") }}
    </div>
    <template v-else>
      <!-- Rejim tanlagich: 1 dona / miqdor bo'yicha jami (qty=1 da ma'nosiz — yashirin) -->
      <div v-if="qty > 1" class="pb-head">
        <div class="pb-mode" role="tablist">
          <button
            type="button"
            :class="['pb-mode-btn', { on: mode === 'unit' }]"
            @click="mode = 'unit'"
          >
            {{ t("pricing.mode.unit") }}
          </button>
          <button
            type="button"
            :class="['pb-mode-btn', { on: mode === 'total' }]"
            @click="mode = 'total'"
          >
            {{ t("pricing.mode.total", { qty: fmtNum(qty), unit: lot.unit }) }}
          </button>
        </div>
      </div>

      <!-- Asosiy 3 maydon -->
      <div class="pricing-summary">
        <div class="ps-cell">
          <div class="ps-label">{{ t("pricing.summary.max") }}</div>
          <div class="ps-value mono">
            {{ fmtSom(scaled(p.maxPrice, p.startUnit)) }}
            <span class="ps-cur">{{ t("currency.som") }}</span>
          </div>
          <div v-if="qty > 1" class="ps-sub mono">
            <template v-if="mode === 'unit'"
              >{{ t("pricing.summary.total") }} ({{ fmtNum(qty) }}
              {{ lot.unit }}): {{ fmtSom(p.maxPrice) }}</template
            >
            <template v-else
              >{{ t("pricing.summary.unit") }}:
              {{ fmtSom(p.startUnit) }}</template
            >
          </div>
        </div>
        <div class="ps-cell">
          <div class="ps-label">{{ t("pricing.summary.supplier") }}</div>
          <div class="ps-value mono">
            {{ fmtSom(scaled(p.costTotal, p.unitCost)) }}
            <span class="ps-cur">{{ t("currency.som") }}</span>
          </div>
          <div
            v-if="p.currency === 'USD' || qty > 1"
            class="ps-sub mono"
          >
            <template v-if="p.currency === 'USD'"
              >{{ fmtNum(p.unitCostSource) }} $ ×
              {{ fmtNum(p.exchangeRate ?? 0)
              }}<template v-if="qty > 1 && mode === 'unit'">
                · {{ t("pricing.summary.total") }}:
                {{ fmtSom(p.costTotal) }}</template
              ></template
            >
            <template v-else-if="mode === 'unit'"
              >{{ t("pricing.summary.total") }}:
              {{ fmtSom(p.costTotal) }}</template
            >
            <template v-else
              >{{ t("pricing.summary.unit") }}:
              {{ fmtSom(p.unitCost) }}</template
            >
          </div>
        </div>
        <div class="ps-cell accent">
          <div class="ps-label">{{ t("pricing.summary.bid") }}</div>
          <div class="ps-value mono">
            {{ fmtSom(scaled(p.bidTotal, p.bidUnit)) }}
            <span class="ps-cur">{{ t("currency.som") }}</span>
          </div>
          <div v-if="qty > 1" class="ps-sub mono">
            <template v-if="mode === 'unit'"
              >{{ t("pricing.summary.total") }}:
              {{ fmtSom(p.bidTotal) }}</template
            >
            <template v-else
              >{{ t("pricing.summary.unit") }}:
              {{ fmtSom(p.bidUnit) }}</template
            >
          </div>
        </div>
      </div>

      <!-- Hisob-kitob jadvali (rejimga mos) -->
      <div class="price-grid">
        <div class="price-row">
          <span class="pr-label">
            {{ t("pricing.maxPriceLabel") }}
          </span>
          <span class="pr-val mono">{{
            fmtSom(scaled(p.maxPrice, p.startUnit))
          }}</span>
        </div>
        <div class="price-row">
          <span class="pr-label">
            {{ t("pricing.ourBidLabel") }}
            <span v-if="mode === 'total'" class="pr-sub"
              >{{ fmtNum(qty) }} {{ lot.unit }} ×
              {{ fmtSom(p.bidUnit) }}</span
            >
          </span>
          <span class="pr-val mono">{{
            fmtSom(scaled(p.bidTotal, p.bidUnit))
          }}</span>
        </div>
        <div class="price-row minus">
          <span class="pr-label">
            {{ t("pricing.costLabel") }}
            <span v-if="p.currency === 'USD'" class="pr-sub"
              >{{ fmtNum(p.unitCostSource) }} $ ×
              {{ fmtNum(p.exchangeRate ?? 0)
              }}<template v-if="mode === 'total'">
                × {{ fmtNum(qty) }}</template
              ></span
            >
          </span>
          <span class="pr-val mono"
            >− {{ fmtSom(scaled(p.costTotal, p.unitCost)) }}</span
          >
        </div>
        <div class="price-row minus">
          <span class="pr-label">
            <BaseIcon
              name="shield"
              :style="{ width: '14px', height: '14px', opacity: 0.6 }"
            />
            {{ t("pricing.feeLabel") }}
            <span class="pr-sub">{{
              p.feesSource === "uzex"
                ? t("pricing.feeSubLive")
                : t("pricing.feeSub")
            }}</span>
          </span>
          <span class="pr-val mono">− {{ fmtSom(scaled(p.fee)) }}</span>
        </div>
        <div v-if="p.taxAmount > 0" class="price-row minus">
          <span class="pr-label">{{ t("pricing.taxLabel") }}</span>
          <span class="pr-val mono">− {{ fmtSom(scaled(p.taxAmount)) }}</span>
        </div>
        <div class="price-row frozen">
          <span class="pr-label">
            <BaseIcon
              name="shield"
              :style="{ width: '14px', height: '14px', opacity: 0.6 }"
            />
            {{ t("pricing.frozenLabel") }}
            <span class="pr-sub">{{
              p.feesSource === "uzex"
                ? p.isDumping
                  ? t("pricing.frozenSubLiveDumping")
                  : t("pricing.frozenSubLive")
                : p.isDumping
                  ? t("pricing.frozenSubDumping")
                  : t("pricing.frozenSub")
            }}</span>
          </span>
          <span class="pr-val mono">{{ fmtSom(scaled(p.totalFrozen)) }}</span>
        </div>
        <div :class="['price-row', 'total', p.net >= 0 ? 'good' : 'bad']">
          <span class="pr-label">
            {{ t("pricing.netProfitLabel") }}
            <span :class="['margin-tag', p.verdict]">
              {{ p.net >= 0 ? "+" : "" }}{{ p.netPct.toFixed(1) }}%
            </span>
          </span>
          <span class="pr-val mono">
            {{ p.net >= 0 ? "" : "− " }}{{ fmtSom(Math.abs(scaled(p.net))) }}
            {{ t("currency.som") }}
          </span>
        </div>
        <div v-if="p.bidUnit < p.startUnit" class="price-row at-start">
          <span class="pr-label">
            {{ t("pricing.netAtStartLabel") }}
            <span class="pr-sub">{{ t("pricing.netAtStartSub") }}</span>
          </span>
          <span class="pr-val mono">
            {{ p.netAtStart >= 0 ? "+" : "− "
            }}{{ fmtSom(Math.abs(scaled(p.netAtStart))) }}
            {{ t("currency.som") }}
          </span>
        </div>
      </div>
      <div :class="['viab-banner', VIAB[p.verdict].cls]">
        <div class="vb-icon">
          <BaseIcon :name="VIAB[p.verdict].icon" />
        </div>
        <div class="vb-text">
          <div class="vb-title">
            {{
              p.verdict === "good"
                ? t("pricing.verdict.good.title")
                : p.verdict === "edge"
                  ? t("pricing.verdict.edge.title")
                  : t("pricing.verdict.bad.title")
            }}
          </div>
          <div class="vb-sub">
            <template v-if="p.verdict === 'good'">
              {{
                t("pricing.verdict.good.sub", {
                  pct: p.discountPct.toFixed(1),
                })
              }}
            </template>
            <template v-else-if="p.verdict === 'edge'">
              {{ t("pricing.verdict.edge.sub") }}
            </template>
            <template v-else>
              {{ t("pricing.verdict.bad.sub") }}
            </template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pricing-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  font-size: 13px;
  color: var(--ink-3);
}

/* Rejim tanlagich (segmented control) */
.pb-head {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px 0;
}
.pb-mode {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  background: var(--surface-3);
  border-radius: var(--radius-sm);
}
.pb-mode-btn {
  border: 0;
  background: transparent;
  padding: 5px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-3);
  border-radius: calc(var(--radius-sm) - 3px);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.pb-mode-btn:hover {
  color: var(--ink-2);
}
.pb-mode-btn.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}

/* Asosiy 3 maydon — tor joyda 2+1 bo'lib o'raladi, qiymat hech qachon kesilmaydi */
.pricing-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
  gap: 10px;
  padding: 12px 16px;
}
.ps-cell {
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  min-width: 0;
}
.ps-cell.accent {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  /* Qaror raqami — doim to'liq qator: ataylab ajralib turadi */
  grid-column: 1 / -1;
}
.ps-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ink-3);
  margin-bottom: 6px;
  line-height: 1.4;
}
.ps-cell.accent .ps-label {
  color: var(--accent-ink);
}
.ps-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ps-cell.accent .ps-value {
  color: var(--accent-ink);
}
.ps-cur {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--ink-3);
}
.ps-cell.accent .ps-cur {
  color: var(--accent-ink);
  opacity: 0.75;
}
.ps-sub {
  margin-top: 4px;
  font-size: 11px;
  color: var(--ink-4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Ma'lumot qatorlari: muzlatish (qaytariladi) va startdagi foyda — xarajat emas */
.price-row.frozen .pr-val,
.price-row.frozen .pr-label {
  opacity: 0.75;
}
.price-row.at-start .pr-val,
.price-row.at-start .pr-label {
  opacity: 0.75;
  font-style: italic;
}

</style>
