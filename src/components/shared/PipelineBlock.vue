<script setup lang="ts">
import { ref } from "vue";

import type { Lot } from "@/types/lot";
import BaseIcon from "@/components/shared/BaseIcon.vue";
import SupplierModal from "@/components/shared/SupplierModal.vue";
import { useI18n } from "@/composables/useI18n";
import { fmtNum } from "@/lib/formatters";

const props = defineProps<{
  lot: Lot;
}>();

const { t } = useI18n();

/** Bosilgan ta'minotchi id si — markazda modal ochish uchun (null bo'lsa yopiq). */
const openSupplierId = ref<string | null>(null);

const LLM_MAP: Record<string, { labelKey: string; cls: string; icon: string }> = {
  verified: { labelKey: "pipeline.llm.verified", cls: "good", icon: "check" },
  partial: { labelKey: "pipeline.llm.partial", cls: "warn", icon: "alert" },
  rejected: { labelKey: "pipeline.llm.rejected", cls: "bad", icon: "x" },
};
</script>

<template>
  <div class="panel">
    <div class="pipe">
      <div class="pipe-stage">
        <div class="ps-num">{{ t("pipeline.stage1.num") }}</div>
        <div class="ps-name">
          <BaseIcon
            name="vector"
            :style="{ width: '15px', height: '15px', color: 'var(--accent)' }"
          />
          {{ t("pipeline.stage1.name") }}
        </div>
        <div class="ps-desc">
          {{ t("pipeline.stage1.desc") }}
        </div>
        <div class="pipe-score">
          <span class="psv" style="color: var(--accent-ink)">{{
            lot.match.vector.toFixed(2)
          }}</span>
          <span class="psu"
            >{{ t("pipeline.stage1.unit") }} ·
            {{ Math.round(lot.match.vector * 100) }}%</span
          >
        </div>
        <div class="meter">
          <span
            :style="{
              width: Math.round(lot.match.vector * 100) + '%',
              background: 'var(--accent)',
            }"
          />
        </div>
      </div>
      <div class="pipe-stage">
        <div class="ps-num">{{ t("pipeline.stage2.num") }}</div>
        <div class="ps-name">
          <BaseIcon
            name="cpu"
            :style="{ width: '15px', height: '15px', color: 'var(--accent)' }"
          />
          {{ t("pipeline.stage2.name") }}
        </div>
        <div class="ps-desc">
          {{ t("pipeline.stage2.desc") }}
        </div>
        <div style="margin-top: 11px">
          <span
            class="verdict-pill"
            :style="{
              background: `var(--${LLM_MAP[lot.match.llm].cls}-soft)`,
              color: `var(--${LLM_MAP[lot.match.llm].cls}-ink)`,
              border: `1px solid var(--${LLM_MAP[lot.match.llm].cls}-line)`,
            }"
          >
            <BaseIcon :name="LLM_MAP[lot.match.llm].icon" />
            {{ t(LLM_MAP[lot.match.llm].labelKey) }}
          </span>
        </div>
        <div class="meter" style="margin-top: 16px">
          <span
            :style="{
              width: lot.match.overall + '%',
              background: `var(--${LLM_MAP[lot.match.llm].cls})`,
            }"
          />
        </div>
      </div>
    </div>

    <div class="stock-row">
      <div class="stock-ph"><div class="ph-stripe" /></div>
      <div class="stock-info">
        <div class="si-name">{{ lot.match.stock.name }}</div>
        <div class="si-code">{{ lot.match.stock.code }}</div>
        <!-- ta'minotchi badge (supplier-based matching) — supplierId bo'lsa
             bosilganda markazda ma'lumot modali ochiladi, bo'lmasa oddiy badge -->
        <component
          :is="lot.match.stock.supplierId ? 'button' : 'span'"
          v-if="lot.match.stock.supplier"
          type="button"
          class="supplier-badge"
          :class="{ 'is-link': lot.match.stock.supplierId }"
          @click.stop="
            lot.match.stock.supplierId &&
              (openSupplierId = lot.match.stock.supplierId)
          "
        >
          <BaseIcon name="store" />
          <span class="sb-label">{{ t("pipeline.supplierLabel") }}</span>
          <span class="sb-name">{{ lot.match.stock.supplier }}</span>
        </component>
      </div>
      <!-- ta'minotchi yo'q (klassik stok matching) — zaxira miqdori o'ngda -->
      <div v-if="!lot.match.stock.supplier" class="stock-avail">
        <div class="sa-v num">{{ fmtNum(lot.match.stock.avail) }}</div>
        <div class="sa-l">
          {{ lot.match.stock.unit }} {{ t("pipeline.inStock") }}
        </div>
      </div>
    </div>

    <div class="reason">
      <div class="r-mark"><BaseIcon name="sparkle" /></div>
      <div class="r-body">
        <div class="r-head">{{ t("pipeline.aiConclusion") }}</div>
        <div class="r-text">{{ lot.match.reasoning }}</div>
      </div>
    </div>

    <SupplierModal
      v-if="openSupplierId"
      :supplier-id="openSupplierId"
      :fallback-name="lot.match.stock.supplier"
      @close="openSupplierId = null"
    />
  </div>
</template>
